import assert from 'node:assert/strict';
import test from 'node:test';
import { downstreamDepartments, upstreamDependencies, validateGraph } from '../lib/graph.mjs';

const scope = {
  departments: [{ id: 'strategy' }, { id: 'engineering' }, { id: 'research' }, { id: 'quality' }],
  memoryNodes: [{ id: 'note-one' }, { id: 'archived-note', archived: true }],
  providerIds: ['codex', 'claude'],
};
const node = (type, referenceId, values = {}) => ({ id: type === 'commander' ? 'commander' : `${type}:${referenceId}`, type, referenceId, x: 100, y: 200, ...values });
const edge = (id, from, to, type = 'handoff') => ({ id, source: from, target: to, type });
const departments = () => scope.departments.map(item => node('department', item.id));
const rejects = input => assert.throws(() => validateGraph(input, scope), error => error.status === 400);

test('valid UI canvas is sanitized without mutating input or persisting derived hierarchy', () => {
  const input = {
    workspace: 'ignored-client-scope',
    nodes: [node('commander', 'commander'), node('provider', 'codex'), node('department', 'strategy', { x: 15.127, prompt: 'not persisted' }), node('memory', 'note-one')],
    edges: [edge('context-1', 'memory:note-one', 'department:strategy', 'memory_context')],
  };
  const before = structuredClone(input);
  const graph = validateGraph(input, scope);
  assert.deepEqual(input, before);
  assert.deepEqual(Object.keys(graph), ['nodes', 'edges']);
  assert.deepEqual(graph.nodes[2], node('department', 'strategy', { x: 15.13 }));
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].type, 'memory_context');
  graph.nodes[0].x = 800;
  assert.equal(input.nodes[0].x, 100);
  rejects({ nodes: input.nodes, edges: [edge('org', 'commander', 'provider:codex', 'organization')] });
});

test('references must belong to the supplied workspace and match deterministic node IDs', () => {
  for (const item of [
    node('department', 'other-project-department'),
    node('memory', 'other-workspace-memory'),
    node('memory', 'archived-note'),
    node('provider', 'unknown-provider'),
    node('department', 'strategy', { id: 'department:engineering' }),
    node('commander', 'not-commander'),
    node('shell', 'strategy'),
  ]) rejects({ nodes: [item], edges: [] });
  assert.deepEqual(validateGraph({ nodes: [], edges: [] }, scope), { nodes: [], edges: [] });
  assert.equal(validateGraph({ nodes: [node('provider', 'codex')], edges: [] }, { ...scope, providerIds: new Set(['codex']) }).nodes.length, 1);
});

test('node coordinates reject non-finite values and follow canvas bounds', () => {
  for (const x of [NaN, Infinity, -Infinity, '100', null, undefined]) rejects({ nodes: [node('department', 'strategy', { x })], edges: [] });
  const graph = validateGraph({ nodes: [node('department', 'strategy', { x: -999999, y: 999999 })], edges: [] }, scope);
  assert.equal(graph.nodes[0].x, -2000);
  assert.equal(graph.nodes[0].y, 6000);
});

test('duplicates, missing endpoints, invalid edge directions and self connections are rejected', () => {
  const nodes = [...departments(), node('memory', 'note-one'), node('provider', 'codex')];
  rejects({ nodes: [...nodes, nodes[0]], edges: [] });
  const valid = edge('first', 'department:strategy', 'department:engineering');
  for (const edges of [
    [valid, { ...valid, id: 'second' }],
    [valid, edge('first', 'department:research', 'department:quality')],
    [edge('self', 'department:strategy', 'department:strategy')],
    [edge('missing', 'department:strategy', 'department:missing')],
    [edge('wrong', 'memory:note-one', 'department:strategy')],
    [edge('reverse', 'department:strategy', 'memory:note-one', 'memory_context')],
    [edge('provider-connection', 'provider:codex', 'department:strategy')],
  ]) rejects({ nodes, edges });
});

test('handoffs reject cycles, including cycles outside the selected workflow component', () => {
  const edges = [edge('ab', 'department:strategy', 'department:engineering'), edge('bc', 'department:engineering', 'department:quality'), edge('ca', 'department:quality', 'department:strategy')];
  rejects({ nodes: departments(), edges });
  assert.throws(() => downstreamDepartments('research', edges), error => error.status === 400);
  assert.throws(() => upstreamDependencies(edges), error => error.status === 400);
});

test('diamond workflows return each reachable department once after all reachable prerequisites', () => {
  const edges = [
    edge('eq', 'department:engineering', 'department:quality'),
    edge('se', 'department:strategy', 'department:engineering'),
    edge('rq', 'department:research', 'department:quality'),
    edge('sr', 'department:strategy', 'department:research'),
    edge('memory', 'memory:note-one', 'department:strategy', 'memory_context'),
  ];
  assert.deepEqual(downstreamDepartments('strategy', edges), ['engineering', 'research', 'quality']);
  assert.deepEqual(downstreamDepartments('department:strategy', edges), ['engineering', 'research', 'quality']);
  assert.deepEqual(downstreamDepartments('engineering', edges), ['quality']);
  assert.deepEqual(downstreamDepartments('quality', edges), []);
  assert.deepEqual(downstreamDepartments('unconnected', edges), []);
  assert.deepEqual(upstreamDependencies(edges), { engineering: ['strategy'], quality: ['engineering', 'research'], research: ['strategy'], strategy: [] });
});

test('node and edge limits are enforced before parsing oversized payload contents', () => {
  rejects({ nodes: Array(501).fill(null), edges: [] });
  rejects({ nodes: [], edges: Array(1001).fill(null) });
  assert.throws(() => downstreamDepartments('strategy', Array(1001).fill(null)), error => error.status === 400);
  rejects(null); rejects({ nodes: {} }); rejects({ nodes: [], edges: null });
});

test('limits accept a full valid canvas and do not turn display properties into executable actions', () => {
  const ids = Array.from({ length: 500 }, (_, index) => `dept-${index}`);
  const nodes = ids.map(id => node('department', id, { command: 'arbitrary shell', label: '<script>ignored</script>' }));
  const edges = ids.slice(1).map((id, index) => edge(`edge-${index}`, `department:${ids[index]}`, `department:${id}`));
  const graph = validateGraph({ nodes, edges }, { departments: ids, memoryNodes: [], providerIds: [] });
  assert.equal(graph.nodes.length, 500);
  assert.equal(graph.edges.length, 499);
  assert.equal(downstreamDepartments(ids[0], graph.edges).length, 499);
  assert.ok(graph.nodes.every(item => !Object.hasOwn(item, 'command') && !Object.hasOwn(item, 'label')));
});
