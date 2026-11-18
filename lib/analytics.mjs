import path from 'node:path';

const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const timestamp = value => { if (typeof value !== 'string' || !value) return null; const number = Date.parse(value); return Number.isFinite(number) ? number : null; };
const text = (value, max = 200) => typeof value === 'string' ? value.slice(0, max) : '';
function scope(value) {
  if (typeof value !== 'string' || !value) return null;
  const result = path.resolve(value);
  return process.platform === 'win32' ? result.toLowerCase() : result;
}
function usage(task) {
  const input = finite(task.usage?.inputTokens), output = finite(task.usage?.outputTokens);
  const reported = task.usageReported === true || input > 0 || output > 0;
  return { reported: reported && (input !== null || output !== null), input: reported ? input : null, output: reported ? output : null, complete: reported && input !== null && output !== null, total: reported && (input !== null || output !== null) ? (input ?? 0) + (output ?? 0) : null };
}
function distribution(values) {
  const ordered = values.filter(value => value !== null).sort((a, b) => a - b);
  const quantile = q => ordered.length ? ordered[Math.max(0, Math.ceil(ordered.length * q) - 1)] : null;
  return { samples: ordered.length, p50: quantile(.5), p95: quantile(.95), average: ordered.length ? ordered.reduce((a, b) => a + b, 0) / ordered.length : null, method: 'nearest-rank' };
}
const sumKnown = values => { const known = values.filter(value => value !== null); return known.length ? known.reduce((a, b) => a + b, 0) : null; };

