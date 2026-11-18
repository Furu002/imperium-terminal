'use strict';

// UI translations are local. Model output and user content always remain untouched.
const TRANSLATIONS = {
  en: {
    '지휘 통제실': 'Command center', '지시하고, 연결하고, 모든 작업의 흐름을 확인하세요.': 'Direct your organization. Follow every operation in one place.',
    '작업 관리': 'Operations', '부서별 작업을 확인하고 실행 결과를 검토하세요.': 'Track assignments and inspect the work your teams deliver.',
    '부서 관리': 'Departments', '부서의 역할과 담당 모델을 구성하세요.': 'Configure each department’s responsibilities and assigned model.',
    '활동 로그': 'Activity log', '모든 부서의 실행 기록을 실시간으로 확인하세요.': 'Follow the execution history of every department in real time.',
    '기록 내보내기': 'Export records', '모델 연결': 'Connections', '실행 중': 'Running', '대기 작업': 'Queued', '완료 작업': 'Completed',
    '지시를 기다리고 있습니다': 'Awaiting your command', '우선순위에 따라 순차 실행': 'Scheduled by priority', '저장된 작업 기준': 'Across saved operations', '연결 상태 확인 중': 'Checking connections',
    '서버 연결이 끊겼습니다.': 'Server connection lost.', '자동으로 다시 연결하고 있습니다. 새 지시는 연결 후 보낼 수 있습니다.': 'Reconnecting automatically. Dispatch will resume when connected.',
    '작업 현황': 'Operations', '전체': 'All', '진행 중': 'Active', '완료': 'Completed', '확인 필요': 'Attention', '작업 검색': 'Search operations',
    '작업 / 담당 부서': 'OPERATION / DEPARTMENT', '모델': 'MODEL', '상태': 'STATUS', '경과': 'ELAPSED', '작업 취소': 'Cancel operation',
    '첫 번째 지시를 내려보세요': 'Your organization is ready', '아래 명령 입력창에서 부서와 모델을 선택하면 작업이 시작됩니다.': 'Choose a department below and dispatch your first operation.', '명령 입력으로 이동': 'Write a command',
    '실제 프로세스 상태 기반': 'Actual process state', '조직 현황': 'Your organization', '부서를 선택해 작업을 지시하세요': 'Select a department to assign work',
    '본부 지시': 'Dispatch command', '담당 부서': 'Department', '실행 모델': 'Execution model', '부서 기본 모델': 'Department default', '우선순위': 'Priority', '작업 우선순위': 'Operation priority',
    '어떤 일을 맡길까요? 목표와 원하는 결과를 구체적으로 지시하세요.': 'What needs to be done? Describe your goal and the result you expect.', '부서에 내릴 작업 지시': 'Command for the selected department',
    '프로젝트 분석 ↗': 'Analyze project ↗', '코드 리뷰 ↗': 'Review code ↗', '실행 계획 ↗': 'Make a plan ↗',
    '파일 수정 허용': 'Allow file edits', '기본: 읽기 및 분석만': 'Default: read and analyze only', '지시 보내기': 'Dispatch command',
    '실시간 활동': 'Live activity', '활동 피드 일시정지': 'Pause activity feed', '활동 피드 재개': 'Resume activity feed', '실시간 활동 로그': 'Live activity log',
    '작업 인스펙터': 'Operation inspector', '선택한 작업 결과 복사': 'Copy selected output', '결과 복사': 'Copy output',
    '이미 구독한 모델, 하나의 본부에서.': 'Your subscriptions. One command center.', 'Codex와 Claude Code의 로그인 계정을 사용합니다.': 'Uses your signed-in Codex and Claude Code accounts.', '작업은 각 서비스의 구독 한도에 반영됩니다.': 'Operations count toward each service’s plan allowance.', '연결 상태 확인': 'Check connections',
    '연결 및 설정': 'Connections & settings', '설정 열기': 'Open settings', '설정 닫기': 'Close settings', '각 CLI에 기존 구독 계정으로 로그인하세요. 로그인 토큰과 API 키는 이 화면에서 수집하지 않습니다.': 'Sign in to each CLI with your subscription account. This screen does not collect login tokens or API keys.',
    '↻ 상태 새로고침': '↻ Refresh status', '작업 환경': 'Workspace', '프로젝트 폴더': 'Project directory', 'C:\\프로젝트\\폴더': 'C:\\projects\\your-project',
    '새 작업을 실행할 실제 로컬 폴더입니다. 진행 중인 작업에는 영향을 주지 않습니다.': 'The local directory for new operations. Running operations keep their original directory.',
    '동시 실행 수': 'Concurrent operations', '1 — 한 번에 하나씩': '1 — One at a time', '2 — 모델을 병렬로 운영': '2 — Run models in parallel', '3 — 최대 3개 작업': '3 — Up to three operations', '4 — 최대 4개 작업': '4 — Up to four operations',
    '같은 부서는 한 번에 하나의 작업을 실행합니다. 병렬 실행은 구독 한도를 더 빠르게 사용합니다.': 'Each department runs one operation at a time. Parallel work consumes your subscription allowance faster.',
    '샘플 작업 체험': 'Try sample operations', '데모 지우기': 'Clear demo', '설정 저장': 'Save settings', '샘플은 실제 모델을 호출하지 않으며 모든 항목에 DEMO로 표시됩니다.': 'Samples do not call a model. Every simulated operation is marked DEMO.',
    '부서 편집': 'Edit department', '부서 편집 닫기': 'Close department editor', '부서 이름': 'Department name', '담당 모델': 'Assigned model', '역할과 업무 지침': 'Role and instructions',
    '부서의 역할은 앞으로 보내는 모든 작업의 지시에 함께 전달됩니다.': 'These instructions are included with every new assignment to this department.', '취소': 'Cancel', '부서 저장': 'Save department',
    '화면 언어': 'Display language', 'IMPERIUM 홈': 'IMPERIUM home', '주 메뉴': 'Main navigation', '조직 현황 요약': 'Organization summary', '조직 현황': 'Organization',
    '작업을 선택하면 오른쪽에서 결과를 확인할 수 있습니다.': 'Select an operation to inspect its output.', '구독 연결 안내': 'Subscription connection information', '작업 폴더': 'Working directory',
    'F1 AI 조직도': 'F1 AI organization', 'F2 작업 관리': 'F2 Operations', 'F3 부서 관리': 'F3 Departments', 'F4 활동 로그': 'F4 Activity', 'F8 연결 및 설정': 'F8 Connections and settings',
    '실행 중인 에이전트 {count}개': '{count} agents at work', '연결 {ready} · 확인 필요 {missing}': '{ready} connected · {missing} need attention', '전체 {count}건 중': 'Across {count} operations',
    '일치하는 작업이 없습니다': 'No matching operations', '상태 필터나 검색어를 변경해보세요.': 'Try another filter or search term.', '작업을 선택하세요': 'Select an operation', '작업 현황에서 항목을 선택하면': 'Choose an item in Mission Control', '진행 과정과 결과를 확인할 수 있습니다.': 'to inspect its progress and output.',
    '작업 지시': 'COMMAND', '실행 결과': 'OUTPUT', '결과를 기다리는 중입니다…': 'Waiting for output…', '작업이 취소되었습니다.': 'This operation was cancelled.', '아직 결과가 없습니다.': 'No output yet.', '읽기 전용': 'READ ONLY', '파일 수정 허용됨': 'FILE EDITS ALLOWED',
    '입력 {count} 토큰': '{count} input tokens', '출력 {count} 토큰': '{count} output tokens', '부서 설정': 'Department settings', '대기 중': 'IDLE', '연결 필요': 'CONNECT',
    '연결됨': 'CONNECTED', '로그인 필요': 'LOGIN REQUIRED', '설치 필요': 'NOT INSTALLED', '확인 필요': 'ATTENTION', '복사': 'Copy',
    '구독 계정으로 연결되었습니다.': 'Connected with your subscription account.', '터미널에서 아래 명령으로 로그인한 뒤 상태를 새로고침하세요.': 'Sign in with the command below, then refresh the connection status.', 'CLI를 설치한 뒤 구독 계정으로 로그인하세요.': 'Install the CLI, then sign in with your subscription account.', '연결을 확인할 수 없습니다. 상태를 새로고침하세요.': 'Connection could not be verified. Refresh to try again.',
    '설치': 'INSTALL', '로그인': 'SIGN IN', '상세 정보': 'Details', '연결 상태를 확인하고 있습니다.': 'Checking connection status.', '아직 실행 기록이 없습니다.': 'No execution history yet.', '본부의 첫 지시를 기다리고 있습니다.': 'Standing by for your first command.', '작업을 보내면 모델의 활동이 여기에 표시됩니다.': 'Model activity will appear here after you dispatch work.',
    '지시할 내용을 입력해주세요.': 'Enter a command first.', '담당 부서를 선택해주세요.': 'Choose a department.', '연결된 뒤 다시 시도해주세요.': 'Wait for the server connection, then try again.', '전송 중…': 'Dispatching…', '작업을 지시했습니다.': 'Operation dispatched.', '모델 연결을 먼저 확인해주세요.': 'Check the selected model connection first.',
    '작업을 취소했습니다.': 'Operation cancelled.', '설정을 저장했습니다.': 'Settings saved.', '부서 설정을 저장했습니다.': 'Department saved.', '클립보드에 복사했습니다.': 'Copied to clipboard.', '복사할 수 없습니다. 텍스트를 직접 선택해주세요.': 'Clipboard unavailable. Select and copy the text directly.',
    '기록을 내보냈습니다.': 'Records exported.', '샘플 작업을 시작했습니다. 실제 모델을 호출하지 않습니다.': 'Sample operations started. No model calls are made.', '데모 작업을 지웠습니다.': 'Demo operations cleared.', '상태를 새로고침했습니다.': 'Connection status refreshed.', '요청을 처리하지 못했습니다.': 'The request could not be completed.',
    '파일 수정이 가능한 작업으로 실행합니다.': 'This operation may edit files.', '기본: 읽기 및 분석만': 'Default: read and analyze only', '저장 중…': 'Saving…', '확인 중…': 'Checking…',
    '전략기획실': 'Strategy', '개발본부': 'Engineering', '리서치센터': 'Research', '품질관리실': 'Quality Assurance',
    '목표를 구체화하고 실행 계획, 우선순위와 의사결정 근거를 정리합니다.': 'Clarifies goals, execution plans, priorities and decision rationale.',
    '요구사항을 분석하고 설계, 코드 구현과 개선을 담당합니다.': 'Analyzes requirements and owns design, implementation and improvements.',
    '자료와 프로젝트를 조사하고 출처, 사실, 추론을 구분해 보고합니다.': 'Investigates sources and projects, separating facts from interpretation.',
    '결과를 검토하고 오류, 위험과 누락된 요구사항을 검증합니다.': 'Reviews results and checks for defects, risks and missed requirements.',
    '현재 프로젝트의 구조를 분석하고, 주요 파일의 역할과 개선 우선순위를 정리해줘.': 'Analyze this project’s structure. Explain the main files and recommend improvement priorities.',
    '현재 프로젝트에서 잠재적인 버그와 예외 처리 누락을 검토하고, 재현 조건과 수정 방향을 보고해줘.': 'Review this project for potential bugs and missing error handling. Report reproduction conditions and recommended fixes.',
    '지금 개발하려는 기능의 요구사항을 정리하고, 구현 단계와 검증 방법을 제안해줘.': 'Clarify the requirements for the planned feature. Propose implementation steps and a verification plan.'
  },
  ja: {
    '지휘 통제실': 'コマンドセンター', '지시하고, 연결하고, 모든 작업의 흐름을 확인하세요.': '指示を出し、つなぎ、すべての作業の流れを把握。',
    '작업 관리': 'タスク管理', '부서별 작업을 확인하고 실행 결과를 검토하세요.': '部署ごとのタスクを確認し、実行結果を検討します。',
    '부서 관리': '部署管理', '부서의 역할과 담당 모델을 구성하세요.': '各部署の役割と担当モデルを設定します。',
    '활동 로그': 'アクティビティ', '모든 부서의 실행 기록을 실시간으로 확인하세요.': 'すべての部署の実行履歴をリアルタイムで確認。',
    '기록 내보내기': '履歴を書き出す', '모델 연결': 'モデル接続', '실행 중': '実行中', '대기 작업': '待機中', '완료 작업': '完了',
    '지시를 기다리고 있습니다': '指示をお待ちしています', '우선순위에 따라 순차 실행': '優先順位に従って実行', '저장된 작업 기준': '保存されたタスクの集計', '연결 상태 확인 중': '接続を確認しています',
    '서버 연결이 끊겼습니다.': 'サーバーとの接続が切れました。', '자동으로 다시 연결하고 있습니다. 새 지시는 연결 후 보낼 수 있습니다.': '自動で再接続しています。接続後に新しい指示を送信できます。',
    '작업 현황': 'タスク状況', '전체': 'すべて', '진행 중': '進行中', '완료': '完了', '확인 필요': '要確認', '작업 검색': 'タスクを検索',
    '작업 / 담당 부서': 'タスク / 担当部署', '모델': 'モデル', '상태': '状態', '경과': '経過', '작업 취소': 'タスクを中止',
    '첫 번째 지시를 내려보세요': '最初の指示を出しましょう', '아래 명령 입력창에서 부서와 모델을 선택하면 작업이 시작됩니다.': '下の入力欄で部署とモデルを選択して作業を開始できます。', '명령 입력으로 이동': 'コマンドを入力',
    '실제 프로세스 상태 기반': '実際のプロセス状態に基づく', '조직 현황': '組織の状況', '부서를 선택해 작업을 지시하세요': '部署を選択してタスクを指示',
    '본부 지시': '本部からの指示', '담당 부서': '担当部署', '실행 모델': '実行モデル', '부서 기본 모델': '部署の既定モデル', '우선순위': '優先度', '작업 우선순위': 'タスクの優先度',
    '어떤 일을 맡길까요? 목표와 원하는 결과를 구체적으로 지시하세요.': 'どのような作業を任せますか？目的と期待する成果を具体的に記入してください。', '부서에 내릴 작업 지시': '部署に送る作業指示',
    '프로젝트 분석 ↗': 'プロジェクト分析 ↗', '코드 리뷰 ↗': 'コードレビュー ↗', '실행 계획 ↗': '実行計画 ↗',
    '파일 수정 허용': 'ファイル編集を許可', '기본: 읽기 및 분석만': '既定：閲覧と分析のみ', '지시 보내기': '指示を送信',
    '실시간 활동': 'リアルタイム活動', '활동 피드 일시정지': 'フィードを一時停止', '활동 피드 재개': 'フィードを再開', '실시간 활동 로그': 'リアルタイムの活動ログ',
    '작업 인스펙터': 'タスクの詳細', '선택한 작업 결과 복사': '選択した結果をコピー', '결과 복사': '結果をコピー',
    '이미 구독한 모델, 하나의 본부에서.': '契約中のモデルを、一つの本部で。', 'Codex와 Claude Code의 로그인 계정을 사용합니다.': 'CodexとClaude Codeのログイン済みアカウントを使用。', '작업은 각 서비스의 구독 한도에 반영됩니다.': '各サービスのサブスクリプション利用枠を消費します。', '연결 상태 확인': '接続状況を確認',
    '연결 및 설정': '接続と設定', '설정 열기': '設定を開く', '설정 닫기': '設定を閉じる', '각 CLI에 기존 구독 계정으로 로그인하세요. 로그인 토큰과 API 키는 이 화면에서 수집하지 않습니다.': '各CLIに契約中のアカウントでログインしてください。この画面ではログイントークンやAPIキーを収集しません。',
    '↻ 상태 새로고침': '↻ 状態を更新', '작업 환경': '作業環境', '프로젝트 폴더': 'プロジェクトフォルダー', 'C:\\프로젝트\\폴더': 'C:\\projects\\your-project',
    '새 작업을 실행할 실제 로컬 폴더입니다. 진행 중인 작업에는 영향을 주지 않습니다.': '新しいタスクを実行するローカルフォルダーです。実行中のタスクには影響しません。',
    '동시 실행 수': '同時実行数', '1 — 한 번에 하나씩': '1 — 一つずつ実行', '2 — 모델을 병렬로 운영': '2 — モデルを並列実行', '3 — 최대 3개 작업': '3 — 最大3件', '4 — 최대 4개 작업': '4 — 最大4件',
    '같은 부서는 한 번에 하나의 작업을 실행합니다. 병렬 실행은 구독 한도를 더 빠르게 사용합니다.': '各部署は一度に一つのタスクを実行します。並列実行は利用枠の消費が速くなります。',
    '샘플 작업 체험': 'サンプルを試す', '데모 지우기': 'デモを消去', '설정 저장': '設定を保存', '샘플은 실제 모델을 호출하지 않으며 모든 항목에 DEMO로 표시됩니다.': 'サンプルは実際のモデルを呼び出しません。すべてDEMOと表示されます。',
    '부서 편집': '部署を編集', '부서 편집 닫기': '部署編集を閉じる', '부서 이름': '部署名', '담당 모델': '担当モデル', '역할과 업무 지침': '役割と業務の指針',
    '부서의 역할은 앞으로 보내는 모든 작업의 지시에 함께 전달됩니다.': 'この役割は、今後この部署に送るすべての指示に含まれます。', '취소': 'キャンセル', '부서 저장': '部署を保存',
    '화면 언어': '表示言語', 'IMPERIUM 홈': 'IMPERIUMホーム', '주 메뉴': 'メインメニュー', '조직 현황 요약': '組織状況の概要',
    '작업을 선택하면 오른쪽에서 결과를 확인할 수 있습니다.': 'タスクを選択すると、右側で結果を確認できます。', '구독 연결 안내': 'サブスクリプション接続の案内', '작업 폴더': '作業フォルダー',
    'F1 AI 조직도': 'F1 AI組織図', 'F2 작업 관리': 'F2 タスク管理', 'F3 부서 관리': 'F3 部署管理', 'F4 활동 로그': 'F4 アクティビティ', 'F8 연결 및 설정': 'F8 接続と設定',
    '실행 중인 에이전트 {count}개': '{count}個のエージェントが実行中', '연결 {ready} · 확인 필요 {missing}': '接続 {ready} · 要確認 {missing}', '전체 {count}건 중': '全{count}件のタスク',
    '일치하는 작업이 없습니다': '一致するタスクがありません', '상태 필터나 검색어를 변경해보세요.': 'フィルターや検索語を変更してください。', '작업을 선택하세요': 'タスクを選択', '작업 현황에서 항목을 선택하면': 'タスク一覧から項目を選択すると', '진행 과정과 결과를 확인할 수 있습니다.': '進行状況と結果を確認できます。',
    '작업 지시': '作業指示', '실행 결과': '実行結果', '결과를 기다리는 중입니다…': '結果を待っています…', '작업이 취소되었습니다.': 'タスクは中止されました。', '아직 결과가 없습니다.': '結果はまだありません。', '읽기 전용': '読み取り専用', '파일 수정 허용됨': 'ファイル編集を許可',
    '입력 {count} 토큰': '入力 {count}トークン', '출력 {count} 토큰': '出力 {count}トークン', '부서 설정': '部署の設定', '대기 중': '待機中', '연결 필요': '接続が必要',
    '연결됨': '接続済み', '로그인 필요': 'ログインが必要', '설치 필요': '未インストール', '복사': 'コピー',
    '구독 계정으로 연결되었습니다.': 'サブスクリプションアカウントで接続済みです。', '터미널에서 아래 명령으로 로그인한 뒤 상태를 새로고침하세요.': 'ターミナルで次のコマンドを実行してログインし、状態を更新してください。', 'CLI를 설치한 뒤 구독 계정으로 로그인하세요.': 'CLIをインストールし、契約中のアカウントでログインしてください。', '연결을 확인할 수 없습니다. 상태를 새로고침하세요.': '接続を確認できません。状態を更新してください。',
    '설치': 'インストール', '로그인': 'ログイン', '상세 정보': '詳細情報', '연결 상태를 확인하고 있습니다.': '接続状態を確認しています。', '아직 실행 기록이 없습니다.': '実行履歴はまだありません。', '본부의 첫 지시를 기다리고 있습니다.': '本部からの最初の指示を待っています。', '작업을 보내면 모델의 활동이 여기에 표시됩니다.': 'タスクを送信すると、モデルの活動がここに表示されます。',
    '지시할 내용을 입력해주세요.': '指示を入力してください。', '담당 부서를 선택해주세요.': '担当部署を選択してください。', '연결된 뒤 다시 시도해주세요.': 'サーバー接続後にもう一度お試しください。', '전송 중…': '送信中…', '작업을 지시했습니다.': 'タスクを送信しました。', '모델 연결을 먼저 확인해주세요.': '先にモデルの接続を確認してください。',
    '작업을 취소했습니다.': 'タスクを中止しました。', '설정을 저장했습니다.': '設定を保存しました。', '부서 설정을 저장했습니다.': '部署の設定を保存しました。', '클립보드에 복사했습니다.': 'クリップボードにコピーしました。', '복사할 수 없습니다. 텍스트를 직접 선택해주세요.': 'コピーできません。テキストを直接選択してください。',
    '기록을 내보냈습니다.': '履歴を書き出しました。', '샘플 작업을 시작했습니다. 실제 모델을 호출하지 않습니다.': 'サンプルを開始しました。実際のモデルは呼び出しません。', '데모 작업을 지웠습니다.': 'デモのタスクを消去しました。', '상태를 새로고침했습니다.': '接続状態を更新しました。', '요청을 처리하지 못했습니다.': 'リクエストを処理できませんでした。',
    '파일 수정이 가능한 작업으로 실행합니다.': 'ファイルを編集できるタスクとして実行します。', '저장 중…': '保存中…', '확인 중…': '確認中…',
    '전략기획실': '戦略企画室', '개발본부': '開発本部', '리서치센터': 'リサーチセンター', '품질관리실': '品質管理室',
    '목표를 구체화하고 실행 계획, 우선순위와 의사결정 근거를 정리합니다.': '目標を具体化し、実行計画、優先度、意思決定の根拠を整理します。',
    '요구사항을 분석하고 설계, 코드 구현과 개선을 담당합니다.': '要件を分析し、設計、コードの実装と改善を担当します。',
    '자료와 프로젝트를 조사하고 출처, 사실, 추론을 구분해 보고합니다.': '資料とプロジェクトを調査し、出典、事実、推論を区別して報告します。',
    '결과를 검토하고 오류, 위험과 누락된 요구사항을 검증합니다.': '結果をレビューし、不具合、リスク、要件の漏れを検証します。',
    '현재 프로젝트의 구조를 분석하고, 주요 파일의 역할과 개선 우선순위를 정리해줘.': '現在のプロジェクト構成を分析し、主要ファイルの役割と改善の優先順位をまとめてください。',
    '현재 프로젝트에서 잠재적인 버그와 예외 처리 누락을 검토하고, 재현 조건과 수정 방향을 보고해줘.': '現在のプロジェクトの潜在的なバグと例外処理の不足を検討し、再現条件と修正方針を報告してください。',
    '지금 개발하려는 기능의 요구사항을 정리하고, 구현 단계와 검증 방법을 제안해줘.': '開発予定の機能の要件を整理し、実装手順と検証方法を提案してください。'
  }
};

