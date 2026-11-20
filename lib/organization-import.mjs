import { randomUUID } from 'node:crypto';
import { DEPARTMENT_LIMITS, validateDepartmentInput } from './department-input.mjs';
import { validateGraph } from './graph.mjs';
import { MAX_HIERARCHY_DEPTH, depthOf, effectiveParents } from './department-hierarchy.mjs';

export const IMPORT_LIMITS = Object.freeze({ bytes: 128 * 1024, agents: 256, handoffs: 1000, templateName: 80 });
export const LAYOUT_MANUAL_MESSAGE = '배치는 수동 조정 필요';
const REQUEST_KEYS = new Set(['workspace', 'dryRun', 'includeHandoffs', 'template']);
const TEMPLATE_KEYS = new Set(['template', 'agents', 'handoffs']);
const AGENT_KEYS = new Set(['name', 'title', 'role', 'provider', 'modelId', 'connectionId', 'group', 'lead', 'parent']);
const GROUP = /^[a-z0-9-]{1,32}$/;
// Organization canvas card metrics (public/organization-nodes.css): agents are 320px wide, the owner 240px.
const CARD = Object.freeze({ width: 320, gap: 32, row: 100, tier: 136, treeRow: 108, indent: 40, owner: 240, left: 40 });
const STEP = CARD.width + CARD.gap;
// Workflow canvas department nodes (public/workspace.js) are 230 x 162.
const FLOW = Object.freeze({ column: 290, row: 200, width: 240, height: 172, min: -2000, max: 6000 });

const fail = (status, message) => Object.assign(new Error(message), { status });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const shown = key => JSON.stringify(String(key).slice(0, 40));
const unknownKey = (value, allowed) => Object.keys(value).find(key => !allowed.has(key));
/** Template names are matched after Unicode NFC normalization and trimming; matching is case-sensitive. */
export const nameKey = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';

/** Shape checks only. Every failure here is a 400, including for dry runs. */
export function parseImportRequest(body) {
  if (!plain(body)) throw fail(400, '올바른 가져오기 요청이 아닙니다.');
  const extra = unknownKey(body, REQUEST_KEYS);
  if (extra !== undefined) throw fail(400, `알 수 없는 요청 항목입니다: ${shown(extra)}`);
  if (typeof body.workspace !== 'string' || !body.workspace.trim()) throw fail(400, '현재 프로젝트 폴더(workspace)가 필요합니다.');
  for (const key of ['dryRun', 'includeHandoffs']) if (body[key] !== undefined && typeof body[key] !== 'boolean') throw fail(400, `${key}는 true 또는 false여야 합니다.`);
  const template = body.template;
  if (!plain(template)) throw fail(400, '템플릿(template)은 JSON 객체여야 합니다.');
  const templateExtra = unknownKey(template, TEMPLATE_KEYS);
  if (templateExtra !== undefined) throw fail(400, `템플릿에 알 수 없는 항목이 있습니다: ${shown(templateExtra)}`);
  if (typeof template.template !== 'string' || !template.template.trim() || template.template.length > IMPORT_LIMITS.templateName) throw fail(400, '템플릿 이름(template)은 1~80자 문자열이어야 합니다.');
  if (!Array.isArray(template.agents) || !template.agents.length || template.agents.length > IMPORT_LIMITS.agents) throw fail(400, `에이전트 목록(agents)은 1~${IMPORT_LIMITS.agents}개 항목의 배열이어야 합니다.`);
  if (template.handoffs !== undefined && (!Array.isArray(template.handoffs) || template.handoffs.length > IMPORT_LIMITS.handoffs)) throw fail(400, '업무 전달 목록(handoffs)은 최대 1,000개 항목의 배열이어야 합니다.');
  const agents = template.agents.map((agent, index) => {
    const at = `agents[${index}]`;
    if (!plain(agent)) throw fail(400, `${at} 항목은 객체여야 합니다.`);
    const key = unknownKey(agent, AGENT_KEYS);
    if (key !== undefined) throw fail(400, `${at}에 알 수 없는 항목이 있습니다: ${shown(key)}`);
    if (agent.group !== undefined && (typeof agent.group !== 'string' || !GROUP.test(agent.group))) throw fail(400, `${at}.group은 영문 소문자·숫자·하이픈으로 된 32자 이내 값이어야 합니다.`);
    if (agent.lead !== undefined && typeof agent.lead !== 'boolean') throw fail(400, `${at}.lead는 true 또는 false여야 합니다.`);
    if (agent.parent !== undefined && agent.parent !== null && typeof agent.parent !== 'string') throw fail(400, `${at}.parent는 상위 에이전트 이름이어야 합니다.`);
    return agent;
  });
  const handoffs = (template.handoffs ?? []).map((pair, index) => {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(name => typeof name !== 'string' || !name.trim())) throw fail(400, `handoffs[${index}]는 ["출발 이름", "도착 이름"] 형식이어야 합니다.`);
    return pair.map(name => name.trim());
  });
  return { workspace: body.workspace, dryRun: body.dryRun === true, includeHandoffs: body.includeHandoffs === true, name: template.template.trim(), agents, handoffs };
}

