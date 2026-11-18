import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalMemoryWorkspace, createMemoryStore } from '../lib/memory.mjs';

function fixture(t) {
  const directory = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'imperium-wikilinks-')));
  const workspace = path.join(directory, 'workspace'), other = path.join(directory, 'other'), dataDir = path.join(directory, 'data');
  mkdirSync(workspace); mkdirSync(other);
  t.after(() => {
    const relative = path.relative(realpathSync.native(tmpdir()), directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(directory).startsWith('imperium-wikilinks-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const store = createMemoryStore({ dataDir });
  return { directory, workspace, other, dataDir, file: path.join(dataDir, 'memory-graph.json'), store, note: (id, title, content = 'A distinct source fact.', extra = {}) => store.upsert({ id, workspace, title, content, ...extra }) };
}
const wiki = (store, workspace) => store.snapshot({ workspace }).edges.filter(edge => edge.provenance === 'wikilink');

test('wikilinks resolve NFKC case-insensitive exact titles, aliases, numbers and literal path/tag titles', t => {
  const f = fixture(t);
  const targets = ['한글 제목', '日本語ノート', 'Alpha API', '42', '#태그', '폴더/문서'].map((title, index) => f.note(`target-${index}`, title, `Unique fact ${index}`));
  const source = f.note('source', 'Source', '[[ 한글 제목 | 별칭 ]] [[日本語ノート|表示]] [[ＡＬＰＨＡ ＡＰＩ]] [[42]] [[#태그]] [[폴더/문서]] [[Source]] [[target-0]] [[Alpha API#heading]]');
  const edges = wiki(f.store, f.workspace);
  assert.equal(edges.length, targets.length);
  assert.ok(edges.every(edge => edge.source === source.id && edge.type === 'related'));
  assert.deepEqual(new Set(edges.map(edge => edge.target)), new Set(targets.map(node => node.id)));
  assert.ok(!edges.some(edge => edge.target === source.id));
  assert.equal(f.store.snapshot({ workspace: f.workspace }).stats.wikiEdgeCount, targets.length);
});

test('forward links automatically resolve later without changing the source or persisting derived edges', t => {
  const f = fixture(t);
  const source = f.note('source', 'Forward reference', 'See [[Future title|later]].');
  assert.deepEqual(wiki(f.store, f.workspace), []);
  const target = f.note('future', 'Future title');
  const before = readFileSync(f.file, 'utf8');
  const edge = wiki(f.store, f.workspace)[0];
  assert.equal(edge.source, source.id); assert.equal(edge.target, target.id);
  f.store.search({ workspace: f.workspace, query: 'Forward reference' });
  assert.equal(readFileSync(f.file, 'utf8'), before);
  assert.ok(!JSON.parse(before).edges.some(value => value.provenance === 'wikilink'));
  assert.equal(f.store.get(source.id).revision, 1);
  assert.equal(wiki(createMemoryStore({ dataDir: f.dataDir }), f.workspace)[0].id, edge.id);
});

test('renaming, deletion and replacement invalidate resolved targets while duplicate titles remain ambiguous', t => {
  const f = fixture(t);
  const source = f.note('source', 'Origin', '[[Alpha]] [[Alpha|again]]');
  const first = f.note('first', 'Ａｌｐｈａ');
  assert.equal(wiki(f.store, f.workspace).length, 1);
  const duplicate = f.note('second', 'alpha');
  assert.deepEqual(wiki(f.store, f.workspace), []);
  f.store.upsert({ id: duplicate.id, archived: true });
  assert.equal(wiki(f.store, f.workspace)[0].target, first.id);
  f.store.upsert({ id: first.id, title: 'Beta' });
  assert.deepEqual(wiki(f.store, f.workspace), []);
  f.store.upsert({ id: source.id, content: '[[Beta|renamed]]' });
  assert.equal(wiki(f.store, f.workspace)[0].target, first.id);
  f.store.remove(first.id); assert.deepEqual(wiki(f.store, f.workspace), []);
  const replacement = f.note('replacement', 'Beta');
  assert.equal(wiki(f.store, f.workspace)[0].target, replacement.id);
});

test('project isolation and archived endpoints apply to derived and stored graph edges', t => {
  const f = fixture(t);
  const source = f.note('source', 'Local origin', '[[Only elsewhere]]');
  f.store.upsert({ id: 'foreign', workspace: f.other, title: 'Only elsewhere', content: 'OTHER_PROJECT_PRIVATE' });
  assert.deepEqual(wiki(f.store, f.workspace), []);
  const target = f.note('local', 'Only elsewhere');
  assert.equal(wiki(f.store, f.workspace)[0].target, target.id);
  assert.deepEqual(wiki(f.store, f.other), []);
  f.store.link({ source: source.id, target: target.id, type: 'depends_on' });
  f.store.upsert({ id: target.id, archived: true });
  assert.deepEqual(f.store.snapshot({ workspace: f.workspace }).edges, []);
  f.store.upsert({ id: target.id, archived: false });
  assert.equal(f.store.snapshot({ workspace: f.workspace }).edges.length, 2);
  f.store.upsert({ id: source.id, archived: true });
  assert.deepEqual(f.store.snapshot({ workspace: f.workspace }).edges, []);
  assert.ok(!JSON.stringify(f.store.snapshot({ workspace: f.workspace })).includes('OTHER_PROJECT_PRIVATE'));
});

test('user related links outrank wikilinks, wikilinks outrank keywords, and opposite directions and other types survive', t => {
  const f = fixture(t);
  const first = f.note('z-origin', 'First', '[[Second]] [[Second|duplicate]]');
  const second = f.note('a-target', 'Second', '[[First]]');
  f.store.link({ source: first.id, target: second.id, provenance: 'keyword' });
  let related = f.store.snapshot({ workspace: f.workspace }).edges.filter(edge => edge.type === 'related');
  assert.equal(related.length, 2);
  assert.ok(related.every(edge => edge.provenance === 'wikilink'));
  assert.ok(related.some(edge => edge.source === first.id && edge.target === second.id));
  assert.ok(related.some(edge => edge.source === second.id && edge.target === first.id));
  const manual = f.store.link({ source: first.id, target: second.id });
  const depends = f.store.link({ source: first.id, target: second.id, type: 'depends_on' });
  const supersedes = f.store.link({ source: second.id, target: first.id, type: 'supersedes' });
  const graph = f.store.snapshot({ workspace: f.workspace });
  related = graph.edges.filter(edge => edge.type === 'related');
  assert.deepEqual(related, [manual]);
  assert.ok(graph.edges.some(edge => edge.id === depends.id)); assert.ok(graph.edges.some(edge => edge.id === supersedes.id));
  assert.throws(() => f.store.link({ source: first.id, target: second.id, provenance: 'wikilink' }), error => error.status === 400);
});

test('retrieval follows at most one explicit hop from a keyword seed while preserving constraints and budgets', t => {
  const f = fixture(t);
  const constraint = f.note('constraint', 'Pinned constraint', 'Keep user files intact.', { kind: 'constraint', pinned: true });
  const third = f.note('third', 'Gamma', 'TWO_HOP_PRIVATE_DETAIL');
  const target = f.note('target', 'Beta', `TARGET_DETAIL_B [[${third.title}]]`);
  const manual = f.note('manual', 'Delta', 'MANUAL_LINK_DETAIL');
  const seed = f.note('seed', 'uniqueanchorz protocol', `Follow [[${target.title}]] for implementation.`);
  f.store.link({ source: seed.id, target: manual.id });
  f.store.upsert({ id: 'foreign', workspace: f.other, title: 'uniqueanchorz secret', content: 'OTHER_PROJECT_PRIVATE' });
  const result = f.store.search({ workspace: f.workspace, query: 'uniqueanchorz', limit: 6, maxChars: 1600 });
  assert.equal(result.memories[0].id, constraint.id);
  assert.ok(result.memories.some(node => node.id === seed.id));
  assert.ok(result.memories.some(node => node.id === target.id && node.retrieval?.sourceId === seed.id && node.retrieval.provenance === 'wikilink'));
  assert.ok(result.memories.some(node => node.id === manual.id && node.retrieval?.provenance === 'user'));
  assert.equal(result.stats.linkedCount, 2); assert.equal(result.stats.graphMethod, 'one-hop-explicit-links');
  assert.equal(result.stats.method, 'local-keyword');
  assert.ok(result.context.length <= 1600); assert.equal(result.stats.contextChars, result.context.length);
  assert.doesNotMatch(result.context, /TWO_HOP_PRIVATE_DETAIL|OTHER_PROJECT_PRIVATE/);
  assert.equal(f.store.search({ workspace: f.workspace, query: 'uniqueanchorz', limit: 2 }).stats.linkedCount, 0);
  assert.equal(f.store.search({ workspace: f.workspace, query: 'unmatchedxyz' }).stats.linkedCount, 0);
});

function seededStore(f, definitions) {
  const workspace = canonicalMemoryWorkspace(f.workspace), time = '2026-11-18T00:00:00.000Z';
  const nodes = definitions.map(({ id, title, content }) => ({ id, title, content, workspace, kind: 'note', source: 'user', confidence: 'user', tags: [], pinned: false, archived: false, revision: 1, createdAt: time, updatedAt: time }));
  writeFileSync(f.file, JSON.stringify({ version: 1, nodes, edges: [], history: [] }));
  return createMemoryStore({ dataDir: f.dataDir });
}

test('large project graphs use deterministic bounded derived edges and return detached cached snapshots', t => {
  const f = fixture(t);
  const definitions = Array.from({ length: 5000 }, (_, index) => ({ id: `note-${index}`, title: `Node ${index}`, content: `[[Node ${(index + 1) % 5000}]]` }));
  const store = seededStore(f, definitions);
  const first = store.snapshot({ workspace: f.workspace });
  assert.equal(first.nodes.length, 5000); assert.equal(first.edges.length, 5000);
  assert.equal(first.stats.wikiEdgesTruncated, false);
  const originalTarget = first.edges[0].target; first.edges[0].target = 'caller mutation';
  assert.equal(store.snapshot({ workspace: f.workspace }).edges[0].target, originalTarget);
  assert.deepEqual(JSON.parse(readFileSync(f.file, 'utf8')).edges, []);
});

test('dense links and excessively linked notes expose clipping instead of unbounded graph work', t => {
  const f = fixture(t);
  const targets = Array.from({ length: 129 }, (_, index) => ({ id: `target-${index}`, title: `Target ${index}`, content: 'Distinct detail.' }));
  const sources = Array.from({ length: 50 }, (_, index) => ({ id: `source-${index}`, title: `Source ${index}`, content: targets.map(node => `[[${node.title}]]`).join(' ') }));
  const store = seededStore(f, [...targets, ...sources]);
  const snapshot = store.snapshot({ workspace: f.workspace });
  assert.equal(snapshot.edges.length, 5000);
  assert.equal(snapshot.stats.wikiEdgesTruncated, true);
  assert.ok(snapshot.stats.wikiLinksTruncated > 0);
  assert.ok(!snapshot.edges.some(edge => edge.target === 'target-128'));
});
