# 05. Карта бизнес-логики

> **Status note (2026-06-03):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## 1) Character lifecycle

### Create
- `characterDetailsPrompt()` — 5670-6199
- `addCharacter()` — 6285-6294
- `createNewThreadWithCharacterId()` — 5294-5330

### Edit
- `editCharacterById()` — 5256-5289
- обновляет DB character
- при изменении `customCode` пересоздаёт iframe'ы thread'ов этого character
- rerender thread list / character list / active thread

### Delete
- `safelyDeleteCharacterById()` — 5142-5186
- удаляет сам character
- удаляет связанные threads
- переназначает/встраивает данные в messages, если deleted character фигурировал как non-thread character

### Duplicate / Share / Import
- duplicate button logic — 5076+
- share button logic — 5030+
- external character import — 13166+
- hash/share-link startup — 13401+

## 2) Thread lifecycle

### Render / navigate
- `renderThreadList()` — 3484-3920
- `showThread()` — 5354-5440
- search UI — 12248-12276
- folder navigation/edit — inside `renderThreadList()` and `renderCharacterList()`

### Create / duplicate / delete / export
- `createNewThreadWithCharacterId()` — 5294+
- `addThread()` — 6374-6438
- duplicate thread UI — 3769+
- `safelyDeleteThreadById()` — 5188-5205
- thread JSON export — `getThreadJSONById()` 3922-4001

### Thread options popup
- user name/avatar override
- auto reply toggle
- thread-level response length
- add/edit character
- reply-as list

Relevant handlers:
- 11960+
- 11988+
- 12000+
- 12010+
- 12021+
- 12025+
- 12030+

## 3) Message lifecycle

### Send path
Главная точка:
- `sendButtonClickHandler()` — 9750-10510

Что делает:
1. читает `$.messageInput.value`
2. обновляет thread user message history
3. парсит slash-команды
4. создаёт `messageObj`
5. пишет в DB через `addMessageToDb()`
6. отрисовывает через `addMessageToFeed()`
7. триггерит custom-code event
8. запускает bot reply when needed

### Render path
- `renderMessageFeed()` — 4004-4187
- `createMessageElement()` — 9047-9430
- `addMessageToFeed()` — 8606-8658

### Edit / quick-edit / delete
- popup editor — `messageEditButtonClickHandler()` 9431-9530
- inline quick editor — `messageQuickEditButtonClickHandler()` 9532-9629
- delete with undo — `messageDeleteButtonClickHandler()` 9631-9675
- safe delete references — `safelyDeleteMessagesByIds()` 5207-5254

### Variants / regenerate / streaming
- `regenerateMessage()` — 8435-8593
- `switchMessageVariant()` — 8665-8690
- `attachEventHandlersToMessageEl()` — 8756-9000
- `handleStreamingReplyChunk()` — 8172-8193

## 4) Reply generation pipeline

### Core generator
- `getBotReply()` — 7158-8070

Внутри:
- подготовка names/roles
- сбор role instructions
- reminder resolution
- general writing instructions preset/custom
- summary replacement
- memory/lore query generation
- embeddings lookup
- relevance ranking
- final instruction/startWith/stopSequences for `root.aiTextPlugin`
- streaming callback emission

### Wrapper orchestration
- `doBotReplyIfNeeded()` — 8236-8432
- `doBotReplyInPlaceOfUser()` — 11800-11906
- `autoNameThreadIfNeeded()` — 8195-8233

## 5) Import / export / sharing logic

### Export families
- raw emergency export — 20-231
- structured app export — 3340-3482
- per-thread export — 3828-3899

### Import families
- raw DB import — 12606+
- Dexie export import — 12668+
- external character card import — 13166+
- TavernAI JSONL thread import — 13345+

### Share URL flow
- share generation in list-side runtime
- startup ingest in `checkForHashCommand()`

## 6) Character-from-URL generation
- `window.generateCharacterFromUrl()` — 2109-2593

Подэтапы:
- URL normalization for several services
- fetch / PDF / image / HTML page parsing
- Readability and fallback scrapers
- avatar extraction and processing
- AI roleInstruction generation via `root.aiTextPlugin`
- opening `characterDetailsPrompt()` with generated draft

## 7) Custom-code business path

### Main flow
1. thread opens
2. if character has `customCode`, create iframe
3. initialize iframe with `oc` data snapshot
4. after message actions → send event into iframe
5. iframe mutates `oc.thread` / `oc.character`
6. diffs are posted back
7. `updateDbWithNewDataFromCustomCode()` reconciles DB and rerenders UI

Main functions:
- `createNewCustomCodeIframeForThread()` — 10555-11213
- `sendCustomCodeIframeMessage()` — 11492-11500
- `getDataForCustomCode()` — 11513-11553
- `triggerInitCustomCodeEvent()` — 11555-11558
- `triggerMessageActionCustomCodeEvent()` — 11561-11584
- `updateDbWithNewDataFromCustomCode()` — 11596-11796

## 8) User-facing slash commands
Handled inside `sendButtonClickHandler()`.

Supported command families in current code:
- `/ai`
- `/user`
- `/sys` / `/system`
- `/sum`
- `/import`
- `/mem`
- `/lore`
- `/name`
- `/avatar`
- `/image`
- `/nar` alias -> narrator/system pattern

`#messageInput` title attribute at line 1958 documents the public command surface shown to the user.