function flowNodes(current, additions) {
  const known = new Set(current.nodes.map(node => node.id));
  const missing = [...new Set(additions.flatMap(edge => [edge.source, edge.target]))].filter(id => !known.has(`department:${id}`));
  if (!missing.length) return [];
  // Longest-path layering keeps imported handoffs reading left to right.
  const layer = new Map(missing.map(id => [id, 0]));
  for (let pass = 0; pass < missing.length; pass++) {
    let changed = false;
    for (const edge of additions) if (layer.has(edge.source) && layer.has(edge.target) && layer.get(edge.target) < layer.get(edge.source) + 1) { layer.set(edge.target, layer.get(edge.source) + 1); changed = true; }
    if (!changed) break;
  }
  const placed = current.nodes.filter(node => Number.isFinite(node.x) && Number.isFinite(node.y)).map(node => ({ x: node.x, y: node.y }));
  const xs = placed.map(node => node.x), ys = placed.map(node => node.y), layers = Math.max(...layer.values()) + 1;
  // Start right of the existing nodes; if that block would cross the canvas edge, start a band below them instead.
  let left = xs.length ? Math.max(...xs) + FLOW.column : 80, top = ys.length ? Math.min(...ys) : 80;
  if (left + (layers - 1) * FLOW.column > FLOW.max) { left = xs.length ? Math.max(FLOW.min, Math.min(...xs)) : 80; top = ys.length ? Math.max(...ys) + FLOW.row : 80; }
  const clamp = value => Math.max(FLOW.min, Math.min(FLOW.max, value));
  const free = (x, y) => placed.every(node => Math.abs(node.x - x) >= FLOW.width || Math.abs(node.y - y) >= FLOW.height);
  const rows = new Map();
  return missing.map(id => {
    const column = layer.get(id), row = rows.get(column) || 0;
    rows.set(column, row + 1);
    // Never stack two nodes on one spot: step down (then right) to the next free slot inside the canvas range.
    let x = clamp(left + column * FLOW.column), y = clamp(top + row * FLOW.row);
    for (let attempt = 0; attempt < 2000 && !free(x, y); attempt++) {
      y += FLOW.row;
      if (y > FLOW.max) { y = clamp(top); x += FLOW.column; if (x > FLOW.max) x = FLOW.min; }
    }
    placed.push({ x, y });
    return { id: `department:${id}`, type: 'department', referenceId: id, x, y };
  });
}

/**
 * Validates a parsed request against the current project without changing anything.
 * `result` is the JSON body returned to the client; `departments`/`graph` are what a real run would store.
 */
