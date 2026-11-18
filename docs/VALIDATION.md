# IMPERIUM 1.3.2 — internal validation

This is an internal prototype. Publishing this source commit does not publish an external application release.

## Implementation and review

Claude Code implemented the interactive terminal, desktop updater, and project workspace modules. Separate Claude Code reviews inspected the integration and subsequent fixes. Reproduced findings led to project-switch isolation, stale-request guards, deduplicated Claude usage, bounded Copilot arguments, and smaller UI snapshots. Regression tests cover these changes. Estimates of progress are explicitly model estimates; only a successful worker exit marks actual completion.

The local automated suite passed **252 tests** with mock providers and temporary workspaces. JavaScript syntax checks passed. Tests cover local-only execution restrictions, project memory and agent isolation, persisted graph editing, XLSX round trips, scoped task details, cancellation, updater state, and UI response ordering. No mock usage is presented as real usage in the product.

Separate live checks previously confirmed subscription login for Codex and Claude, one task-scoped memory MCP lookup by each provider, and a real PowerShell PTY under Electron. Packaged installer and platform build results are checked separately from source tests.

## Synthetic serialization workload

The fixture contains 200 completed tasks, each with 150,000 output characters and 20 short logs. Five repetitions were measured in one Node process on the development machine.

| Measure | Full state | UI snapshot |
| --- | ---: | ---: |
| Serialized bytes | 30,535,077 | 445,092 |
| Median serialization time | 104.7 ms | 3.6 ms |

This measures a synthetic UI transport workload. It is not a model-quality, end-to-end latency, subscription-credit, or billing-savings benchmark. Full results remain available through scoped detail requests and exports.

## Operational limits

- Exact subscription allowance and monetary savings are not exposed by the CLI integrations. Charts use retained, reported token values and observed durations.
- Knowledge is a project-scoped local retrieval graph. Model weights are not trained by the application; automatically captured conclusions stay unverified until reviewed.
- Local-only mode restricts the application's model execution and updater. Explicit terminal commands and operating-system networking remain under the user's control.
- The Windows publisher is metadata naming **Sato Junichiro**. Builds have no code-signing certificate. macOS automatic installation remains unavailable until signed; the download route is provided instead.
- External distribution remains withheld pending internal benchmarking and a publication decision.

Desktop verification found a Windows OneDrive folder-creation stall reproduced outside the app. New desktop workspaces and default project creation now use the local home/Imperium Projects folder; existing saved workspace choices are preserved. UI requests have a 30-second deadline with explicit uncertainty about server completion. Shutdown releases its listener even when persistence fails, and unfinished requests are closed after 1.5 seconds. Hosted Windows test fixtures canonicalize temporary paths before use and close every restarted server before deleting shared test data.

The legacy Settings connection cards now open AI Accounts for every unavailable provider, using its single provider-specific setup tutorial rather than maintaining a duplicate installation-command fallback. No installer or login command is executed by opening this guide.
