[한국어](../README.md) · [English](README.en.md) · [日本語](README.ja.md)

# IMPERIUM

ラテン語で指揮権・統率権を意味する**IMPERIUM**は、ユーザーが本部長となり、CodexとClaude Codeに部署ごとの業務を指示するローカルAI運用ターミナルです。ブルームバーグ端末をイメージした画面で、待機列、実行状況、ツールのイベント、結果を確認できます。

v1.1はローカルWebサーバーをデスクトップのウィンドウまたはブラウザーで利用するアプリです。このアプリから開始したタスクを追跡します。既存のChatGPT・Claudeの会話や、別のターミナルで動くセッションを監視する機能はありません。

## デスクトップ版の起動

Windowsでは、セットアップウィザード付きの**`Imperium-Setup-1.1.0-x64.exe`**を推奨します。

1. インストーラーを実行し、**次へ（Next）→ インストール（Install）→ 完了（Finish）**の順に進みます。インストール先を変更でき、現在のWindowsユーザー用にインストールされます。
2. デスクトップまたはスタートメニューの**IMPERIUM**ショートカットからアプリを開きます。
3. アンインストールする場合は、Windowsの設定のアプリ一覧から**IMPERIUM**を選択します。

インストールせずに使用する場合は、ポータブル版の`Imperium-1.1.0-win-x64.exe`を選択してください。どちらも専用ウィンドウで開きます。モデルとの接続には、以下のCodex・Claude Codeのインストールとサブスクリプションでのログインが必要です。

このアプリをGitHubに公開した場合、Actionsの**Build Imperium desktop**を実行し、成功した実行の**Artifacts**からOSに合ったファイルを取得します。Windowsは`imperium-windows-x64`、macOSは`imperium-macos-intel-apple-silicon`、Linuxは`imperium-linux-x64`です。macOS用のDMG・ZIPは、macOSランナーでのビルド成功後に取得できます。Apple Silicon版のファイル名は`Imperium-1.1.0-mac-arm64.dmg`・`.zip`、Intel版は`Imperium-1.1.0-mac-x64.dmg`・`.zip`です。

作成者メタデータの名前は**Sato Junichiro**です。このメタデータだけでは、Windowsに確認された発行元にはなりません。実際のAuthenticode証明書を提供して署名するまでは未署名の開発用ビルドであり、Windowsで不明な発行元と表示される場合があります。Windowsでセキュリティ通知が出た場合は、配布元を確認したうえで、そのアプリのみ実行を許可してください。macOSでブロックされた場合は、システム設定の「プライバシーとセキュリティ」で、そのアプリのみ開くことを許可できます。OS全体のセキュリティ機能を無効にする必要はありません。

デスクトップ版の記録は、OSのアプリデータ保存先の`hq-data/`に保存されます。既定の作業フォルダーは書類フォルダー内の`Imperium Workspace`で、設定から変更できます。

## Linuxへのインストール

Linux x64向けに、Debian・Ubuntu用の`Imperium-1.1.0-linux-x64.deb`と、直接実行する`Imperium-1.1.0-linux-x64.AppImage`を用意しています。ダウンロードしたファイルがあるフォルダーで、必要なコマンドを実行してください。

Debian・Ubuntuにインストールする場合：

```sh
sudo apt install ./Imperium-1.1.0-linux-x64.deb
```

インストール後は、アプリメニューの**IMPERIUM**から起動できます。AppImageを使用する場合：

```sh
chmod +x Imperium-1.1.0-linux-x64.AppImage
./Imperium-1.1.0-linux-x64.AppImage
```

AppImageは、アプリメニューやデスクトップのショートカットを自動作成しません。LinuxでもCodex・Claude Codeのインストールとサブスクリプションでのログインが必要です。LinuxのCIビルド成功はパッケージの生成と自動検査を意味し、Linuxデスクトップでの手動実行テストを意味するものではありません。

## ソースからWebモードを起動

