# 04. DB schema и persistence

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## Dexie bootstrap
- `dbName = "chatbot-ui-v1"` — line 2890
- `dbVersion = 90` — line 2891

Главный schema bootstrap расположен в:
- lines 2917-3028
- exact fragment: `015_module_db_bootstrap_upgrades.frag`

## Stores

### `characters`
Indexes:
- `++id`
- `modelName`
- `fitMessagesInContextMethod`
- `uuid`
- `creationTime`
- `lastMessageTime`
- `folderPath`

Назначение:
- character definition
- avatar / roleInstruction / reminder / initialMessages / customCode
- default per-character user/system overrides
- loreBookUrls / image prompt config / shortcut defaults

### `threads`
Indexes:
- `++id`
- `name`
- `characterId`
- `creationTime`
- `lastMessageTime`
- `lastViewTime`
- `folderPath`

Назначение:
- конкретный чат с character
- thread-specific overrides (`thread.character`, `thread.userCharacter`, `thread.systemCharacter`)
- shortcut buttons snapshot
- customCodeWindow state
- loreBookId
- unsentMessageText
- userMessagesSentHistory

### `messages`
Indexes:
- `++id`
- `threadId`
- `characterId`
- `creationTime`
- `order`

Назначение:
- хранилище всех сообщений thread'а
- `characterId=-1` user, `-2` system
- variants, scene, avatar override, wrapperStyle
- summary/memory/lore usage tracing
- `summariesEndingHere`, `memoriesEndingHere`

### `misc`
- key/value storage
- глобальные пользовательские настройки:
  - `userName`
  - `userAvatarUrl`
  - `userRoleInstruction`
  - `showInlineReminder`
  - folder metadata
  - datesApplicationWasUsedInThisBrowser
  - etc.

### `summaries`
Legacy store.
Комментарий в коде сам отмечает, что новый подход хранит summaries на message object, а этот store оставлен ради backwards-compat.

### `memories`
Legacy/transition store.
Новый подход частично переносит памяти в `message.memoriesEndingHere`, но import/export/upgrades всё ещё учитывают old-format memories.

### `lore`
Indexes:
- `++id`
- `bookId`
- `bookUrl`

Назначение:
- thread-local lore (`bookId == thread.loreBookId`)
- URL-backed lorebooks (`bookUrl`)

### `textEmbeddingCache`
Indexes:
- `++id`
- `textHash`
- `&[textHash+modelName]`

Назначение:
- кэш эмбеддингов lore/memory texts

### `textCompressionCache`
Indexes:
- `++id`
- `uncompressedTextHash`
- `&[uncompressedTextHash+modelName+tokenLimit]`

Назначение:
- кэш текстовой компрессии/summary-like helper data

## Upgrade helpers

### Character upgrade
- `upgradeCharacterFromOldVersion` — 3058-3100
- нормализует:
  - `customCode`
  - `modelVersion -> modelName`
  - `avatarUrl -> avatar.url`
  - `scene`
  - `roleInstruction`
  - `userCharacter`
  - `systemCharacter`
  - `customData`
  - `loreBookUrls`
  - `autoGenerateMemories`
  - `maxTokensPerMessage`

### Message upgrade
- `upgradeMessageFromOldVersion` — 3102-3120
- нормализует:
  - `variants`
  - `expectsReply`
  - `summaryHashUsed`
  - `memoryIdBatchesUsed`
  - `loreIdsUsed`
  - `scene`
  - `avatar`
  - `customData`
  - `wrapperStyle`
  - `memoryQueriesUsed`
  - `messageIdsUsed`
  - `order`
  - `instruction`

### Thread upgrade
- `upgradeThreadFromOldVersion` — 3122-3167
- нормализует:
  - favorites
  - per-thread overrides
  - modelName inheritance
  - textEmbeddingModelName inheritance
  - folderPath
  - loreBookId
  - shortcutButtons
  - currentSummaryHashChain

## Persistence-critical flows

### Export
- button handler: 3340-3482
- raw DB export: 20-231
- per-thread export: 3828-3899

### Import
- main import input handler: 12510-12553
- raw DB import: 12606-12666
- Dexie import/re-numbering: 12668-13149
- external character imports: 13166-13344
- TavernAI thread import: 13345-13390

### Share links / URL-backed import
List-side:
- `generateShareLinkForCharacter` — list 21-59
- `loadDataFromUrlThatReferencesCloudStorageFile` — list 66-112

HTML-side startup consumer:
- `checkForHashCommand()` — 13401-13530

## Persistence edge-case handling
Код явно содержит отдельные recovery/consistency layers:
- emergency raw export on load stall
- delete all data fallback
- corruption-tolerant raw export with replacers
- DB upgrade safety export
- null filtering wrappers around `db.characters.toArray()` / `db.threads.toArray()` / `db.messages.toArray()`
- import-time re-numbering of IDs across tables
- cache deduplication for embeddings/compression cache
