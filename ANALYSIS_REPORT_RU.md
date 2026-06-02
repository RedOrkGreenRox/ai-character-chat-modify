# Анализ `RedOrkGreenRox/ai-character-chat-modify`

Дата анализа: 2026-06-01  
Репозиторий: https://github.com/RedOrkGreenRox/ai-character-chat-modify  
Локальная копия: `/home/user/ai-character-chat-modify`

## 1. Что было сделано

- Репозиторий клонирован с GitHub.
- Проверена история: ветка `main`, HEAD `74d78d5`.
- Изучена структура проекта, исходники `original/`, фрагменты `analysis/exact_components/`, документация `docs/`, инструменты `tools/`, overlay-модификация `modify/` и собранный результат `output/`.
- Запущены проверки точной пересборки и сборки модифицированного output.
- Извлечены и проверены скриптовые блоки из итогового HTML через `node --check`; синтаксических ошибок JS/ESM не найдено.
- Изучена релевантная документация Perchance: базовый tutorial, advanced tutorial/examples, Learn Perchance, Learn Web, formatting docs, plugins index, AI text plugin, text-to-image plugin, upload plugin, AI Character Chat/custom-code страницы, а также уже имеющиеся в репозитории заметки `analysis/perchance_research.md`.

> Ограничение: Perchance-документация сама сделана как набор Perchance-генераторов/страниц, часть страниц при markdown-извлечении содержит editor chrome и runtime UI. Поэтому выводы ниже опираются на извлечённый документальный контент, исходники текущего репозитория и официальные/хабовые страницы Perchance, доступные на момент анализа.

## 2. Количественная картина репозитория

Без `.git` репозиторий содержит примерно:

- 1074 файла;
- ~4.85 MB данных;
- основной HTML-исходник: `original/ai-character-chat-html.txt`, 863,640 байт, 13,619 строк;
- основной list-исходник: `original/ai-character-chat-list.txt`, 45,059 байт, 691 строка;
- модифицированный HTML-output: `output/ai-character-chat-html.txt`, 889,764 байт, 14,379 строк;
- модифицированный list-output: `output/ai-character-chat-list.txt`, 45,059 байт, 691 строка.

Контрольные суммы:

```text
original/ai-character-chat-html.txt  4ea99775dc4fb0b0fca228799005fc1db3116c0f86e4a6ba52dc73c9109b0a1a
reassembled/ai-character-chat-html.txt  same hash
original/ai-character-chat-list.txt  47df59075725c8e798371693c43be121bf021c4795e2455a479afc8abd2c1b29
reassembled/ai-character-chat-list.txt  same hash
output/ai-character-chat-html.txt  8e86022dbc4db0156af31477165d34d919d29582606ca6f36f812e698503fa0b
output/ai-character-chat-list.txt  same as original list
```

## 3. Главная архитектура

Проект — это не обычное веб-приложение в виде исходников `src/*.js`. Это сохранённый и декомпозированный Perchance-генератор `ai-character-chat`, где есть два ключевых слоя:

### 3.1. Perchance lists layer

Файл: `original/ai-character-chat-list.txt`

Роль:

- импорт Perchance-плагинов;
- функции, доступные HTML-слою через `root.*`;
- share-link/upload/download логика;
- sandbox evaluation helper;
- `$meta.dynamic`;
- движок hierarchical summaries/memories.

Ключевые импорты:

```text
loadDependencies = {import:ai-character-chat-dependencies-v1}
aiTextPlugin = {import:ai-text-plugin}
textToImagePlugin = {import:text-to-image-plugin}
commentsPlugin = {import:comments-plugin}
tabbedCommentsPlugin = {import:tabbed-comments-plugin-v1}
uploadPlugin = {import:upload-plugin}
superFetch = {import:super-fetch-plugin}
fullscreenButtonPlugin = {import:fullscreen-button-plugin}
combineEmojis = {import:combine-emojis-plugin}
bugReport = {import:bug-report-plugin}
```

Ключевые функции list-side:

- `generateShareLinkForCharacter`
- `compressBlobWithGzip`
- `loadDataFromUrlThatReferencesCloudStorageFile`
- `decompressBlobWithGzip`
- `evaluatePerchanceTextInSandbox`
- `getMessageObjsWithoutSummarizedOnes`
- `injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded`
- `confirmAsync`

### 3.2. HTML app / SPA-like layer

Файл: `original/ai-character-chat-html.txt`

Это полноценное браузерное приложение внутри Perchance HTML panel. Оно содержит:

- license/header/loading shell;
- emergency IndexedDB export/delete;
- загрузку зависимостей;
- глобальные helpers;
- CSS theme system;
- DOM shell трёхколоночного интерфейса;
- Dexie/IndexedDB schema + migrations;
- character/thread/message CRUD;
- reply-generation pipeline;
- rendering markdown/images/custom styles;
- memory/lore/embeddings;
- slash commands;
- custom-code iframe runtime;
- import/export/share startup flows.

## 4. Декомпозиция на exact fragments

Репозиторий уже качественно декомпозирует монолитные Perchance-исходники на exact fragments:

- HTML: 29 базовых фрагментов;
- LIST: 9 базовых фрагментов;
- все фрагменты непересекающиеся и покрывают исходники полностью;
- `tools/verify_exact_components.py` подтверждает byte-for-byte идентичность `original/` и `reassembled/`.

Это правильная стратегия для такого типа проекта: сначала сохраняется точная обратимая сборка, и только затем можно добавлять overlay-модификации.

Главные index-файлы:

- `analysis/exact_component_manifest.json`
- `analysis/component_map.md`
- `analysis/function_inventory.json`
- `analysis/function_to_component_map.md`
- `analysis/api_surface_matrix.json`
- `analysis/dom_id_inventory.json`
- `analysis/css_variable_inventory.json`
- `analysis/commented_original/README.md`

## 5. Build/overlay system

`modify/` реализует overlay-систему:

- `modify/replace/` — полная замена базового fragment;
- `modify/inject_before/` — вставка перед fragment;
- `modify/inject_after/` — вставка после fragment;
- `modify/new/` — новые модули, позиция задаётся в `modify/manifest.json`.

Текущая модификация одна:

```json
{
  "030_extensions.frag": {
    "source": "ai-character-chat-html",
    "insert_after": "html_028_module_reply_as_and_input_ux"
  }
}
```

Итог:

- `output/ai-character-chat-html.txt` отличается от оригинала вставкой 760 строк после original line ~12473, перед `getCharacterHash`/import-startup блоком.
- `output/ai-character-chat-list.txt` полностью идентичен оригинальному list-файлу.

## 6. Boot sequence основного приложения

Упрощённый порядок запуска:

1. Ранние globals: `window.pageLoadStartTime`, `window.dbName`.
2. Emergency export/delete UI.
3. `root.loadDependencies()` из Perchance list-side.
4. Utility foundation: `$`, `$$`, show/hide, floating windows, markdown/sanitize helpers, prompt modal.
5. CSS variables/theme + DOM shell.
6. Main `<script type="module">`.
7. Dexie open/create/migration до `dbVersion = 90`.
8. Регистрация upgrade helpers для characters/messages/threads/memories/lore.
9. Экспорт/импорт UI.
10. Thread list rendering.
11. Message feed rendering.
12. Character catalog CRUD.
13. Reply generation pipeline.
14. Custom-code iframe API.
15. Import/hash startup flow.
16. Final startup: last thread / add character flow / preload AI.

## 7. IndexedDB/Dexie schema

Текущая схема в `original/ai-character-chat-html.txt`:

```js
characters: "++id,modelName,fitMessagesInContextMethod,uuid,creationTime,lastMessageTime,folderPath"
threads: "++id,name,characterId,creationTime,lastMessageTime,lastViewTime,folderPath"
messages: "++id,threadId,characterId,creationTime,order"
misc: "key"
summaries: "hash,threadId"
memories: "++id,[summaryHash+threadId],[characterId+status],[threadId+status],[threadId+index],threadId"
lore: "++id,bookId,bookUrl"
textEmbeddingCache: "++id,textHash,&[textHash+modelName]"
textCompressionCache: "++id,uncompressedTextHash,&[uncompressedTextHash+modelName+tokenLimit]"
```

Важный вывод: extension-модуль пишет в существующую таблицу `lore` и не меняет schema version. Это удобно, но создаёт ответственность: все добавляемые lore entries должны полностью соответствовать ожиданиям retrieval pipeline, особенно по embeddings.

## 8. Custom-code runtime и `oc.*`

Приложение реализует собственный sandbox iframe runtime:

- iframe создаётся с `sandbox="allow-scripts"`;
- данные thread/character/messages синхронизируются через `postMessage`;
- iframe получает API `oc.*`;
- main page проксирует AI/text-to-image/superFetch/window show-hide и события;
- изменения из iframe конвертируются обратно в DB-формат.

Внутренний public contract custom-code:

- thread fields: `name`, `messages`, `userCharacter`, `systemCharacter`, `character`, `customData`, `messageWrapperStyle`, `shortcutButtons`;
- thread events: `MessageAdded`, `MessageEdited`, `MessageDeleted`, `MessageInserted`, `StreamingMessageChunk`, `StreamingMessage`;
- character fields: `name`, `avatar`, `roleInstruction`, `reminderMessage`, `initialMessages`, `customCode`, image prompt fields, `shortcutButtons`, `messageInputPlaceholder`, `stopSequences`, `modelName`, etc.;
- methods: `getChatCompletion`, `getInstructCompletion`, `generateText`, `textToImage`, `window.show`, `window.hide`.

## 9. Perchance docs — выводы, важные для этого проекта

Из Perchance-документации для этой кодовой базы критичны следующие факты:

1. Perchance строится вокруг list/tree syntax: lists, indentation, square blocks `[x]`, inline curly lists `{a|b}`, odds `^2`, variables/selectOne/evaluateItem.
2. HTML panel — обычный HTML/CSS/JS слой. Поэтому крупное SPA внутри `ai-character-chat-html.txt` является валидной Perchance-архитектурой.
3. Imports через `{import:plugin-name}` становятся callable сущностями в дереве Perchance и доступны HTML-слою через `root.*`.
4. AI plugins (`ai-text-plugin`, `text-to-image-plugin`) являются server-backed и имеют coupling с серверной стороной Perchance; форкать их рискованно, лучше оборачивать official plugin.
5. `upload-plugin` поддерживает string/Blob uploads и используется именно для сложных приложений вроде AI chat/share links.
6. Perchance examples/advanced docs подчёркивают execution order: HTML panel и square blocks читаются left-to-right/top-to-bottom; это важно для любых inline Perchance-вставок в HTML.
7. Для complex generators авторы Perchance фактически рекомендуют HTML/CSS/JS знания; данный репозиторий как раз такой advanced case.

## 10. Анализ `modify/new/030_extensions.frag`

Модуль добавляет:

- localStorage settings с ключом `__ae`;
- `/file`, `/search`, `/toggle <feature>`, `/extensions`;
- drag & drop файлов;
- скрытый `<input type=file multiple>`;
- загрузку pdf.js, mammoth.js, Transformers.js;
- обработку text/pdf/docx/image/audio;
- запись результатов в lore;
- web search через DuckDuckGo + `root.superFetch`;
- shortcut buttons через wrapper над `showThread`.

### 10.1. Хорошие решения

- Не меняет DB schema и не трогает базовые fragments напрямую.
- Вставлен как отдельный overlay-модуль, поэтому легко удалить/заменить.
- Команды перехватываются capture-phase listener'ом до оригинального `sendButtonClickHandler`.
- Использует существующие API: `db`, `embedTexts`, `createMessageObj`, `addMessageToDb`, `addMessageToFeed`, `renderShortcutButtons`, `showThread`.
- Сохраняет file/search data в lore, то есть интегрируется с memory/lore retrieval, а не просто пишет огромный текст в чат.

### 10.2. Критичные/вероятные проблемы

#### P1 — shortcut buttons, скорее всего, не кликабельны

Оригинальный `renderShortcutButtons` выполняет действие только если:

```js
if(shortcut.type === "message") { ... }
```

Extension-кнопки в строках 655-683 `030_extensions.frag` не задают `type: "message"`.

Следствие: кнопки визуально появятся, но click handler ничего не сделает. Команды вручную (`/file`, `/search`, `/extensions`) будут работать, но кнопки — нет.

Решение: добавить `type: "message"` в каждый объект shortcut.

#### P1 — lore entry без embeddings может ломать будущий reply generation

`__aeAddLoreEntry` ловит ошибку embedding, но всё равно добавляет lore object:

```js
catch(e) { console.warn('[ae] Embedding failed (will fail on retrieval too):', e.message); }
...
await db.lore.add(loreObj);
```

Оригинальный retrieval pipeline ожидает `entry.embeddings[embeddingModelName]` и при отсутствии embeddings может бросать ошибку.

Следствие: если embedding не загрузился/упал на одном файле, можно записать «битую» lore-запись и потом сломать генерацию ответов в этом thread.

Решение: при embedding failure не добавлять lore, либо добавлять с явным статусом pending и отдельным re-embed flow, либо сразу повторно вычислять embeddings перед retrieval.

#### P2 — audio transcription input format рискованный

`__aeProcessAudioFile` передаёт `ArrayBuffer` напрямую в Transformers.js ASR pipeline:

```js
var result = await transcriber(arrayBuffer, { chunk_length_s: 30 });
```

Для browser Transformers.js ASR обычно надёжнее передавать decoded audio/URL/typed array в ожидаемом формате. Сжатые mp3/ogg/m4a как raw ArrayBuffer могут не декодироваться так, как ожидается.

