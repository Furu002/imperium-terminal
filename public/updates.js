/* IMPERIUM updates screen (renderer).
 *
 *   window.ImperiumUpdates.mount(container[, { language }]) -> { unmount }
 *   window.ImperiumUpdates.render([state])   // optional: re-render, or render a pushed state
 *   window.ImperiumUpdates.unmount()
 *
 * Talks only to window.ImperiumDesktopUpdates (exposed by desktop/preload.cjs). In a plain
 * browser that bridge does not exist and the screen explains that updates are desktop-only.
 *
 * Safety: every string from the update feed (version, name, notes, error text) is written with
 * textContent. No HTML parsing APIs are used. The page never sends versions or URLs to the main
 * process; the only link it renders is a validated https://github.com/<owner>/<repo>/releases/latest.
 */
(function () {
  'use strict';

  var RELEASES_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}\/releases\/latest$/;

  var LABELS = {
    ko: {
      title: '업데이트', lead: 'IMPERIUM 데스크톱 앱의 새 버전을 확인하고 설치합니다. 다운로드와 설치는 직접 누를 때만 진행됩니다.',
      desktopOnly: '업데이트는 IMPERIUM 데스크톱 앱에서만 사용할 수 있습니다. 브라우저에서는 확인하거나 설치할 수 없습니다.',
      statusLabel: '상태',
      status: {
        setup_required: '업데이트 채널이 아직 설정되지 않았습니다. 공개 배포 저장소가 정해지면 확인할 수 있습니다.',
        development: '개발 모드로 실행 중이라 업데이트를 확인하지 않습니다.',
        checking: '새 버전을 확인하는 중…',
        available: '새 버전을 사용할 수 있습니다.',
        current: '최신 버전을 사용 중입니다.',
        downloading: '업데이트를 다운로드하는 중…',
        downloaded: '다운로드 완료. 다시 시작하면 설치됩니다.',
        error: '업데이트 확인 또는 다운로드에 실패했습니다.',
        unsupported: '이 환경에서는 자동 업데이트를 사용할 수 없습니다.',
        unknown: '상태를 불러오는 중…',
      },
      current: '현재 버전', latest: '최신 버전', checked: '마지막 확인', channel: '배포 채널', publisher: '게시자',
      integrity: '무결성', integrityValue: '릴리스 메타데이터의 SHA-512로 다운로드 파일을 검증 (코드 서명 아님)',
      unsigned: '코드 서명 없음', signed: '코드 서명됨', notSet: '설정 안 됨', unknownValue: '—', never: '아직 확인 안 함',
      check: '지금 확인', download: '다운로드', install: '다시 시작하여 설치', openPage: '다운로드 페이지 열기',
      confirmText: '설치하려면 IMPERIUM이 종료됩니다. 실행 중인 터미널과 작업이 닫힙니다. 계속할까요?',
      confirm: '종료 후 설치', cancel: '취소', installing: '설치를 위해 종료하는 중…',
      progress: '다운로드 진행률', notes: '릴리스 노트', releaseName: '릴리스', releaseDate: '릴리스 날짜',
      errorDetails: '세부 정보',
      notice: {
        'windows-unsigned': 'Windows 빌드는 Sato Junichiro가 게시하며 코드 서명이 되어 있지 않습니다. 설치 시 SmartScreen 경고가 표시될 수 있습니다.',
        'windows-portable': '포터블 버전은 스스로 업데이트할 수 없습니다. 다운로드 페이지에서 새 버전을 받아 주세요.',
        'mac-unsigned': 'macOS 빌드는 아직 서명되지 않아 자동 설치가 동작하지 않을 수 있습니다. 다운로드 페이지에서 DMG를 받아 설치해 주세요.',
        'linux-package': '.deb 등 패키지 설치본은 자동으로 업데이트되지 않습니다. 다운로드 페이지에서 새 패키지를 받아 주세요. (AppImage는 자동 업데이트 지원)',
        'platform-unsupported': '이 운영체제는 자동 업데이트를 지원하지 않습니다.',
      },
      errors: {
        invalid_channel: '업데이트 채널 설정이 올바르지 않습니다.', updater_unavailable: '업데이트 모듈을 불러오지 못했습니다.',
        updater_inactive: '이 빌드에서는 업데이트 서비스가 활성화되지 않았습니다.', no_result: '업데이트 서비스가 결과를 반환하지 않았습니다.',
        invalid_metadata: '릴리스 정보가 올바르지 않습니다.', integrity: '다운로드한 파일의 SHA-512 검증에 실패했습니다. 파일을 설치하지 않았습니다.',
        signature: '코드 서명 검증 문제로 설치할 수 없습니다.', github_rate_limited: 'GitHub 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.',
        no_release: '공개된 릴리스를 찾지 못했습니다.', metadata_missing: '릴리스에 업데이트 메타데이터(latest.yml)가 없습니다.',
        access_denied: '릴리스에 접근할 수 없습니다. 저장소가 공개 상태인지 확인하세요.', network: '네트워크에 연결할 수 없습니다.',
        disk_full: '디스크 공간이 부족합니다.', unknown: '알 수 없는 오류가 발생했습니다.',
      },
      reasons: {
        rate_limited: '방금 확인했습니다. 잠시 후 다시 시도하세요.', busy: '다른 업데이트 작업이 진행 중입니다.',
        manual_download: '이 설치본은 다운로드 페이지에서 직접 업데이트해야 합니다.', not_available: '다운로드할 업데이트가 없습니다.',
        not_downloaded: '먼저 업데이트를 다운로드하세요.', installing: '이미 설치를 시작했습니다.',
        development: '개발 모드에서는 사용할 수 없습니다.', setup_required: '업데이트 채널이 설정되지 않았습니다.',
        unsupported: '이 환경에서는 지원되지 않습니다.', failed: '요청을 처리하지 못했습니다.',
      },
    },
    en: {
      title: 'Updates', lead: 'Check for and install new versions of the IMPERIUM desktop app. Downloads and installs only start when you press the button.',
      desktopOnly: 'Updates are available only in the IMPERIUM desktop app. They cannot be checked or installed from a browser.',
      statusLabel: 'Status',
      status: {
        setup_required: 'No update channel is configured yet. Checking becomes available once the public release repository is set.',
        development: 'Running in development mode, so updates are not checked.',
        checking: 'Checking for a new version…',
        available: 'A new version is available.',
        current: 'You are on the latest version.',
        downloading: 'Downloading the update…',
        downloaded: 'Download complete. Restart to install.',
        error: 'Checking or downloading the update failed.',
        unsupported: 'Automatic updates are not available in this environment.',
        unknown: 'Loading status…',
      },
      current: 'Current version', latest: 'Latest version', checked: 'Last checked', channel: 'Release channel', publisher: 'Publisher',
      integrity: 'Integrity', integrityValue: 'Download verified with SHA-512 from the release metadata (not a code signature)',
      unsigned: 'not code-signed', signed: 'code-signed', notSet: 'Not configured', unknownValue: '—', never: 'Not checked yet',
      check: 'Check now', download: 'Download', install: 'Restart and install', openPage: 'Open download page',
      confirmText: 'IMPERIUM will quit to install the update. Running terminals and tasks will close. Continue?',
      confirm: 'Quit and install', cancel: 'Cancel', installing: 'Quitting to install…',
      progress: 'Download progress', notes: 'Release notes', releaseName: 'Release', releaseDate: 'Release date',
      errorDetails: 'Details',
      notice: {
        'windows-unsigned': 'The Windows build is published by Sato Junichiro and is not code-signed. SmartScreen may show a warning during installation.',
        'windows-portable': 'The portable build cannot update itself. Get the new version from the download page.',
        'mac-unsigned': 'The macOS build is not signed yet, so automatic installation may not work. Download the DMG from the download page instead.',
        'linux-package': 'Package installs such as .deb are not updated automatically. Get the new package from the download page. (The AppImage updates automatically.)',
        'platform-unsupported': 'This operating system does not support automatic updates.',
      },
      errors: {
        invalid_channel: 'The update channel configuration is invalid.', updater_unavailable: 'The update module could not be loaded.',
        updater_inactive: 'The update service is not active for this build.', no_result: 'The update service returned no result.',
        invalid_metadata: 'The release information is invalid.', integrity: 'The SHA-512 check of the downloaded file failed. Nothing was installed.',
        signature: 'Installation blocked by a code-signature check.', github_rate_limited: 'GitHub rate limit reached. Try again later.',
        no_release: 'No published release was found.', metadata_missing: 'The release has no update metadata (latest.yml).',
        access_denied: 'The release could not be accessed. Make sure the repository is public.', network: 'Could not reach the network.',
        disk_full: 'Not enough disk space.', unknown: 'An unknown error occurred.',
      },
      reasons: {
        rate_limited: 'Checked just now. Try again in a moment.', busy: 'Another update action is in progress.',
        manual_download: 'This install must be updated from the download page.', not_available: 'There is no update to download.',
        not_downloaded: 'Download the update first.', installing: 'Installation has already started.',
        development: 'Not available in development mode.', setup_required: 'No update channel is configured.',
        unsupported: 'Not supported in this environment.', failed: 'The request could not be completed.',
      },
    },
    ja: {
      title: 'アップデート', lead: 'IMPERIUM デスクトップアプリの新しいバージョンを確認してインストールします。ダウンロードとインストールはボタンを押したときだけ行われます。',
      desktopOnly: 'アップデートは IMPERIUM デスクトップアプリでのみ利用できます。ブラウザーからは確認もインストールもできません。',
      statusLabel: '状態',
      status: {
        setup_required: 'アップデートチャネルがまだ設定されていません。公開リリースのリポジトリが決まると確認できるようになります。',
        development: '開発モードで実行中のため、アップデートを確認しません。',
        checking: '新しいバージョンを確認しています…',
        available: '新しいバージョンがあります。',
        current: '最新バージョンを使用しています。',
        downloading: 'アップデートをダウンロードしています…',
        downloaded: 'ダウンロード完了。再起動するとインストールされます。',
        error: 'アップデートの確認またはダウンロードに失敗しました。',
        unsupported: 'この環境では自動アップデートを利用できません。',
        unknown: '状態を読み込んでいます…',
      },
      current: '現在のバージョン', latest: '最新バージョン', checked: '最終確認', channel: '配布チャネル', publisher: '発行者',
      integrity: '整合性', integrityValue: 'リリースメタデータの SHA-512 でダウンロードを検証 (コード署名ではありません)',
      unsigned: 'コード署名なし', signed: 'コード署名あり', notSet: '未設定', unknownValue: '—', never: 'まだ確認していません',
      check: '今すぐ確認', download: 'ダウンロード', install: '再起動してインストール', openPage: 'ダウンロードページを開く',
      confirmText: 'インストールのため IMPERIUM を終了します。実行中のターミナルと作業は閉じられます。続行しますか?',
      confirm: '終了してインストール', cancel: 'キャンセル', installing: 'インストールのため終了しています…',
      progress: 'ダウンロードの進捗', notes: 'リリースノート', releaseName: 'リリース', releaseDate: 'リリース日',
      errorDetails: '詳細',
      notice: {
        'windows-unsigned': 'Windows 版は Sato Junichiro が発行しており、コード署名されていません。インストール時に SmartScreen の警告が表示される場合があります。',
        'windows-portable': 'ポータブル版は自動で更新できません。ダウンロードページから新しいバージョンを入手してください。',
        'mac-unsigned': 'macOS 版はまだ署名されていないため、自動インストールが動作しない可能性があります。ダウンロードページから DMG を入手してください。',
        'linux-package': '.deb などのパッケージ版は自動更新されません。ダウンロードページから新しいパッケージを入手してください。(AppImage は自動更新に対応)',
        'platform-unsupported': 'この OS は自動アップデートに対応していません。',
      },
      errors: {
        invalid_channel: 'アップデートチャネルの設定が正しくありません。', updater_unavailable: 'アップデートモジュールを読み込めませんでした。',
        updater_inactive: 'このビルドではアップデートサービスが有効になっていません。', no_result: 'アップデートサービスから結果が返りませんでした。',
        invalid_metadata: 'リリース情報が正しくありません。', integrity: 'ダウンロードしたファイルの SHA-512 検証に失敗しました。インストールは行っていません。',
        signature: 'コード署名の検証によりインストールできません。', github_rate_limited: 'GitHub のリクエスト上限に達しました。しばらくしてから再試行してください。',
        no_release: '公開されたリリースが見つかりません。', metadata_missing: 'リリースにアップデートメタデータ (latest.yml) がありません。',
        access_denied: 'リリースにアクセスできません。リポジトリが公開されているか確認してください。', network: 'ネットワークに接続できません。',
        disk_full: 'ディスクの空き容量が不足しています。', unknown: '不明なエラーが発生しました。',
      },
      reasons: {
        rate_limited: '先ほど確認しました。少し待ってから再試行してください。', busy: '別のアップデート処理が進行中です。',
        manual_download: 'このインストールはダウンロードページから更新する必要があります。', not_available: 'ダウンロードできるアップデートはありません。',
        not_downloaded: '先にアップデートをダウンロードしてください。', installing: 'すでにインストールを開始しています。',
        development: '開発モードでは利用できません。', setup_required: 'アップデートチャネルが設定されていません。',
        unsupported: 'この環境ではサポートされていません。', failed: 'リクエストを完了できませんでした。',
      },
    },
  };

  var ctx = null;

  function normalizeLanguage(value) {
    var lang = String(value || '').toLowerCase().slice(0, 2);
    return Object.prototype.hasOwnProperty.call(LABELS, lang) ? lang : 'ko';
  }

  function bridge() {
    var api = window.ImperiumDesktopUpdates;
    if (!api || typeof api.getState !== 'function' || typeof api.onState !== 'function') return null;
    return api;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function show(node, visible) {
    node.hidden = !visible;
  }

  function formatBytes(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var index = 0;
    while (n >= 1024 && index < units.length - 1) { n /= 1024; index += 1; }
    return (index === 0 ? String(Math.round(n)) : n.toFixed(1)) + ' ' + units[index];
  }

  function formatDate(value, lang) {
    if (typeof value !== 'string') return null;
    var date = new Date(value);
    if (isNaN(date.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    } catch (error) {
      return date.toISOString();
    }
  }

  function text(value, max) {
    if (typeof value !== 'string') return null;
    var trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed;
  }

  function fact(list, key) {
    var dt = el('dt');
    var dd = el('dd');
    list.appendChild(dt);
    list.appendChild(dd);
    return { key: key, dt: dt, dd: dd };
  }

  function build(container) {
    var root = el('section', 'imp-updates');
    var titleId = 'imp-updates-title-' + Math.random().toString(36).slice(2, 10);
    root.setAttribute('aria-labelledby', titleId);
    var title = el('h2', 'imp-updates__title');
    title.id = titleId;
    var lead = el('p', 'imp-updates__lead');

    var status = el('div', 'imp-updates__status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var statusLabel = el('span', 'imp-updates__status-label');
    var badge = el('span', 'imp-updates__badge');
    badge.setAttribute('aria-hidden', 'true');
    var statusText = el('span', 'imp-updates__status-text');
    status.appendChild(statusLabel);
    status.appendChild(badge);
    status.appendChild(statusText);

    var notice = el('p', 'imp-updates__notice');
    var error = el('div', 'imp-updates__error');
    error.setAttribute('role', 'alert');
    var errorText = el('p', 'imp-updates__error-text');
    var errorDetail = el('p', 'imp-updates__error-detail');
    error.appendChild(errorText);
    error.appendChild(errorDetail);

    var facts = el('dl', 'imp-updates__facts');
    var rows = {
      current: fact(facts, 'current'), latest: fact(facts, 'latest'), releaseName: fact(facts, 'releaseName'),
      releaseDate: fact(facts, 'releaseDate'), checked: fact(facts, 'checked'), channel: fact(facts, 'channel'),
      publisher: fact(facts, 'publisher'), integrity: fact(facts, 'integrity'),
    };

    var progressWrap = el('div', 'imp-updates__progress');
    var progressId = 'imp-updates-progress-' + Math.random().toString(36).slice(2, 10);
    var progressLabel = el('label', 'imp-updates__progress-label');
    progressLabel.htmlFor = progressId;
    var progress = el('progress');
    progress.id = progressId;
    progress.max = 100;
    progress.value = 0;
    var progressText = el('span', 'imp-updates__progress-text');
    progressWrap.appendChild(progressLabel);
    progressWrap.appendChild(progress);
    progressWrap.appendChild(progressText);

    var actions = el('div', 'imp-updates__actions');
    var checkButton = el('button', 'imp-updates__button');
    checkButton.type = 'button';
    var downloadButton = el('button', 'imp-updates__button imp-updates__button--primary');
    downloadButton.type = 'button';
    var installButton = el('button', 'imp-updates__button imp-updates__button--primary');
    installButton.type = 'button';
    var pageLink = el('a', 'imp-updates__button imp-updates__link');
    pageLink.target = '_blank';
    pageLink.rel = 'noopener noreferrer';
    actions.appendChild(checkButton);
    actions.appendChild(downloadButton);
    actions.appendChild(installButton);
    actions.appendChild(pageLink);

    var confirmBox = el('div', 'imp-updates__confirm');
    confirmBox.setAttribute('role', 'group');
    var confirmText = el('p', 'imp-updates__confirm-text');
    var confirmButton = el('button', 'imp-updates__button imp-updates__button--danger');
    confirmButton.type = 'button';
    var cancelButton = el('button', 'imp-updates__button');
    cancelButton.type = 'button';
    confirmBox.appendChild(confirmText);
    confirmBox.appendChild(confirmButton);
    confirmBox.appendChild(cancelButton);

    var message = el('p', 'imp-updates__message');
    message.setAttribute('aria-live', 'polite');

    var notesSection = el('section', 'imp-updates__notes');
    var notesTitle = el('h3', 'imp-updates__notes-title');
    var notesBody = el('pre', 'imp-updates__notes-body');
    notesBody.tabIndex = 0;
    notesSection.appendChild(notesTitle);
    notesSection.appendChild(notesBody);

    var desktopOnly = el('p', 'imp-updates__desktop-only');

    [title, lead, desktopOnly, status, notice, error, facts, progressWrap, actions, confirmBox, message, notesSection]
      .forEach(function (node) { root.appendChild(node); });
    container.appendChild(root);

    return {
      root: root, title: title, lead: lead, desktopOnly: desktopOnly, status: status, statusLabel: statusLabel,
      badge: badge, statusText: statusText, notice: notice, error: error, errorText: errorText, errorDetail: errorDetail,
      facts: facts, rows: rows, progressWrap: progressWrap, progressLabel: progressLabel, progress: progress,
      progressText: progressText, actions: actions, checkButton: checkButton, downloadButton: downloadButton,
      installButton: installButton, pageLink: pageLink, confirmBox: confirmBox, confirmText: confirmText,
      confirmButton: confirmButton, cancelButton: cancelButton, message: message, notesSection: notesSection,
      notesTitle: notesTitle, notesBody: notesBody,
    };
  }

  function setFact(row, label, value) {
    row.dt.textContent = label;
    row.dd.textContent = value;
    show(row.dt, value !== null);
    show(row.dd, value !== null);
  }

  function currentLanguage() {
    if (ctx && ctx.forcedLanguage) return ctx.forcedLanguage;
    return normalizeLanguage(document.documentElement.lang);
  }

  function render(nextState) {
    if (!ctx) return;
    if (nextState && typeof nextState === 'object') ctx.state = nextState;
    var lang = currentLanguage();
    var t = LABELS[lang];
    var v = ctx.view;
    var state = ctx.state;
    var api = ctx.api;

    v.root.setAttribute('lang', lang);
    v.title.textContent = t.title;
    v.lead.textContent = t.lead;

    if (!api) {
      v.desktopOnly.textContent = t.desktopOnly;
      show(v.desktopOnly, true);
      [v.status, v.notice, v.error, v.facts, v.progressWrap, v.actions, v.confirmBox, v.message, v.notesSection]
        .forEach(function (node) { show(node, false); });
      v.root.setAttribute('data-status', 'browser');
      return;
    }
    show(v.desktopOnly, false);
    show(v.status, true);
    show(v.facts, true);
    show(v.actions, true);

    var status = state && typeof state.status === 'string' && Object.prototype.hasOwnProperty.call(t.status, state.status)
      ? state.status : 'unknown';
    v.root.setAttribute('data-status', status);
    v.statusLabel.textContent = t.statusLabel + ': ';
    v.badge.setAttribute('data-status', status);
    v.statusText.textContent = state && state.installing ? t.installing : t.status[status];

    var noticeKey = state && typeof state.notice === 'string' && Object.prototype.hasOwnProperty.call(t.notice, state.notice) ? state.notice : null;
    v.notice.textContent = noticeKey ? t.notice[noticeKey] : '';
    show(v.notice, Boolean(noticeKey));

    var err = state && state.error && typeof state.error === 'object' ? state.error : null;
    if (err) {
      var code = typeof err.code === 'string' && Object.prototype.hasOwnProperty.call(t.errors, err.code) ? err.code : 'unknown';
      v.errorText.textContent = t.errors[code];
      var detail = text(err.message, 300);
      v.errorDetail.textContent = detail ? t.errorDetails + ': ' + detail : '';
      show(v.errorDetail, Boolean(detail));
    }
    show(v.error, Boolean(err));

    var unknown = t.unknownValue;
    setFact(v.rows.current, t.current, text(state && state.currentVersion, 64) || unknown);
    setFact(v.rows.latest, t.latest, text(state && state.latestVersion, 64) || unknown);
    setFact(v.rows.releaseName, t.releaseName, text(state && state.releaseName, 200));
    setFact(v.rows.releaseDate, t.releaseDate, formatDate(state && state.releaseDate, lang));
    setFact(v.rows.checked, t.checked, formatDate(state && state.checkedAt, lang) || t.never);
    var channel = state && state.channel && typeof state.channel === 'object'
      ? text(String(state.channel.owner || '') + '/' + String(state.channel.repo || ''), 160) : null;
    setFact(v.rows.channel, t.channel, channel || t.notSet);
    var publisher = text(state && state.publisher, 80);
    setFact(v.rows.publisher, t.publisher, publisher ? publisher + ' (' + (state.codeSigned ? t.signed : t.unsigned) + ')' : null);
    setFact(v.rows.integrity, t.integrity, state && state.integrity === 'sha512' ? t.integrityValue : null);

    var progress = state && state.progress && typeof state.progress === 'object' ? state.progress : null;
    var showProgress = Boolean(progress) && (status === 'downloading' || status === 'downloaded');
    show(v.progressWrap, showProgress);
    if (showProgress) {
      var percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
      v.progressLabel.textContent = t.progress;
      v.progress.value = percent;
      v.progress.setAttribute('aria-valuetext', Math.round(percent) + '%');
      var detailText = Math.round(percent) + '%';
      if (Number(progress.total) > 0) detailText += ' (' + formatBytes(progress.transferred) + ' / ' + formatBytes(progress.total) + ')';
      v.progressText.textContent = detailText;
    }

    var pending = ctx.pending;
    var installing = Boolean(state && state.installing);
    v.checkButton.textContent = t.check;
    v.checkButton.disabled = Boolean(pending) || !(state && state.canCheck);
    show(v.checkButton, status !== 'downloaded');

    v.downloadButton.textContent = t.download;
    v.downloadButton.disabled = Boolean(pending) || !(state && state.canDownload);
    show(v.downloadButton, Boolean(state && state.mode === 'auto' && (status === 'available' || status === 'downloading')));

    v.installButton.textContent = t.install;
    v.installButton.disabled = Boolean(pending) || installing || !(state && state.canInstall);
    show(v.installButton, status === 'downloaded' && !ctx.confirming);

    var url = state && typeof state.releasesURL === 'string' && RELEASES_URL_RE.test(state.releasesURL) ? state.releasesURL : null;
    var showPage = Boolean(url) && Boolean(state && state.manualDownload);
    v.pageLink.textContent = t.openPage;
    if (showPage) v.pageLink.href = url; else v.pageLink.removeAttribute('href');
    show(v.pageLink, showPage);

    v.confirmText.textContent = t.confirmText;
    v.confirmButton.textContent = t.confirm;
    v.cancelButton.textContent = t.cancel;
    v.confirmButton.disabled = Boolean(pending) || installing;
    show(v.confirmBox, Boolean(ctx.confirming) && status === 'downloaded' && !installing);

    v.message.textContent = ctx.messageKey && t.reasons[ctx.messageKey] ? t.reasons[ctx.messageKey] : '';
    show(v.message, Boolean(v.message.textContent));

    var notes = text(state && state.releaseNotes, 6000);
    var showNotes = Boolean(notes) && (status === 'available' || status === 'downloading' || status === 'downloaded');
    v.notesTitle.textContent = t.notes;
    v.notesBody.textContent = showNotes ? notes : '';
    show(v.notesSection, showNotes);
  }

  function handleResult(result) {
    if (!ctx) return;
    var next = result && typeof result === 'object' && result.state && typeof result.state === 'object' ? result.state : null;
    if (next) ctx.state = next;
    if (result && result.ok === false && typeof result.reason === 'string') {
      ctx.messageKey = Object.prototype.hasOwnProperty.call(LABELS.en.reasons, result.reason) ? result.reason : null;
    } else {
      ctx.messageKey = null;
    }
  }

  function run(action) {
    if (!ctx || !ctx.api || ctx.pending) return;
    var mounted = ctx;
    mounted.pending = action;
    mounted.messageKey = null;
    render();
    var promise;
    try {
      promise = Promise.resolve(mounted.api[action]());
    } catch (error) {
      promise = Promise.reject(error);
    }
    promise.then(handleResult, function () {
      if (ctx === mounted) ctx.messageKey = 'failed';
    }).then(function () {
      if (ctx !== mounted) return;
      ctx.pending = null;
      if (action === 'install') ctx.confirming = false;
      render();
    });
  }

  function unmount() {
    if (!ctx) return;
    if (ctx.unsubscribe) { try { ctx.unsubscribe(); } catch (error) { /* already gone */ } }
    if (ctx.observer) ctx.observer.disconnect();
    if (ctx.view.root.parentNode) ctx.view.root.parentNode.removeChild(ctx.view.root);
    ctx = null;
  }

  function mount(container, options) {
    if (!container || typeof container.appendChild !== 'function') throw new TypeError('ImperiumUpdates.mount requires a container element.');
    unmount();
    var opts = options || {};
    var view = build(container);
    ctx = {
      view: view,
      api: bridge(),
      state: null,
      pending: null,
      confirming: false,
      messageKey: null,
      unsubscribe: null,
      observer: null,
      forcedLanguage: opts.language ? normalizeLanguage(opts.language) : null,
    };
    var mounted = ctx;

    view.checkButton.addEventListener('click', function () { run('check'); });
    view.downloadButton.addEventListener('click', function () { run('download'); });
    view.installButton.addEventListener('click', function () {
      if (!ctx) return;
      ctx.confirming = true;
      render();
      ctx.view.confirmButton.focus();
    });
    view.cancelButton.addEventListener('click', function () {
      if (!ctx) return;
      ctx.confirming = false;
      render();
      ctx.view.installButton.focus();
    });
    view.confirmButton.addEventListener('click', function () { run('install'); });

    if (typeof MutationObserver === 'function') {
      ctx.observer = new MutationObserver(function () { if (ctx === mounted) render(); });
      ctx.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }

    if (ctx.api) {
      try {
        ctx.unsubscribe = ctx.api.onState(function (state) {
          if (ctx !== mounted || !state || typeof state !== 'object') return;
          ctx.state = state;
          if (state.status !== 'downloaded') ctx.confirming = false;
          render();
        });
      } catch (error) { /* bridge refused the listener; manual refresh still works */ }
      Promise.resolve().then(function () { return mounted.api.getState(); }).then(function (state) {
        if (ctx !== mounted || !state || typeof state !== 'object') return;
        if (!ctx.state) ctx.state = state;
        render();
      }, function () {
        if (ctx !== mounted) return;
        ctx.messageKey = 'failed';
        render();
      });
    }
    render();
    return { unmount: unmount };
  }

  window.ImperiumUpdates = Object.freeze({ mount: mount, render: render, unmount: unmount });
}());
