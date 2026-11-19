# IMPERIUM 1.8.1 — internal validation

This is an internal prototype. Publishing this source commit does not publish an external application release.

The 1.8.1 output reader keeps a stable inline host and moves the same reader DOM between its panel and a nonmodal app-internal window. Window bounds, drag completion, Escape ordering, unrelated modal focus, multi-window focus, live response updates, source copying, selection, and owner cleanup are covered by regression tests. Hidden Electron rendering additionally checks real resize observation, full-viewport geometry and restore, background input, selected paragraph preservation during SSE, scroll preservation and narrow layouts. These are application UI checks with fixture output, without model calls.

The 1.8 integration adds a role-based first screen, five primary navigation items, folded legacy tools, bundled Korean typography, and project-scoped local skill registration/equipment. Claude reviewed the actual integration. Cancellation while awaiting skill files now finalizes the owned run and releases scheduling locks; deleted-agent skill bindings are pruned. Regression tests use temporary files and controlled providers to verify both fixes, pinned skill instructions in runner input, metadata-only UI snapshots, unchanged permissions, source-file preservation, and project switching guards. Hidden Electron rendering checks cover organization at 390, 768, 1024 and 1440 pixels and navigation to Skills, Work, Workflow and Memory. These checks do not constitute a live multi-agent development benchmark.

## Implementation and review

Claude Code implemented the interactive terminal, desktop updater, and project workspace modules. Separate Claude Code reviews inspected the integration and subsequent fixes. Reproduced findings led to project-switch isolation, stale-request guards, deduplicated Claude usage, bounded Copilot arguments, and smaller UI snapshots. Regression tests cover these changes. Estimates of progress are explicitly model estimates; only a successful worker exit marks actual completion.

Automated tests use mock providers and temporary workspaces. Coverage includes local-only execution restrictions, project memory and agent isolation, persisted graph editing, XLSX round trips, scoped task details, cancellation, updater state, UI response ordering, account quota readers, and model execution settings. JavaScript syntax checks are included in `npm run check`. Current pass/fail totals belong to the corresponding test output and CI run; this document does not pin a changing test count. No mock usage is presented as real usage in the product.

Separate live checks previously confirmed subscription login for Codex and Claude, one task-scoped memory MCP lookup by each provider, and a real PowerShell PTY under Electron. Packaged installer and platform build results are checked separately from source tests.

## Dense terminal and linked knowledge workspace

The user-selected Bloomberg tutorial was inspected directly in the browser. The application now uses black panels, compact tables and forms, amber labels, green function keys, a function command line, and workspace tabs. Navigation and prepared commands are separate from model or shell execution. Terminal command tests cover navigation, task preparation, unknown commands, keyboard history, localization, and real task counts without executing a model or a shell.

Project knowledge uses an Obsidian-inspired explorer, graph, and note editor. Wikilinks are resolved by an exact normalized title inside one project; absent and ambiguous titles remain unresolved. Derived relationships are bounded and never written as fabricated notes. Search can add at most two explicitly linked one-hop neighbors of a genuine keyword match while preserving the existing context budget and pinned-constraint priority. The app does not train neural weights or synchronize an Obsidian vault.

Claude's knowledge review reproduced an unrecoverable revision-conflict flow. The final UI preserves drafts while loading the latest record, displays its actual title, content, classification and pin state, and provides explicit discard or rebase actions without writing to the server. Deleted or archived notes retain reachable, copyable recovery drafts; creating a replacement requires an explicit create action. A follow-up read failure never labels cached text as current. Regression coverage also prevents duplicate saves during conflict refresh and handles same-revision 409 responses without trapping the editor. Integrated tests verify the existing F-key handlers and first-use FIND query after delayed loading.

## Account allowance and execution settings

The final integration review also reproduced deleted-connection draft restoration across projects and guarded new-agent creation with its captured workspace. The XLSX regression revealed JSZip 3.10's UTF-16 chunk boundary issue when new headers shifted a long emoji-containing shared string. This workbook alone pre-encodes its shared-string XML as UTF-8 bytes before compression; dependency files and global prototypes are untouched. A 200,000-character Unicode export round-trips exactly, including formula-like literal content.

