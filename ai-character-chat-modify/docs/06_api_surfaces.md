# 06. API surfaces

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## A. Perchance/list-side runtime exposed into HTML as `root.*`

Source of truth:
- `original/ai-character-chat-list.txt`

### Imported services
- `root.loadDependencies`
- `root.aiTextPlugin`
- `root.textToImagePlugin`
- `root.commentsPlugin`
- `root.tabbedCommentsPlugin`
- `root.uploadPlugin`
- `root.superFetch`
- `root.fullscreenButtonPlugin`
- `root.combineEmojis`
- `root.bugReport`

### Locally defined list-side functions used from HTML
- `root.generateShareLinkForCharacter`
- `root.compressBlobWithGzip`
- `root.decompressBlobWithGzip`
- `root.loadDataFromUrlThatReferencesCloudStorageFile`
- `root.evaluatePerchanceTextInSandbox`
- `root.getMessageObjsWithoutSummarizedOnes`
- `root.injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded`
- `root.confirmAsync`

## B. DOM convenience API in HTML

### `window.$`
- declared at 269-278
- Proxy wrapper:
  - property access like `$.messageInput` → `document.querySelector('#messageInput')`
  - call form like `$('selector')` → `document.querySelector(selector)`

### `window.$$`
- declared at 266
- shorthand for `document.querySelectorAll(selector)`

### Other global helpers
- `showEl`, `hideEl`
- `delay`
- `createFloatingWindow`
- `createLoadingModal`
- `sanitizeHtml`
- `htmlToElement`
- `downloadTextOrBlob`
- `applyObjectOverrides`
- `objectKeysAndTypesAreValid`
- `addBackgroundToElement`
- `blobToDataUrl`, `processAvatarImageUrl`

## C. Database API (`db.*`)

### Global instance
- `window.db` created at 2893+
- Dexie instance over `chatbot-ui-v1`

### Main tables used directly throughout code
- `db.characters`
- `db.threads`
- `db.messages`
- `db.misc`
- `db.summaries`
- `db.memories`
- `db.lore`
- `db.textEmbeddingCache`
- `db.textCompressionCache`

### Common usage patterns
- `.get(...)`
- `.put(...)`
- `.update(...)`
- `.add(...)`
- `.bulkAdd(...)`
- `.where(...).equals(...)`
- `.where(...).anyOf(...)`
- `.orderBy(...).reverse().toArray()`
- `.transaction('rw', ...)`

## D. `$.messageInput` API and send-flow surface

### DOM node
- `#messageInput` — line 1958
- textarea used for all message creation and slash commands

### What is bound to it
- keydown send/newline behavior — 12292-12305
- paste resize — 12308-12311
- blur/focus/click/input auto-resize — 12313-12332
- unsentMessageText persistence via debounced input listener — 9732-9748
- double tap / double click history popup logic — 12335-12440
- placeholder updates via `renderMessageInputPlaceholder()` — 5340-5350

### Send-related companion APIs
- `#sendButton` → `sendButtonClickHandler()`
- `#shortcutButtonsCtn` → shortcut injection into textarea
- `thread.currentReplyAsCharacterId` → changes semantic of outgoing message
- slash command parser inside `sendButtonClickHandler()`

## E. Custom-code iframe API — `oc.*`

Source region:
- iframe runtime inside `createNewCustomCodeIframeForThread()`
- especially lines 10652-10779

### `oc.thread`
Fields exposed:
- `name`
- `messages`
- `userCharacter`
- `systemCharacter`
- `character`
- `customData`
- `messageWrapperStyle`
- `shortcutButtons`

Methods:
- `oc.thread.on(eventName, callback)`
- `oc.thread.off(eventName, callback)`
- `oc.thread.once(eventName, callback)`

Events supported in bridge code:
- `MessageAdded`
- `MessageEdited`
- `MessageDeleted`
- `MessageInserted`
- `StreamingMessageChunk`
- synthesized `StreamingMessage`

### `oc.character`
Exposed from `characterPropertiesVisibleToCustomCode` plus compat field:
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
- `avatarUrl` (backwards-compat)

### `oc.userCharacter`
Read-only global user defaults snapshot.
Not thread override state.

### `oc.window`
- `oc.window.show(args={})`
- `oc.window.hide(args={})`

### Text/image generation helpers in iframe
- `oc.getChatCompletion(options)`
- `oc.getInstructCompletion(options)`
- `oc.generateText(options)`
- `oc.textToImage(options)`

### Rendering extension point
- `oc.messageRenderingPipeline` — array of middleware handlers

## F. Bridge internals between main thread and iframe

### Main thread side
- `sendCustomCodeIframeMessage(threadId, data)`
- `runCodeInCustomCodeIframe(code, opts={})`
- `getDataForCustomCode(threadId, opts={})`
- `triggerMessageActionCustomCodeEvent(...)`
- `triggerStreamingMessageChunkCustomCodeEvent(...)`
- `updateDbWithNewDataFromCustomCode(...)`

### Iframe side
- deep proxy change tracking over `oc.thread` and `oc.character`
- diffing against last snapshot
- `___setDataWithoutTriggeringChange(...)` for main-thread → iframe sync
- custom fetch proxy via parent `proxiedFetch`

## G. Image-generation message API
Message text can embed:
- `<image>prompt text</image>`

Main handling inside `createMessageElement()`:
- parses tags
- applies prompt prefix/suffix/triggers
- calls `root.textToImagePlugin(...)`
- allows “keep” persistence into `message.customData.__savedImages`

## H. Public-ish internal constants / maps worth knowing
- `characterPropertiesVisibleToCustomCode` — 10526-10552
- `defaultThreadName` — 5291
- `defaultSystemName` — 5292
- `defaultUserName` — 9676
