import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const KINDS = new Set(['fact', 'decision', 'constraint', 'task', 'note']);
const EDGE_TYPES = new Set(['related', 'depends_on', 'supersedes']);
const MAX_CONTENT = 24000;
const MAX_NODES = 5000;
const MAX_WIKI_EDGES = 5000;
const MAX_WIKI_LINKS_PER_NODE = 128;
const MAX_RETRIEVAL_NEIGHBORS = 2;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const HISTORY_PER_NODE = 8;
const MAX_HISTORY = 300;
const STOP_WORDS = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'have', 'for', 'are', 'you', 'your', 'into', 'then', 'will', '합니다', '있습니다', '주세요', '그리고', '대한', '하는', '합니', '니다', '입니', '습니', '세요', '해주', '주세', '있습', '없습', '으로', '에서', '하고', '위해']);
const clone = value => structuredClone(value);
const failure = (status, message) => Object.assign(new Error(message), { status });

export function canonicalMemoryWorkspace(workspace) {
  if (typeof workspace !== 'string' || !workspace.trim() || workspace.length > 4096 || !path.isAbsolute(workspace)) {
    throw failure(400, '메모리 작업 폴더의 절대 경로가 필요합니다.');
  }
  let result = path.resolve(workspace);
  try { result = realpathSync.native(result); } catch { /* A workspace may be configured before it is created. */ }
  return process.platform === 'win32' ? result.toLowerCase() : result;
}

/** Local words and CJK bigrams, not embeddings or a model inference call. */
export function tokenizeMemory(value) {
  const normalized = String(value ?? '').normalize('NFKC').toLowerCase();
  const result = [];
  for (const match of normalized.matchAll(/[a-z0-9_]+|[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu)) {
    const word = match[0];
    if (!STOP_WORDS.has(word) && word.length > 1) result.push(word);
    if (/^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(word)) {
      const letters = [...word];
      for (let i = 0; i + 1 < letters.length; i++) {
        const bigram = letters[i] + letters[i + 1];
        if (bigram !== word && !STOP_WORDS.has(bigram)) result.push(bigram);
      }
    }
  }
  return result;
}

function idValue(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,128}$/.test(value)) throw failure(400, '올바른 메모리 ID가 필요합니다.');
  return value;
}

function boundedString(value, name, max, { optional = false } = {}) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw failure(400, `${name}은(는) 1~${max.toLocaleString()}자로 입력해 주세요.`);
  return value.trim();
}

function tagsValue(tags = []) {
  if (!Array.isArray(tags) || tags.length > 24 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 48)) {
    throw failure(400, '태그는 48자 이내의 문자열을 최대 24개까지 사용할 수 있습니다.');
  }
  return [...new Set(tags.map(tag => tag.trim()))];
}

function limitValue(value, fallback, max) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > max) throw failure(400, `결과 수는 1~${max} 사이의 정수여야 합니다.`);
  return value;
}

function queryValue(query = '') {
  if (typeof query !== 'string' || query.length > 2000) throw failure(400, '검색어는 2,000자 이내로 입력해 주세요.');
  return query.trim();
}

