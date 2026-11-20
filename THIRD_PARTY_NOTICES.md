# Third-party notices

IMPERIUM bundles these fonts locally. The application does not contact a font CDN.
Original font files and license texts are included in `public/fonts/`.

## Pretendard and Pretendard JP

- Project: https://github.com/orioncactus/pretendard
- Revision: `7aeb0698819be2b4097dae8ec8fe6a795e5cf3ae`
- License: SIL Open Font License 1.1; see `public/fonts/Pretendard-LICENSE.txt`.
- Files: `pretendard-variable.woff2`, `pretendard-jp-variable.woff2`.

## JetBrains Mono

- Project: https://github.com/JetBrains/JetBrainsMono
- Revision: `19371302b95d218af43299bce79ddbddd0bc364d`
- License: SIL Open Font License 1.1; see `public/fonts/JetBrainsMono-OFL.txt`.
- File: `jetbrains-mono-variable.woff2`.

## IBM Plex Mono Variable

- Project: https://github.com/IBM/plex
- Source: `@ibm/plex-mono-variable@1.0.0`, revision `bf260093582f04622aacc1e9f9ca604d7ccd0c42`.
- License: SIL Open Font License 1.1. The upstream WOFF2 notice is in `public/fonts/IBM-Plex-Mono-OFL.txt`.
- File: `ibm-plex-mono-variable.woff2` is the unmodified Roman variable face from `fonts/complete/woff2/IBM Plex Mono Var-Roman.woff2`.

The terminal checks system fonts for Bloomberg Fixed Unicode before falling back to the bundled IBM Plex Mono face.

Font filenames are normalized for local serving. Font data has not been modified.

## Runtime libraries

The desktop app also includes node-pty (the `@lydell/node-pty` distribution), xterm.js, the xterm fit addon, ExcelJS, and electron-updater with their dependencies. Their original license notices are retained in the packaged `node_modules` files. These libraries are used for the interactive shell, local terminal rendering, XLSX export, and desktop updates respectively.

## Cytoscape.js 3.35.0

- Project: https://github.com/cytoscape/cytoscape.js
- License: MIT; original notice is included at `public/licenses/cytoscape-LICENSE.txt`.
- Unmodified browser distribution: `node_modules/cytoscape/dist/cytoscape.min.js`.
- Used for the interactive project-memory graph, including pan, zoom, selection, and layout.

## Chart.js 4.6.1

- Project: https://github.com/chartjs/Chart.js
- License: MIT; original notice is included at `public/licenses/chartjs-LICENSE.txt`.
- Unmodified browser distribution: `node_modules/chart.js/dist/chart.umd.js`.
- Used for measured usage, task performance, memory retrieval, and task-status charts.

Both graph libraries are pinned production dependencies, served from the installed app through its local server. No CDN, telemetry service, or external chart-rendering API is used. Chart input remains local task and memory metadata; unavailable measurements are not estimated by these libraries.


## fCoSE 2.2.0 and supporting layout libraries

- Projects: https://github.com/iVis-at-Bilkent/cytoscape.js-fcose , https://github.com/iVis-at-Bilkent/cose-base , https://github.com/iVis-at-Bilkent/layout-base
- License: MIT; original notices are included in public/licenses/cytoscape-fcose-LICENSE.txt, cose-base-LICENSE.txt, and layout-base-LICENSE.txt.
- Unmodified browser builds are served locally, after Cytoscape.js, in dependency order: layout-base.js, cose-base.js, cytoscape-fcose.js.
- Used for explicitly requested animated memory-graph arrangement. No remote layout service is contacted.

## Provider logos

- Source: https://github.com/lobehub/lobe-icons , revision 34270bc208d7122778dc00b30bd460f97ea03216.
- MIT source notice, individual filenames and display modifications: public/model-icons/NOTICE.
- Logos identify connected providers. Codex uses the OpenAI provider symbol; this does not claim it is the current Codex desktop application icon. Brand and trademark rights remain with their respective owners.

## Workflow design references

n8n execution status and run-inspection interactions were studied from its official documentation. No n8n code is bundled or copied; the n8n repository has its own restricted licenses. IMPERIUM's workflow execution and collaboration board are implemented independently.
