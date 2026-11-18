import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync } from 'node:fs';
import path from 'node:path';
import { canonicalMemoryWorkspace } from './memory.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value : '';
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$/.test(value);
const ACTIVE = new Set(['running', 'queued']);
const ACTIONS = new Set(['peer_tasks_list', 'peer_task_get', 'artifact_publish', 'artifact_list', 'artifact_get']);
function validEvent(event) {
  if (!object(event) || !validId(event.id) || typeof event.workspace !== 'string' || !event.workspace || event.workspace.length > 4096 || !Number.isSafeInteger(event.sequence) || event.sequence <= 0 || !(event.sourceTaskId === null || validId(event.sourceTaskId)) || !(event.targetTaskId === null || validId(event.targetTaskId)) || !ACTIONS.has(event.action)) return false;
  if (Object.hasOwn(event, 'targetTaskIds')) {
    if (!Array.isArray(event.targetTaskIds) || event.targetTaskIds.length > 20 || !event.targetTaskIds.every(validId) || new Set(event.targetTaskIds).size !== event.targetTaskIds.length || event.targetTaskId !== (event.targetTaskIds[0] || null)) return false;
  }
  return true;
}
const finite = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
function integer(value, fallback, min, max) { const number = value ?? fallback; if (!Number.isInteger(number) || number < min || number > max) throw fail(400, 'Invalid collaboration range.'); return number; }
function query(value) { if (value !== undefined && (typeof value !== 'string' || value.length > 2000)) throw fail(400, 'Invalid collaboration query.'); return (value || '').trim().toLowerCase(); }
function publicTask(task) {
  const summary = [...(task.logs || [])].reverse().find(log => log?.type === 'status' && ['model-summary', 'model-estimate'].includes(log.source));
  const p = task.progress, progress = p && ['model-estimate', 'process'].includes(p.source) ? { source: p.source, ...(finite(p.percent, 100) ? { percent: p.percent } : {}), ...(finite(p.etaMinutes, 1440) ? { etaMinutes: p.etaMinutes } : {}), stage: text(p.stage).slice(0, 240), updatedAt: timestamp(p.updatedAt) } : null;
  return { id: task.id, title: text(task.title).slice(0, 240), departmentId: task.departmentId, departmentName: text(task.departmentName).slice(0, 160), provider: task.provider, modelId: text(task.modelId).slice(0, 200), reportedModel: text(task.reportedModel).slice(0, 200), status: task.status, workflowId: task.workflowId || null, dependsOn: (task.dependsOn || []).filter(validId).slice(0, 30), createdAt: timestamp(task.createdAt), startedAt: timestamp(task.startedAt), finishedAt: timestamp(task.finishedAt), progress, publicSummary: summary ? { text: text(summary.text).slice(0, 400), source: summary.source, timestamp: timestamp(summary.timestamp) } : null };
}
function metadata(artifact) { return { id: artifact.id, sequence: artifact.sequence, workspace: artifact.workspace, taskId: artifact.taskId, provider: artifact.provider, departmentId: artifact.departmentId, title: artifact.title, kind: artifact.kind, createdAt: artifact.createdAt, confidence: 'unverified', snippet: artifact.content.slice(0, 500), contentChars: artifact.content.length }; }

