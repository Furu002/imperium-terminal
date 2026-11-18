const NODE_TYPES = new Set(['commander', 'provider', 'department', 'memory']);
const EDGE_TYPES = new Set(['memory_context', 'handoff']);
const MAX_NODES = 500;
const MAX_EDGES = 1000;
const invalid = message => Object.assign(new Error(message), { status: 400 });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function identifier(value, label = 'ID', max = 128) {
  if (typeof value !== 'string' || value.length > max || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) {
    throw invalid(`올바른 ${label}가 필요합니다.`);
  }
  return value;
}

function allowedReferences(values, label, { activeOnly = false } = {}) {
  if (!(Array.isArray(values) || values instanceof Set)) throw invalid(`${label} 참조 목록이 올바르지 않습니다.`);
  const result = new Set();
  for (const item of values) {
    if (activeOnly && isObject(item) && item.archived === true) continue;
    result.add(identifier(typeof item === 'string' ? item : item?.id, `${label} ID`));
  }
  return result;
}

function coordinate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid('노드 좌표는 유한한 숫자여야 합니다.');
  return Math.round(Math.max(-2000, Math.min(6000, value)) * 100) / 100;
}

function departmentReference(value, { allowRaw = false } = {}) {
  identifier(value, '부서 노드 ID', 200);
  if (value.startsWith('department:')) return identifier(value.slice('department:'.length), '부서 ID');
  if (allowRaw) return identifier(value, '부서 ID');
  throw invalid('업무 전달 연결은 부서 노드끼리만 사용할 수 있습니다.');
}

function handoffGraph(edges) {
  if (!Array.isArray(edges) || edges.length > MAX_EDGES) throw invalid('연결은 최대 1,000개까지 사용할 수 있습니다.');
  const outgoing = new Map();
  const incoming = new Map();
  const ensure = id => {
    if (!outgoing.has(id)) outgoing.set(id, new Set());
    if (!incoming.has(id)) incoming.set(id, new Set());
  };
  for (const edge of edges) {
    if (!isObject(edge)) throw invalid('올바른 연결 항목이 필요합니다.');
    if (edge.type !== 'handoff') continue;
    const source = departmentReference(edge.source);
    const target = departmentReference(edge.target);
    if (source === target) throw invalid('부서는 자신에게 업무를 전달할 수 없습니다.');
    ensure(source); ensure(target);
    outgoing.get(source).add(target);
    incoming.get(target).add(source);
  }
  return { outgoing, incoming };
}

function topologicalOrder({ outgoing, incoming }) {
  const degrees = new Map([...incoming].map(([id, values]) => [id, values.size]));
  const ready = [...degrees].filter(([, degree]) => degree === 0).map(([id]) => id).sort();
  const order = [];
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const target of [...outgoing.get(id)].sort()) {
      degrees.set(target, degrees.get(target) - 1);
      if (degrees.get(target) === 0) { ready.push(target); ready.sort(); }
    }
  }
  if (order.length !== incoming.size) throw invalid('순환하는 업무 전달은 만들 수 없습니다.');
  return order;
}

/**
 * Validate a single workspace's editable canvas. The caller supplies that
 * workspace's department/memory allowlists and persists the returned value.
 * Organization hierarchy lines are derived in the UI and are never saved as
 * user connections. Unknown display/execution properties are deliberately dropped.
 */
export function validateGraph(input, { departments = [], memoryNodes = [], providerIds = [] } = {}) {
  if (!isObject(input) || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) throw invalid('노드와 연결 배열이 필요합니다.');
  if (input.nodes.length > MAX_NODES) throw invalid('노드는 최대 500개까지 사용할 수 있습니다.');
  if (input.edges.length > MAX_EDGES) throw invalid('연결은 최대 1,000개까지 사용할 수 있습니다.');
  const allowed = {
    department: allowedReferences(departments, '부서'),
    memory: allowedReferences(memoryNodes, '메모리', { activeOnly: true }),
    provider: allowedReferences(providerIds, '모델 제공자'),
  };
  const byId = new Map();
  const nodes = input.nodes.map(item => {
    if (!isObject(item) || !NODE_TYPES.has(item.type)) throw invalid('지원하지 않는 노드 종류입니다.');
    const id = identifier(item.id, '노드 ID', 200);
    const referenceId = identifier(item.referenceId, '참조 ID');
    if (item.type === 'commander') {
      if (id !== 'commander' || referenceId !== 'commander') throw invalid('본부장 노드의 ID가 올바르지 않습니다.');
    } else {
      if (id !== `${item.type}:${referenceId}`) throw invalid('노드 ID와 참조 ID가 일치하지 않습니다.');
      if (!allowed[item.type].has(referenceId)) throw invalid('현재 작업 폴더에서 사용할 수 없는 노드 참조입니다.');
    }
    if (byId.has(id)) throw invalid('같은 노드를 중복해서 저장할 수 없습니다.');
    const node = { id, type: item.type, referenceId, x: coordinate(item.x), y: coordinate(item.y) };
    byId.set(id, node);
    return node;
  });
  const edgeIds = new Set();
  const connections = new Set();
  const edges = input.edges.map(item => {
    if (!isObject(item) || !EDGE_TYPES.has(item.type)) throw invalid('기억 연결과 부서 간 업무 전달만 저장할 수 있습니다.');
    const id = identifier(item.id, '연결 ID', 200);
    const source = identifier(item.source, '출발 노드 ID', 200);
    const target = identifier(item.target, '도착 노드 ID', 200);
    const first = byId.get(source);
    const second = byId.get(target);
    if (!first || !second) throw invalid('연결할 노드를 찾을 수 없습니다.');
    if (source === target) throw invalid('자기 자신을 연결할 수 없습니다.');
    if (item.type === 'memory_context' && (first.type !== 'memory' || second.type !== 'department')) throw invalid('기억 문맥은 메모리에서 부서로만 연결할 수 있습니다.');
    if (item.type === 'handoff' && (first.type !== 'department' || second.type !== 'department')) throw invalid('업무 전달은 부서끼리만 연결할 수 있습니다.');
    const signature = `${item.type}\0${source}\0${target}`;
    if (edgeIds.has(id) || connections.has(signature)) throw invalid('같은 연결을 중복해서 저장할 수 없습니다.');
    edgeIds.add(id); connections.add(signature);
    return { id, source, target, type: item.type };
  });
  topologicalOrder(handoffGraph(edges));
  return { nodes, edges };
}

/** Reachable department reference IDs, excluding start, in deterministic DAG order. */
export function downstreamDepartments(start, edges) {
  const source = departmentReference(start, { allowRaw: true });
  const graph = handoffGraph(edges);
  const order = topologicalOrder(graph);
  const reachable = new Set();
  const pending = [source];
  while (pending.length) {
    const id = pending.pop();
    for (const target of graph.outgoing.get(id) ?? []) {
      if (!reachable.has(target)) { reachable.add(target); pending.push(target); }
    }
  }
  return order.filter(id => id !== source && reachable.has(id));
}

/** Plain reference-ID -> direct prerequisite reference IDs; never executes work. */
export function upstreamDependencies(edges) {
  const graph = handoffGraph(edges);
  topologicalOrder(graph);
  return Object.fromEntries([...graph.incoming].sort(([a], [b]) => a.localeCompare(b)).map(([id, sources]) => [id, [...sources].sort()]));
}
