# 02. Точки входа и boot sequence

> **Status note (2026-06-03):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## Самые ранние entrypoints в HTML

### 1) Глобальные bootstrap script tags
- lines 8-9
- выставляют:
  - `window.pageLoadStartTime`
  - `window.dbName = "chatbot-ui-v1"`

### 2) Emergency recovery bootstrap
- lines 20-231
- если приложение зависает на загрузке, показываются:
  - emergency export
  - emergency delete all data
- внутри же находится низкоуровневый `exportRawDb`.

### 3) Dependency bootstrap
- lines 253-255
- `root.loadDependencies()`
- это первый критичный мост к list-side импорту `loadDependencies`.

### 4) Utility bootstrap script
- lines 259-1175
- поднимает глобальные helper-ы:
  - `$`, `$$`
  - `showEl`, `hideEl`, `delay`
  - `createFloatingWindow`
  - `sanitizeHtml`
  - `textToSpeech`
  - `sha256Text`
  - `jsonToBlob`
  - `prompt2`
  - `applyCodeMirror5ToTextarea`

Это фактически «foundation layer» всего UI.

## Главная точка входа приложения

### `<script type="module">` main runtime
- starts at line 1994
- main body finishes at line 13603

Это главный boot script.

## Boot sequence внутри main module

### Шаг 1 — аварийные/защитные handlers
Сразу вверху:
- clear data button handler
- loading modal fallback timeout
- avatar toggle helper
- environment checks
- lazy JSON5 load
- avatar/blob helpers

Ключевые строки:
- `$.clearDataButton.addEventListener(...)` — 2010+
- `window.toggleAvatarPicDisplay` — 2025+
- `window.generateCharacterFromUrl` — 2109+

### Шаг 2 — sanitization / markdown / rendering infrastructure
- DOMPurify config and hooks — 2623+
- marked renderer — 2643+
- global `window.onerror` — 2656+
- ResizeObserver for feed — 2680+
- `sceneBackground = addBackgroundToElement(...)` — 2708

### Шаг 3 — layout/nav behavior
- left column open/close — 2768-2787
- mobile overlay behavior — 2795+
- message feed top bar visibility logic — 2804+
- right column/mobile custom-code column logic — 2851+

### Шаг 4 — DB bootstrap
- constants:
  - `dbName = "chatbot-ui-v1"` — 2890
  - `dbVersion = 90` — 2891
- existing db open/check — 2893+
- `db.version(...).stores(...).upgrade(...)` — 2917+
- actual `await db.open()` — 3000+

### Шаг 5 — upgrade helpers registration
- `upgradeCharacterFromOldVersion` — 3058+
- `upgradeMessageFromOldVersion` — 3102+
- `upgradeThreadFromOldVersion` — 3122+
- `upgradeMemoryFromOldVersion` — 3241+
- `upgradeLoreFromOldVersion` — 3262+

### Шаг 6 — export/import/runtime UI wiring
- export button flow — 3340+
- thread list render — 3484+
- message feed render — 4004+
- character list render — 4883+
- send flow — 9750+
- custom-code iframe API — 10555+
- import flows — 12510+

### Шаг 7 — startup screen selection
В самом конце:
- `renderThreadList()` — 13541
- optional `customPostPageLoadMainThreadCode` — 13546+
- `checkForHashCommand()` — 13401+, вызывается при старте
- если thread'ов нет → открывается/создаётся стартовый character flow
- иначе → открывается mostRecentlyInteractedThread

### Шаг 8 — final visibility and preload
- `initialPageLoadingModal.style.display = "none"` — 13577
- `$.main.style.visibility = "visible"` — 13578
- `window.finishedPageLoad = true` — 13598
- `root.aiTextPlugin({preload:true})` — 13600+

## List-side entrypoints

### `urlNamedCharacters`
- lines 157-166
- short aliases for `?char=` URLs.

### `$meta.dynamic`
- lines 167-221
- page metadata entrypoint based on URL params / shared character file.

### `injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded`
- lines 243-648
- это важнейшая list-side background entrypoint, вызываемая HTML runtime для summaries/memories.

## Startup decision tree
1. Load emergency UI.
2. Load dependencies from list-side.
3. Initialize utilities.
4. Render static DOM shell.
5. Start main module.
6. Open/check Dexie DB and run migrations.
7. Render thread list.
8. Process hash/query share-link command if present.
9. Otherwise open last viewed thread or create starter thread.
10. Hide initial modal, show app, preload AI backend.