Account allowance is scoped to the provider login under the current OS user, shared across projects and model connections. Codex uses its official account rate-limit interface; Claude uses the official CLI's experimental `get_usage` control and passive task usage events; Copilot uses its official CLI account-quota protocol. Only returned windows, balances, request counts, and verified monetary units are displayed. Gemini has an official quota-guide link without an automatic balance reader. Ollama local models have no cloud subscription balance.

Quota checks and Codex/Claude model discovery send metadata/control requests only, with no user prompt, model turn, or inference request. These checks still use cloud networking. Read-only live checks against installed Codex 0.160.1 and Claude Code 2.1.327 confirmed model capability metadata and account-limit retrieval without generating model output. No private account balance, utilization, or identity is included in this document. Claude initialization returns model metadata without a second control request; unsupported versions fail safely without a fallback model prompt.

Regression coverage verifies aborts during executable lookup and active reads, cancellation of owned subprocesses, bounded protocol output, credential-free results, cache cooldowns, and local-only cancellation. A partial Claude event replaces its matching five-hour window while retaining weekly and model-scoped windows, plan and extra-usage metadata, the full report's check time, and its original cache deadline. A newer event survives an older pending read or error. Copilot percentages can be derived from reported used and allowed counts when no percentage is supplied; zero limits do not create invented percentages.

Roles and agents persist model, reasoning, and speed defaults; individual tasks can override them. Model-specific metadata constrains supported reasoning levels and Fast options. Codex supports its advertised levels, including `max` or `ultra` where returned; Claude levels depend on its model and account metadata. Copilot exposes its supported reasoning flag with default speed only; Gemini and Ollama retain default reasoning and speed. Settings remain scoped to each invocation rather than rewriting global CLI configuration.

Default speed inherits the CLI's preference and can therefore inherit Fast. Standard explicitly disables Fast for Codex and Claude; Fast requests faster routing where the account and model permit it. Read-only Codex configuration probes accepted both `service_tier="fast"` and the explicit-standard sentinel `service_tier="default"`. Claude uses its documented per-invocation `fastMode` setting. **Claude Fast consumes separate usage credits even when included subscription allowance remains.** Task details label saved values as requested execution settings: provider policy, model support, and fallback can change what is actually applied. These labels are not measurements of reasoning depth, service tier, or achieved speed.

Official references: [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [Claude model configuration](https://code.claude.com/docs/en/model-config), [Claude Fast mode](https://code.claude.com/docs/en/fast-mode), and [Copilot CLI reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference). Account interfaces may change and require revalidation with newer CLI versions.

## Synthetic serialization workload

The fixture contains 200 completed tasks, each with 150,000 output characters and 20 short logs. Five repetitions were measured in one Node process on the development machine.

| Measure | Full state | UI snapshot |
| --- | ---: | ---: |
| Serialized bytes | 30,535,077 | 445,092 |
| Median serialization time | 104.7 ms | 3.6 ms |

This measures a synthetic UI transport workload. It is not a model-quality, end-to-end latency, subscription-credit, or billing-savings benchmark. Full results remain available through scoped detail requests and exports.

## Operational limits

- Account allowance is a timestamped provider report rather than a guaranteed live balance or remaining message count. Missing fields stay unavailable. Cached values older than two minutes or past a reported reset need confirmation; token charts and observed durations do not establish monetary savings.
- Knowledge is a project-scoped local retrieval graph. Model weights are not trained by the application; automatically captured conclusions stay unverified until reviewed.
- Local-only mode restricts the application's model execution, cloud model discovery, quota readers, external usage links, and updater. Explicit terminal commands and operating-system networking remain under the user's control.
- The Windows publisher is metadata naming **Sato Junichiro**. Builds have no code-signing certificate. macOS automatic installation remains unavailable until signed; the download route is provided instead.
- External distribution remains withheld pending internal benchmarking and a publication decision.

Desktop verification found a Windows OneDrive folder-creation stall reproduced outside the app. New desktop workspaces and default project creation now use the local home/Imperium Projects folder; existing saved workspace choices are preserved. UI requests have a 30-second deadline with explicit uncertainty about server completion. Shutdown releases its listener even when persistence fails, and unfinished requests are closed after 1.5 seconds. Hosted Windows test fixtures canonicalize temporary paths before use and close every restarted server before deleting shared test data.

The legacy Settings connection cards now open AI Accounts for every unavailable provider, using its single provider-specific setup tutorial rather than maintaining a duplicate installation-command fallback. No installer or login command is executed by opening this guide.
