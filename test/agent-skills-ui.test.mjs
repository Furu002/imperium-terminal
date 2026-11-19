import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const source = readFileSync(new URL('../public/agent-skills.js', import.meta.url), 'utf8');
const workspace = 'C:\\Team Project', other = 'C:\\Other Project';
const skill = (extra = {}) => ({ id: 'skill-a', name: 'Code review', relativePath: 'skills/review/SKILL.md', sha256: 'a'.repeat(64), bytes: 100, originUrl: '', description: 'Inspect actual code', ...extra });
const catalog = (extra = {}) => ({ workspace, skills: [skill()], bindings: { engineering: [] }, revision: 1, ...extra });
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(t, { handler, initial, visible = true, lang = '' } = {}) {
  const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(`<html lang="${lang}"><div id="skills-section"></div></html>`, { runScripts: 'outside-only', url: 'http://127.0.0.1:4310', virtualConsole });
  let state = initial || { settings: { workspace, language: 'en' }, departments: [{ id: 'engineering', name: 'Engineering' }, { id: 'quality', name: 'Quality' }], server: { skillsRevision: 0 } };
  const calls = [], events = [], toasts = []; dom.window.eval(source);
  dom.window.addEventListener('imperium:skills-changed', event => events.push(event.detail));
  const controller = dom.window.ImperiumSkills.init({ container: '#skills-section', getState: () => state, toast: value => toasts.push(value), api: async (url, options) => { calls.push({ url, options }); if (handler) return handler(url, options); return url.includes('/skill-a') ? { workspace, skill: { ...skill(), content: 'Actual local skill source' } } : catalog(); } });
  controller.render(state, { visible }); t.after(() => { controller.destroy(); dom.window.close(); });
  return { dom, document: dom.window.document, window: dom.window, controller, calls, events, toasts, errors, get state() { return state; }, render(value, options) { state = value; controller.render(state, options); } };
}
const submit = (ui, selector) => ui.document.querySelector(selector).dispatchEvent(new ui.window.Event('submit', { cancelable: true, bubbles: true }));

test('lists actual local registrations separately from equipment without installation or execution requests', async t => {
  const ui = fixture(t); await settle();
  assert.equal(ui.document.querySelectorAll('[data-skill-id]').length, 1); assert.equal(ui.document.querySelector('[data-skill-toggle]').checked, false);
  assert.match(ui.document.body.textContent, /License unverified/); assert.match(ui.document.body.textContent, /Equipment is separate from actual use/); assert.match(ui.document.body.textContent, /do not install tools or expand permissions/);
  assert.equal(ui.calls.length, 1); assert.equal(new URL(ui.calls[0].url, 'http://local').searchParams.get('workspace'), 'c:/team project'); assert.equal(Object.keys(ui.calls[0].options).length, 0); assert.deepEqual(ui.errors, []);
});

test('registers an entered local path with scoped metadata, refreshes and emits a change event', async t => {
  let registered = false;
  const ui = fixture(t, { handler: async (url, options) => { if (options.method === 'POST') { registered = true; return { workspace, skill: skill(), revision: 2 }; } return catalog({ skills: registered ? [skill()] : [] }); } }); await settle();
  ui.document.querySelector('[data-skill-path]').value = 'skills/review/SKILL.md'; ui.document.querySelector('[data-skill-origin]').value = 'https://github.com/example/skills'; submit(ui, '[data-skill-register]'); await settle();
  const request = ui.calls.find(call => call.options.method === 'POST'); assert.equal(request.url, '/api/skills'); assert.equal(request.options.body.workspace, 'c:/team project'); assert.equal(request.options.body.path, 'skills/review/SKILL.md'); assert.equal(request.options.body.originUrl, 'https://github.com/example/skills');
  assert.equal(ui.document.querySelector('[data-skill-path]').value, ''); assert.equal(ui.events.length, 1); assert.equal(ui.events[0].workspace, 'c:/team project'); assert.ok(ui.document.querySelector('[data-skill-id]')); assert.equal(ui.calls.filter(call => call.options.method === 'POST').length, 1);
});

test('equips and unequips only the selected current agent through the real binding endpoint', async t => {
  let ids = [];
  const ui = fixture(t, { handler: async (url, options) => { if (options.method === 'PUT') { ids = options.body.skillIds; return catalog({ bindings: { engineering: ids }, revision: 2 }); } return catalog({ bindings: { engineering: ids } }); } }); await settle();
  ui.document.querySelector('[data-skill-toggle]').click(); assert.equal(ui.document.querySelector('[data-skill-save]').disabled, false); ui.document.querySelector('[data-skill-save]').click(); await settle();
  assert.equal(ui.calls.find(call => call.options.method === 'PUT').url, '/api/skills/bindings/engineering'); assert.deepEqual([...ids], ['skill-a']); assert.equal(ui.document.querySelector('[data-skill-toggle]').checked, true);
  ui.document.querySelector('[data-skill-toggle]').click(); ui.document.querySelector('[data-skill-save]').click(); await settle(); assert.deepEqual([...ids], []);
  assert.ok(ui.calls.every(call => !/workflows|tasks|install|logout/.test(call.url)));
});

test('previews source as literal text and keeps registration, license and source provenance honest', async t => {
  const attack = '<img src=x onerror="window.bad=1"><script>window.bad=1</script>';
  const ui = fixture(t, { handler: async url => url.includes('/skill-a') ? { workspace, skill: { ...skill({ name: attack }), content: attack } } : catalog({ skills: [skill({ name: attack, originUrl: attack, description: attack })] }) }); await settle();
  ui.document.querySelector('[data-skill-preview]').click(); await settle(); assert.equal(ui.document.querySelector('[data-skill-content]').textContent, attack); assert.equal(ui.document.querySelector('img,script,iframe'), null); assert.equal(ui.window.bad, undefined); assert.match(ui.document.body.textContent, /User-supplied source · unverified/);
});

