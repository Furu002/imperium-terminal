import path from 'node:path';
import { publicConversations } from './conversations.mjs';

const ACTIVE = new Set(['running', 'queued']);
const ACTIVE_OUTPUT_LIMIT = 200_000;
const PREVIEW_LIMIT = 2000;
const ACTIVE_LOG_LIMIT = 60;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copyRecords = value => Array.isArray(value) ? value.map(item => record(item) ? { ...item } : item) : [];

function canonicalWorkspace(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function preview(text, limit) {
  let end = Math.min(text.length, limit);
  // Avoid ending a UTF-16 preview with half an emoji or another surrogate pair.
  if (end && text.charCodeAt(end - 1) >= 0xD800 && text.charCodeAt(end - 1) <= 0xDBFF) end--;
  return text.slice(0, end);
}

function taskSnapshot(task) {
  const active = ACTIVE.has(task.status);
  const fullOutput = typeof task.output === 'string' ? task.output : '';
  const output = preview(fullOutput, active ? ACTIVE_OUTPUT_LIMIT : PREVIEW_LIMIT);
  const fullLogs = Array.isArray(task.logs) ? task.logs : [];
  const logs = active ? copyRecords(fullLogs.slice(-ACTIVE_LOG_LIMIT)) : [];
  const snapshot = {
    ...task,
    output,
    logs,
    outputChars: fullOutput.length,
    detailsTruncated: output.length !== fullOutput.length || logs.length !== fullLogs.length,
    legacyWorkspace: canonicalWorkspace(task.workspace) === null,
  };
  // Copy small known mutable metadata without cloning the original full output/log tree.
  for (const key of ['usage', 'progress', 'historicalETA', 'memoryUsage']) {
    if (record(task[key])) snapshot[key] = { ...task[key] };
  }
  if (Array.isArray(task.dependsOn)) snapshot.dependsOn = [...task.dependsOn];
  if (record(task.teamRole)) snapshot.teamRole = { ...task.teamRole };
  delete snapshot.teamContextTaskIds;
  if (record(task.harness)) snapshot.harness = structuredClone(task.harness);
  if (Array.isArray(task.memoryUsage?.selectedIds)) snapshot.memoryUsage.selectedIds = [...task.memoryUsage.selectedIds];
  return snapshot;
}

/** Lightweight UI transport only. Full task history remains available for details and exports. */
export function createUISnapshot(state = {}) {
  const settings = record(state.settings) ? state.settings : {};
  const currentWorkspace = canonicalWorkspace(settings.workspace);
  const tasks = (Array.isArray(state.tasks) ? state.tasks : []).filter(task => {
    if (!record(task)) return false;
    const taskWorkspace = canonicalWorkspace(task.workspace);
    return taskWorkspace === null || currentWorkspace !== null && taskWorkspace === currentWorkspace;
  }).map(taskSnapshot);
  const taskIds = new Set(tasks.map(task => task.id));
  const teamRuns = (Array.isArray(state.teamRuns) ? state.teamRuns : [])
    .filter(team => record(team) && currentWorkspace !== null && canonicalWorkspace(team.workspace) === currentWorkspace)
    .map(team => structuredClone(team));
  const departments = copyRecords(state.departments);
  const projects = (Array.isArray(state.projects) ? state.projects : []).filter(record).map(project => {
    const { departments: definitions, ...summary } = project;
    const current = currentWorkspace !== null && canonicalWorkspace(project.workspace) === currentWorkspace;
    return { ...summary, current, departmentCount: current ? departments.length : Array.isArray(definitions) ? definitions.length : 0 };
  });
  const events = copyRecords((Array.isArray(state.events) ? state.events : []).filter(event => {
    if (!record(event)) return false;
    const eventWorkspace = canonicalWorkspace(event.workspace);
    if (eventWorkspace && eventWorkspace !== currentWorkspace) return false;
    return !event.taskId || taskIds.has(event.taskId);
  }));
  const graphs = {};
  if (record(state.graphs) && currentWorkspace !== null) {
    for (const [key, graph] of Object.entries(state.graphs)) {
      if (canonicalWorkspace(key) !== currentWorkspace || !record(graph)) continue;
      graphs[key] = { ...graph, nodes: copyRecords(graph.nodes), edges: copyRecords(graph.edges) };
    }
  }
  return {
    ...state,
    tasks,
    conversations: publicConversations(state, settings.workspace),
    teamRuns,
    departments,
    projects,
    events,
    graphs,
    settings: { ...settings, ...(record(settings.identity) ? { identity: { ...settings.identity } } : {}) },
    server: record(state.server) ? { ...state.server } : {},
    providers: copyRecords(state.providers),
    connections: copyRecords(state.connections),
  };
}