Object.assign(TRANSLATIONS.en, {
  '노드 워크스페이스': 'Node workspace', '노드를 직접 추가하고 이름표와 연결을 구성하세요.': 'Add nodes and customize names, titles, and connections.', '프로젝트': 'Projects', '프로젝트별 폴더, 색상과 작업 환경을 관리하세요.': 'Manage project folders, colors, and workspaces.', '사용량과 성능': 'Usage & performance', '실제 실행 기록의 토큰, 작업 시간과 비교를 확인하세요.': 'Inspect reported tokens, task duration, and observed changes.', '프로젝트 기억': 'Project memory', '지식을 검토하고 연결하며 다음 작업에 재사용하세요.': 'Review, connect, and reuse project knowledge.',
  '프로필 · 이름표': 'Profile · nameplate', '표시 이름': 'Display name', '직함': 'Title', '로컬 전용 AI': 'Local-only AI', 'Ollama 로컬 모델만 사용하고 클라우드 실행·자동 업데이트 연결을 중지합니다. 터미널 명령과 OS 네트워크 설정은 사용자가 관리합니다.': 'Use local Ollama models and stop cloud execution and automatic update connections. Terminal commands and OS networking remain under your control.',
  'AI 조직도': 'AI Organization',
  '모델과 부서를 연결하고, 당신의 AI 조직을 지휘하세요.': 'Connect models and departments. Take command of your AI organization.',
  '조직 연결 현황': 'Organization network',
  '본부에서 모델과 부서의 연결, 현재 맡은 업무를 확인하세요.': 'See how models and departments connect, and what each team is working on.',
  '연결 모델과 담당 부서': 'Connected models and their departments',
  '부서 에이전트는 설정된 역할입니다. 각 모델은 업무를 지시할 때 실행됩니다.': 'Department agents represent configured roles. Models run when you assign work; they are not always-running processes.',
  '본부장': 'Commander', '지휘 · 최종 의사결정': 'Direction · Final decisions',
  '연결된 모델': 'Connected models', '구성된 부서 에이전트': 'Department roles', '실제 실행 작업': 'Running operations',
  '구성된 부서 에이전트 {count}개': '{count} configured department roles',
  '연결 관리': 'Manage connection', '업무 지시': 'Assign work', '편집': 'Edit',
  '실행 중': 'Running', '작업 대기': 'Queued', '지시 대기': 'Standing by', '오프라인': 'Offline', '확인 중': 'Checking',
  '진행 업무': 'CURRENT', '대기 업무': 'QUEUED', '담당 모델': 'Assigned model',
  '업무 지시를 기다리고 있습니다.': 'Standing by for an assignment.',
  '모델을 연결하면 업무를 지시할 수 있습니다.': 'Connect this model to assign work.',
  '서버에 다시 연결하는 중입니다.': 'Reconnecting to the local server.',
  '아직 배정된 부서가 없습니다.': 'No departments assigned yet.',
  '부서 편집에서 담당 모델을 변경할 수 있습니다.': 'Assign a model in the department editor.',
});
Object.assign(TRANSLATIONS.ja, {
  '노드 워크스페이스': 'ノードワークスペース', '노드를 직접 추가하고 이름표와 연결을 구성하세요.': 'ノードを追加し、名前・役職・接続を自由に設定します。', '프로젝트': 'プロジェクト', '프로젝트별 폴더, 색상과 작업 환경을 관리하세요.': 'プロジェクト別のフォルダー・色・作業環境を管理します。', '사용량과 성능': '使用量と性能', '실제 실행 기록의 토큰, 작업 시간과 비교를 확인하세요.': '実測トークン数、作業時間、観測された変化を確認します。', '프로젝트 기억': 'プロジェクトの記憶', '지식을 검토하고 연결하며 다음 작업에 재사용하세요.': '知識を確認・接続し、次の作業に再利用します。',
  '프로필 · 이름표': 'プロフィール・名札', '표시 이름': '表示名', '직함': '役職', '로컬 전용 AI': 'ローカル専用AI', 'Ollama 로컬 모델만 사용하고 클라우드 실행·자동 업데이트 연결을 중지합니다. 터미널 명령과 OS 네트워크 설정은 사용자가 관리합니다.': 'Ollamaのローカルモデルのみを使い、クラウド実行と自動更新接続を停止します。ターミナルコマンドとOSネットワークは利用者が管理します。',
  'AI 조직도': 'AI組織図',
  '모델과 부서를 연결하고, 당신의 AI 조직을 지휘하세요.': 'モデルと部署をつなぎ、あなたのAI組織を指揮。',
  '조직 연결 현황': '組織の接続状況',
  '본부에서 모델과 부서의 연결, 현재 맡은 업무를 확인하세요.': 'モデルと部署のつながり、各部署が担当する業務を確認できます。',
  '연결 모델과 담당 부서': '接続モデルと担当部署',
  '부서 에이전트는 설정된 역할입니다. 각 모델은 업무를 지시할 때 실행됩니다.': '部署エージェントは設定された役割です。モデルは業務を指示したときに実行され、常時稼働するプロセスではありません。',
  '본부장': '本部長', '지휘 · 최종 의사결정': '指揮 · 最終意思決定',
  '연결된 모델': '接続モデル', '구성된 부서 에이전트': '設定済み部署', '실제 실행 작업': '実行中の業務',
  '구성된 부서 에이전트 {count}개': '設定済みの部署エージェント {count}件',
  '연결 관리': '接続を管理', '업무 지시': '業務を指示', '편집': '編集',
  '실행 중': '実行中', '작업 대기': '実行待ち', '지시 대기': '指示待ち', '오프라인': 'オフライン', '확인 중': '確認中',
  '진행 업무': '進行中の業務', '대기 업무': '待機中の業務', '담당 모델': '担当モデル',
  '업무 지시를 기다리고 있습니다.': '業務の指示を待っています。',
  '모델을 연결하면 업무를 지시할 수 있습니다.': 'モデルを接続すると業務を指示できます。',
  '서버에 다시 연결하는 중입니다.': 'ローカルサーバーに再接続しています。',
  '아직 배정된 부서가 없습니다.': '割り当てられた部署はまだありません。',
  '부서 편집에서 담당 모델을 변경할 수 있습니다.': '部署の編集で担当モデルを変更できます。',
});

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let language = 'ko';
let hasLocalLanguage = false;
let loadedServerLanguage = false;
try { const saved = localStorage.getItem('hq.language'); hasLocalLanguage = ['ko', 'en', 'ja'].includes(saved); if (hasLocalLanguage) language = saved; } catch {}
const t = (key, values = {}) => (TRANSLATIONS[language]?.[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
const num = value => Number(value || 0).toLocaleString(language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US');
function node(tag, attrs = {}, ...children) {
  const item = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') item.className = value;
    else if (key === 'text') item.textContent = value;
    else if (key.startsWith('on')) item.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null && value !== false) item.setAttribute(key, String(value));
  }
  for (const child of children.flat()) if (child !== undefined && child !== null) item.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return item;
}
const DEFAULT_DEPARTMENTS = {
  strategy: { name: '전략기획실', role: '목표를 구체화하고 실행 계획, 우선순위와 의사결정 근거를 정리합니다.' },
  engineering: { name: '개발본부', role: '요구사항을 분석하고 설계, 코드 구현과 개선을 담당합니다.' },
  research: { name: '리서치센터', role: '자료와 프로젝트를 조사하고 출처, 사실, 추론을 구분해 보고합니다.' },
  quality: { name: '품질관리실', role: '결과를 검토하고 오류, 위험과 누락된 요구사항을 검증합니다.' }
};
const departmentName = dept => dept ? (dept.name === DEFAULT_DEPARTMENTS[dept.id]?.name ? t(dept.name) : dept.name) : '—';
const departmentRole = dept => dept ? (dept.role === DEFAULT_DEPARTMENTS[dept.id]?.role ? t(dept.role) : dept.role) : '';
const providerName = id => id === 'claude' ? 'CLAUDE' : id === 'codex' ? 'CODEX' : String(id || 'SYSTEM').toUpperCase();
const STATUS = { queued: 'QUEUED', running: 'RUNNING', completed: 'DONE', failed: 'FAILED', cancelled: 'CANCELLED', interrupted: 'INTERRUPTED' };
const ACTIVE = new Set(['running', 'queued']);
let state = { departments: [], tasks: [], events: [], providers: [], settings: {}, server: {} };
let connected = false;
let selectedTaskId = null;
let currentFilter = 'all';
let view = 'overview';
let feedPaused = false;
let dispatchPending = false;
let lastFeedSignature = '';
let stream;
let accountsMounted = false, terminalMounted = false, updatesMounted = false;
let projectsMounted = false, analyticsMounted = false, knowledgeMounted = false;
const taskDetailCache = new Map(), taskDetailRequests = new Map(), projectDrafts = new Map();
const taskDetailKey = task => `${task.id}:${task.status}:${task.finishedAt || ''}:${task.outputChars || task.output?.length || 0}`;
function inspectedTask(task) {
  if (task && ACTIVE.has(task.status)) return { ...task, detailsTruncated: false };
  const cached = task && taskDetailCache.get(taskDetailKey(task)); return cached ? { ...task, output: cached.output, logs: cached.logs, detailsTruncated: false } : task;
}
Object.assign(TRANSLATIONS.en, {
  'AI 계정': 'AI accounts', '각자의 계정으로 모델을 등록하고 연결하세요.': 'Register models with your own account.', '터미널': 'Terminal', '프로젝트 폴더의 실제 셸을 사용합니다.': 'Use an interactive shell in your project directory.', '업데이트': 'Updates', '새 버전을 확인하고 설치하세요.': 'Check for a new version and install it.',
  '닫기': 'Close', '현재 프로젝트의 기억과 전체 작업 기록을 내보냅니다. 터미널 내용과 로그인 정보는 포함하지 않습니다.': 'Export this project’s memory and all operation records. Shell content and login data are excluded.',
  'F5 AI 계정': 'F5 AI accounts', 'F6 터미널': 'F6 Terminal', 'F7 업데이트': 'F7 Updates'
});
Object.assign(TRANSLATIONS.ja, {
  'AI 계정': 'AIアカウント', '각자의 계정으로 모델을 등록하고 연결하세요.': '自分のアカウントでモデルを登録・接続します。', '터미널': 'ターミナル', '프로젝트 폴더의 실제 셸을 사용합니다.': 'プロジェクトフォルダーの対話型シェルを使用します。', '업데이트': 'アップデート', '새 버전을 확인하고 설치하세요.': '新しいバージョンを確認してインストールします。',
  '닫기': '閉じる', '현재 프로젝트의 기억과 전체 작업 기록을 내보냅니다. 터미널 내용과 로그인 정보는 포함하지 않습니다.': '現在のプロジェクトの記憶と全タスク履歴を書き出します。シェル内容とログイン情報は含みません。',
  'F5 AI 계정': 'F5 AIアカウント', 'F6 터미널': 'F6 ターミナル', 'F7 업데이트': 'F7 アップデート'
});

// Capture original static text once so repeated language changes do not translate user content.
const staticText = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const item = walker.currentNode;
  if (['SCRIPT', 'STYLE'].includes(item.parentElement?.tagName)) continue;
  const original = item.nodeValue.trim();
  if (original && /[가-힣]/.test(original)) staticText.push({ item, original, raw: item.nodeValue });
}
const staticAttributes = [];
$$('[aria-label],[placeholder],[title]').forEach(item => {
  for (const attribute of ['aria-label', 'placeholder', 'title']) {
    const original = item.getAttribute(attribute);
    if (original && /[가-힣]/.test(original)) staticAttributes.push({ item, attribute, original });
  }
});