const newest = (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
const stableEdgeId = (source, target, type) => `edge-${createHash('sha256').update(`${source}\0${target}\0${type}`).digest('hex').slice(0, 32)}`;
const wikiTitle = value => value.trim().normalize('NFKC').toLowerCase();
const relatedPair = (source, target) => [source, target].sort().join('\0');

/**
 * Synchronous local persistence makes each successful mutation durable before it
 * returns. Store the directory under the current OS user's application data.
 *
 * list/get/upsert return detached node values; snapshot returns nodes, edges,
 * scoped revision history and counts. Errors carry an HTTP-compatible status.
 * Edge source/target are node IDs. Snapshot-only wikilinks resolve exact NFKC,
 * lowercase titles and exclude ambiguous titles. IDs, paths, tags and headings
 * receive no special interpretation: only the literal title can resolve.
 * Related pairs merge user > wikilink > keyword; opposite wikilink directions
 * and other edge types remain distinct. Derived edges are never persisted.
 */
export function createMemoryStore({ dataDir } = {}) {
  if (typeof dataDir !== 'string' || !path.isAbsolute(dataDir)) throw failure(400, '메모리 저장 폴더의 절대 경로가 필요합니다.');
  const directory = path.resolve(dataDir);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'memory-graph.json');
  let state = { version: 1, nodes: [], edges: [], history: [] };
  if (existsSync(file)) {
    if (lstatSync(file).isSymbolicLink() || statSync(file).size > MAX_FILE_BYTES) throw failure(500, '메모리 저장 파일의 형식 또는 크기를 확인해 주세요.');
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      if (saved?.version !== 1 || !Array.isArray(saved.nodes) || !Array.isArray(saved.edges) || !Array.isArray(saved.history ?? [])) throw new Error('Invalid graph');
      if (saved.nodes.length > MAX_NODES || saved.nodes.some(node => !node || typeof node.id !== 'string' || typeof node.workspace !== 'string' || typeof node.title !== 'string' || typeof node.content !== 'string' || !KINDS.has(node.kind) || !Number.isInteger(node.revision) || node.revision < 1)) throw new Error('Invalid nodes');
      const nodeIds = new Set(saved.nodes.map(node => node.id));
      if (nodeIds.size !== saved.nodes.length || saved.edges.some(edge => !edge || !nodeIds.has(edge.source) || !nodeIds.has(edge.target) || !EDGE_TYPES.has(edge.type))) throw new Error('Invalid edges');
      state = { version: 1, nodes: saved.nodes, edges: saved.edges, history: saved.history ?? [] };
    } catch {
      throw failure(500, '메모리 저장 파일을 읽지 못했습니다. 원본 memory-graph.json을 보존한 상태로 복구해 주세요.');
    }
  }
  const documents = new Map();
  const wikiDocuments = new Map(), graphs = new Map();

  function persist(next) {
    const serialized = JSON.stringify(next, null, 2);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_FILE_BYTES) throw failure(413, '메모리 저장소가 64MB 한도에 도달했습니다. 오래된 메모리를 정리해 주세요.');
    if (existsSync(file) && lstatSync(file).isSymbolicLink()) throw failure(500, '메모리 저장 파일에 심볼릭 링크를 사용할 수 없습니다.');
    const temp = path.join(directory, `.memory-${randomUUID()}.tmp`);
    let descriptor;
    try {
      descriptor = openSync(temp, 'wx', 0o600);
      writeFileSync(descriptor, serialized, 'utf8');
      fsyncSync(descriptor);
      closeSync(descriptor); descriptor = undefined;
      renameSync(temp, file);
    } catch (error) {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch {}
      try { unlinkSync(temp); } catch {}
      throw failure(500, `메모리를 저장하지 못했습니다: ${error.code || '쓰기 오류'}`);
    }
  }

  function mutate(operation) {
    const next = clone(state);
    const result = operation(next);
    persist(next);
    state = next;
    graphs.clear();
    return clone(result);
  }

  function wikiTargets(node) {
    const cached = wikiDocuments.get(node.id);
    if (cached?.revision === node.revision) return cached;
    const targets = new Set();
    let count = 0, truncated = false;
    for (const match of node.content.matchAll(/\[\[([^\[\]\r\n]+)\]\]/g)) {
      if (++count > MAX_WIKI_LINKS_PER_NODE) { truncated = true; break; }
      const title = match[1].split('|', 1)[0].trim();
      if (title && title.length <= 160) targets.add(wikiTitle(title));
    }
    const value = { revision: node.revision, targets: [...targets], truncated };
    wikiDocuments.set(node.id, value);
    return value;
  }

  function graphFor(scope) {
    if (graphs.has(scope)) return graphs.get(scope);
    const nodes = state.nodes.filter(node => node.workspace === scope && !node.archived);
    const byId = new Map(nodes.map(node => [node.id, node])), titles = new Map();
    for (const node of nodes) {
      const key = wikiTitle(node.title);
      // null is deliberately ambiguous, including case/normalization collisions.
      titles.set(key, titles.has(key) ? null : node.id);
    }
    const derived = new Map();
    let wikiEdgesTruncated = false, wikiLinksTruncated = 0;
    outer: for (const node of nodes) {
      const parsed = wikiTargets(node);
      if (parsed.truncated) wikiLinksTruncated++;
      for (const key of parsed.targets) {
        const target = titles.get(key);
        if (!target || target === node.id) continue;
        const id = stableEdgeId(node.id, target, 'related');
        if (derived.has(id)) continue;
        if (derived.size >= MAX_WIKI_EDGES) { wikiEdgesTruncated = true; break outer; }
        derived.set(id, { id, source: node.id, target, type: 'related', provenance: 'wikilink' });
      }
    }
    const stored = new Map();
    for (const edge of state.edges) {
      if (!byId.has(edge.source) || !byId.has(edge.target) || edge.source === edge.target) continue;
      const key = edge.type === 'related' ? `related\0${relatedPair(edge.source, edge.target)}` : `${edge.type}\0${edge.source}\0${edge.target}`;
      const previous = stored.get(key);
      if (!previous || previous.provenance === 'keyword' && edge.provenance !== 'keyword') stored.set(key, edge);
    }
    const wikiPairs = new Set([...derived.values()].map(edge => relatedPair(edge.source, edge.target)));
    const userPairs = new Set([...stored.values()].filter(edge => edge.type === 'related' && edge.provenance !== 'keyword').map(edge => relatedPair(edge.source, edge.target)));
    const edges = [...stored.values()].filter(edge => edge.type !== 'related' || edge.provenance !== 'keyword' || !wikiPairs.has(relatedPair(edge.source, edge.target)));
    for (const edge of derived.values()) if (!userPairs.has(relatedPair(edge.source, edge.target))) edges.push(edge);
    const neighbors = new Map();
    const addNeighbor = (source, target, provenance) => {
      let entries = neighbors.get(source);
      if (!entries) { entries = new Map(); neighbors.set(source, entries); }
      if (entries.size < 32 && !entries.has(target)) entries.set(target, { node: byId.get(target), provenance });
    };
    // Explicit author links are stronger context than automatic keyword edges.
    for (const provenance of ['user', 'wikilink']) for (const edge of edges) {
      if (provenance === 'wikilink' ? edge.provenance !== 'wikilink' : edge.provenance === 'wikilink' || edge.provenance === 'keyword') continue;
      addNeighbor(edge.source, edge.target, provenance);
      if (edge.type === 'related' && provenance === 'user') addNeighbor(edge.target, edge.source, provenance);
    }
    const graph = { edges, neighbors, wikiEdgesTruncated, wikiLinksTruncated };
    graphs.set(scope, graph);
    return graph;
  }

  function documentFor(node) {
    const cached = documents.get(node.id);
    if (cached?.revision === node.revision) return cached;
    const frequencies = new Map();
    const add = (text, weight) => {
      for (const term of tokenizeMemory(text)) frequencies.set(term, (frequencies.get(term) || 0) + weight);
    };
    add(node.content, 1); add(node.title, 3); add((node.tags || []).join(' '), 2);
    const document = { revision: node.revision, frequencies, length: [...frequencies.values()].reduce((sum, count) => sum + count, 0) || 1 };
    documents.set(node.id, document);
    return document;
  }

  function ranked(nodes, query) {
    const terms = [...new Set(tokenizeMemory(query))].slice(0, 160);
    const averageLength = nodes.reduce((sum, node) => sum + documentFor(node).length, 0) / Math.max(1, nodes.length);
    const frequency = new Map(terms.map(term => [term, nodes.reduce((sum, node) => sum + Number(documentFor(node).frequencies.has(term)), 0)]));
    const phrase = query.normalize('NFKC').toLowerCase();
    return nodes.map(node => {
      const doc = documentFor(node);
      let score = 0;
      for (const term of terms) {
        const tf = doc.frequencies.get(term) || 0;
        if (!tf) continue;
        const idf = Math.log(1 + (nodes.length - frequency.get(term) + .5) / (frequency.get(term) + .5));
        score += idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * doc.length / Math.max(1, averageLength)));
      }
      if (phrase && node.title.normalize('NFKC').toLowerCase().includes(phrase)) score += 5;
      if (phrase && node.content.normalize('NFKC').toLowerCase().includes(phrase)) score += 1;
      return { node, score };
    }).sort((a, b) => b.score - a.score || newest(a.node, b.node));
  }

  function addKeywordEdges(next, node) {
    next.edges = next.edges.filter(edge => edge.provenance !== 'keyword' || edge.source !== node.id && edge.target !== node.id);
    if (node.archived) return;
    const terms = new Set(documentFor(node).frequencies.keys());
    const peers = next.nodes.filter(peer => peer.workspace === node.workspace && peer.id !== node.id && !peer.archived);
    const matches = peers.map(peer => ({ peer, overlap: [...documentFor(peer).frequencies.keys()].reduce((sum, term) => sum + Number(terms.has(term)), 0) }))
      .filter(match => match.overlap >= 2).sort((a, b) => b.overlap - a.overlap || newest(a.peer, b.peer)).slice(0, 3);
    for (const { peer } of matches) {
      const [source, target] = [node.id, peer.id].sort();
      const id = stableEdgeId(source, target, 'related');
      if (!next.edges.some(edge => edge.id === id)) next.edges.push({ id, source, target, type: 'related', provenance: 'keyword' });
    }
  }

  function upsert(input, { expectedRevision, preserveAuthorship = false } = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw failure(400, '올바른 메모리 항목이 필요합니다.');
    const id = input.id === undefined ? randomUUID() : idValue(input.id);
    const existing = state.nodes.find(node => node.id === id);
    const workspace = canonicalMemoryWorkspace(input.workspace ?? existing?.workspace);
    if (existing && workspace !== existing.workspace) throw failure(409, '기존 메모리를 다른 작업 폴더로 이동할 수 없습니다.');
    if (expectedRevision !== undefined && (!Number.isInteger(expectedRevision) || expectedRevision < 0)) throw failure(400, '올바른 메모리 버전이 필요합니다.');
    if (expectedRevision !== undefined && expectedRevision !== (existing?.revision ?? 0)) throw failure(409, '메모리가 다른 작업에서 변경되었습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.');
    const source = input.source ?? 'user';
    if (!['user', 'agent'].includes(source)) throw failure(400, '올바른 메모리 출처가 필요합니다.');
    if (source === 'agent' && existing && (existing.pinned || existing.source === 'user')) throw failure(409, '에이전트는 고정 메모리와 사용자가 작성한 내용을 덮어쓸 수 없습니다.');
    const title = boundedString(input.title ?? existing?.title, '제목', 160);
    const content = boundedString(input.content ?? existing?.content, '내용', MAX_CONTENT);
    const kind = input.kind ?? existing?.kind ?? 'note';
    if (!KINDS.has(kind)) throw failure(400, '지원하지 않는 메모리 종류입니다.');
    const tags = tagsValue(input.tags ?? existing?.tags ?? []);
    for (const field of ['pinned', 'archived']) if (input[field] !== undefined && typeof input[field] !== 'boolean') throw failure(400, `${field} 값은 참 또는 거짓이어야 합니다.`);
    if (input.confidence !== undefined && !['user', 'unverified'].includes(input.confidence)) throw failure(400, '올바른 메모리 검증 상태가 필요합니다.');
    const sourceTaskId = input.sourceTaskId ?? existing?.sourceTaskId;
    if (sourceTaskId !== undefined && (typeof sourceTaskId !== 'string' || !sourceTaskId.trim() || sourceTaskId.length > 128)) throw failure(400, '올바른 원본 작업 ID가 필요합니다.');
    if (!existing && state.nodes.length >= MAX_NODES) throw failure(409, '메모리 항목 한도에 도달했습니다. 오래된 항목을 정리해 주세요.');
    const now = new Date().toISOString();
    const node = {
      id, workspace, title, content, kind, tags, source: preserveAuthorship && existing ? existing.source : source,
      pinned: input.pinned ?? existing?.pinned ?? false,
      archived: input.archived ?? existing?.archived ?? false,
      confidence: preserveAuthorship && existing ? existing.confidence : source === 'agent' ? 'unverified' : input.confidence ?? 'user',
      revision: (existing?.revision ?? 0) + 1,
      createdAt: existing?.createdAt ?? now, updatedAt: now,
      ...(sourceTaskId ? { sourceTaskId } : {}),
    };
    return mutate(next => {
      const index = next.nodes.findIndex(item => item.id === id);
      if (existing) {
        next.history.push({ ...clone(existing), recordedAt: now });
        const own = next.history.filter(entry => entry.id === id);
        const expired = new Set(own.slice(0, Math.max(0, own.length - HISTORY_PER_NODE)));
        next.history = next.history.filter(entry => !expired.has(entry)).slice(-MAX_HISTORY);
        next.nodes[index] = node;
      } else next.nodes.push(node);
      addKeywordEdges(next, node);
      return node;
    });
  }

  function list({ workspace, query = '', limit } = {}) {
    const scope = canonicalMemoryWorkspace(workspace);
    const size = limitValue(limit, 200, 500);
    const search = queryValue(query);
    const nodes = state.nodes.filter(node => node.workspace === scope && !node.archived);
    const entries = search ? ranked(nodes, search).filter(entry => entry.score > 0).map(entry => entry.node) : [...nodes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || newest(a, b));
    return clone(entries.slice(0, size));
  }

  function get(id) { return clone(state.nodes.find(node => node.id === idValue(id)) ?? null); }

  function remove(id) {
    idValue(id);
    if (!state.nodes.some(node => node.id === id)) return { removed: false, id };
    return mutate(next => {
      next.nodes = next.nodes.filter(node => node.id !== id);
      next.edges = next.edges.filter(edge => edge.source !== id && edge.target !== id);
      next.history = next.history.filter(entry => entry.id !== id);
      documents.delete(id);
      wikiDocuments.delete(id);
      return { removed: true, id };
    });
  }

  function link({ source, target, type = 'related', provenance = 'user' } = {}) {
    idValue(source); idValue(target);
    if (source === target || !EDGE_TYPES.has(type) || !['user', 'keyword'].includes(provenance)) throw failure(400, '올바른 메모리 연결이 필요합니다.');
    const first = state.nodes.find(node => node.id === source);
    const second = state.nodes.find(node => node.id === target);
    if (!first || !second) throw failure(404, '연결할 메모리 항목을 찾을 수 없습니다.');
    if (first.workspace !== second.workspace) throw failure(400, '다른 작업 폴더의 메모리를 연결할 수 없습니다.');
    if (type === 'related') [source, target] = [source, target].sort();
    const id = stableEdgeId(source, target, type);
    const existing = state.edges.find(edge => edge.id === id);
    if (existing && (existing.provenance === 'user' || provenance === 'keyword')) return clone(existing);
    return mutate(next => {
      const edge = { id, source, target, type, provenance };
      const index = next.edges.findIndex(item => item.id === id);
      if (index < 0) next.edges.push(edge); else next.edges[index] = edge;
      return edge;
    });
  }

  function unlink(id, { workspace, expectedSourceRevision, expectedTargetRevision } = {}) {
    idValue(id);
    const scope = canonicalMemoryWorkspace(workspace);
    const edge = state.edges.find(item => item.id === id);
    if (!edge) {
      if (graphFor(scope).edges.some(item => item.id === id)) throw failure(409, '자동 연결은 원문의 링크 또는 내용을 수정해 주세요.');
      throw failure(404, '연결을 찾을 수 없습니다.');
    }
    const source = state.nodes.find(node => node.id === edge.source && node.workspace === scope);
    const target = state.nodes.find(node => node.id === edge.target && node.workspace === scope);
    if (!source || !target) throw failure(404, '연결을 찾을 수 없습니다.');
    if (edge.provenance !== undefined && edge.provenance !== 'user') throw failure(409, '자동 연결은 원문의 링크 또는 내용을 수정해 주세요.');
    if (![expectedSourceRevision, expectedTargetRevision].every(value => Number.isInteger(value) && value >= 1)) throw failure(400, '연결 양쪽 메모리의 현재 버전이 필요합니다.');
    if (source.revision !== expectedSourceRevision || target.revision !== expectedTargetRevision) throw failure(409, '메모리가 변경되었습니다. 새로고침 후 연결을 다시 확인해 주세요.');
    return mutate(next => {
      next.edges = next.edges.filter(item => item.id !== id);
      return { removed: true, id };
    });
  }

  function search({ workspace, query = '', limit = 6, maxChars = 6000 } = {}) {
    const scope = canonicalMemoryWorkspace(workspace);
    const size = limitValue(limit, 6, 12);
    const phrase = queryValue(query);
    if (!Number.isInteger(maxChars) || maxChars < 128 || maxChars > 24000) throw failure(400, '메모리 문맥 길이는 128~24,000자 사이여야 합니다.');
    const nodes = state.nodes.filter(node => node.workspace === scope && !node.archived);
    const ranking = ranked(nodes, phrase);
    const mandatory = nodes.filter(node => node.pinned && node.kind === 'constraint').sort(newest);
    const other = phrase ? ranking.filter(entry => entry.score > 0).map(entry => entry.node) : [...nodes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || newest(a, b));
    const linked = new Map();
    if (phrase && other.length) {
      const seed = other[0], graph = graphFor(scope);
      for (const value of graph.neighbors.get(seed.id)?.values() || []) {
        if (mandatory.some(node => node.id === value.node.id)) continue;
        linked.set(value.node.id, { node: value.node, sourceId: seed.id, provenance: value.provenance });
        if (linked.size >= MAX_RETRIEVAL_NEIGHBORS) break;
      }
    }
    const candidates = phrase && other.length ? [other[0], ...[...linked.values()].map(value => value.node), ...other.slice(1)] : other;
    const ordered = [...new Map([...mandatory, ...candidates].map(node => [node.id, node])).values()].slice(0, size);
    const header = 'Workspace memory · local keyword retrieval. Agent-authored entries are unverified.\n';
    let context = ordered.length && maxChars >= 512 ? header : '';
    const memories = [];
    const terms = [...new Set(tokenizeMemory(phrase))].sort((a, b) => b.length - a.length);
    for (const node of ordered) {
      const titleLimit = Math.min(160, Math.max(12, Math.floor(maxChars / 6)));
      const title = node.title.length > titleLimit ? `${node.title.slice(0, titleLimit - 1)}…` : node.title;
      const relation = linked.get(node.id);
      const label = `\n[${node.id} | ${node.kind} | ${node.confidence}${node.pinned ? ' | pinned' : ''}${relation ? ` | linked from ${relation.sourceId}` : ''}] ${title}\n`;
      const available = maxChars - context.length - label.length;
      if (available < 24) continue;
      const budget = Math.min(available, node.pinned && node.kind === 'constraint' ? 1800 : 1200);
      let offset = 0;
      if (node.content.length > budget && terms.length && !node.pinned) {
        const lower = node.content.normalize('NFKC').toLowerCase();
        const hit = terms.map(term => lower.indexOf(term)).find(index => index >= 0);
        if (hit !== undefined) offset = Math.max(0, Math.min(node.content.length - budget, hit - 120));
      }
      const truncated = offset > 0 || node.content.length > budget;
      const excerpt = `${offset ? '…' : ''}${node.content.slice(offset, offset + Math.max(0, budget - (truncated ? 2 : 0)))}${truncated ? '…' : ''}`;
      context += label + excerpt;
      memories.push({ ...clone(node), content: excerpt, truncated, originalChars: node.content.length, ...(relation ? { retrieval: { method: 'graph-neighbor', sourceId: relation.sourceId, provenance: relation.provenance } } : {}) });
    }
    if (!memories.length) context = '';
    return { memories, context, stats: { selectedCount: memories.length, totalCount: nodes.length, contextChars: context.length, totalChars: nodes.reduce((sum, node) => sum + node.content.length, 0), estimatedTokens: Math.ceil(context.length / 3), method: 'local-keyword', graphMethod: 'one-hop-explicit-links', linkedCount: memories.filter(node => node.retrieval?.method === 'graph-neighbor').length } };
  }

  function captureTask(task, { workspace } = {}) {
    if (!task || task.status !== 'completed' || task.demo || typeof task.output !== 'string' || !task.output.trim()) return null;
    const scope = canonicalMemoryWorkspace(workspace);
    const sourceTaskId = idValue(task.id);
    const existing = state.nodes.find(node => node.workspace === scope && node.sourceTaskId === sourceTaskId);
    if (existing && (existing.source === 'user' || existing.pinned)) return null;
    const title = String(task.title || task.prompt || '완료된 작업').trim().slice(0, 160) || '완료된 작업';
    const prompt = typeof task.prompt === 'string' ? task.prompt.slice(0, 2000) : '';
    const content = `${prompt ? `Task instruction:\n${prompt}\n\n` : ''}Task output (unverified):\n${task.output.trim()}`.slice(0, MAX_CONTENT);
    if (existing?.content === content && existing.title === title) return clone(existing);
    const id = existing?.id ?? `task-${createHash('sha256').update(`${scope}\0${sourceTaskId}`).digest('hex').slice(0, 32)}`;
    return upsert({ id, workspace: scope, title, content, kind: 'task', tags: [task.provider, task.departmentId, 'task-result'].filter(value => typeof value === 'string' && value.trim()).map(value => value.slice(0, 48)), sourceTaskId, source: 'agent', pinned: false, confidence: 'unverified' }, { expectedRevision: existing?.revision ?? 0 });
  }

  function snapshot({ workspace } = {}) {
    const scope = canonicalMemoryWorkspace(workspace);
    const nodes = state.nodes.filter(node => node.workspace === scope);
    const { edges, wikiEdgesTruncated, wikiLinksTruncated } = graphFor(scope);
    return clone({ nodes, edges, history: state.history.filter(entry => entry.workspace === scope), stats: { nodeCount: nodes.length, activeCount: nodes.filter(node => !node.archived).length, edgeCount: edges.length, wikiEdgeCount: edges.filter(edge => edge.provenance === 'wikilink').length, wikiEdgesTruncated, wikiLinksTruncated, pinnedCount: nodes.filter(node => node.pinned && !node.archived).length, totalChars: nodes.reduce((sum, node) => sum + node.content.length, 0), method: 'local-keyword' } });
  }

  if (!existsSync(file)) persist(state);
  return { list, get, upsert, remove, link, unlink, search, captureTask, snapshot };
}