Решение: протестировать на mp3/wav/ogg; при необходимости использовать `AudioContext.decodeAudioData` и подавать Float32Array + sampling rate.

#### P2 — `.doc` объявлен поддерживаемым, но mammoth работает с DOCX

В строке 340:

```js
var isDocx = ext === 'docx' || ext === 'doc';
```

Но mammoth.js предназначен для DOCX; старый binary `.doc` обычно не поддерживается.

Решение: убрать `.doc` или показывать отдельное сообщение «DOC не поддерживается, конвертируйте в DOCX».

#### P2 — web search citations слабые

Search pipeline собирает mostly snippets, но не сохраняет URL/title для HTML SERP. При этом synthesis prompt просит «Cite sources where possible».

Следствие: AI не сможет надёжно цитировать источники; ответ может выглядеть уверенным без проверяемых ссылок.

Решение: парсить result title + URL + snippet; хранить structured results; показывать ссылки в system message.

#### P2 — heavy models грузятся в main thread

Image captioning и ASR загружают BLIP/Whisper через `@xenova/transformers` в основном контексте страницы. Это может:

- надолго замораживать UI;
- конкурировать с уже существующим embedding worker;
- ломаться из-за CDN/CORS/adblock;
- увеличивать memory pressure.

Решение: выносить captioning/ASR в Worker, кешировать pipelines, давать cancel/progress и явные предупреждения о размерах моделей.

### 10.3. Средние замечания

- `__aeEnsureShortcutButtons` делает `return`, если `thread.shortcutButtons` отсутствует. Миграции и addThread обычно гарантируют массив, но defensive вариант лучше: `if (!thread.shortcutButtons) thread.shortcutButtons = []`.
- `__aeFeatureMap` в error message использует `.filter(function(k) { return __aeFeatureMap[k] === k || true; })`, где `|| true` делает filter бессмысленным.
- Search result dedup отсутствует; одинаковые snippets могут попадать несколько раз.
- File chunking по 300 слов не учитывает token budget, язык, overlap и semantic boundaries.
- Все settings глобальные на browser/localStorage, не per-thread/per-character.
- System messages hidden from AI — правильно для внутренних уведомлений, но для web search UX может быть неожиданно: персонаж не «видит» готовый web answer напрямую, только возможно найдёт raw search lore позже.

## 11. Security/privacy notes

Основное приложение уже содержит опасные по природе возможности:

- custom main-thread code через advanced settings / `eval(customPostPageLoadMainThreadCode)`;
- character custom code в sandbox iframe;
- `root.superFetch` прокси-запросы;
- dynamic imports с CDN/user.uploads.dev;
- импорт/экспорт IndexedDB.

Это ожидаемо для power-user Perchance AI chat, но важно:

- нельзя устанавливать чужой custom code без аудита;
- extension-модуль добавляет ещё больше внешних CDN-зависимостей;
- web search/file extraction может отправлять содержимое пользовательских файлов в локальную embedding модель, а затем в AI synthesis/search prompts — нужно явно описать privacy semantics пользователю;
- DuckDuckGo/API/superFetch могут раскрывать queries сторонним сервисам.

## 12. Рекомендованный план дальнейшей работы

### Немедленно

1. Исправить shortcut buttons: добавить `type: "message"`.
2. Запретить запись lore без embeddings или сделать re-embed fallback.
3. Уточнить поддержку `.doc`: оставить только `.docx`.
4. Добавить structured URL/title/snippet для web search.

### После этого

5. Вынести BLIP/Whisper в Worker.
6. Добавить progress/cancel для долгих file/audio/image операций.
7. Добавить тестовый чеклист в `modify/README.md`: `/file`, `/search`, `/toggle`, drag/drop, PDF, DOCX, image, audio, reload, export/import.
8. Добавить mini regression script, который после сборки:
   - проверяет byte identity original→reassembled;
   - проверяет output diff only expected insertion;
   - извлекает scripts и гоняет `node --check`.
9. Сгенерировать отдельную developer doc по extension API и по совместимости с оригинальными функциями.

## 13. Итоговая оценка

Репозиторий уже является хорошей «рабочей станцией» для безопасной модификации Perchance `ai-character-chat`: есть exact decomposition, reversible assembly, индексы функций/DOM/API и overlay-система.

Главный риск не в базовой архитектуре, а в новом extension-модуле. Он концептуально хорошо встроен, но имеет минимум две критичные проблемы перед практическим использованием: shortcut buttons без `type: "message"` и возможная запись lore без embeddings. После их исправления модуль станет значительно надёжнее.