function installControls() {
  $('#offline-banner').after(node('div', { id: 'storage-banner', class: 'notice notice-warning', role: 'alert', hidden: '' }));
  $('.heading-actions').prepend(node('button', { id: 'project-switcher', class: 'button button-outline', type: 'button', onclick: () => updateView('projects') }, 'PROJECT'));
  const profile = node('div', { class: 'profile-settings' },
    node('h3', {}, '프로필 · 이름표'),
    node('label', { class: 'settings-label', for: 'settings-name' }, '표시 이름'), node('input', { id: 'settings-name', class: 'text-input', maxlength: 60, required: '' }),
    node('label', { class: 'settings-label', for: 'settings-title' }, '직함'), node('input', { id: 'settings-title', class: 'text-input', maxlength: 80 }),
    node('label', { class: 'settings-label' }, node('input', { id: 'settings-local-only', type: 'checkbox' }), ' 로컬 전용 AI'),
    node('p', { class: 'field-help' }, 'Ollama 로컬 모델만 사용하고 클라우드 실행·자동 업데이트 연결을 중지합니다. 터미널 명령과 OS 네트워크 설정은 사용자가 관리합니다.'));
  $('#settings-form').prepend(profile);
  const profileWalker = document.createTreeWalker(profile, NodeFilter.SHOW_TEXT);
  while (profileWalker.nextNode()) { const item = profileWalker.currentNode, original = item.nodeValue.trim(); if (original && /[가-힣]/.test(original)) staticText.push({ item, original, raw: item.nodeValue }); }
  const titleLabel = node('label', { class: 'settings-label', for: 'edit-department-title' }, '직함');
  const titleInput = node('input', { id: 'edit-department-title', class: 'text-input', maxlength: 80 });
  $('#edit-department-role').before(titleLabel, titleInput);
  staticText.push({ item: titleLabel.firstChild, original: '직함', raw: '직함' });
  const picker = node('label', { class: 'language-picker' }, node('span', { class: 'sr-only', id: 'language-label' }, t('화면 언어')));
  const select = node('select', { id: 'language-select', 'aria-label': t('화면 언어') },
    node('option', { value: 'ko' }, '한국어'), node('option', { value: 'en' }, 'EN'), node('option', { value: 'ja' }, '日本語'));
  select.value = language;
  picker.append(select);
  $('.topbar-right').prepend(picker);
  select.addEventListener('change', () => {
    language = select.value;
    hasLocalLanguage = true;
    try { localStorage.setItem('hq.language', language); } catch {}
    applyLanguage();
    if (connected) api('/api/settings', { method: 'POST', body: { language } }).then(result => { if (result.settings) state.settings = result.settings; }).catch(() => {});
  });
  $('#dispatch-prompt').maxLength = 12000;
  $('#prompt-count').textContent = '0 / 12,000';
  const clear = node('button', { type: 'button', id: 'clear-demo-button', class: 'text-button', hidden: '' }, t('데모 지우기'));
  const demos = node('div', { class: 'demo-actions' });
  $('#demo-button').replaceWith(demos);
  demos.append(node('button', { type: 'button', id: 'demo-button', class: 'button button-quiet' }, t('샘플 작업 체험')), clear);
}