export function planImport(request, { departments = [], connections = [], graph, memoryNodes = [], providerIds = [] } = {}) {
  const errors = [], created = [], skipped = [];
  const existing = new Map();
  for (const item of departments) { const key = nameKey(item.name); if (key && !existing.has(key)) existing.set(key, item); }
  // Names of template agents that already have their own error; references to them are not reported again.
  const seen = new Map(), leads = new Map(), invalid = new Set();
  request.agents.forEach((agent, index) => {
    const name = typeof agent.name === 'string' && agent.name.trim() ? agent.name.trim().slice(0, 40) : `#${index + 1}`;
    const report = (field, message, code = 'invalid') => errors.push({ code, index, name, field, message });
    const key = nameKey(agent.name);
    if (key && seen.has(key)) { report('name', `템플릿 안에서 이름이 중복됩니다(${seen.get(key) + 1}번째 항목과 같음).`, 'duplicate'); invalid.add(key); return; }
    if (key) seen.set(key, index);
    if (agent.lead === true) {
      if (!agent.group) report('lead', 'lead는 group과 함께 지정해야 합니다.');
      else if (leads.has(agent.group)) report('lead', `group "${agent.group}"의 lead가 두 명 이상입니다.`);
      else leads.set(agent.group, index);
    }
    let fields;
    try {
      const input = Object.fromEntries(['name', 'title', 'role', 'provider', 'modelId', 'connectionId'].filter(field => agent[field] !== undefined).map(field => [field, agent[field]]));
      if (input.connectionId === null || input.connectionId === '') delete input.connectionId;
      if (input.connectionId === undefined) {
        const matches = connections.filter(connection => connection.providerId === input.provider);
        if (matches.length === 1) input.connectionId = matches[0].id;
      }
      fields = validateDepartmentInput(input, { connections });
    } catch (error) { report(error.field || 'agent', error.message); if (key) invalid.add(key); return; }
    const match = existing.get(key);
    if (match) { skipped.push({ index, name: match.name, departmentId: match.id, reason: 'exists' }); return; }
    created.push({ index, key, group: agent.group ?? null, lead: agent.lead === true, parent: typeof agent.parent === 'string' && agent.parent.trim() ? agent.parent.trim() : null, department: { id: randomUUID(), code: 'AI', ...fields, parentId: null } });
  });
  if (departments.length + created.length > DEPARTMENT_LIMITS.agents) {
    errors.push({ code: 'limit', field: 'agents', message: `프로젝트당 에이전트는 최대 ${DEPARTMENT_LIMITS.agents}개까지 등록할 수 있습니다(현재 ${departments.length}개 + 새로 ${created.length}개).` });
  }

  const idByName = new Map([...existing].map(([key, item]) => [key, item.id]));
  for (const item of created) idByName.set(item.key, item.department.id);
  const reportFor = (item, field, message, code) => errors.push({ code, index: item.index, name: item.department.name, field, message });
  for (const item of created) {
    if (!item.parent) continue;
    const parentId = idByName.get(nameKey(item.parent));
    if (!parentId) { if (!invalid.has(nameKey(item.parent))) reportFor(item, 'parent', `상위 에이전트 "${item.parent.slice(0, 40)}"를 템플릿이나 현재 프로젝트에서 찾을 수 없습니다.`, 'parent'); }
    else if (parentId === item.department.id) reportFor(item, 'parent', '자기 자신을 상위 에이전트로 지정할 수 없습니다.', 'parent');
    else item.department.parentId = parentId;
  }
  const combined = [...departments, ...created.map(item => item.department)];
  const byId = new Map(combined.map(item => [item.id, item]));
  let cyclic = false;
  for (const item of created) {
    for (let current = item.department.parentId, seen = new Set(); current && !seen.has(current); current = byId.get(current)?.parentId) {
      if (current === item.department.id) { reportFor(item, 'parent', '상위 에이전트 관계가 순환합니다.', 'parent'); cyclic = true; break; }
      seen.add(current);
    }
  }
  if (!cyclic) {
    const parents = effectiveParents(combined);
    for (const item of created) if (depthOf(parents, item.department.id) > MAX_HIERARCHY_DEPTH) reportFor(item, 'parent', `보고 체계는 소유자 아래 최대 ${MAX_HIERARCHY_DEPTH}단계까지 만들 수 있습니다.`, 'parent');
  }

  const handoffs = { included: request.includeHandoffs, total: request.handoffs.length, created: [], skipped: [] };
  let nextGraph = null;
  if (request.includeHandoffs && request.handoffs.length) {
    const current = graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges) ? graph : { nodes: [], edges: [] };
    const signatures = new Set(current.edges.map(edge => `${edge.type}\0${edge.source}\0${edge.target}`)), added = new Set(), additions = [];
    request.handoffs.forEach(([from, to], handoffIndex) => {
      const source = idByName.get(nameKey(from)), target = idByName.get(nameKey(to)), name = `${from.slice(0, 40)} → ${to.slice(0, 40)}`;
      if (!source || !target) { if ([from, to].some(name => invalid.has(nameKey(name)))) return; errors.push({ code: 'handoff', handoffIndex, name, field: 'handoffs', message: `업무 전달 ${handoffIndex + 1}번: "${(source ? to : from).slice(0, 40)}" 에이전트를 템플릿이나 현재 프로젝트에서 찾을 수 없습니다.` }); return; }
      if (source === target) { errors.push({ code: 'handoff', handoffIndex, name, field: 'handoffs', message: `업무 전달 ${handoffIndex + 1}번: 에이전트는 자신에게 업무를 전달할 수 없습니다.` }); return; }
      const signature = `handoff\0department:${source}\0department:${target}`;
      if (signatures.has(signature)) { handoffs.skipped.push({ handoffIndex, source: from, target: to, reason: added.has(signature) ? 'duplicate' : 'exists' }); return; }
      signatures.add(signature); added.add(signature);
      additions.push({ source, target });
      handoffs.created.push({ handoffIndex, source: from, target: to });
    });
    if (additions.length) {
      const allowed = { departments: combined, memoryNodes, providerIds };
      let currentValid = true;
      try { validateGraph(current, allowed); }
      catch (error) {
        currentValid = false;
        errors.push({ code: 'graph', field: 'handoffs', message: `현재 업무 연결 그래프를 확인하지 못했습니다(${error.message}). 업무 연결 화면에서 그래프를 정리한 뒤 다시 가져오거나, 업무 전달선 없이 가져와 주세요.` });
      }
      if (currentValid) {
        const merged = { ...current, nodes: [...current.nodes, ...flowNodes(current, additions)], edges: [...current.edges, ...additions.map(edge => ({ id: `edge-${randomUUID()}`, source: `department:${edge.source}`, target: `department:${edge.target}`, type: 'handoff' }))] };
        try { validateGraph(merged, allowed); nextGraph = merged; }
        catch (error) {
          const cycle = /순환/.test(error.message);
          errors.push({ code: cycle ? 'cycle' : 'graph', field: 'handoffs', message: cycle ? '업무 전달선이 순환합니다. 순환을 없앤 뒤 다시 가져와 주세요. 에이전트도 만들지 않았습니다.' : `업무 전달선을 기존 그래프에 합칠 수 없습니다: ${error.message}` });
        }
      }
    }
  }

  const nameOf = id => byId.get(id)?.name ?? null;
  const result = {
    ok: errors.length === 0, dryRun: request.dryRun, template: request.name, includeHandoffs: request.includeHandoffs,
    created: created.map(item => ({ index: item.index, name: item.department.name, title: item.department.title, provider: item.department.provider, modelId: item.department.modelId, connectionId: item.department.connectionId, group: item.group, lead: item.lead, parent: item.department.parentId ? nameOf(item.department.parentId) : null })),
    skipped, errors, handoffs,
    limit: { existing: departments.length, adding: created.length, max: DEPARTMENT_LIMITS.agents },
  };
  return { result, departments: created.map(item => item.department), graph: nextGraph, layout: created.map(item => ({ id: item.department.id, group: item.group, lead: item.lead })) };
}

