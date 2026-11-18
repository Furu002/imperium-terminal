const { app, BrowserWindow, Menu, dialog, nativeTheme, shell, ipcMain } = require('electron');
const { createUpdater, registerUpdateIpc, createStateSender } = require('./updater.cjs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomBytes } = require('node:crypto');

app.setName('Imperium');
if (process.platform === 'win32') app.setAppUserModelId('com.imperium.terminal');
const privateSessionToken = randomBytes(32).toString('hex');

let mainWindow = null;
let terminalServer = null;
let terminalURL = null;
let quitting = false;
let shutdownComplete = false;
let menuLanguage = null;
let menuTimer = null;
let updater = null, removeUpdateIpc = null;

const messages = {
  ko: {
    file: '파일', close: '창 닫기', quit: '종료', edit: '편집', undo: '실행 취소', redo: '다시 실행',
    cut: '잘라내기', copy: '복사', paste: '붙여넣기', selectAll: '모두 선택', view: '보기', reload: '새로고침',
    actualSize: '실제 크기', zoomIn: '확대', zoomOut: '축소', fullscreen: '전체 화면', devTools: '개발자 도구',
    about: 'Imperium 정보', services: '서비스', hide: 'Imperium 가리기', hideOthers: '다른 앱 가리기', showAll: '모두 보기',
    errorTitle: 'IMPERIUM 실행 오류', errorMessage: '앱을 시작하지 못했습니다.',
  },
  en: {
    file: 'File', close: 'Close Window', quit: 'Quit', edit: 'Edit', undo: 'Undo', redo: 'Redo',
    cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', view: 'View', reload: 'Reload',
    actualSize: 'Actual Size', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', fullscreen: 'Full Screen', devTools: 'Developer Tools',
    about: 'About Imperium', services: 'Services', hide: 'Hide Imperium', hideOthers: 'Hide Others', showAll: 'Show All',
    errorTitle: 'IMPERIUM startup error', errorMessage: 'The app could not start.',
  },
  ja: {
    file: 'ファイル', close: 'ウインドウを閉じる', quit: '終了', edit: '編集', undo: '取り消す', redo: 'やり直す',
    cut: '切り取り', copy: 'コピー', paste: '貼り付け', selectAll: 'すべてを選択', view: '表示', reload: '再読み込み',
    actualSize: '実際のサイズ', zoomIn: '拡大', zoomOut: '縮小', fullscreen: 'フルスクリーン', devTools: '開発者ツール',
    about: 'Imperiumについて', services: 'サービス', hide: 'Imperiumを隠す', hideOthers: 'ほかを隠す', showAll: 'すべてを表示',
    errorTitle: 'IMPERIUM 起動エラー', errorMessage: 'アプリを起動できませんでした。',
  },
};

function language() {
  const selected = terminalServer?.store?.state?.settings?.language;
  return Object.hasOwn(messages, selected) ? selected : 'ko';
}

const officialOrigins = new Set([
  'https://github.com',
  'https://openai.com',
  'https://help.openai.com',
  'https://developers.openai.com',
  'https://learn.chatgpt.com',
  'https://chatgpt.com',
  'https://claude.ai',
  'https://claude.com',
  'https://code.claude.com',
  'https://support.claude.com',
  'https://anthropic.com',
  'https://www.anthropic.com',
  'https://docs.anthropic.com',
  'https://support.anthropic.com',
  'https://geminicli.com', 'https://docs.github.com', 'https://ollama.com', 'https://docs.ollama.com', 'https://nodejs.org',
]);

function isLocalPage(value) {
  try {
    const candidate = new URL(value);
    return terminalURL !== null && candidate.origin === new URL(terminalURL).origin;
  } catch {
    return false;
  }
}

function openOfficialPage(value) {
  try {
    const candidate = new URL(value);
    if (candidate.username || candidate.password || !officialOrigins.has(candidate.origin)) return;
    void shell.openExternal(candidate.href).catch(() => {});
  } catch {
    // Local files, custom protocols, and malformed URLs are never handed to the OS.
  }
}

function installMenu() {
  const selected = language();
  if (menuLanguage === selected) return;
  const t = messages[selected];
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: 'Imperium',
      submenu: [
        { role: 'about', label: t.about },
        { type: 'separator' },
        { role: 'services', label: t.services },
        { type: 'separator' },
        { role: 'hide', label: t.hide },
        { role: 'hideOthers', label: t.hideOthers },
        { role: 'unhide', label: t.showAll },
        { type: 'separator' },
        { role: 'quit', label: t.quit },
      ],
    }] : []),
    {
      label: t.file,
      submenu: [
        { role: 'close', label: t.close },
        ...(process.platform === 'darwin' ? [] : [{ role: 'quit', label: t.quit }]),
      ],
    },
    {
      label: t.edit,
      submenu: [
        { role: 'undo', label: t.undo },
        { role: 'redo', label: t.redo },
        { type: 'separator' },
        { role: 'cut', label: t.cut },
        { role: 'copy', label: t.copy },
        { role: 'paste', label: t.paste },
        { role: 'selectAll', label: t.selectAll },
      ],
    },
    {
      label: t.view,
      submenu: [
        { role: 'reload', label: t.reload },
        { type: 'separator' },
        { role: 'resetZoom', label: t.actualSize },
        { role: 'zoomIn', label: t.zoomIn },
        { role: 'zoomOut', label: t.zoomOut },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t.fullscreen },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools', label: t.devTools }] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  menuLanguage = selected;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 1000,
    minWidth: 1050,
    minHeight: 720,
    title: 'IMPERIUM',
    icon: path.join(app.getAppPath(), 'build', 'icon.png'),
    backgroundColor: '#090c10',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      preload: path.join(app.getAppPath(), 'desktop', 'preload.cjs'),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openOfficialPage(url);
    return { action: 'deny' };
  });
  const keepLocal = (event, url) => {
    if (!isLocalPage(url)) {
      event.preventDefault();
      openOfficialPage(url);
    }
  };
  mainWindow.webContents.on('will-navigate', keepLocal);
  mainWindow.webContents.on('will-redirect', keepLocal);
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'clipboard-sanitized-write');
  });
  mainWindow.webContents.session.setPermissionCheckHandler((_contents, permission) => permission === 'clipboard-sanitized-write');
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders({ urls: [`${terminalURL}/*`] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    if (details.webContentsId === mainWindow?.webContents.id && isLocalPage(details.url)) headers['X-IMPERIUM-Session'] = privateSessionToken;
    callback({ requestHeaders: headers });
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(terminalURL);
}

async function startApplication() {
  await app.whenReady();
  nativeTheme.themeSource = 'dark';
  const entryURL = pathToFileURL(path.join(app.getAppPath(), 'server.mjs')).href;
  const { createHQServer } = await import(entryURL);
  terminalServer = createHQServer({
    dataDir: path.join(app.getPath('userData'), 'hq-data'),
    workspace: path.join(app.getPath('documents'), 'Imperium Workspace'),
    port: 0,
    privateSessionToken,
    onSettingsChange: settings => updater?.setOffline(settings.localOnly === true),
  });
  const { url } = await terminalServer.start();
  terminalURL = url;
  updater = createUpdater({ app, sendState: createStateSender(() => mainWindow), offline: terminalServer.store.state.settings.localOnly === true, channel: { owner: 'Furu002', repo: 'imperium-releases' } });
  removeUpdateIpc = registerUpdateIpc({ ipcMain, updater, getMainWindow: () => mainWindow, isTrustedURL: isLocalPage });
  installMenu();
  menuTimer = setInterval(installMenu, 1000);
  menuTimer.unref();
  await createWindow();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || quitting) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  // Closing the final window stops its CLI workers on both Windows and macOS.
  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
    else if (terminalURL && !quitting) void createWindow().catch(() => app.quit());
  });
  app.on('before-quit', (event) => {
    if (shutdownComplete) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    clearInterval(menuTimer);
    removeUpdateIpc?.(); updater?.dispose();
    Promise.resolve(terminalServer?.close())
      .catch((error) => console.error('[IMPERIUM] Shutdown:', error.message))
      .finally(() => {
        shutdownComplete = true;
        app.quit();
      });
  });
  startApplication().catch((error) => {
    const t = messages[language()];
    dialog.showErrorBox(t.errorTitle, `${t.errorMessage}\n\n${error.message}`);
    app.quit();
  });
}
