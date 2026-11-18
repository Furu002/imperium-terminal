'use strict';

/* IMPERIUM desktop preload (sandboxed, contextIsolation on).
 *
 * Exposes exactly one narrow API to the page:
 *   window.ImperiumDesktopUpdates = { getState(), check(), download(), install(), onState(callback) -> unsubscribe }
 *
 * No Node, ipcRenderer, Electron objects or app internals are exposed. Actions take no
 * arguments: the main process decides versions, feeds and URLs. Channel names must stay in
 * sync with IPC_CHANNELS in desktop/updater.cjs (sandboxed preloads cannot require local files).
 */

const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = Object.freeze({
  getState: 'imperium:updates:getState',
  check: 'imperium:updates:check',
  download: 'imperium:updates:download',
  install: 'imperium:updates:install',
  state: 'imperium:updates:state',
});

const MAX_SUBSCRIBERS = 16;
let subscribers = 0;

function invoke(channel) {
  // Never forward page-supplied arguments.
  return ipcRenderer.invoke(channel);
}

const api = Object.freeze({
  getState: () => invoke(CHANNELS.getState),
  check: () => invoke(CHANNELS.check),
  download: () => invoke(CHANNELS.download),
  install: () => invoke(CHANNELS.install),
  onState(callback) {
    if (typeof callback !== 'function') throw new TypeError('onState requires a function.');
    if (subscribers >= MAX_SUBSCRIBERS) throw new Error('Too many update listeners.');
    // Wrap so the IpcRendererEvent (and its sender) never reaches page code.
    const listener = (_event, state) => {
      try { callback(state); } catch { /* page errors must not break other listeners */ }
    };
    ipcRenderer.on(CHANNELS.state, listener);
    subscribers += 1;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      subscribers -= 1;
      ipcRenderer.removeListener(CHANNELS.state, listener);
    };
  },
});

contextBridge.exposeInMainWorld('ImperiumDesktopUpdates', api);