/** Status for a rejected real run: only the 64-agent limit is a conflict; everything else is invalid input. */
export function importFailure(result) {
  const status = result.errors.every(error => error.code === 'limit') ? 409 : 400;
  const first = result.errors[0]?.message || '템플릿을 가져오지 못했습니다.';
  return Object.assign(fail(status, result.errors.length > 1 ? `${first} 외 ${result.errors.length - 1}건의 오류가 있어 아무것도 저장하지 않았습니다.` : `${first} 아무것도 저장하지 않았습니다.`), { details: result });
}

/** Children stacked under their parent, indented per level; roots fill columns left to right. */
export function treeLayout(ids, parentOf, { left = CARD.left, top = 160, maxColumns = 6 } = {}) {
  const members = new Set(ids), children = new Map(), roots = [], placed = new Set(), positions = {};
  for (const id of ids) {
    const parent = parentOf(id);
    if (parent && parent !== id && members.has(parent)) children.set(parent, [...(children.get(parent) || []), id]);
    else roots.push(id);
  }
  const column = root => {
    const entries = [];
    const walk = (id, depth) => { if (placed.has(id)) return; placed.add(id); entries.push({ id, depth }); for (const child of children.get(id) || []) walk(child, depth + 1); };
    walk(root, 0);
    return entries;
  };
  const columns = roots.map(column);
  for (const id of ids) if (!placed.has(id)) columns.push(column(id));
  let y = top, width = 0;
  for (let start = 0; start < columns.length; start += maxColumns) {
    let x = left, height = 0;
    for (const entries of columns.slice(start, start + maxColumns)) {
      entries.forEach((entry, index) => { positions[`agent:${entry.id}`] = { x: x + entry.depth * CARD.indent, y: y + index * CARD.treeRow }; });
      x += CARD.width + Math.max(0, ...entries.map(entry => entry.depth)) * CARD.indent + CARD.gap;
      height = Math.max(height, entries.length * CARD.treeRow);
    }
    if (start === 0) width = x - CARD.gap - left;
    y += height + 40;
  }
  return { positions, width, bottom: y };
}

