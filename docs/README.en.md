[한국어](../README.md) · [English](README.en.md) · [日本語](README.ja.md)

# IMPERIUM

**IMPERIUM**, Latin for command or authority, is a local AI operations terminal where you act as headquarters and dispatch departmental tasks to Codex and Claude Code. Its Bloomberg-inspired interface shows queues, execution status, tool events, and results.

Version 1 runs a local web server, viewed in a desktop window or your browser. It tracks tasks launched here; it does not observe existing ChatGPT or Claude conversations or sessions running in other terminals.

## Run the desktop app

For Windows, the recommended download is **`Imperium-Setup-1.0.0-x64.exe`**, which includes a guided setup wizard.

1. Run the installer and proceed through **Next → Install → Finish**. You can change the installation folder. The app installs for the current Windows user.
2. Open the app using the **IMPERIUM** shortcut on your desktop or in the Start menu.
3. To uninstall, select **IMPERIUM** in the apps list in Windows Settings.

For use without installation, choose the portable file `Imperium-1.0.0-win-x64.exe`. Both versions open their own window. Model connections still require the Codex or Claude Code installation and subscription login described below.

Once this app is hosted on GitHub, run **Build Imperium desktop** in Actions and download the appropriate package from the successful run's **Artifacts**: `imperium-windows-x64` or `imperium-macos-intel-apple-silicon`. macOS DMG and ZIP packages are available after a successful build on a macOS runner.

The author metadata names **Sato Junichiro**. This metadata alone does not establish a Windows-verified publisher. Builds remain unsigned developer packages until an actual Authenticode certificate is supplied and used for signing; Windows may show an unknown publisher. If Windows displays a security prompt, verify the source before allowing that specific app. If macOS blocks the app, authorize that individual app in System Settings under Privacy & Security. There is no need to disable system-wide security controls.

Desktop records are stored in `hq-data/` under the operating system's application-data location. The default working folder is `Imperium Workspace` in Documents, and can be changed in settings.

## Run web mode from source

Install [Node.js](https://nodejs.org/) 22 or later and run this command from the app folder. The web server uses only Node.js built-ins, so this mode does not require `npm install`. Electron development and packaging require a separate `npm install`.

```sh
npm start
```

Open [http://127.0.0.1:4310](http://127.0.0.1:4310). On Windows, you can also run `start-headquarters.cmd`. Press `Ctrl+C` in the server terminal to stop it.

With the server running, open another terminal for the optional keyboard-operated ANSI view:

```sh
npm run terminal
```

Set the `HQ_PORT` environment variable to change the default port, 4310.

## Connect subscription accounts

Install the CLI tools you want to use and sign in with your subscription accounts. These are separate tool installations; the app itself requires no dependency installation.

```sh
npm install -g @openai/codex
codex login
```

```sh
npm install -g @anthropic-ai/claude-code
claude auth login
```

Choose your ChatGPT account for Codex and your Claude subscription account for Claude Code. Refresh installation and login status in the app's connections view. If only one provider is ready, select that provider when dispatching work.

This connection method requires no separate API key and draws from your subscription allowance. See the official [OpenAI plan guide](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan) and [Claude plan guide](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan) for current limits and eligibility. Each CLI's configured default model is used. The app does not force a particular model or reasoning effort based on the subscription name.

## Dispatch work

1. Select Strategy, Engineering, Research, or Quality. Department names, roles, and default providers are editable.
2. Enter an instruction and select Codex or Claude. Each task can override its department's default provider.
3. Choose read-only or file-write permission and a priority, then dispatch.
4. Follow live logs, results, and status; cancel tasks when needed. Export records as JSON.

The queue runs one task per provider and up to two tasks overall. Tasks in the same department run sequentially. File-write tasks run without other tasks to reduce conflicts. The overall concurrency setting is either one or two.

**DEMO** tasks are labeled simulations and do not call a model. Use the demo controls to inspect streaming and state changes. Actual model calls occur when you dispatch real work.

## Language and permissions

The language selector switches interface labels and explanations between 한국어, English, and 日本語. Your choice is saved in that browser. Model responses follow the task prompt and the server's default Korean instruction; explicitly request another response language in your prompt. User-entered department names and roles are not automatically translated.

| Permission | Codex | Claude Code v1 |
| --- | --- | --- |
| Read-only | CLI `read-only` sandbox | `Read`, `Glob`, `Grep` |
| File-write | CLI `workspace-write` sandbox | The above plus `Edit`, `Write` |

Claude's tool set excludes `Bash`, so Claude tasks cannot run shell commands or tests in this version. Codex retains its CLI sandbox and approval restrictions. Select the working folder in the connections/settings view.

## Storage and current scope

- In web mode, tasks, results, events, and settings persist in the Git-ignored `.hq/` directory. Desktop mode uses the application-data location above. Up to 200 task records are retained.
- After a server restart, running and queued tasks are marked interrupted. They are not automatically resumed.
- Task token counts come from CLI reports. Account-wide remaining allowance and an exact subscription usage percentage are unavailable.
- Existing-chat synchronization, observation of other sessions, and automatic background model runs are outside the current scope.
- This folder is a standalone app. Placing it inside another project does not make it manage the parent repository or its code. Work in your explicitly selected working folder is separate.

## Desktop development and builds

```sh
npm install
npm run desktop
```

On Windows, `npm run build:win` generates both the setup wizard and the portable app. Run `npm run build:installer` to generate only the installer. For macOS DMG and ZIP packages, run `npm run build:mac` on a Mac or use the GitHub Actions macOS build. Build output is written to `dist/`. Check the workflow result to confirm whether each platform build succeeded.

## Validate

```sh
npm test
npm run check
```

Tests use mock CLIs and do not call real models. When this app folder is published as the repository root, the included GitHub Actions workflow runs both commands on Ubuntu and Windows with Node.js 22 and 24.