test('removal requires explicit in-app confirmation and only removes a registration', async t => {
  let deleted = false;
  const ui = fixture(t, { handler: async (url, options) => { if (options.method === 'DELETE') { deleted = true; return catalog({ skills: [], bindings: {}, revision: 3 }); } return catalog({ skills: deleted ? [] : [skill()] }); } }); await settle();
  ui.document.querySelector('[data-skill-remove]').click(); assert.equal(ui.calls.length, 1); assert.match(ui.document.querySelector('dialog').textContent, /original SKILL.md and existing run records are retained/);
  ui.document.querySelector('[data-skill-confirm-remove]').click(); await settle(); assert.equal(ui.calls.find(call => call.options.method === 'DELETE').url, '/api/skills/skill-a'); assert.equal(ui.document.querySelector('[data-skill-id]'), null);
});

test('a failed registration or binding preserves entered values and editable equipment changes', async t => {
  const ui = fixture(t, { handler: async (url, options) => { if (options.method) throw new Error('Explicit permission or file-version error'); return catalog(); } }); await settle();
  ui.document.querySelector('[data-skill-path]').value = 'skills/keep/SKILL.md'; submit(ui, '[data-skill-register]'); await settle(); assert.equal(ui.document.querySelector('[data-skill-path]').value, 'skills/keep/SKILL.md'); assert.match(ui.document.querySelector('[role=status]').textContent, /Explicit permission/);
  ui.document.querySelector('[data-skill-toggle]').click(); ui.document.querySelector('[data-skill-save]').click(); await settle(); assert.equal(ui.document.querySelector('[data-skill-toggle]').checked, true); assert.equal(ui.document.querySelector('[data-skill-save]').disabled, false); assert.equal(ui.events.length, 0);
});

test('late lists, previews and mutation failures cannot cross a project boundary', async t => {
  const old = deferred(), preview = deferred(), mutation = deferred(); let first = true;
  const ui = fixture(t, { handler: async (url, options) => { if (options.method) return mutation.promise; if (url.includes('/skill-a')) return preview.promise; if (first) { first = false; return old.promise; } const key = new URL(url, 'http://local').searchParams.get('workspace'); return catalog({ workspace: key, skills: key.includes('other') ? [skill({ id: 'other-skill', name: 'Other project only' })] : [skill()] }); } });
  ui.render({ ...ui.state, settings: { workspace: other, language: 'en' } }); await settle(); old.resolve(catalog()); await settle(); assert.equal(ui.document.querySelector('[data-skill-id="skill-a"]'), null); assert.ok(ui.document.querySelector('[data-skill-id="other-skill"]'));
  ui.render({ ...ui.state, settings: { workspace, language: 'en' } }); await settle(); ui.document.querySelector('[data-skill-preview]').click(); ui.document.querySelector('[data-skill-toggle]').click(); ui.document.querySelector('[data-skill-save]').click();
  ui.render({ ...ui.state, settings: { workspace: other, language: 'en' } }); await settle(); preview.resolve({ workspace, skill: { ...skill(), content: 'FOREIGN_PRIVATE_SOURCE' } }); mutation.reject(new Error('FOREIGN_PRIVATE_ERROR')); await settle();
  assert.ok(!ui.document.body.textContent.includes('FOREIGN_PRIVATE')); assert.equal(ui.toasts.length, 0); assert.equal(ui.events.length, 0);
});

test('server revision refreshes only when visible and repeated renders do not duplicate a pending request', async t => {
  const waiting = deferred(), ui = fixture(t, { visible: false, handler: () => waiting.promise }); assert.equal(ui.calls.length, 0);
  ui.render(ui.state, { visible: true }); for (let i = 0; i < 4; i++) ui.render(ui.state); assert.equal(ui.calls.length, 1); waiting.resolve(catalog()); await settle();
  ui.render({ ...ui.state, server: { skillsRevision: 1 } }, { visible: false }); await settle(); assert.equal(ui.calls.length, 1);
  ui.render(ui.state, { visible: true }); await settle(); assert.equal(ui.calls.length, 2);
});

test('organization selection events select only an agent in the same project', async t => {
  const ui = fixture(t); await settle();
  ui.window.dispatchEvent(new ui.window.CustomEvent('imperium:skills-agent', { detail: { workspace, departmentId: 'quality' } })); assert.equal(ui.document.querySelector('[data-skill-agent]').value, 'quality');
  ui.window.dispatchEvent(new ui.window.CustomEvent('imperium:skills-agent', { detail: { workspace: other, departmentId: 'engineering' } })); assert.equal(ui.document.querySelector('[data-skill-agent]').value, 'quality'); assert.equal(ui.calls.length, 1);
});

test('document language overrides server language and switches Korean and Japanese immediately', async t => {
  const ui = fixture(t, { lang: 'ko' }); await settle(); assert.match(ui.document.querySelector('h2').textContent, /스킬 관리/);
  ui.document.documentElement.lang = 'ja'; ui.render(ui.state); assert.match(ui.document.querySelector('h2').textContent, /スキル管理/); assert.match(ui.document.body.textContent, /実際の使用は別/); assert.equal(ui.calls.length, 1);
});