function applyLanguage() {
  document.documentElement.lang = language;
  for (const { item, original, raw } of staticText) if (item.isConnected) item.nodeValue = raw.replace(original, t(original));
  for (const { item, attribute, original } of staticAttributes) if (item.isConnected) item.setAttribute(attribute, t(original));
  $('#language-label').textContent = t('화면 언어');
  $('#language-select').setAttribute('aria-label', t('화면 언어'));
  $('#clear-demo-button').textContent = t('데모 지우기');
  $('#demo-button').textContent = t('샘플 작업 체험');
  // Keep source prompts in data attributes and translate only when inserted by the user.
  updateView(view);
  updateClock();
  lastFeedSignature = '';
  render();
  renderProviders();
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.method && options.method !== 'GET') {
    headers['content-type'] = 'application/json';
    headers['x-hq-token'] = state.server.csrfToken || '';
  }
  const response = await fetch(path, { ...options, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) {
    const error = new Error(result.error || t('요청을 처리하지 못했습니다.'));
    error.status = response.status;
    throw error;
  }
  return result;
}

function toast(message, error = false) {
  const item = node('div', { class: `toast${error ? ' error' : ''}` }, message);
  $('#toast-container').append(item);
  setTimeout(() => item.remove(), 5000);
}

function setConnected(value) {
  connected = value;
  $('#connection-dot').className = `live-dot${value ? '' : ' offline'}`;
  $('#footer-dot').className = `live-dot${value ? '' : ' offline'}`;
  $('#connection-label').textContent = value ? 'SYSTEM ONLINE' : 'RECONNECTING';
  $('#footer-status').textContent = value ? 'ALL SYSTEMS NOMINAL' : 'CONNECTION LOST';
  $('#offline-banner').hidden = value;
  $('#dispatch-submit').disabled = !value || dispatchPending;
  $('.stream-status').style.opacity = value ? '' : '.45';
  renderOrganization();
  renderExtensions();
}

function receiveState(incoming) {
  if (!incoming || !Array.isArray(incoming.tasks) || !Array.isArray(incoming.departments)) return;
  const previousWorkspace = state.settings.workspace;
  let restoredDepartment = null;
  if (previousWorkspace && incoming.settings?.workspace !== previousWorkspace) {
    taskDetailRequests.clear();
    projectDrafts.set(previousWorkspace, { prompt: $('#dispatch-prompt').value, department: $('#dispatch-department').value, provider: $('#dispatch-provider').value });
    const draft = projectDrafts.get(incoming.settings?.workspace);
    restoredDepartment = draft?.department || null;
    $('#dispatch-prompt').value = draft?.prompt || ''; $('#dispatch-provider').value = draft?.provider || '';
    selectedTaskId = null;
  }
  const memoryChanged = incoming.memoryUpdatedAt && incoming.memoryUpdatedAt !== state.memoryUpdatedAt;
  state = { ...state, ...incoming };
  if (memoryChanged) window.dispatchEvent(new CustomEvent('imperium:memory-changed'));
  if (!loadedServerLanguage) {
    loadedServerLanguage = true;
    if (!hasLocalLanguage && ['ko', 'en', 'ja'].includes(state.settings.language)) {
      language = state.settings.language;
      $('#language-select').value = language;
      applyLanguage();
    } else if (hasLocalLanguage && state.settings.language !== language) {
      api('/api/settings', { method: 'POST', body: { language } }).then(result => { if (result.settings) state.settings = result.settings; }).catch(() => {});
    }
  }
  if (selectedTaskId && !state.tasks.some(task => task.id === selectedTaskId)) selectedTaskId = null;
  if (!selectedTaskId && state.tasks.length) selectedTaskId = state.tasks[0].id;
  render();
  if (restoredDepartment && state.departments.some(d => d.id === restoredDepartment)) { $('#dispatch-department').value = restoredDepartment; renderDepartments(); }
  if ($('#settings-dialog').open) renderProviders();
}

async function connect() {
  try {
    receiveState(await api('/api/state'));
    setConnected(true);
  } catch (error) {
    setConnected(false);
  }
  stream = new EventSource('/api/events');
  stream.addEventListener('state', event => {
    try { receiveState(JSON.parse(event.data)); setConnected(true); } catch { /* incomplete events reconnect automatically */ }
  });
  stream.onopen = () => {
    setConnected(true);
    // Recover a state snapshot even when a server restart races the first request.
    api('/api/state').then(receiveState).catch(() => setConnected(false));
  };
  stream.onerror = () => setConnected(false);
}

function render() {
  const storageError = state.server.storageError;
  $('#storage-banner').hidden = !storageError;
  if (storageError) $('#storage-banner').textContent = language === 'ja' ? '記録を保存できませんでした。既存ファイルを保持し、次の保存時に再試行します。' : language === 'en' ? 'Records could not be saved. The previous file is preserved; the next save will retry.' : '기록을 저장하지 못했습니다. 기존 파일은 보존하며 다음 저장 시 다시 시도합니다.';
  renderExtensions();
  renderOrganization();
  renderMetrics();
  renderDepartmentOptions();
  renderDepartments();
  renderMissions();
  renderFeed();
  renderInspector();
  $('#clear-demo-button').hidden = !state.tasks.some(task => task.demo);
  $('#workspace-path').textContent = state.settings.workspace || 'WORKSPACE —';
  $('#workspace-path').title = state.settings.workspace || t('작업 폴더');
  $('.sidebar-version b').textContent = `v${state.server.version || '1.2.0'}`;
  $('#permission-description').textContent = t($('#write-permission').checked ? '파일 수정이 가능한 작업으로 실행합니다.' : '기본: 읽기 및 분석만');
  const identity = state.settings.identity || { name: '나', title: '워크스페이스 소유자' };
  const profileText = $('#settings-top > span:nth-child(2)');
  profileText.replaceChildren(identity.name, node('small', {}, identity.title || ''));
  $('#settings-top .avatar').textContent = [...(identity.name || '')][0] || 'I';
  $('.subscription-label').textContent = state.settings.localOnly ? 'LOCAL AI ONLY' : 'SUBSCRIPTION CLI';
  $('#prompt-count').textContent = `${num($('#dispatch-prompt').value.length)} / 12,000`;
}