/** Retained task telemetry only. No provider requests, credit estimates, or inferred model quality. */
export function summarizeAnalytics(state = {}, { workspace = state.settings?.workspace } = {}) {
  const current = scope(state.settings?.workspace), requested = scope(workspace);
  const retained = (Array.isArray(state.tasks) ? state.tasks : []).filter(task => task && typeof task === 'object');
  const scoped = retained.filter(task => task.workspace ? scope(task.workspace) === requested : requested === current);
  const tasks = scoped.filter(task => !task.demo);
  const records = tasks.map(task => {
    const started = timestamp(task.startedAt), finished = timestamp(task.finishedAt), firstOutput = timestamp(task.firstOutputAt);
    const created = timestamp(task.createdAt) ?? started ?? finished;
    const durationMs = started !== null && finished !== null && finished >= started ? finished - started : null;
    const firstOutputLatencyMs = started !== null && firstOutput !== null && firstOutput >= started && (finished === null || firstOutput <= finished) ? firstOutput - started : null;
    return { task, usage: usage(task), time: created, day: created === null ? null : new Date(created).toISOString().slice(0, 10), durationMs, firstOutputLatencyMs };
  });
  const statuses = Object.fromEntries(['completed', 'failed', 'running', 'queued', 'cancelled', 'interrupted'].map(status => [status, tasks.filter(task => task.status === status).length]));
  const reported = records.filter(record => record.usage.reported);
  const inputTokens = sumKnown(reported.map(record => record.usage.input)), outputTokens = sumKnown(reported.map(record => record.usage.output));
  const totals = { tasks: tasks.length, ...statuses, reportedTasks: reported.length, unreportedTasks: tasks.length - reported.length, completeUsageTasks: records.filter(record => record.usage.complete).length, inputTokens, outputTokens, totalTokens: sumKnown(reported.map(record => record.usage.total)) };
  const days = new Map();
  for (const record of records) {
    if (!record.day) continue;
    if (!days.has(record.day)) days.set(record.day, []);
    days.get(record.day).push(record);
  }
  const byDay = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, rows]) => ({
    day, tasks: rows.length, completed: rows.filter(row => row.task.status === 'completed').length, failed: rows.filter(row => row.task.status === 'failed').length,
    reportedTasks: rows.filter(row => row.usage.reported).length,
    inputTokens: sumKnown(rows.map(row => row.usage.input)), outputTokens: sumKnown(rows.map(row => row.usage.output)), totalTokens: sumKnown(rows.map(row => row.usage.total)),
  }));
  let cumulative = 0;
  const tokenHistory = byDay.filter(day => day.totalTokens !== null).map(day => ({ day: day.day, tokens: day.totalTokens, cumulativeTokens: cumulative += day.totalTokens, reportedTasks: day.reportedTasks }));
  const taskBars = [...records].sort((a, b) => (a.time ?? -Infinity) - (b.time ?? -Infinity) || text(a.task.id).localeCompare(text(b.task.id))).slice(-30).map(row => ({
    id: text(row.task.id), title: text(row.task.title, 240), provider: text(row.task.provider), modelId: text(row.task.modelId), departmentId: text(row.task.departmentId), status: text(row.task.status),
    durationMs: row.durationMs, firstOutputLatencyMs: row.firstOutputLatencyMs, inputTokens: row.usage.input, outputTokens: row.usage.output, totalTokens: row.usage.total,
  }));
  const memoryRows = tasks.map(task => task.memoryUsage).filter(value => value && typeof value === 'object');
  const retrieved = memoryRows.map(row => finite(row.retrievedChars) ?? (finite(row.retrievals) === 0 ? 0 : null));
  const memory = {
    measuredTasks: memoryRows.length,
    initialContextChars: sumKnown(memoryRows.map(row => finite(row.contextChars))),
    totalMemoryChars: sumKnown(memoryRows.map(row => finite(row.totalMemoryChars))),
    additionalRetrievals: sumKnown(memoryRows.map(row => finite(row.retrievals))),
    retrievedChars: sumKnown(retrieved), unknownRetrievedCharTasks: retrieved.filter(value => value === null).length,
    method: 'character-counts', includesContextLabels: true,
  };
  const grouped = new Map();
  let excludedUnknownModelTasks = 0;
  for (const record of records) {
    const task = record.task;
    if (task.status !== 'completed' || !record.usage.complete || record.time === null) continue;
    if (!text(task.modelId) || !text(task.provider) || !text(task.departmentId) || !text(task.permission)) { excludedUnknownModelTasks++; continue; }
    const key = JSON.stringify([task.provider, task.modelId, task.departmentId, task.permission, task.reasoningEffort || 'default', task.speed || 'default']);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }
  const groups = [...grouped].map(([key, rows]) => {
    rows.sort((a, b) => a.time - b.time || text(a.task.id).localeCompare(text(b.task.id)));
    const count = Math.floor(rows.length / 2);
    const previous = rows.slice(0, count), recent = rows.slice(rows.length - count);
    const enough = count >= 3;
    const average = values => values.reduce((total, row) => total + row.usage.total, 0) / values.length;
    const previousAverage = enough ? average(previous) : null, recentAverage = enough ? average(recent) : null;
    const [provider, modelId, departmentId, permission, reasoningEffort, speed] = JSON.parse(key);
    return { provider, modelId, departmentId, permission, reasoningEffort, speed, status: enough ? 'available' : 'insufficient', totalSamples: rows.length, previousCount: count, recentCount: count, omittedMiddleCount: rows.length % 2, previousAverageTokens: previousAverage, recentAverageTokens: recentAverage, changePercent: enough && previousAverage > 0 ? (recentAverage - previousAverage) / previousAverage * 100 : null, lastObservedAt: new Date(rows.at(-1).time).toISOString() };
  }).sort((a, b) => b.lastObservedAt.localeCompare(a.lastObservedAt));
  const successSampleCount = statuses.completed + statuses.failed;
  return {
    meta: { workspace: workspace ?? null, timeZone: 'UTC', basis: 'retained-real-tasks', legacyWorkspaceTasks: tasks.filter(task => !task.workspace).length, excludedDemoTasks: scoped.filter(task => task.demo).length, undatedTasks: records.filter(record => !record.day).length },
    totals,
    performance: { successRate: successSampleCount ? statuses.completed / successSampleCount : null, successSampleCount, durationMs: distribution(records.map(record => record.durationMs)), firstOutputLatencyMs: distribution(records.map(record => record.firstOutputLatencyMs)) },
    credits: { remaining: null, status: 'see-account-quotas' },
    memory, byDay, tokenHistory, taskBars,
    comparison: { method: 'equal-count-chronological-halves', minimumPerCohort: 3, interpretation: 'observed-token-change-not-billing-savings', excludedUnknownModelTasks, groups },
  };
}