[Node.js](https://nodejs.org/) 22以上を用意し、アプリのフォルダーで実行してください。WebサーバーはNode.jsの標準ライブラリーだけを使用するため、この実行に`npm install`は不要です。Electronの開発・パッケージ化には別途`npm install`が必要です。

```sh
npm start
```

[http://127.0.0.1:4310](http://127.0.0.1:4310)を開きます。Windowsでは`start-headquarters.cmd`からも起動できます。終了するには、サーバーのターミナルで`Ctrl+C`を押します。

サーバーを起動したまま別のターミナルで以下を実行すると、キーボードで操作するANSIターミナル表示も利用できます。

```sh
npm run terminal
```

環境変数`HQ_PORT`で、既定のポート4310を変更できます。

## サブスクリプションの接続

利用するCLIをインストールし、契約中のアカウントでログインします。以下は個別ツールのインストールであり、アプリ本体の依存関係のインストールではありません。

```sh
npm install -g @openai/codex
codex login
```

```sh
npm install -g @anthropic-ai/claude-code
claude auth login
```

CodexではChatGPTアカウント、Claude CodeではClaudeのサブスクリプションアカウントを選択します。アプリの接続画面からインストール・ログイン状況を更新できます。片方だけ準備できている場合は、タスクの指示時にそのモデルを選択してください。

この接続方法に個別のAPIキーは不要で、サブスクリプションの利用枠を使用します。利用上限と適用条件は[OpenAIの公式案内](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)と[Claudeの公式案内](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan)を確認してください。モデルは各CLIに設定された既定値を使用します。契約プランの名前に合わせて、特定のモデルや推論強度を強制する機能はありません。

## 業務の指示

最初の画面は**AI組織図（F1）**です。本部長の下にChatGPT/CodexとClaudeを配置し、各モデルの下で部署の役割、接続状況、現在のタスクを確認できます。状態表示は実際の接続とタスク記録に基づきます。

1. 組織図で戦略企画・開発・リサーチ・品質管理の**業務を指示**を押すと、その部署を選択したタスク管理画面に移動します。この操作だけでモデルが実行されることはありません。**F2**でタスク管理画面を直接開くこともできます。部署名、役割、既定のモデルは編集できます。
2. 指示を入力し、CodexまたはClaudeを選択します。タスクごとに部署の既定モデルを変更できます。
3. 読み取り専用またはファイル変更の権限と優先度を選び、指示を送信します。
4. リアルタイムのログ、結果、状況を確認し、必要ならタスクを取り消します。記録はJSONで書き出せます。

モデルごとに同時実行は1件、全体では最大2件です。同じ部署のタスクも順番に実行します。ファイル変更タスクは競合を減らすため、他のタスクと重ならないように実行します。全体の同時実行数は1または2に設定できます。

**DEMO**はモデルを呼び出さない、明示的に表示されたシミュレーションです。デモの実行・削除からストリーミングと状態変化を確認できます。実際のモデルは、ユーザーが実タスクを指示した場合に呼び出されます。

## 言語と権限

言語選択から、画面の表示文言と説明を한국어・English・日本語に切り替えられます。選択はそのブラウザーに保存されます。モデルの回答は指示内容とサーバーの既定の韓国語指示に従うため、日本語などでの回答を希望する場合はプロンプトに明記してください。ユーザーが入力した部署名や役割も自動翻訳されません。

| 権限 | Codex | Claude Code v1 |
| --- | --- | --- |
| 読み取り専用 | CLIの`read-only`サンドボックス | `Read`、`Glob`、`Grep` |
| ファイル変更 | CLIの`workspace-write`サンドボックス | 上記に加え`Edit`、`Write` |

Claudeでは`Bash`を許可しないため、現在のバージョンではシェルコマンドやテストを実行できません。CodexもCLIのサンドボックスと承認の制限を維持します。作業フォルダーは接続・設定画面から指定します。

## 保存と現在の範囲

- Webモードのタスク、結果、イベント、設定はGitの対象外となる`.hq/`に保存されます。デスクトップ版は上記のアプリデータ保存先を使用します。タスク履歴は最大200件です。
- サーバーを再起動すると、実行中・待機中のタスクは中断状態になります。自動再開はしません。
- タスクでCLIが報告した入力・出力トークン数を表示します。アカウント全体の残り利用枠や、正確なサブスクリプション使用率は取得しません。
- 既存会話の同期、他セッションの監視、バックグラウンドでの自動モデル実行は現在の対象外です。
- このフォルダーは独立したアプリです。他プロジェクトの中に置いても、親のGitリポジトリーやコードを管理しません。明示的に選択した作業フォルダーでの処理は別です。

Pretendard・Pretendard JP・JetBrains Monoは`public/fonts/`に同梱され、外部のフォントCDNなしで利用できます。SIL Open Font License 1.1のライセンス文と出典は[サードパーティーの表記](../THIRD_PARTY_NOTICES.md)を参照してください。

## デスクトップ版の開発・ビルド

```sh
npm install
npm run desktop
```

Windowsで`npm run build:win`を実行すると、セットアップウィザードとポータブル版の両方を生成します。インストーラーだけを生成する場合は`npm run build:installer`を実行してください。macOSのDMG・ZIPは、Macで`npm run build:mac`を実行するか、GitHub ActionsのmacOSビルドを使用してください。LinuxのDEB・AppImageは、Linuxで`npm run build:linux`を実行するか、GitHub ActionsのUbuntuビルドを使用してください。成果物は`dist/`に生成されます。各プラットフォームのビルド成功状況はワークフローの実行結果で確認できます。

## 検証

```sh
npm ci --ignore-scripts
npm test
npm run check
```

テストはモックCLIを使い、実モデルを呼び出しません。このアプリのフォルダーをリポジトリーのルートとして公開した場合、付属のGitHub ActionsはUbuntu・Windows、Node.js 22・24で両コマンドを実行します。
