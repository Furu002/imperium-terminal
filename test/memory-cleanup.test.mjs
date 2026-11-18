import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMemoryStore } from '../lib/memory.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'imperium-cleanup-'));
  const workspace = path.join(directory, 'project'), other = path.join(directory, 'other');
  mkdirSync(workspace); mkdirSync(other);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const dataDir = path.join(directory, 'data');
  const store = createMemoryStore({ dataDir });
  const first = store.upsert({ workspace, title: 'First', content: 'One isolated observation' });
  const second = store.upsert({ workspace, title: 'Second', content: 'Independent result' });
  return { store, workspace, other, dataDir, first, second };
}
const status = wanted => error => error.status === wanted;
const revisions = (store, edge, workspace) => ({ workspace, expectedSourceRevision: store.get(edge.source).revision, expectedTargetRevision: store.get(edge.target).revision });

test('manual unlink persists only the edge removal and leaves notes/history intact', t => {
  const { store, workspace, dataDir, first, second } = fixture(t);
  const edge = store.link({ source: first.id, target: second.id, type: 'depends_on' });
  const before = store.snapshot({ workspace });
  assert.deepEqual(store.unlink(edge.id, revisions(store, edge, workspace)), { removed: true, id: edge.id });
  const after = createMemoryStore({ dataDir }).snapshot({ workspace });
  assert.deepEqual(after.nodes, before.nodes);
  assert.deepEqual(after.history, before.history);
  assert.equal(after.edges.length, 0);
});

test('unlink rejects missing/stale revisions and foreign scopes without writing', t => {
  const { store, workspace, other, dataDir, first, second } = fixture(t);
  const edge = store.link({ source: first.id, target: second.id });
  const old = revisions(store, edge, workspace);
  store.upsert({ id: first.id, content: 'Updated note' }, { expectedRevision: first.revision });
  const original = readFileSync(path.join(dataDir, 'memory-graph.json'), 'utf8');
  assert.throws(() => store.unlink(edge.id, { workspace }), status(400));
  assert.throws(() => store.unlink(edge.id, old), status(409));
  assert.throws(() => store.unlink(edge.id, { ...old, workspace: other }), status(404));
  assert.throws(() => store.unlink('missing', { workspace }), status(404));
  assert.equal(readFileSync(path.join(dataDir, 'memory-graph.json'), 'utf8'), original);
});

test('derived wiki and keyword links require editing their source rather than deletion', t => {
  const { store, workspace, first, second } = fixture(t);
  store.upsert({ id: first.id, content: 'See [[Second]]' }, { expectedRevision: first.revision });
  const wiki = store.snapshot({ workspace }).edges.find(edge => edge.provenance === 'wikilink');
  assert.ok(wiki);
  assert.throws(() => store.unlink(wiki.id, revisions(store, wiki, workspace)), status(409));
  const keyword = store.link({ source: first.id, target: second.id, type: 'depends_on', provenance: 'keyword' });
  assert.throws(() => store.unlink(keyword.id, revisions(store, keyword, workspace)), status(409));
  const manual = store.link({ source: first.id, target: second.id });
  store.unlink(manual.id, revisions(store, manual, workspace));
  assert.ok(store.snapshot({ workspace }).edges.some(edge => edge.provenance === 'wikilink'));
});

test('legacy manual links without a provenance marker remain removable', t => {
  const { store, dataDir, workspace, first, second } = fixture(t);
  const edge = store.link({ source: first.id, target: second.id });
  const file = path.join(dataDir, 'memory-graph.json');
  const state = JSON.parse(readFileSync(file, 'utf8'));
  delete state.edges.find(value => value.id === edge.id).provenance;
  writeFileSync(file, JSON.stringify(state));
  const restored = createMemoryStore({ dataDir });
  assert.equal(restored.unlink(edge.id, revisions(restored, edge, workspace)).removed, true);
});

test('archive excludes notes from retrieval and active graph, and restore retains manual links', t => {
  const { store, workspace, first, second } = fixture(t);
  store.link({ source: first.id, target: second.id });
  const archived = store.upsert({ id: first.id, archived: true }, { expectedRevision: first.revision });
  assert.equal(store.snapshot({ workspace }).nodes.length, 2);
  assert.equal(store.snapshot({ workspace }).edges.length, 0);
  assert.ok(store.search({ workspace, query: 'isolated' }).memories.every(node => node.id !== first.id));
  store.upsert({ id: first.id, archived: false }, { expectedRevision: archived.revision });
  assert.equal(store.snapshot({ workspace }).edges.length, 1);
  assert.equal(store.get(first.id).content, first.content);
});
