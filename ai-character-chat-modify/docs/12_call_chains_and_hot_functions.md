# 12. Call chains and hot functions

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

Эта страница — уже не просто список функций, а карта основных execution chains.

Machine-readable aids:
- `analysis/function_inventory.json`
- `analysis/function_to_component_map.json`
- `analysis/function_to_component_map.md`

## 1. Startup chain
1. tiny bootstrap scripts set `pageLoadStartTime` and `dbName`
2. `root.loadDependencies()`
3. utility layer is defined (`$`, `prompt2`, etc.)
4. main `<script type="module">` starts
5. Dexie opens / upgrades DB
6. `renderThreadList()`
7. `checkForHashCommand()`
8. `showThread(...)` or starter-character flow
9. app becomes visible
10. `root.aiTextPlugin({preload:true})`

## 2. Standard send-message chain
1. user types in `#messageInput`
2. clicks `#sendButton` or presses Enter
3. `sendButtonClickHandler()`
4. maybe slash-command path, otherwise:
5. `createMessageObj()`
6. `addMessageToDb()`
7. `addMessageToFeed()`
8. `triggerMessageActionCustomCodeEvent(..., MessageAdded)`
9. `doBotReplyIfNeeded()` if auto-reply is expected

## 3. Bot reply chain
1. `doBotReplyIfNeeded()`
2. placeholder typing message added via `addMessageToFeed()`
3. `getBotReply()`
4. inside `getBotReply()`:
   - `prepareMessagesForBot()`
   - summary reduction
   - role/reminder assembly
   - memory/lore query generation
   - final `root.aiTextPlugin(...)`
5. streaming chunks handled by `handleStreamingReplyChunk()`
6. final text committed to DB via `addMessageToDb()`
7. final render via `addMessageToFeed()`
8. custom-code `MessageAdded` event fires

## 4. Reader rendering chain
This is separate from AI prompt preparation.

1. `renderMessageFeed()`
2. `renderMessagesForReader({reader:'user'})`
3. if custom code exists:
   - `messagesToCustomCodeFormat()`
   - `sendCustomCodeIframeMessage()`
   - iframe runs `oc.messageRenderingPipeline`
   - `messagesFromCustomCodeFormat()`
4. `createMessageElement()`
5. `attachEventHandlersToMessageEl()`

## 5. Custom code event chain
1. message added/edited/deleted/inserted in main thread
2. `triggerMessageActionCustomCodeEvent()`
3. `getDataForCustomCode()` snapshot
4. `sendCustomCodeIframeMessage()`
5. iframe handler mutates `oc.thread` / `oc.character`
6. iframe diff posts back `dataChanged`
7. `updateDbWithNewDataFromCustomCode()` reconciles DB
8. rerender affected thread/UI state

## 6. Import chain
1. `#importDataFileInput` change
2. import modal/options
3. attempt order:
   - `tryImportingRawDbExport`
   - `tryImportingDexieFile`
   - `tryImportingTavernAIThreadFile`
   - `tryImportingExternalCharacterFileFormat`
4. if success → rerender thread/character UI

## 7. Hash/share-link startup chain
1. `checkForHashCommand()`
2. parse URL hash / `?data=` / `?char=`
3. maybe call `root.loadDataFromUrlThatReferencesCloudStorageFile()`
4. normalize character object through upgrade helper
5. open `characterDetailsPrompt()` or reuse near-identical existing character
6. `addCharacter()` or modify existing one
7. `createNewThreadWithCharacterId()`

## 8. Hot functions (highest leverage / highest risk)

### `sendButtonClickHandler`
Почему горячая:
- biggest command dispatcher
- central user action handler
- touches DB, UI, slash-commands, lore/mem, bot replies

### `getBotReply`
Почему горячая:
- core intelligence pipeline
- summaries + memory + lore + prompts + streaming all meet here

### `renderMessageFeed`
Почему горячая:
- central UI redraw path
- sensitive to performance and currently streaming messages

### `createMessageElement`
Почему горячая:
- final visible rendering of messages
- markdown, code blocks, image tags, avatar/style resolution

### `updateDbWithNewDataFromCustomCode`
Почему горячая:
- reconciles sandbox changes into authoritative DB state
- easy place to create race bugs

### `tryImportingDexieFile`
Почему горячая:
- huge persistence migration path
- lots of ID remapping and compatibility logic

## 9. Most dangerous refactor boundaries

### Boundary A — between `prepareMessagesForBot` and `renderMessagesForReader`
Они похожи по названию, но делают разные вещи:
- one prepares AI-visible text
- one prepares user-visible text after custom rendering

### Boundary B — between `thread.character` and `db.characters.get(thread.characterId)`
- `thread.character` = per-thread override object
- `db.characters[...]` = canonical character

### Boundary C — `oc.*` vs real DB state
- iframe edits `oc`
- DB is updated later through reconciliation
- это не live shared state, а synced state

### Boundary D — summaries/memories old vs new model
- legacy stores still exist
- actual live summaries now mostly sit on messages
- import/export must understand both worlds
