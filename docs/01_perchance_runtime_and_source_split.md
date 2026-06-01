# 01. Perchance runtime и разделение исходников

## Базовая картина
В этом проекте есть два главных исходника:

- `original/ai-character-chat-list.txt`
- `original/ai-character-chat-html.txt`

Они соответствуют двум разным слоям исполнения Perchance.

## Слой 1 — lists / Perchance syntax
Файл: `original/ai-character-chat-list.txt`

Здесь находятся:
- импорты плагинов Perchance;
- функции/хелперы, доступные потом как `root.*`;
- `$meta.dynamic`;
- URL/share-link логика;
- list-side логика summaries/memories;
- комментарии/конфиг для channels/comments.

### Ключевые импорты
Линии 1-10:
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

### Ключевые list-side функции
- `generateShareLinkForCharacter` — lines 21-59
- `compressBlobWithGzip` — lines 60-65
- `loadDataFromUrlThatReferencesCloudStorageFile` — lines 66-112
- `decompressBlobWithGzip` — lines 113-117
- `evaluatePerchanceTextInSandbox` — lines 118-156
- `getMessageObjsWithoutSummarizedOnes` — lines 222-242
- `injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded` — lines 243-648
- `confirmAsync` — lines 649-673

## Слой 2 — HTML app / SPA-like client
Файл: `original/ai-character-chat-html.txt`

Это уже полноценное приложение с:
- DOM-разметкой;
- CSS-темой;
- Dexie/IndexedDB;
- чат-логикой;
- импорт/экспортом;
- sandboxed custom-code iframe;
- мостом `oc.*`.

## Связь между слоями
HTML-слой использует list-side runtime как `root.*`.

Самые важные вызовы:
- `root.loadDependencies()` — line 254
- `root.aiTextPlugin(...)` — используется в генерации текста/summary/memory/query/URL-char generation
- `root.textToImagePlugin(...)` — встраивание генерации изображений в сообщения
- `root.generateShareLinkForCharacter(...)` — share-link flow
- `root.loadDataFromUrlThatReferencesCloudStorageFile()` — загрузка chars из URL
- `root.injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded(...)` — list-side summarization engine

## Практический вывод для дальнейшей модульной декомпозиции

### Что считать «ядром Perchance»
- всё из `ai-character-chat-list.txt`
- всё, что зовётся через `root.*`

### Что считать «приложением»
- весь `ai-character-chat-html.txt`
- DOM/CSS/JS/Dexie/custom-code bridge

### Что считать «внутренним API этого приложения»
- `oc.*`
- `window.$`, `window.$$`
- `window.db`
- `messagesToCustomCodeFormat` / `messagesFromCustomCodeFormat`
- `getDataForCustomCode` / `updateDbWithNewDataFromCustomCode`

## Exact-fragment view
Сейчас каноническое exact-разбиение такое:
- HTML: 29 фрагментов
- LIST: 9 фрагментов

См.:
- `analysis/exact_component_manifest.json`
- `analysis/component_map.md`
