import path from 'node:path';

const PREFIX = '[[IMPERIUM_PROGRESS ';
const SUFFIX = ']]';
const MAX_MARKER_CHARS = 4096;
const CONFIG_FIELDS = ['provider', 'modelId', 'departmentId', 'permission'];
const plain = value => typeof value === 'string' ? [...value.replace(/[\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]/gu, ' ').trim()].slice(0, 120).join('') : '';
const finiteRange = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;

function parseMarker(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !finiteRange(data.percent, 99)) return null;
  if (data.etaMinutes !== undefined && data.etaMinutes !== null && !finiteRange(data.etaMinutes, 1440)) return null;
  if (data.stage !== undefined && typeof data.stage !== 'string') return null;
  return { type: 'progress', percent: data.percent, etaMinutes: data.etaMinutes ?? null, stage: plain(data.stage), source: 'model-estimate' };
}

function prefixTailLength(text) {
  for (let length = Math.min(text.length, PREFIX.length - 1); length > 0; length--) {
    if (text.endsWith(PREFIX.slice(0, length))) return length;
  }
  return 0;
}

function markerClose(text) {
  let quoted = false, escaped = false;
  for (let index = PREFIX.length; index < Math.min(text.length, MAX_MARKER_CHARS); index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ']' && text[index + 1] === ']') return index;
  }
  return -1;
}

/** Filter explicit public progress markers without inferring progress from model prose or time. */
export function createProgressReader({ onText = () => {}, onProgress = () => {} } = {}) {
  if (typeof onText !== 'function' || typeof onProgress !== 'function') throw new TypeError('Progress callbacks must be functions');
  let pending = '', ended = false;
  const emit = text => { if (text) onText(text); };
  function write(text) {
    if (ended) return;
    if (typeof text !== 'string') throw new TypeError('Progress text must be a string');
    pending += text;
    while (pending) {
      const start = pending.indexOf(PREFIX);
      if (start < 0) {
        const keep = prefixTailLength(pending);
        emit(pending.slice(0, pending.length - keep));
        pending = keep ? pending.slice(-keep) : '';
        return;
      }
      if (start > 0) { emit(pending.slice(0, start)); pending = pending.slice(start); }
      const close = markerClose(pending);
      if (close >= 0 && close + SUFFIX.length <= MAX_MARKER_CHARS) {
        const length = close + SUFFIX.length;
        const event = parseMarker(pending.slice(PREFIX.length, close));
        if (event) onProgress(event);
        else emit(pending.slice(0, length));
        pending = pending.slice(length);
        continue;
      }
      if (pending.length < MAX_MARKER_CHARS) return;
      // An oversized/incomplete marker becomes literal text. Never retain an unbounded candidate.
      emit(PREFIX);
      pending = pending.slice(PREFIX.length);
    }
  }
  function end() {
    if (ended) return;
    ended = true;
    emit(pending);
    pending = '';
  }
  return { write, end };
}

function time(value) {
  if (typeof value !== 'string' || !value) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
function workspace(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const result = path.resolve(value);
  return process.platform === 'win32' ? result.toLowerCase() : result;
}

/** Observed completed-task durations only; no elapsed-time completion percentage is invented. */
export function estimateHistoricalETA(task, tasks, { minSamples = 3, now = Date.now() } = {}) {
  if (!Number.isInteger(minSamples) || minSamples < 1) throw new RangeError('minSamples must be a positive integer');
  if (!task || typeof task !== 'object' || task.demo || !Array.isArray(tasks) || !Number.isFinite(now)) return null;
  if (CONFIG_FIELDS.some(key => typeof task[key] !== 'string' || !task[key].trim())) return null;
  const requestedWorkspace = workspace(task.workspace);
  const durations = [];
  for (const previous of tasks) {
    if (!previous || typeof previous !== 'object' || previous.demo || previous.status !== 'completed') continue;
    if (task.id && previous.id === task.id || CONFIG_FIELDS.some(key => previous[key] !== task[key]) || ['reasoningEffort', 'speed'].some(key => (previous[key] || 'default') !== (task[key] || 'default'))) continue;
    const previousWorkspace = workspace(previous.workspace);
    if (requestedWorkspace && previousWorkspace && requestedWorkspace !== previousWorkspace) continue;
    const start = time(previous.startedAt), finish = time(previous.finishedAt);
    if (start === null || finish === null || finish < start) continue;
    durations.push((finish - start) / 1000);
  }
  if (durations.length < minSamples) return null;
  durations.sort((a, b) => a - b);
  const quantile = fraction => durations[Math.max(0, Math.ceil(durations.length * fraction) - 1)];
  const medianSeconds = quantile(.5), started = time(task.startedAt);
  const elapsed = started === null ? 0 : Math.max(0, (now - started) / 1000);
  return { source: 'history', sampleCount: durations.length, medianSeconds, p90Seconds: quantile(.9), remainingSeconds: Math.max(0, medianSeconds - elapsed) };
}