/**
 * Positions for imported agents. Saved positions are returned unchanged; existing agents
 * that were never placed are put below the imported block so cards do not overlap.
 * group/lead decide the layout whenever the template uses groups; within a group column,
 * members that report to another member of the same group are stacked and indented below it.
 * Templates without groups (only "parent") use the reporting tree.
 */
export function importPositions({ positions = {}, departments = [], created = [] }) {
  const next = { ...positions };
  const createdIds = new Set(created.map(item => item.id));
  const unplaced = departments.filter(item => !createdIds.has(item.id) && !positions[`agent:${item.id}`]).map(item => item.id);
  const fresh = Object.keys(positions).length === 0;
  const bottoms = Object.entries(positions).map(([id, point]) => point.y + (id === 'owner' ? 74 : 92));
  const top = fresh ? 160 : Math.max(...bottoms) + 80;
  const parents = effectiveParents(departments);
  const place = (id, point) => { if (!positions[`agent:${id}`]) next[`agent:${id}`] = point; };
  const placeTree = (ids, start, maxColumns) => {
    const tree = treeLayout(ids, id => parents.get(id), { top: start, maxColumns });
    for (const [key, point] of Object.entries(tree.positions)) place(key.slice(6), point);
    return tree;
  };
  let width;
  if (!created.some(item => item.group)) {
    const pending = new Set([...createdIds, ...unplaced]);
    ({ width } = placeTree(departments.map(item => item.id).filter(id => pending.has(id)), top, 4));
  } else {
    const groups = [];
    for (const item of created) if (item.group && item.group !== 'board' && !groups.includes(item.group)) groups.push(item.group);
    const columns = groups.map(group => {
      const members = created.filter(item => item.group === group), ids = new Set(members.map(item => item.id));
      const lead = members.find(item => item.lead) || members[0];
      const parentOf = item => { const parent = parents.get(item.id); return parent && parent !== item.id && ids.has(parent) ? parent : null; };
      const entries = [], seen = new Set();
      const walk = (item, depth) => { if (seen.has(item.id)) return; seen.add(item.id); entries.push({ item, depth }); for (const child of members) if (child !== lead && parentOf(child) === item.id) walk(child, depth + 1); };
      walk(lead, 0);
      for (const item of members) if (!parentOf(item)) walk(item, 0);
      for (const item of members) walk(item, 0);
      const depth = Math.max(0, ...entries.map(entry => entry.depth));
      return { entries, width: CARD.width + depth * CARD.indent, step: depth ? CARD.treeRow : CARD.row };
    });
    width = Math.max(CARD.width, columns.reduce((sum, column) => sum + column.width + CARD.gap, -CARD.gap));
    const center = CARD.left + width / 2;
    let row = top;
    const board = created.filter(item => item.group === 'board').sort((a, b) => Number(b.lead) - Number(a.lead));
    if (board.length) {
      const span = board.length * STEP - CARD.gap;
      board.forEach((item, index) => place(item.id, { x: center - span / 2 + index * STEP, y: row }));
      row += CARD.tier;
    }
    let bottom = row, x = CARD.left;
    for (const column of columns) {
      column.entries.forEach(({ item, depth }, index) => place(item.id, { x: x + depth * CARD.indent, y: row + index * column.step }));
      bottom = Math.max(bottom, row + column.entries.length * column.step);
      x += column.width + CARD.gap;
    }
    const loose = [...created.filter(item => !item.group).map(item => item.id), ...unplaced];
    if (loose.length) placeTree(loose, groups.length || board.length ? bottom + 36 : row, Math.max(4, groups.length));
  }
  if (fresh) next.owner = { x: CARD.left + width / 2 - CARD.owner / 2, y: 32 };
  return next;
}