/** A project-scoped, append-only board. It never starts models or changes project files/memory. */
export function createCollaborationStore({ dataDir, getState = () => ({ tasks: [] }) }) {
  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'collaboration-board.json');
  let data = { version: 1, sequence: 0, artifacts: [], events: [] };
  if (existsSync(file)) {
    if (statSync(file).size > 64 * 1024 * 1024) throw fail(503, 'Collaboration board exceeds its storage limit.');
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      if (saved.version !== 1 || !Number.isSafeInteger(saved.sequence) || saved.sequence < 0 || !Array.isArray(saved.artifacts) || !Array.isArray(saved.events)) throw new Error();
      if (saved.artifacts.some(item => !object(item) || !validId(item.id) || !validId(item.taskId) || !Number.isSafeInteger(item.sequence) || typeof item.workspace !== 'string' || typeof item.title !== 'string' || item.title.length > 160 || typeof item.content !== 'string' || item.content.length > 8000 || !['note', 'finding', 'handoff', 'result'].includes(item.kind) || typeof item.idempotencyKey !== 'string')) throw new Error();
      if (!saved.events.every(validEvent)) throw new Error();
      data = saved;
    } catch { throw fail(503, 'Collaboration board could not be read. Existing data was not overwritten.'); }
  }
  function persist(next) {
    const encoded = JSON.stringify(next); if (Buffer.byteLength(encoded) > 64 * 1024 * 1024) throw fail(507, 'Collaboration storage limit reached.');
    const temporary = `${file}.${randomUUID()}.tmp`;
    try { writeFileSync(temporary, encoded, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); renameSync(temporary, file); data = next; }
    finally { if (existsSync(temporary)) unlinkSync(temporary); }
  }
  const tasksIn = workspace => (Array.isArray(getState().tasks) ? getState().tasks : []).filter(task => task && !task.demo && task.workspace && canonicalMemoryWorkspace(task.workspace) === workspace);
  function peers({ workspace, query: input, limit } = {}) {
    const scope = canonicalMemoryWorkspace(workspace), needle = query(input), count = integer(limit, 6, 1, 20);
    return tasksIn(scope).filter(task => !needle || `${task.title} ${task.departmentName} ${task.departmentId} ${task.provider}`.toLowerCase().includes(needle)).sort((a, b) => text(b.createdAt).localeCompare(text(a.createdAt))).slice(0, count).map(publicTask);
  }
  function peer({ workspace, taskId, offset, maxChars } = {}) {
    if (!validId(taskId)) throw fail(400, 'Invalid peer task ID.');
    const scope = canonicalMemoryWorkspace(workspace), task = tasksIn(scope).find(task => task.id === taskId);
    if (!task) throw fail(404, 'Peer task not found in this project.');
    const start = integer(offset, 0, 0, 2000000), size = integer(maxChars, 4000, 1, 8000), output = text(task.output), end = Math.min(output.length, start + size);
    return { task: publicTask(task), output: output.slice(start, end), outputChars: output.length, offset: start, nextOffset: end < output.length ? end : null, truncated: end < output.length, final: !ACTIVE.has(task.status), error: text(task.error).slice(0, 2000) || null, confidence: 'unverified' };
  }
  function list({ workspace, query: input, afterSequence, limit } = {}) {
    const scope = canonicalMemoryWorkspace(workspace), needle = query(input), after = integer(afterSequence, 0, 0, Number.MAX_SAFE_INTEGER), count = integer(limit, 8, 1, 20);
    const matching = data.artifacts.filter(item => item.workspace === scope && item.sequence > after && (!needle || `${item.title}\n${item.content}`.toLowerCase().includes(needle)));
    const selected = (after ? matching.sort((a, b) => a.sequence - b.sequence) : matching.sort((a, b) => b.sequence - a.sequence)).slice(0, count);
    return { workspace: scope, artifacts: selected.map(metadata), latestSequence: Math.max(0, ...data.artifacts.filter(item => item.workspace === scope).map(item => item.sequence)), nextSequence: selected.length ? Math.max(...selected.map(item => item.sequence)) : after, truncated: matching.length > selected.length };
  }
  function get({ workspace, id, maxChars } = {}) {
    if (!validId(id)) throw fail(400, 'Invalid artifact ID.');
    const scope = canonicalMemoryWorkspace(workspace), artifact = data.artifacts.find(item => item.id === id && item.workspace === scope);
    if (!artifact) throw fail(404, 'Artifact not found in this project.');
    const size = integer(maxChars, 8000, 1, 8000); return { ...metadata(artifact), content: artifact.content.slice(0, size), truncated: artifact.content.length > size };
  }
  function publish({ task, input }) {
    if (!task || task.status !== 'running' || task.demo) throw fail(403, 'A running real task is required to publish.');
    if (!object(input) || Object.keys(input).some(key => !['title', 'content', 'kind', 'idempotencyKey'].includes(key))) throw fail(400, 'Unexpected artifact fields.');
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 160 || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 8000 || !['note', 'finding', 'handoff', 'result'].includes(input.kind) || typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(input.idempotencyKey)) throw fail(400, 'Invalid artifact title, content, kind or idempotency key.');
    const scope = canonicalMemoryWorkspace(task.workspace), prior = data.artifacts.find(item => item.workspace === scope && item.taskId === task.id && item.idempotencyKey === input.idempotencyKey);
    if (prior) { if (prior.title !== input.title.trim() || prior.content !== input.content || prior.kind !== input.kind) throw fail(409, 'This idempotency key already identifies a different artifact.'); return { artifact: get({ workspace: scope, id: prior.id }), created: false }; }
    if (data.artifacts.filter(item => item.workspace === scope && item.taskId === task.id).length >= 20) throw fail(409, 'Each task may publish at most 20 artifacts.');
    const next = structuredClone(data), projectEntries = next.artifacts.filter(item => item.workspace === scope), activeIds = new Set(tasksIn(scope).filter(task => ACTIVE.has(task.status)).map(task => task.id));
    const removable = projectEntries.filter(item => !activeIds.has(item.taskId)).sort((a, b) => a.sequence - b.sequence);
    while (next.artifacts.filter(item => item.workspace === scope).length >= 500 && removable.length) { const old = removable.shift(); next.artifacts = next.artifacts.filter(item => item.id !== old.id); }
    if (next.artifacts.filter(item => item.workspace === scope).length >= 500) throw fail(409, 'The project board is full of active-task artifacts.');
    const artifact = { id: randomUUID(), sequence: ++next.sequence, workspace: scope, taskId: task.id, provider: text(task.provider), departmentId: text(task.departmentId), title: input.title.trim(), content: input.content, kind: input.kind, idempotencyKey: input.idempotencyKey, createdAt: new Date().toISOString(), confidence: 'unverified' };
    next.artifacts.push(artifact); persist(next); return { artifact: get({ workspace: scope, id: artifact.id }), created: true };
  }
  function audit({ workspace, sourceTaskId = null, targetTaskId = null, targetTaskIds, action, artifactId = null, chars = 0 }) {
    const targets = [...new Set(Array.isArray(targetTaskIds) ? targetTaskIds.filter(validId) : validId(targetTaskId) ? [targetTaskId] : [])].slice(0, 20);
    const scope = canonicalMemoryWorkspace(workspace), next = structuredClone(data), event = { id: randomUUID(), sequence: ++next.sequence, workspace: scope, sourceTaskId, targetTaskId: targets[0] || null, targetTaskIds: targets, action, artifactId, chars: Math.max(0, Math.min(256000, Number(chars) || 0)), timestamp: new Date().toISOString() };
    next.events.push(event); const retained = next.events.filter(item => item.workspace === scope).slice(-100), ids = new Set(retained.map(item => item.id)); next.events = next.events.filter(item => item.workspace !== scope || ids.has(item.id)); persist(next); return structuredClone(event);
  }
  return { peers, peer, list, get, publish, audit, events({ workspace }) { const scope = canonicalMemoryWorkspace(workspace); return structuredClone(data.events.filter(item => item.workspace === scope).slice(-100)); } };
}
