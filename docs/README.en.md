[한국어](../README.md) · [English](README.en.md) · [日本語](README.ja.md)

# IMPERIUM

**IMPERIUM**, Latin for command or authority, is a local operations terminal for building your own AI workspace. Add yourself, AI connections, roles, and memory to an empty canvas, then follow queues, execution status, tool events, and results from Codex, Claude Code, and other providers. A company organization chart is an optional layout; names and titles are yours to choose.

Version 1.4.0 is the **internal validation target**. The expanded scope moves development forward without a final external 1.2.0 release. No external release will be published until benchmarking and distribution checks are complete. Package names and update instructions below describe build targets, rather than downloads already available to the public.

The app runs a local web server, viewed in a desktop window or your browser. It tracks tasks launched here; it does not observe existing ChatGPT or Claude conversations or sessions running in other terminals.

## Run the desktop app

The Windows internal-validation installer is named **`Imperium-Setup-1.4.0-x64.exe`** and includes a guided setup wizard.

1. Run the installer and proceed through **Next → Install → Finish**. You can change the installation folder. The app installs for the current Windows user.
2. Open the app using the **IMPERIUM** shortcut on your desktop or in the Start menu.
3. To uninstall, select **IMPERIUM** in the apps list in Windows Settings.

For use without installation, choose the portable file `Imperium-1.4.0-win-x64.exe`. Both versions open their own window. Model connections still require the Codex or Claude Code installation and subscription login described below.

Developers with access to the private source repository can run **Build Imperium desktop** in Actions and obtain validation packages from a successful run's **Artifacts**: `imperium-windows-x64`, `imperium-macos-intel-apple-silicon`, or `imperium-linux-x64`. macOS DMG and ZIP packages are available after a successful build on a macOS runner. Apple Silicon packages are named `Imperium-1.4.0-mac-arm64.dmg` and `.zip`; Intel packages are named `Imperium-1.4.0-mac-x64.dmg` and `.zip`.

The author metadata names **Sato Junichiro**. This metadata alone does not establish a Windows-verified publisher. Builds remain unsigned developer packages until an actual Authenticode certificate is supplied and used for signing; Windows may show an unknown publisher. If Windows displays a security prompt, verify the source before allowing that specific app. If macOS blocks the app, authorize that individual app in System Settings under Privacy & Security. There is no need to disable system-wide security controls.

Desktop records are stored in `hq-data/` under the operating system's application-data location. A fresh installation starts in `Imperium Projects/Workspace` under your home directory, and new projects default to the home directory’s `Imperium Projects` folder. Previously saved workspace choices are preserved. **Projects (F9)** lets you create and select separate real work folders with a name and color.

## Install on Linux

Linux x64 build targets are `Imperium-1.4.0-linux-amd64.deb` for Debian and Ubuntu, and the directly executable `Imperium-1.4.0-linux-x86_64.AppImage`. If you have received a validation package, run the relevant commands from its folder.

To install on Debian or Ubuntu:

```sh
sudo apt install ./Imperium-1.4.0-linux-amd64.deb
```

After installation, launch **IMPERIUM** from your application menu. To use the AppImage:

```sh
chmod +x Imperium-1.4.0-linux-x86_64.AppImage
./Imperium-1.4.0-linux-x86_64.AppImage
```

The AppImage does not automatically create application-menu or desktop shortcuts. Linux also requires Codex or Claude Code installation and subscription login. A successful Linux CI build confirms package generation and automated checks, rather than manual testing in a Linux desktop session.

## Run web mode from source

