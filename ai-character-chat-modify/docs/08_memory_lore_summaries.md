# 08. Memory, lore, summaries

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## Overview
В проекте сосуществуют:
1. **new hierarchical summaries**
2. **message-attached memories** (`memoriesEndingHere`)
3. **lore entries** in `db.lore`
4. **legacy summaries/memories compatibility paths**

Это одна из самых сложных подсистем всего приложения.

## A. List-side hierarchical summarization engine
Source:
- `original/ai-character-chat-list.txt`
- lines 222-648

Ключевые функции:
- `getMessageObjsWithoutSummarizedOnes(messages, opts)`
- `injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded(threadId, opts)`

### Что делает `getMessageObjsWithoutSummarizedOnes`
- идёт назад по message objects
- выбирает только те message objects, которые нужны после схлопывания старых сообщений summary-уровнями
- возвращает сами message objects, а не готовый текст

### Что делает `injectHierarchical...`
- получает messages thread'а
- внедряет уже готовые summaries/memories назад в `db.messages`
- оценивает token budget
- если budget переполнен — в фоне строит next summary level
- дополнительно может извлекать memory entries из new summary block

### Важная архитектурная деталь
Summaries больше не живут главным образом в store `summaries`.
Они пишутся прямо в message object:
- `message.summariesEndingHere[level]`

Памяти тоже могут крепиться к message:
- `message.memoriesEndingHere[level]`

## B. HTML-side memory/lore retrieval in reply generation
Source:
- `getBotReply()` — lines 7158-8070

### Сначала summaries
До memory/lore retrieval код:
- берёт prepared messages
- заменяет старые сегменты summary-сообщениями
- запоминает `summariesUsed`
- формирует `messageIdsUsed`

### Затем memory/lore query generation
Если memory/lore доступны:
1. строятся search queries через `root.aiTextPlugin`
2. queries эмбедятся
3. все memory/lore entries получают relevance score
4. top memories собираются в batches
5. лишнее отбрасывается до token budget
6. результирующий retrieval text добавляется в prompt

### Tracking fields on outgoing message
При генерации bot reply могут заполняться:
- `memoryIdBatchesUsed`
- `loreIdsUsed`
- `summariesUsed`
- `memoryQueriesUsed`
- `messageIdsUsed`

Это потом используется brain-button popup'ом для диагностики.

## C. Lore storage modes

### Thread-local lore
- `bookId == thread.loreBookId`
- редактируется через `/lore`

### URL-backed lore
- `bookUrl`
- список URL живёт в `character.loreBookUrls`
- фактическая загрузка делает `ensureLoreUrlsAreLoaded(...)`

### Lore load pipeline
`ensureLoreUrlsAreLoaded({loreBookUrls, modelName})` — 6440-6518

Pipeline:
- fetch/download text
- normalize lines / split by blank lines
- precompute hashes
- embed texts
- merge/update DB lore entries

## D. Memory editing flow (`/mem`)
Source inside `sendButtonClickHandler()` around 9987-10240.

Текущий editor:
- собирает memories из `message.memoriesEndingHere`
- эмулирует old memory format для редактирования
- позволяет переписать text blocks
- переэмбедит changed texts
- переукладывает их назад по message buckets

В коде видно большой commented-out альтернативный memory rewrite algorithm — он вынесен в каталог commented code.

## E. Summary editing flow (`/sum`)
Source around 9859-9919.

Current flow:
- берёт active thread messages
- строит список current top summaries из `summariesEndingHere`
- показывает их в `prompt2`
- пишет отредактированные тексты обратно в `db.messages`

В коде сохранён старый summary-store based flow как комментарий.

## F. Lore editing flow (`/lore`)
Two modes:
- `/lore <text>` → быстро добавляет одну запись
- `/lore` → открывает lore editor modal

Editor path:
- загружает `db.lore.where({bookId:loreBookId})`
- позволяет редактировать local thread lore
- показывает read-only URL-lore section
- умеет `Reload Lore URLs`

## G. Embedding subsystem

### Default model
- `currentDefaultTextEmbeddingModelName = 'Xenova/bge-base-en-v1.5'` — line 2056

### Local embedding runtime
- lazy worker/bootstrap around 6559-6628
- `embedTextWithLocalModel(...)`
- `embedTexts(...)`

### Caches
- `db.textEmbeddingCache`
- `db.textCompressionCache`

## H. Legacy compatibility notes
Несмотря на новый подход, код всё ещё поддерживает:
- legacy `summaries` store
- legacy `memories` store
- old memory id format in `message.memoryIdBatchesUsed`
- import/export migration paths for both old and new layouts

## I. Exact fragments most relevant to this subsystem
- list summaries engine: `analysis/exact_components/ai-character-chat-list/005_summary_selection_helper.frag`
- list summary budget/injection: `006_summary_injection_and_budget.frag`
- list summary generation/memories: `007_summary_generation_and_memories.frag`
- html embeddings/lore loading: `021_module_message_models_lore_embeddings.frag`
- html message prep/custom code formats: `022_module_prepare_messages_and_custom_code_format.frag`
- html reply generation pipeline: `023_module_reply_generation_pipeline.frag`
- command handlers (`/sum`, `/mem`, `/lore`): `026_module_send_button_commands.frag`
