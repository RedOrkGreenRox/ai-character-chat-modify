# 11. API matrix

> **Status note (2026-06-03):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

Эта страница собирает API-поверхности в одном месте, уже после доп.проверки исходников.

Machine-readable source:
- `analysis/api_surface_matrix.json`
- `analysis/function_inventory.json`
- `analysis/dom_id_inventory.json`
- `analysis/css_variable_inventory.json`

## 1. Perchance runtime / `root.*`

### Imports from list-side
HTML runtime ожидает следующие сервисы на `root`:
- `loadDependencies`
- `aiTextPlugin`
- `textToImagePlugin`
- `commentsPlugin`
- `tabbedCommentsPlugin`
- `uploadPlugin`
- `superFetch`
- `fullscreenButtonPlugin`
- `combineEmojis`
- `bugReport`

### List-side helper functions consumed by HTML
- `generateShareLinkForCharacter`
- `compressBlobWithGzip`
- `loadDataFromUrlThatReferencesCloudStorageFile`
- `decompressBlobWithGzip`
- `evaluatePerchanceTextInSandbox`
- `getMessageObjsWithoutSummarizedOnes`
- `injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded`
- `confirmAsync`

## 2. Main DOM helper API

### `$`
Proxy shortcut:
- `$.messageInput` → `document.querySelector('#messageInput')`
- `$.sendButton` → `document.querySelector('#sendButton')`
- etc.

### `$$`
- `$$('selector')` → `document.querySelectorAll(selector)`

### Common global helpers
- `showEl(el)`
- `hideEl(el)`
- `delay(ms)`
- `htmlToElement(html)`
- `createLoadingModal(...)`
- `createFloatingWindow(...)`

## 3. DB API

Global:
- `window.db`

Core tables:
- `db.characters`
- `db.threads`
- `db.messages`
- `db.misc`
- `db.summaries`
- `db.memories`
- `db.lore`
- `db.textEmbeddingCache`
- `db.textCompressionCache`

## 4. `$.messageInput` surface

Main node:
- `#messageInput`

Bound behaviors:
- send on Enter (desktop-like path)
- auto-grow on input/paste/focus/click
- debounced save into `thread.unsentMessageText`
- double-click/double-tap history popup
- placeholder changes depending on current reply identity

Related nodes:
- `#sendButton`
- `#shortcutButtonsCtn`
- `#userMessagesSentHistoryCtn`
- `#threadReplyAsCharacterListPopup`

## 5. Custom-code sandbox API: `oc.*`

### `oc.thread`
Fields:
- `name`
- `messages`
- `userCharacter`
- `systemCharacter`
- `character`
- `customData`
- `messageWrapperStyle`
- `shortcutButtons`

Methods:
- `on(eventName, callback)`
- `off(eventName, callback)`
- `once(eventName, callback)`

Events:
- `MessageAdded`
- `MessageEdited`
- `MessageDeleted`
- `MessageInserted`
- `StreamingMessageChunk`
- `StreamingMessage`

### `oc.character`
Fields exposed to sandbox:
- `name`
- `avatar`
- `roleInstruction`
- `reminderMessage`
- `initialMessages`
- `customCode`
- `imagePromptPrefix`
- `imagePromptSuffix`
- `imagePromptTriggers`
- `shortcutButtons`
- `messageInputPlaceholder`
- `stopSequences`
- `modelName`
- `userCharacter`
- `streamingResponse`
- `customData`
- `maxTokensPerMessage`
- compat alias: `avatarUrl`

### `oc.userCharacter`
Read-only snapshot of global user defaults.

### `oc.window`
- `oc.window.show(args={})`
- `oc.window.hide(args={})`

### Generation methods
- `oc.getChatCompletion(options)`
- `oc.getInstructCompletion(options)`
- `oc.generateText(options)`
- `oc.textToImage(options)`

### Rendering extension
- `oc.messageRenderingPipeline`

## 6. Message/image pseudo-API
Messages can include:
- `<image>...</image>`

That is interpreted by the built-in message renderer and converted into image-generation widgets or saved images.

## 7. Data-sync bridge helpers
Main-thread helpers:
- `sendCustomCodeIframeMessage`
- `runCodeInCustomCodeIframe`
- `getDataForCustomCode`
- `triggerInitCustomCodeEvent`
- `triggerMessageActionCustomCodeEvent`
- `triggerStreamingMessageChunkCustomCodeEvent`
- `updateDbWithNewDataFromCustomCode`

Iframe-side sync helpers:
- `___setDataWithoutTriggeringChange`
- `getCurrentData`
- `getChangedData`
- `sendBackDataUpdatesIfNeeded`

## 8. Inventory references
- DOM IDs inventory: `analysis/dom_id_inventory.json`
- CSS variables inventory: `analysis/css_variable_inventory.json`
- Function inventory: `analysis/function_inventory.json`
- Function→component map: `analysis/function_to_component_map.md`