Install [Node.js](https://nodejs.org/) 22 or later. This version has dependencies for its real terminal and Excel export, so install the app packages before starting:

```sh
npm ci
npm start
```

Open [http://127.0.0.1:4310](http://127.0.0.1:4310). On Windows, you can also run `start-headquarters.cmd`. Press `Ctrl+C` in the server terminal to stop it.

With the server running, open another terminal for the optional keyboard-operated ANSI view:

```sh
npm run terminal
```

Set the `HQ_PORT` environment variable to change the default port, 4310.

## Connect subscription accounts

Install the CLI tools you want to use and sign in with your subscription accounts. These tools are installed separately from the app's `npm ci` dependencies.

```sh
npm install -g @openai/codex
codex login
```

```sh
npm install -g @anthropic-ai/claude-code
claude auth login
```

Choose your ChatGPT account for Codex and your Claude subscription account for Claude Code. Refresh installation and login status in the app's connections view. If only one provider is ready, select that provider when dispatching work.

Selecting subscription sign-in in Codex or Claude Code uses that account's conditions and allowance without requiring a separate API key. See the official [OpenAI plan guide](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan) and [Claude plan guide](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan). A connection with a model ID uses that ID; an empty ID uses the CLI default. IMPERIUM does not force a model or reasoning effort based on the subscription name. Each service determines model access, extra usage charges, and credit conditions. Free usage or billing savings are not guaranteed.

**AI connections (F5)** supports registration for five providers: Codex, Claude Code, Gemini CLI, GitHub Copilot CLI, and Ollama. Each person signs in through the official CLI on their own computer and OS user account. Connections under the same OS user share that provider's CLI login. Adding several labels does not create independently authenticated accounts. This is a local application, not a centrally shared multi-tenant subscription service.

Model-list labels distinguish **Account discovery**, **CLI alias**, **Local model**, and **Manual entry**. Aliases and manually entered IDs are not evidence of account entitlement. When discovery is unavailable, check supported models in the official CLI and enter the ID. Detecting an installed Gemini CLI may not establish authentication; verify Google account sign-in in that CLI. Ollama uses local models installed on this computer.

## Select a model, reasoning effort, and speed

Version 1.4.0 lets you save execution model, reasoning effort, and response speed defaults for each role or agent. Override them for one task under **Model settings for this task** in **Operations (F2)**. **Load account models** retrieves models and supported options reported by Codex or Claude Code, including Claude aliases and their resolved model IDs. A manually entered ID does not establish access or support for every option.

| Setting | Behavior |
| --- | --- |
| Default model / effort | Leaves model selection or effort to the CLI and model rather than forcing an override. |
| Default speed | Inherits the CLI's existing speed preference, which may already enable Fast. |
| Standard | Explicitly turns Fast off for Codex and Claude and requests standard speed. |
| Fast | Requests faster processing on a supported model and account. It may consume more allowance or incur additional charges. |

Codex effort options follow the selected model's reported list; `max` and `ultra` appear where supported. Claude's `low`, `medium`, `high`, `xhigh`, and `max` also depend on model metadata. Copilot effort support depends on the model and CLI; only default speed is offered. Gemini and Ollama offer default reasoning and speed in this version. Unsupported selections return to default.

**Claude Fast consumes separate usage credits, even when included subscription allowance remains.** Select it only after checking your account or organization's access and extra usage terms. See the official [Claude Fast guide](https://code.claude.com/docs/en/fast-mode) and [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

Task details show **Requested execution settings**: the values saved and passed to the CLI. Actual model, effort, and speed may differ because of account access, organization policies, model support, or provider fallback. This label does not certify that Fast was applied or that a performance level was achieved. Overrides are scoped to task execution and do not rewrite global CLI settings.

## Account allowance

The **Account allowance** panel at the top shows reported usage and remaining percentages, reset times, source, and check time. Expand **Details** and choose **Refresh account data** to update it. Allowance belongs to the **provider account signed into the current OS user's CLI** and is shared across connections and projects; each model label does not have a separate balance.

- **Codex** shows windows reported by the official account interface and a credit balance when provided.
- **Claude Code** reads five-hour, weekly, and model-scoped limits through its official CLI usage interface. Usage events during tasks update the relevant windows. Extra usage amounts appear only when currency and units are known. This experimental interface can be unavailable on other CLI versions.
- **Copilot** shows quota, request counts, and remaining percentages exposed by its official CLI. If only used and allowed counts are supplied, the percentage is calculated from those counts.
- **Gemini** has no automatic remaining-quota reader in this version; the panel links to the official usage guide. Cloud subscription quotas do not apply to **Ollama** local models.

A remaining percentage is not converted into messages or money. Unreported balances and reset times stay unknown; task tokens are never used to estimate account balances. The normal cache lasts 60 seconds; manual refresh has a minimum ten-second cooldown. Values over two minutes old, or past their reported reset time, are marked as last reported values and need confirmation.

Model discovery and quota checks use official CLI metadata interfaces **without model inference or a user prompt**. Cloud account checks still require network access. Local-only mode stops cloud quota checks, cancels pending checks, and hides external usage links.

## Dispatch work

The first screen of a new workspace is an **empty canvas (F1)**. Use the **node library** to add yourself, AI connections, roles, and memory. Choose your own name and title; no Commander role is required. Each AI has a nameplate identifying its connection and role. Apply the **organization template** explicitly if you want a company layout. Existing projects restore their saved canvas.

1. Select a project in **Projects (F9)** or create a real folder with your preferred name, color, and parent folder. New projects start with an empty configuration.
2. Verify CLI installation and sign-in in **AI connections (F5)**, then add the AI and roles you need to the canvas. **Assign work** opens operations with that role selected; it does not call a model. **F2** opens operations directly.
3. Enter an instruction and select a ready provider or connection. Use **Model settings for this task** to override the role's model, reasoning effort, or speed when needed.
4. Choose read-only or file-write permission and a priority, then use **Dispatch command** to start actual work.
5. Follow live logs, results, and status; cancel tasks when needed. Export records as JSON or a genuine Excel workbook (`.xlsx`).

A role or department node is a task-assignment definition, rather than an always-running model process. Agent definitions, canvas layouts, and memory are separated by project. Registered model connections and CLI sign-in are shared across projects under the same OS user; switching projects does not create a separate subscription account. Complete or cancel queued and running tasks before switching projects.

Canvas execution and completion states follow actual task status. Public stages, percentages, and remaining times supplied by the AI are labeled **model estimates**, without a guarantee of completeness or an exact finish time. Times derived from previous tasks are **history-based estimates**. Only tasks confirmed complete are shown at 100%.

The queue runs one task per provider and up to two tasks overall. Tasks in the same department run sequentially. File-write tasks run without other tasks to reduce conflicts. The overall concurrency setting is either one or two.

**DEMO** tasks are labeled simulations and do not call a model. Use the demo controls to inspect streaming and state changes. Actual model calls occur when you dispatch real work.

## Nodes, memory, and workflows

- Drag nodes to move them. Drag the background or use the wheel to pan; use `Ctrl+wheel` to zoom, or choose **Fit view** and **Auto arrange**. Positions and connections are saved per project.
- **Add memory** selects an existing memory or creates one. Connect its output port to a department input to include it in task context. Inspect and edit its content, pinned state, and revision. **Remove from canvas** retains the underlying memory.
- Connect one role's output to another role's input to create a workflow handoff. Cycles are rejected. Select a connection to delete it.
- Connecting nodes does not execute work. Choose a department to write an assignment, or explicitly use **Run connected workflow** in its inspector. The default permission is read-only.

Memory consists of project-scoped local notes, decisions, constraints, and task results. **Knowledge (F11)** shows a graph of actual task results and pinned notes. Retrieval and automatic relationships use **project-scoped keyword RAG**; no model weights are trained. Automatically captured results are marked `unverified`. Review the original material, edit it when needed, and pin important notes. Agents cannot overwrite pinned or user-authored material. Pinning does not automatically establish factual accuracy.

Codex and Claude tasks receive read-only MCP tools—`memory_search`, `memory_get`, and `memory_list`—that can retrieve more memory during execution. Access is scoped to that task and project. The model can query as needed; this does not mean it always reads every memory or learns autonomously in the background.

## Projects and local-only mode

**Projects (F9)** creates an actual new folder. The default parent is `Imperium Projects` next to the current work folder; you can choose another existing parent folder. Existing folders are not overwritten or moved. Project names and colors are editable. Role definitions, node layouts, and memory retrieval stay within the selected project.

Enable **Local only** (`settings.localOnly`) to run only local models installed in Ollama on this computer. Cloud tasks and cloud model discovery are rejected with HTTP 403; desktop update checks and downloads are also stopped. Complete active and queued work before changing this setting. It applies to the app's model and updater paths; **it does not block external commands you run in the real terminal or networking at the operating-system level**.

## Usage and performance

**Analytics (F10)** uses retained real tasks from the current project to show token history and task graphs, p50/p95 first-output latency and execution duration, and the success rate among completed and failed tasks. DEMO tasks are excluded. Usage missing from CLI reports stays unreported, rather than becoming zero or an estimated charge.

Earlier/recent comparisons require **at least six** completed tasks with reported usage in the same provider, model ID, role, and permission group. They compare equal-sized chronological halves, with at least three tasks in each. This is an observed token change, not causal evidence of a memory benefit or billing savings. Unknown model IDs are excluded. Account allowance is shown separately from official reports as described above; task tokens are not converted into remaining allowance or money saved.

The **initial context character selection rate** compares the characters initially supplied with stored memory. It does not measure billed tokens across later MCP retrieval, the CLI's own context, or tokenization, so it is not a billing savings rate. See [architecture and validation principles](architecture.md) for the design rationale and measurement boundaries.

## Keyboard navigation and the real terminal

| Key | View or action |
| --- | --- |
| F1 / F2 / F3 / F4 | Node workspace / operations / departments / activity |
| F5 / F6 / F7 / F8 | AI connections and setup guide / terminal / updates / general settings |
| F9 / F10 / F11 | Projects / analytics / knowledge |
| Ctrl+Enter | Dispatch from the task composer |
| / | Search operations |

Use the **setup guide in F5** for installation → official account sign-in → actual status verification → an explicitly selected sample operation. **Prepare in terminal** only stages an installation or login command. In **F6**, choose **New session** to open a real shell, select **Insert into terminal (no Enter)**, and press `Enter` in the shell yourself to execute. `Tab` and arrow keys are sent to the active shell; `Ctrl+C` requests interruption according to the running program. Pressing `Enter` in the command-draft field does not execute it.

IMPERIUM keeps raw terminal input/output only in a bounded per-session RAM buffer. It is omitted from task history, memory, JSON, and Excel. **Close session** discards that buffer. History, files, and logs independently written by the shell or programs you run are separate.

## Excel export

The `.xlsx` workbook contains seven sheets: **Summary, Tasks, Task Output, Departments, Events, Memory, Connections**. Sheet names and headers follow the Korean, English, or Japanese interface language. It includes original task instructions and results. Long output is split into numbered parts of at most 32,000 UTF-16 code units, preserving the full text. Usage includes only CLI-reported values. Authentication tokens, API keys, terminal output, and raw server state are omitted. User content is stored in literal string cells, not formulas.

## Language and permissions

The language selector switches interface labels and explanations between 한국어, English, and 日本語. Your choice is saved in app settings and that browser. Model responses follow the task prompt and the server's default Korean instruction; explicitly request another response language in your prompt. User-entered department names and roles are not automatically translated.

| Permission | Codex | Claude Code |
| --- | --- | --- |
| Read-only | CLI `read-only` sandbox | `Read`, `Glob`, `Grep` |
| File-write | CLI `workspace-write` sandbox | The above plus `Edit`, `Write` |

Claude's tool set excludes `Bash`, so Claude tasks cannot run shell commands or tests in this version. Codex retains its CLI sandbox and approval restrictions. Select the working folder in the connections/settings view.

Gemini CLI, GitHub Copilot CLI, and Ollama support **read-only tasks only** in this build. Selecting file-write permission does not grant these providers write access. The real terminal is a separate shell operated directly by the user.

## Storage and current scope

- In web mode, tasks, results, events, settings, memory, and project node layouts persist in the Git-ignored `.hq/` directory. Desktop mode uses the application-data location above. Up to 200 task records are retained.
- After a server restart, running and queued tasks are marked interrupted. They are not automatically resumed.
- Task token counts come from CLI reports. Account allowance shows only windows and balances exposed by the official CLI; separate per-model balances and remaining message counts are not estimated.
- Existing-chat synchronization, observation of other sessions, and automatic background model runs are outside the current scope.
- This folder is a standalone app. Placing it inside another project does not make it manage the parent repository or its code. Work in your explicitly selected working folder is separate.

Pretendard, Pretendard JP, and JetBrains Mono are bundled in `public/fonts/` and work without an external font CDN. See [third-party notices](../THIRD_PARTY_NOTICES.md) for their SIL Open Font License 1.1 license texts and sources.

## Updates and release status

Source is maintained privately in `Furu002/imperium-terminal`. The public distribution repository [Furu002/imperium-releases](https://github.com/Furu002/imperium-releases) is currently empty; no external release is published before benchmarking is complete. Version 1.4.0 is the internal validation target. **Updates (F7)** requires a packaged app, a configured public channel, and an actually published release. Local-only mode stops update network requests. Download and installation require explicit user action.

Windows installed builds use the NSIS update path. Linux AppImage builds use the AppImage update path; DEB users download and install the next package manually. macOS may require manual updates while signing certificates are unavailable. File-hash verification is not a code signature, and the **Sato Junichiro** author metadata is not certificate signing. Instructions do not require disabling a firewall or system-wide OS security settings.

## Desktop development and builds

```sh
npm install
npm run desktop
```

On Windows, `npm run build:win` generates both the setup wizard and the portable app. Run `npm run build:installer` to generate only the installer. For macOS DMG and ZIP packages, run `npm run build:mac` on a Mac or use the GitHub Actions macOS build. For Linux DEB and AppImage packages, run `npm run build:linux` on Linux or use the GitHub Actions Ubuntu build. Build output is written to `dist/`. Check the workflow result to confirm whether each platform build succeeded.

## Validate

```sh
npm ci --ignore-scripts
npm test
npm run check
```

Tests use mock CLIs and do not call real models. When this app folder is published as the repository root, the included GitHub Actions workflow runs both commands on Ubuntu and Windows with Node.js 22 and 24.