function renderOrganization() {
  const readyCount = connected ? state.providers.filter(provider => provider.status === 'ready' && provider.authenticated).length : 0;
  const runningCount = state.tasks.filter(task => task.status === 'running' && !task.demo).length;
  $('#org-summary').replaceChildren(...[
    ['providers', `${readyCount}/2`, '연결된 모델'],
    ['departments', String(state.departments.length), '구성된 부서 에이전트'],
    ['running', connected ? String(runningCount) : '—', '실제 실행 작업'],
  ].map(([metric, value, label]) => node('div', { class: 'org-summary-item', 'data-metric': metric }, node('strong', { class: 'org-summary-value' }, value), node('span', { class: 'org-summary-label' }, t(label)))));
  $('#org-chart-root').replaceChildren(node('div', { class: 'org-commander-node org-commander-card' },
    node('span', { class: 'org-commander-badge', 'aria-hidden': 'true' }, 'YOU'),
    node('div', { class: 'org-commander-content' }, node('strong', { class: 'org-commander-name' }, t('본부장')), node('span', { class: 'org-commander-role' }, t('지휘 · 최종 의사결정'))),
    node('span', { class: 'org-commander-status' }, 'COMMANDER')));
  const branches = ['codex', 'claude'].map(providerId => {
    const provider = state.providers.find(item => item.id === providerId);
    const status = !connected ? 'offline' : provider?.status || 'checking';
    const ready = status === 'ready' && provider?.authenticated;
    const labels = { ready: '연결됨', missing: '설치 필요', login_required: '로그인 필요', error: '확인 필요', offline: '오프라인', checking: '확인 중' };
    const departments = state.departments.filter(dept => dept.provider === providerId);
    const providerLabel = providerId === 'codex' ? 'ChatGPT / Codex' : 'Claude Code';
    const hub = node('section', { class: 'org-provider-node', 'data-provider': providerId, 'data-status': status, 'aria-label': `${providerLabel} · ${t(labels[status] || '확인 필요')}` },
      node('div', { class: 'org-provider-heading' }, node('span', { class: 'org-provider-mark', 'aria-hidden': 'true' }, providerId === 'codex' ? 'GPT' : 'C'), node('h3', { class: 'org-provider-name' }, providerLabel),
        node('span', { class: 'org-provider-status', 'data-status': status }, node('span', { class: `live-dot${ready ? '' : status === 'error' || status === 'offline' ? ' offline' : ' connecting'}`, 'aria-hidden': 'true' }), t(labels[status] || '확인 필요'))),
      node('p', { class: 'org-provider-meta' }, t('구성된 부서 에이전트 {count}개', { count: departments.length })),
      node('button', { class: 'org-provider-action', type: 'button', onclick: openSettings, 'aria-label': `${providerLabel} · ${t('연결 관리')}` }, t('연결 관리'), ' ↗'));
    const children = node('ul', { class: 'org-department-children', 'aria-label': providerLabel });
    if (!departments.length) children.append(node('li', { class: 'org-empty-branch' }, node('strong', {}, t('아직 배정된 부서가 없습니다.')), node('span', {}, t('부서 편집에서 담당 모델을 변경할 수 있습니다.'))));
    for (const dept of departments) {
      const tasks = state.tasks.filter(task => task.departmentId === dept.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const task = tasks.find(item => item.status === 'running') || tasks.find(item => item.status === 'queued');
      const agentStatus = !connected ? 'offline' : task?.status === 'running' ? 'running' : task?.status === 'queued' ? 'queued' : ready ? 'idle' : 'unavailable';
      const agentLabels = { running: '실행 중', queued: '작업 대기', idle: '지시 대기', unavailable: '연결 필요', offline: '오프라인' };
      const taskLine = node('p', { class: 'org-agent-task', title: task?.title || '' });
      if (task && connected) taskLine.append(node('small', { class: 'org-task-label' }, t(task.status === 'queued' ? '대기 업무' : '진행 업무')), node('span', {}, `${task.demo ? '[DEMO] ' : ''}${task.title}`));
      else taskLine.append(node('span', {}, t(!connected ? '서버에 다시 연결하는 중입니다.' : ready ? '업무 지시를 기다리고 있습니다.' : '모델을 연결하면 업무를 지시할 수 있습니다.')));
      children.append(node('li', { class: 'org-agent-card', 'data-department-id': dept.id, 'data-provider': providerId, 'data-status': agentStatus },
        node('div', { class: 'org-agent-header' }, node('span', { class: 'org-agent-code' }, `DPT. ${dept.code || dept.id.toUpperCase().slice(0, 3)}`), node('span', { class: 'org-agent-status', 'data-status': agentStatus }, `${task?.demo && connected ? 'DEMO · ' : ''}${t(agentLabels[agentStatus])}`)),
        node('h3', { class: 'org-agent-name' }, departmentName(dept)),
        node('p', { class: 'org-agent-model' }, `${t(task ? '실행 모델' : '담당 모델')} · ${task ? task.provider === 'claude' ? 'Claude Code' : 'ChatGPT / Codex' : providerLabel}`),
        node('p', { class: 'org-agent-role' }, departmentRole(dept)), taskLine,
        node('div', { class: 'org-agent-actions' },
          node('button', { class: 'org-agent-dispatch', type: 'button', onclick: () => assignDepartment(dept.id), 'aria-label': `${departmentName(dept)} · ${t('업무 지시')}` }, t('업무 지시'), ' ↗'),
          node('button', { class: 'org-agent-edit', type: 'button', onclick: () => openDepartmentEditor(dept), 'aria-label': `${departmentName(dept)} · ${t('부서 편집')}` }, t('편집')))));
    }
    return node('li', { class: 'org-model-branch', 'data-provider': providerId }, hub, children);
  });
  $('#org-model-branches').replaceChildren(...branches);
}

function assignDepartment(departmentId) {
  $('#dispatch-department').value = departmentId;
  $('#dispatch-provider').value = '';
  updateView('operations');
  renderDepartments();
  $('#dispatch-section').scrollIntoView({ block: 'center', behavior: 'smooth' });
  $('#dispatch-prompt').focus({ preventScroll: true });
}

function renderMetrics() {
  const running = state.tasks.filter(task => task.status === 'running').length;
  const queued = state.tasks.filter(task => task.status === 'queued').length;
  const completed = state.tasks.filter(task => task.status === 'completed').length;
  const ready = state.providers.filter(provider => provider.status === 'ready').length;
  $('#metric-running').textContent = String(running).padStart(2, '0');
  $('#metric-queued').textContent = String(queued).padStart(2, '0');
  $('#metric-completed').textContent = String(completed).padStart(2, '0');
  const totalProviders = state.providers.length || 2;
  $('#metric-providers').replaceChildren(String(ready), node('span', { class: 'metric-fraction' }, `/${totalProviders}`));
  $('#connection-count').textContent = `${ready}/${totalProviders}`;
  $('#metric-running-detail').textContent = running ? t('실행 중인 에이전트 {count}개', { count: running }) : t('지시를 기다리고 있습니다');
  $('#metric-completed-detail').textContent = t('전체 {count}건 중', { count: state.tasks.length });
  $('#metric-providers-detail').textContent = t('연결 {ready} · 확인 필요 {missing}', { ready, missing: Math.max(0, totalProviders - ready) });
  $('.metric-graphic.green-text').textContent = running ? '▂▄▃▆▅▇▄▆' : '▁▁▁▁▁▁▁▁';
}

function renderDepartmentOptions() {
  renderConnectionOptions();
  const select = $('#dispatch-department');
  const selected = select.value;
  const signature = `${language}:${state.departments.map(dept => `${dept.id}:${dept.name}`).join('|')}`;
  if (select.dataset.signature === signature) return;
  select.dataset.signature = signature;
  select.replaceChildren(...state.departments.map(dept => node('option', { value: dept.id }, departmentName(dept))));
  if (state.departments.some(dept => dept.id === selected)) select.value = selected;
}

function connectionChoices(defaultOption = false) {
  return [ ...(defaultOption ? [node('option', { value: '' }, t('부서 기본 모델'))] : []),
    ...state.providers.map(p => node('option', { value: p.id }, p.name || providerName(p.id))),
    ...(state.connections || []).map(c => node('option', { value: `connection:${c.id}` }, `${c.label}${c.modelId ? ` · ${c.modelId}` : ''}`)) ];
}
function renderConnectionOptions() {
  const signature = JSON.stringify([language, state.providers.map(p => [p.id, p.name]), state.connections]);
  const select = $('#dispatch-provider');
  if (select.dataset.signature === signature) return;
  const selected = select.value; select.dataset.signature = signature;
  select.replaceChildren(...connectionChoices(true)); if ([...select.options].some(o => o.value === selected)) select.value = selected;
}
function selectedConnection(value) {
  if (value.startsWith('connection:')) return { connectionId: value.slice(11) };
  return value ? { provider: value } : {};
}

function renderDepartments() {
  const icons = { strategy: '⌘', engineering: '⌥', research: '⌕', quality: '◇' };
  $('#department-total').textContent = `${state.departments.length} DEPARTMENTS`;
  const cards = state.departments.map(dept => {
    const active = state.tasks.find(task => task.departmentId === dept.id && task.status === 'running');
    const ready = state.providers.find(provider => provider.id === dept.provider)?.status === 'ready';
    const label = active ? 'RUNNING' : ready ? t('대기 중') : t('연결 필요');
    const statusClass = active ? 'running' : ready ? '' : 'unavailable';
    const card = node('div', { class: `department-card${$('#dispatch-department').value === dept.id ? ' selected' : ''}`, tabindex: '0', role: 'button', 'aria-label': `${departmentName(dept)} · ${providerName(dept.provider)}` },
      node('div', { class: 'department-card-head' }, node('span', { class: 'department-code' }, `DPT. ${dept.code || dept.id.toUpperCase().slice(0, 3)}`), node('span', { class: `department-state ${statusClass}` }, node('span', { class: 'live-dot' }), label)),
      node('div', { class: 'department-main' }, node('span', { class: 'department-icon', 'aria-hidden': 'true' }, icons[dept.id] || '◇'), node('div', {}, node('div', { class: 'department-name' }, departmentName(dept)), node('div', { class: 'department-model' }, dept.provider === 'claude' ? 'CLAUDE CODE' : 'CHATGPT / CODEX'))),
      node('p', { class: `department-description${active ? ' running-task' : ''}`, title: active?.title || departmentRole(dept) }, active?.title || departmentRole(dept)),
      node('button', { class: 'department-edit', type: 'button', title: t('부서 편집'), 'aria-label': `${departmentName(dept)} · ${t('부서 편집')}`, onclick: event => { event.stopPropagation(); openDepartmentEditor(dept); } }, '↗'));
    const choose = () => { $('#dispatch-department').value = dept.id; $('#dispatch-provider').value = ''; renderDepartments(); if (view !== 'departments') $('#dispatch-prompt').focus({ preventScroll: true }); };
    card.addEventListener('click', choose);
    card.addEventListener('keydown', event => { if (event.target === card && ['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(); } });
    return card;
  });
  $('#department-grid').replaceChildren(...cards);
}

function elapsed(task) {
  const start = new Date(task.startedAt || task.createdAt).getTime();
  const end = task.finishedAt ? new Date(task.finishedAt).getTime() : Date.now();
  if (!Number.isFinite(start)) return '—';
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
}

function statusTag(task) {
  const estimate = task.status === 'running' && task.progress?.source === 'model-estimate' && Number.isFinite(task.progress.percent) ? ` · AI ${Math.min(99, Math.round(task.progress.percent))}%` : '';
  return node('span', { class: `status-tag ${task.status}` }, (STATUS[task.status] || String(task.status || '').toUpperCase()) + estimate);
}

function progressView(task) {
  const copy = language === 'ja' ? { actual: '実行完了', model: 'AIの自己推定', waiting: 'AIの推定待ち', minutes: '約{n}分', expired: '再推定待ち', historical: '過去{n}件に基づく目安', uncertain: '推定値です。完了確認とは異なります。' } : language === 'en' ? { actual: 'Execution completed', model: 'AI self estimate', waiting: 'Awaiting AI estimate', minutes: 'About {n} min', expired: 'Awaiting a revised estimate', historical: 'Estimate from {n} past tasks', uncertain: 'Estimates are separate from confirmed completion.' } : { actual: '실행 완료', model: 'AI 자체 추정', waiting: 'AI 추정 대기', minutes: '약 {n}분', expired: '재추정 대기', historical: '과거 {n}건 기준 추정', uncertain: '추정치는 실제 완료 확인과 구분합니다.' };
  const p = task.progress, completed = task.status === 'completed', active = task.status === 'running';
  const percent = completed ? 100 : active && p?.source === 'model-estimate' && Number.isFinite(p.percent) ? Math.max(0, Math.min(99, Math.round(p.percent))) : null;
  const box = node('div', { class: 'operation-progress' });
  box.append(node('strong', {}, completed ? `${copy.actual} · 100%` : percent !== null ? `${copy.model} · ${percent}%` : copy.waiting));
  if (percent !== null) { const bar = node('div', { class: 'operation-progress-track', role: 'progressbar', 'aria-label': completed ? copy.actual : copy.model, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent }); const fill = node('span'); fill.style.width = `${percent}%`; bar.append(fill); box.append(bar); }
  if (active && p?.stage) box.append(node('p', {}, p.stage));
  if (active && Number.isFinite(p?.etaMinutes)) {
    const remaining = p.etaMinutes * 60 - Math.max(0, (Date.now() - Date.parse(p.updatedAt)) / 1000);
    box.append(node('span', {}, remaining > 0 ? copy.minutes.replace('{n}', String(Math.max(1, Math.ceil(remaining / 60)))) : copy.expired));
  } else if (active && task.historicalETA) {
    const h = task.historicalETA, remaining = h.medianSeconds - Math.max(0, (Date.now() - Date.parse(task.startedAt)) / 1000);
    box.append(node('span', {}, `${copy.historical.replace('{n}', h.sampleCount)} · ${remaining > 0 ? copy.minutes.replace('{n}', Math.max(1, Math.ceil(remaining / 60))) : copy.expired}`));
  }
  if (active) box.append(node('small', {}, copy.uncertain));
  return box;
}

function renderMissions() {
  const search = $('#task-search').value.trim().toLocaleLowerCase();
  const attention = state.tasks.filter(task => ['failed', 'interrupted'].includes(task.status));
  $('#mission-total').textContent = `${state.tasks.length} OPERATIONS`;
  $('#filter-all-count').textContent = String(state.tasks.length);
  $('#filter-active-count').textContent = String(state.tasks.filter(task => ACTIVE.has(task.status)).length);
  $('#filter-attention-count').textContent = String(attention.length);
  $('#filter-attention-count').hidden = !attention.length;
  const filtered = state.tasks.filter(task => {
    const department = state.departments.find(dept => dept.id === task.departmentId);
    const matchesStatus = currentFilter === 'all' || (currentFilter === 'active' && ACTIVE.has(task.status)) || (currentFilter === 'completed' && task.status === 'completed') || (currentFilter === 'attention' && ['failed', 'interrupted'].includes(task.status));
    return matchesStatus && (!search || `${task.title} ${task.id} ${task.prompt} ${departmentName(department)} ${task.provider}`.toLocaleLowerCase().includes(search));
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $('#mission-rows').replaceChildren(...filtered.map(task => {
    const department = state.departments.find(dept => dept.id === task.departmentId);
    const subline = node('span', { class: 'task-department' }, departmentName(department));
    if (task.priority === 'high') subline.append(node('span', { class: 'priority-mark' }, '↑ HIGH'));
    if (task.demo) subline.append(node('span', { class: 'demo-tag' }, 'DEMO'));
    const action = node('td');
    if (ACTIVE.has(task.status)) action.append(node('button', { class: 'cancel-task', type: 'button', 'aria-label': `${t('작업 취소')}: ${task.title}`, title: t('작업 취소'), onclick: event => { event.stopPropagation(); cancelTask(task.id); } }, '×'));
    const row = node('tr', { class: selectedTaskId === task.id ? 'selected' : '', tabindex: '0', 'aria-label': `${task.title} · ${STATUS[task.status] || task.status}`, 'aria-selected': selectedTaskId === task.id ? 'true' : 'false' },
      node('td', {}, node('span', { class: 'task-short-id' }, `#${task.id.slice(-5).toUpperCase()}`)),
      node('td', {}, node('span', { class: 'task-name', title: task.title }, task.title), subline),
      node('td', {}, node('span', { class: `provider-name ${task.provider}` }, providerName(task.provider))),
      node('td', {}, statusTag(task)), node('td', {}, node('span', { class: 'elapsed-text', 'data-elapsed-task': task.id }, elapsed(task))), action);
    const choose = () => { selectedTaskId = task.id; renderMissions(); renderInspector(); };
    row.addEventListener('click', choose);
    row.addEventListener('keydown', event => { if (event.target === row && ['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(); } });
    return row;
  }));
  $('#empty-missions').hidden = filtered.length > 0;
  $('#empty-missions-title').textContent = t(state.tasks.length ? '일치하는 작업이 없습니다' : '첫 번째 지시를 내려보세요');
  $('#empty-missions-description').textContent = t(state.tasks.length ? '상태 필터나 검색어를 변경해보세요.' : '아래 명령 입력창에서 부서와 모델을 선택하면 작업이 시작됩니다.');
  $('#focus-dispatch').hidden = state.tasks.length > 0;
}

function timeOf(value) {
  try { return new Date(value).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour12: false }); } catch { return '--:--:--'; }
}

function renderFeed() {
  if (feedPaused) return;
  const feed = $('#activity-feed');
  const events = (state.events || []).slice(-150);
  const signature = `${language}:${events.length}:${events.at(-1)?.id || events.at(-1)?.timestamp || ''}:${events.at(-1)?.text || ''}`;
  if (signature === lastFeedSignature) return;
  lastFeedSignature = signature;
  const wasAtBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 60;
  if (!events.length) {
    feed.replaceChildren(node('div', { class: 'feed-idle' },
      node('div', { class: 'feed-idle-line' }, node('span', { class: 'feed-idle-prompt' }, '›'), node('span', {}, 'HQ EVENT STREAM INITIALIZED')),
      node('div', { class: 'feed-idle-line' }, node('span', { class: 'feed-idle-prompt' }, '›'), node('span', {}, t('아직 실행 기록이 없습니다.'))),
      node('div', { class: 'feed-idle-line' }, node('span', { class: 'feed-idle-prompt' }, '›'), node('span', {}, t('작업을 보내면 모델의 활동이 여기에 표시됩니다.'))),
      node('div', { class: 'feed-waiting' }, t('본부의 첫 지시를 기다리고 있습니다.'), ' ', node('span', {}, '▍'))));
  } else {
    feed.replaceChildren(...events.map(event => {
      const department = state.departments.find(dept => dept.id === event.departmentId);
      const task = state.tasks.find(item => item.id === event.taskId);
      const source = department ? `${department.code || departmentName(department)} / ${providerName(event.provider || department.provider)}` : event.provider ? providerName(event.provider) : 'HQ SYSTEM';
      const sourceLine = node('div', { class: 'feed-source' }, source);
      if (task?.demo || event.demo) sourceLine.append(node('span', { class: 'demo-tag' }, 'DEMO'));
      return node('div', { class: `feed-entry ${['error', 'tool', 'completed', 'status', 'task'].includes(event.type) ? event.type : ''}` }, node('span', { class: 'feed-time' }, timeOf(event.timestamp)), node('div', { class: 'feed-entry-content' }, sourceLine, node('div', { class: 'feed-entry-text' }, event.text || '')));
    }));
  }
  $('#event-count').textContent = `${state.events.length} EVENTS`;
  if (wasAtBottom || events.length <= 1) feed.scrollTop = feed.scrollHeight;
}

function renderInspector() {
  const container = $('#inspector-content');
  const oldScroll = container.scrollTop;
  const wasAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
  let task = inspectedTask(state.tasks.find(item => item.id === selectedTaskId));
  $('#copy-output').disabled = !task?.output || task.detailsTruncated;
  if (!task) {
    container.replaceChildren(node('div', { class: 'inspector-empty' }, node('div', { class: 'inspector-empty-visual', 'aria-hidden': 'true' }, node('span'), node('span'), node('span')), node('strong', {}, t('작업을 선택하세요')), node('p', {}, t('작업 현황에서 항목을 선택하면'), node('br'), t('진행 과정과 결과를 확인할 수 있습니다.'))));
    return;
  }
  if (task.detailsTruncated) {
    const key = taskDetailKey(task), project = state.settings.workspace, pending = taskDetailRequests.get(key);
    if (!pending || Date.now() - pending > 5000) {
      taskDetailRequests.set(key, Date.now());
      api(`/api/tasks/${encodeURIComponent(task.id)}`).then(result => {
        const current = state.tasks.find(t => t.id === result.task?.id);
        if (project !== state.settings.workspace || !current || taskDetailKey(current) !== key) return;
        taskDetailCache.set(key, result.task);
        while (taskDetailCache.size > 30) taskDetailCache.delete(taskDetailCache.keys().next().value);
        renderInspector();
      }).catch(() => {});
    }
  }
  const department = state.departments.find(dept => dept.id === task.departmentId);
  const tags = node('div', { class: 'inspector-tags' }, node('span', {}, departmentName(department)), node('span', {}, providerName(task.provider)), node('span', {}, t(task.permission === 'workspace-write' ? '파일 수정 허용됨' : '읽기 전용')));
  if (task.demo) tags.append(node('span', { class: 'demo-tag' }, 'DEMO'));
  const meta = node('div', { class: 'inspector-meta' }, node('div', { class: 'inspector-meta-top' }, node('span', {}, `#${task.id.slice(-8).toUpperCase()}`), statusTag(task)), node('h3', {}, task.title), tags);
  const prompt = node('div', { class: 'inspector-prompt' }, node('span', { class: 'inspector-section-label' }, t('작업 지시')), node('p', {}, task.prompt || ''));
  const result = node('div', { class: 'inspector-result' }, node('span', { class: 'inspector-section-label' }, t('실행 결과')));
  if (task.detailsTruncated) result.append(node('p', { class: 'waiting-output' }, language === 'ja' ? 'プレビュー · 全文を読み込み中…' : language === 'en' ? 'Preview · loading full output…' : '미리보기 · 전체 결과 불러오는 중…'));
  if (task.output) result.append(node('pre', {}, task.output));
  else result.append(node('p', { class: 'waiting-output' }, t(ACTIVE.has(task.status) ? '결과를 기다리는 중입니다…' : task.status === 'cancelled' ? '작업이 취소되었습니다.' : '아직 결과가 없습니다.')));
  if (task.error) result.append(node('p', { class: 'inspector-error' }, task.error));
  const parts = [meta, prompt, result];
  if (['running', 'completed'].includes(task.status)) parts.splice(1, 0, progressView(task));
  if (task.memoryUsage) {
    const m = task.memoryUsage;
    const words = language === 'ja' ? ['参照記憶', '文脈文字', '追加検索'] : language === 'en' ? ['Memories used', 'context chars', 'extra lookups'] : ['참조한 기억', '문맥 문자', '추가 검색'];
    parts.push(node('div', { class: 'inspector-memory' }, `${words[0]} ${m.selectedIds?.length || 0} · ${num(m.contextChars)} ${words[1]} / ${num(m.totalMemoryChars)} · ${words[2]} ${m.retrievals || 0}`));
  }
  if (task.usage && (task.usage.inputTokens || task.usage.outputTokens)) parts.push(node('div', { class: 'inspector-usage' }, node('span', {}, t('입력 {count} 토큰', { count: num(task.usage.inputTokens) })), node('span', {}, t('출력 {count} 토큰', { count: num(task.usage.outputTokens) }))));
  if (task.status === 'failed') parts.push(node('div', { class: 'inspector-links' }, node('button', { class: 'text-button', type: 'button', onclick: openSettings }, t('연결 상태 확인'), ' ↗')));
  container.replaceChildren(...parts);
  container.scrollTop = wasAtBottom && task.status === 'running' ? container.scrollHeight : oldScroll;
}

function updateView(next) {
  view = ['overview', 'operations', 'departments', 'logs', 'accounts', 'terminal', 'updates', 'projects', 'analytics', 'knowledge'].includes(next) ? next : 'overview';
  $('.app-shell').dataset.view = view;
  $$('.nav-button[data-view]').forEach(button => { const active = button.dataset.view === view; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  const content = {
    overview: ['NODE WORKSPACE', '노드 워크스페이스', '노드를 직접 추가하고 이름표와 연결을 구성하세요.'],
    operations: ['OPERATIONS', '작업 관리', '부서별 작업을 확인하고 실행 결과를 검토하세요.'],
    departments: ['ORGANIZATION', '부서 관리', '부서의 역할과 담당 모델을 구성하세요.'],
    logs: ['ACTIVITY STREAM', '활동 로그', '모든 부서의 실행 기록을 실시간으로 확인하세요.'],
    accounts: ['AI CONNECTIONS', 'AI 계정', '각자의 계정으로 모델을 등록하고 연결하세요.'],
    terminal: ['INTERACTIVE SHELL', '터미널', '프로젝트 폴더의 실제 셸을 사용합니다.'],
    updates: ['RELEASE CHANNEL', '업데이트', '새 버전을 확인하고 설치하세요.'],
    projects: ['PROJECT WORKSPACES', '프로젝트', '프로젝트별 폴더, 색상과 작업 환경을 관리하세요.'],
    analytics: ['OBSERVED METRICS', '사용량과 성능', '실제 실행 기록의 토큰, 작업 시간과 비교를 확인하세요.'],
    knowledge: ['PROJECT MEMORY', '프로젝트 기억', '지식을 검토하고 연결하며 다음 작업에 재사용하세요.']
  }[view];
  $('#breadcrumb').textContent = content[0];
  $('#page-title').replaceChildren(t(content[1]), node('span', { class: 'title-cursor' }, '_'));
  $('#page-description').textContent = t(content[2]);
  renderExtensions();
}

function renderExtensions() {
  window.ImperiumWorkspace?.render(state, { language, t, connected, onAssignDepartment: assignDepartment, onOpenSettings: () => updateView('accounts'), onEditDepartment: openDepartmentEditor });
  if (state.server.csrfToken && window.ImperiumAccounts) {
    if (!accountsMounted) {
      accountsMounted = true;
      window.ImperiumAccounts.mount($('#accounts-section'), { getState: () => state, api, onChanged: async () => { receiveState(await api('/api/state')); } });
    }
    window.ImperiumAccounts.render(state);
  }
  if (view === 'terminal' && window.ImperiumTerminal && !terminalMounted) {
    terminalMounted = true;
    window.ImperiumTerminal.mount($('#terminal-section'), { api, getState: () => state, language, autoStart: false });
  }
  if (terminalMounted) window.ImperiumTerminal.render(state);
  if (view === 'updates' && window.ImperiumUpdates && !updatesMounted) {
    updatesMounted = true; window.ImperiumUpdates.mount($('#updates-section'));
  }
  const project = state.projects?.find(p => p.current) || state.projects?.find(p => p.workspace === state.settings.workspace);
  if ($('#project-switcher')) { $('#project-switcher').textContent = `▱ ${project?.name || (state.settings.workspace || 'PROJECT').split(/[\\/]/).pop()}`; $('#project-switcher').style.borderColor = project?.color || ''; }
  if (view === 'projects' && window.ImperiumProjects) {
    if (!projectsMounted) { projectsMounted = true; window.ImperiumProjects.mount($('#projects-section'), { getState: () => state, api, onChanged: async () => receiveState(await api('/api/state')), onSelect: async () => { receiveState(await api('/api/state')); updateView('overview'); } }); }
    window.ImperiumProjects.render(state);
  }
  if (view === 'analytics' && window.ImperiumAnalytics) {
    if (!analyticsMounted) { analyticsMounted = true; window.ImperiumAnalytics.mount($('#analytics-section'), { getState: () => state, api }); }
    window.ImperiumAnalytics.render(state);
  }
  if (view === 'knowledge' && window.ImperiumKnowledge) {
    if (!knowledgeMounted) { knowledgeMounted = true; window.ImperiumKnowledge.mount($('#knowledge-section'), { getState: () => state, api }); }
    window.ImperiumKnowledge.render(state);
  }
}

function renderProviders() {
  const statusLabels = { ready: '연결됨', missing: '설치 필요', login_required: '로그인 필요', error: '확인 필요' };
  if (!state.providers.length) { $('#provider-cards').replaceChildren(node('p', { class: 'settings-description' }, t('연결 상태를 확인하고 있습니다.'))); return; }
  $('#provider-cards').replaceChildren(...state.providers.map(provider => {
    const friendly = { ready: '구독 계정으로 연결되었습니다.', missing: 'CLI를 설치한 뒤 구독 계정으로 로그인하세요.', login_required: '터미널에서 아래 명령으로 로그인한 뒤 상태를 새로고침하세요.', error: '연결을 확인할 수 없습니다. 상태를 새로고침하세요.' }[provider.status] || '연결을 확인할 수 없습니다. 상태를 새로고침하세요.';
    const card = node('div', { class: 'provider-card', 'data-provider': provider.id }, node('div', { class: 'provider-card-header' }, node('span', { class: 'provider-card-name' }, node('span', { class: 'provider-letter', 'aria-hidden': 'true' }, provider.id === 'claude' ? 'C' : 'G'), provider.name || providerName(provider.id)), node('span', { class: `provider-card-status ${provider.status}` }, `● ${t(statusLabels[provider.status] || '확인 필요')}`)), node('p', { class: 'provider-card-detail' }, t(friendly)));
    if (provider.version) card.append(node('div', { class: 'provider-version' }, `VERSION ${provider.version}`));
    if (provider.status === 'missing') card.append(commandLine(provider.id === 'claude' ? 'npm install -g @anthropic-ai/claude-code' : 'npm install -g @openai/codex', t('설치')));
    if (provider.status !== 'ready') card.append(commandLine(provider.loginCommand || (provider.id === 'claude' ? 'claude auth login' : 'codex login'), t('로그인')));
    // Provider diagnostics are local tool output, not translated or interpreted as HTML.
    if (provider.detail && provider.status === 'error') card.append(node('p', { class: 'provider-card-detail muted-text' }, `${t('상세 정보')}: ${provider.detail}`));
    return card;
  }));
}

function commandLine(command, label) {
  return node('div', { class: 'provider-command' }, node('span', { class: 'command-label' }, label), node('code', {}, command), node('button', { type: 'button', onclick: () => copyText(command) }, t('복사')));
}

function openSettings() {
  $('#settings-name').value = state.settings.identity?.name || '나';
  $('#settings-title').value = state.settings.identity?.title || '';
  $('#settings-local-only').checked = state.settings.localOnly === true;
  $('#settings-workspace').value = state.settings.workspace || '';
  $('#settings-concurrency').value = String(state.settings.maxConcurrent || 2);
  $('#settings-error').hidden = true;
  renderProviders();
  if (!$('#settings-dialog').open) $('#settings-dialog').showModal();
}

function openDepartmentEditor(dept) {
  $('#department-dialog').dataset.workspace = state.settings.workspace;
  $('#edit-department-id').value = dept.id;
  $('#edit-department-name').value = dept.name;
  $('#edit-department-provider').replaceChildren(...connectionChoices());
  $('#edit-department-provider').value = dept.connectionId ? `connection:${dept.connectionId}` : dept.provider;
  $('#edit-department-role').value = dept.role;
  $('#edit-department-title').value = dept.title || '';
  $('#department-error').hidden = true;
  $('#department-dialog').showModal();
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t('클립보드에 복사했습니다.')); }
  catch { toast(t('복사할 수 없습니다. 텍스트를 직접 선택해주세요.'), true); }
}

async function cancelTask(id) {
  try { const result = await api(`/api/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} }); if (result.task) { const index = state.tasks.findIndex(task => task.id === id); if (index >= 0) state.tasks[index] = result.task; render(); } toast(t('작업을 취소했습니다.')); }
  catch (error) { toast(`${t('요청을 처리하지 못했습니다.')} ${error.message}`, true); }
}

function showFormError(id, error) {
  const element = $(id);
  element.textContent = language === 'ko' ? error.message : `${t('요청을 처리하지 못했습니다.')}\n${error.message}`;
  element.hidden = false;
}

function updateClock() {
  const now = new Date();
  $('#clock-time').textContent = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour12: false });
  $('#clock-date').textContent = `${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })} · KST`;
  $$('[data-elapsed-task]').forEach(item => { const task = state.tasks.find(value => value.id === item.dataset.elapsedTask); if (task && ACTIVE.has(task.status)) item.textContent = elapsed(task); });
}

function bindEvents() {
  $$('.nav-button[data-view]').forEach(button => button.addEventListener('click', () => updateView(button.dataset.view)));
  $('.brand').addEventListener('click', event => { event.preventDefault(); updateView('overview'); });
  for (const id of ['#settings-top', '#nav-settings']) $(id).addEventListener('click', openSettings);
  for (const id of ['#connections-button', '#subscription-info']) $(id).addEventListener('click', () => updateView('accounts'));
  $$('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close)?.close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } }));
  $$('.filter-tab').forEach(button => button.addEventListener('click', () => { currentFilter = button.dataset.filter; $$('.filter-tab').forEach(item => item.classList.toggle('active', item === button)); renderMissions(); }));
  $('#task-search').addEventListener('input', renderMissions);
  $('#dispatch-department').addEventListener('change', renderDepartments);
  $('#dispatch-prompt').addEventListener('input', () => { $('#prompt-count').textContent = `${num($('#dispatch-prompt').value.length)} / 12,000`; $('#dispatch-error').hidden = true; });
  $('#write-permission').addEventListener('change', () => { $('#permission-description').textContent = t($('#write-permission').checked ? '파일 수정이 가능한 작업으로 실행합니다.' : '기본: 읽기 및 분석만'); });
  $('#focus-dispatch').addEventListener('click', () => { $('#dispatch-section').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('#dispatch-prompt').focus({ preventScroll: true }); });
  $$('[data-prompt]').forEach(button => button.addEventListener('click', () => { $('#dispatch-prompt').value = t(button.dataset.prompt); $('#dispatch-prompt').dispatchEvent(new Event('input')); $('#dispatch-prompt').focus(); }));

  $('#dispatch-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (dispatchPending) return;
    const prompt = $('#dispatch-prompt').value.trim();
    if (!prompt) { toast(t('지시할 내용을 입력해주세요.'), true); $('#dispatch-prompt').focus(); return; }
    if (!connected) { toast(t('연결된 뒤 다시 시도해주세요.'), true); return; }
    const departmentId = $('#dispatch-department').value;
    const department = state.departments.find(dept => dept.id === departmentId);
    if (!department) { toast(t('담당 부서를 선택해주세요.'), true); return; }
    const choice = selectedConnection($('#dispatch-provider').value);
    const provider = choice.connectionId ? state.connections.find(c => c.id === choice.connectionId)?.providerId : choice.provider || department.provider;
    if (state.providers.find(item => item.id === provider)?.status !== 'ready') { toast(t('모델 연결을 먼저 확인해주세요.'), true); openSettings(); return; }
    dispatchPending = true;
    $('#dispatch-submit').disabled = true;
    $('#dispatch-submit').textContent = t('전송 중…');
    $('#dispatch-error').hidden = true;
    try {
      const result = await api('/api/tasks', { method: 'POST', body: { prompt, departmentId, workspace: state.settings.workspace, ...choice, priority: $('#dispatch-priority').value, permission: $('#write-permission').checked ? 'workspace-write' : 'read-only' } });
      if (result.task) { selectedTaskId = result.task.id; if (!state.tasks.some(task => task.id === result.task.id)) state.tasks.unshift(result.task); }
      $('#dispatch-prompt').value = '';
      render();
      toast(t('작업을 지시했습니다.'));
    } catch (error) { showFormError('#dispatch-error', error); if (error.status === 409) openSettings(); }
    finally { dispatchPending = false; $('#dispatch-submit').disabled = !connected; $('#dispatch-submit').replaceChildren(t('지시 보내기'), node('span', { 'aria-hidden': 'true' }, '↗')); }
  });

  $('#settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#save-settings'); button.disabled = true; button.textContent = t('저장 중…'); $('#settings-error').hidden = true;
    try {
      const body = {}, workspace = $('#settings-workspace').value.trim(), maxConcurrent = Number($('#settings-concurrency').value), localOnly = $('#settings-local-only').checked, identity = { name: $('#settings-name').value.trim(), title: $('#settings-title').value.trim() };
      if (workspace !== state.settings.workspace) body.workspace = workspace;
      if (maxConcurrent !== state.settings.maxConcurrent) body.maxConcurrent = maxConcurrent;
      if (localOnly !== state.settings.localOnly) body.localOnly = localOnly;
      if (JSON.stringify(identity) !== JSON.stringify(state.settings.identity)) body.identity = identity;
      await api('/api/settings', { method: 'POST', body });
      receiveState(await api('/api/state')); render(); toast(t('설정을 저장했습니다.')); $('#settings-dialog').close();
    }
    catch (error) { showFormError('#settings-error', error); }
    finally { button.disabled = false; button.textContent = t('설정 저장'); }
  });
  $('#department-form').addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#edit-department-id').value;
    const button = $('#department-form button[type=submit]'); button.disabled = true; $('#department-error').hidden = true;
    try {
      const result = await api(`/api/departments/${encodeURIComponent(id)}`, { method: 'PATCH', body: { workspace: $('#department-dialog').dataset.workspace, name: $('#edit-department-name').value.trim(), title: $('#edit-department-title').value.trim(), ...selectedConnection($('#edit-department-provider').value), role: $('#edit-department-role').value.trim() } });
      if (result.department) { const index = state.departments.findIndex(dept => dept.id === id); if (index >= 0) state.departments[index] = result.department; }
      render(); $('#department-dialog').close(); toast(t('부서 설정을 저장했습니다.'));
    } catch (error) { showFormError('#department-error', error); }
    finally { button.disabled = false; }
  });
  $('#refresh-providers').addEventListener('click', async () => {
    const button = $('#refresh-providers'); button.disabled = true; button.textContent = t('확인 중…');
    try { const result = await api('/api/providers/refresh', { method: 'POST', body: {} }); if (result.providers) state.providers = result.providers; renderProviders(); renderMetrics(); renderDepartments(); renderOrganization(); toast(t('상태를 새로고침했습니다.')); }
    catch (error) { toast(`${t('요청을 처리하지 못했습니다.')} ${error.message}`, true); }
    finally { button.disabled = false; button.textContent = t('↻ 상태 새로고침'); }
  });
  $('#demo-button').addEventListener('click', async () => {
    const button = $('#demo-button'); button.disabled = true;
    try { const result = await api('/api/demo', { method: 'POST', body: {} }); if (result.tasks?.length) { selectedTaskId = result.tasks[0].id; for (const task of result.tasks) if (!state.tasks.some(item => item.id === task.id)) state.tasks.unshift(task); } render(); $('#settings-dialog').close(); updateView('overview'); toast(t('샘플 작업을 시작했습니다. 실제 모델을 호출하지 않습니다.')); }
    catch (error) { toast(`${t('요청을 처리하지 못했습니다.')} ${error.message}`, true); }
    finally { button.disabled = false; }
  });
  $('#clear-demo-button').addEventListener('click', async () => {
    const button = $('#clear-demo-button'); button.disabled = true;
    try { await api('/api/demo', { method: 'DELETE' }); state.tasks = state.tasks.filter(task => !task.demo); if (!state.tasks.some(task => task.id === selectedTaskId)) selectedTaskId = null; render(); toast(t('데모 작업을 지웠습니다.')); }
    catch (error) { toast(`${t('요청을 처리하지 못했습니다.')} ${error.message}`, true); }
    finally { button.disabled = false; }
  });
  $('#feed-pause').addEventListener('click', () => {
    feedPaused = !feedPaused;
    $('.activity-panel').classList.toggle('feed-paused', feedPaused);
    $('#feed-pause').textContent = feedPaused ? '▷' : 'Ⅱ';
    $('#feed-pause').setAttribute('aria-label', t(feedPaused ? '활동 피드 재개' : '활동 피드 일시정지'));
    $('#feed-pause').title = t(feedPaused ? '활동 피드 재개' : '활동 피드 일시정지');
    $('#feed-mode').textContent = feedPaused ? 'PAUSED' : 'LIVE · AUTO SCROLL';
    if (!feedPaused) { lastFeedSignature = ''; renderFeed(); $('#activity-feed').scrollTop = $('#activity-feed').scrollHeight; }
  });
  $('#copy-output').addEventListener('click', () => { const task = inspectedTask(state.tasks.find(item => item.id === selectedTaskId)); if (task?.output && !task.detailsTruncated) copyText(task.output); });
  $('#export-button').addEventListener('click', () => $('#export-dialog').showModal());
  $('#export-json').addEventListener('click', async () => {
    try {
      const data = await api('/api/export');
      // Exporting records never embeds the per-process request token in a downloaded file.
      if (data.server) delete data.server.csrfToken;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = node('a', { href: url, download: `imperium-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast(t('기록을 내보냈습니다.'));
    } catch (error) { toast(`${t('요청을 처리하지 못했습니다.')} ${error.message}`, true); }
  });
  $('#export-excel').addEventListener('click', async () => {
    try {
      const response = await fetch('/api/export.xlsx');
      if (!response.ok) throw new Error(t('요청을 처리하지 못했습니다.'));
      const url = URL.createObjectURL(await response.blob());
      const link = node('a', { href: url, download: `imperium-${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('#export-dialog').close(); toast(t('기록을 내보냈습니다.'));
    } catch (error) { toast(error.message, true); }
  });
  window.addEventListener('imperium:terminal-command', () => updateView('terminal'));
  document.addEventListener('keydown', event => {
    const dialogOpen = $$('dialog').some(dialog => dialog.open);
    if (event.key === 'F8') { event.preventDefault(); if (!dialogOpen) openSettings(); return; }
    const shortcuts = { F1: 'overview', F2: 'operations', F3: 'departments', F4: 'logs', F5: 'accounts', F6: 'terminal', F7: 'updates', F9: 'projects', F10: 'analytics', F11: 'knowledge' };
    if (shortcuts[event.key]) { event.preventDefault(); if (!dialogOpen) updateView(shortcuts[event.key]); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !dialogOpen && document.activeElement === $('#dispatch-prompt')) { event.preventDefault(); $('#dispatch-form').requestSubmit(); return; }
    const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (event.key === '/' && !editing && !dialogOpen) { event.preventDefault(); if (view === 'departments' || view === 'logs') updateView('operations'); $('#task-search').focus(); }
  });
}

installControls();
bindEvents();
applyLanguage();
updateClock();
setInterval(updateClock, 1000);
connect();
