import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHQServer } from '../server.mjs';

test('graph vendors ship unchanged and load before adapters through the local allowlist', async t => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'imperium-vendors-'));
  const app = createHQServer({ dataDir, workspace: dataDir, port: 0, providers: {
    detectProviders: async () => [], startProvider: async () => { throw Error('No inference allowed'); },
  } });
  t.after(async () => { await app.close(); await rm(dataDir, { recursive: true, force: true }); });
  const { url } = await app.start();
  const index = await (await fetch(url)).text();
  for (const [route, file, adapter, consumer] of [
    ['/vendor/cytoscape.min.js', 'cytoscape/dist/cytoscape.min.js', '/knowledge-graph.js', '/knowledge.js'],
    ['/vendor/chart.umd.js', 'chart.js/dist/chart.umd.js', '/analytics-charts.js', '/analytics.js'],
  ]) {
    const response = await fetch(url + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL('../node_modules/' + file, import.meta.url)));
    assert.ok(index.indexOf(`src="${route}"`) < index.indexOf(`src="${adapter}"`));
    assert.ok(index.indexOf(`src="${adapter}"`) < index.indexOf(`src="${consumer}"`));
    assert.equal((await fetch(url + adapter)).status, 200);
  }
  assert.doesNotMatch(index, /<script[^>]+src=["']https?:/);
  for (const feature of ['output-view', 'provider-mascots', 'live-progress', 'access-review', 'conversations']) {
    assert.equal((await fetch(`${url}/${feature}.js`)).status, 200);
    assert.equal((await fetch(`${url}/${feature}.css`)).status, 200);
    assert.ok(index.indexOf(`src="/${feature}.js"`) < index.indexOf('src="/app.js"'));
  }
  assert.equal((await fetch(url + '/vendor/cytoscape/package.json')).status, 404);
  assert.equal((await fetch(url + '/vendor/chart.js.map')).status, 404);
  for (const [original, shipped] of [['cytoscape/LICENSE', 'cytoscape-LICENSE.txt'], ['chart.js/LICENSE.md', 'chartjs-LICENSE.txt']]) {
    // Git checkouts can convert text licenses to CRLF on Windows. Preserve and
    // compare every character of the notice while allowing that text encoding.
    const originalNotice = await readFile(new URL('../node_modules/' + original, import.meta.url), 'utf8');
    const shippedNotice = await readFile(new URL('../public/licenses/' + shipped, import.meta.url), 'utf8');
    assert.equal(originalNotice.replace(/\r\n/g, '\n'), shippedNotice.replace(/\r\n/g, '\n'));
  }
});
