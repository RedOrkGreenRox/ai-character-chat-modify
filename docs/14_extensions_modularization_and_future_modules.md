# 14. Extensions modularization and future module design

Этот документ описывает текущее разбиение `modify/new` и план для следующих модулей: **Проводник**, **Упоминание**, **Базовая установка**.

## 1. Текущее разбиение extension-модуля

Бывший монолит `030_extensions.frag` разделён на ordered build-time modules. Все они вставляются после `html_028_module_reply_as_and_input_ux` в порядке, заданном `modify/manifest.json`.

### `030_extensions_core.frag`

Назначение:

- constants / defaults;
- settings helpers;
- CDN loaders;
- text chunking;
- lore writing;
- toast notifications;
- system messages;
- AI-visible hidden context messages;
- shared upload context helpers;
- hook bus for reply-time modules.

Ключевая новая точка расширения:

```js
__aeRegisterBeforeBotReplyHook(name, fn)
```

Она позволяет будущим модулям модифицировать `getBotReply(opts)` без прямого повторного wrapping `getBotReply`. Hook получает `opts` и может вернуть modified `opts`.

### `031_extensions_processors.frag`

Назначение:

- text files;
- PDF;
- DOCX;
- images;
- audio transcription;
- spreadsheets: xlsx/xls/ods;
- ZIP archives;
- unified `__aeProcessFile(file, opts)` router.

### `032_extensions_web_search.frag`

Назначение:

- decide whether web search is needed;
- generate search queries;
- DuckDuckGo API/HTML search;
- synthesize search answer;
- manual `/search`;
- auto-search hook via `__aeRegisterBeforeBotReplyHook('autoWebSearch', ...)`.

### `033_extensions_controls_io.frag`

Назначение:

- feature map;
- `/toggle`;
- `/extensions` status;
- hidden file input;
- drag & drop;
- paste file handling.

### `034_extensions_voice.frag`

Назначение:

- Telegram-like voice recording;
- `/voice` command support backend;
- MediaRecorder lifecycle;
- handoff to audio transcription.

### `035_extensions_shortcuts_commands_init.frag`

Назначение:

- shortcut buttons;
- command interception;
- sendButtonClickHandler wrapper for shortcut-originated commands;
- showThread wrapper for button injection;
- input tooltip;
- button styling;
- module initialization.

## 2. Важное ограничение текущей модульности

Это **build-time modular overlay**, не runtime ES-module architecture.

В Perchance на выходе всё равно получается один HTML panel. Модули существуют в репозитории и сборщике, но runtime — общий `<script type="module">` scope.

Это нормально для Perchance. Главное правило: новые модули должны минимально monkey-patch'ить core app и, по возможности, использовать hook bus.

## 3. Future module: Проводник

### Цель

Дать пользователю UI, где он видит загруженные файлы текущего/всех тредов:

- имя файла;
- тип;
- размер;
- дата загрузки;
- статус обработки;
- краткий preview;
- кнопки: вставить упоминание, показать preview, удалить запись, повторно проиндексировать.

### Предлагаемый файл

```text
modify/new/036_extensions_file_explorer.frag
```

### Storage strategy

Не менять Dexie schema, чтобы не трогать `dbVersion`. Использовать `db.misc`:

```js
key: '__aeFileRegistry'
value: {
  version: 1,
  files: [
    {
      id: 'ae_file_<timestamp>_<random>',
      threadId,
      name,
      normalizedName,
      type,
      ext,
      size,
      uploadedAt,
      source: 'drop' | 'paste' | 'picker' | 'archive' | 'voice',
      status: 'ok' | 'partial' | 'failed',
      error: null,
      contextMessageId,
      preview,
      wordCount,
      pageCount,
      sheetCount,
      archiveParentId
    }
  ]
}
```

### Needed changes in existing modules

`030_extensions_core.frag` / processor helpers should expose:

```js
__aeRegisterUploadedFile(meta)
__aeUpdateUploadedFile(id, patch)
__aeGetUploadedFiles({threadId, includeGlobal})
```

`__aeAddAiContextMessage` should return the created message id:

```js
let id = await addMessageToDb(...);
return id;
```

Then processors can register files after extraction.

### UI options

Minimal implementation:

- add `/files` command;
- open `prompt2` modal or `createFloatingWindow`;
- list files for active thread;
- buttons per file:
  - `Insert @[...]` into message input;
  - `Preview`;
  - `Forget`.

Better implementation:

- add shortcut button `🗂️ Files`;
- add search/filter inside modal;
- show archive tree.

### Risks

- `db.misc` can grow large if previews/full text are stored there. Store only preview + contextMessageId, not full file content.
- Deleting a file record should not necessarily delete lore/messages unless explicitly requested.

## 4. Future module: Упоминание

### Цель

Позволить пользователю написать:

```text
@[имя файла]
```

или выбрать файл из Проводника, чтобы персонаж явно получил контекст соответствующего файла.

### Предлагаемый файл

```text
modify/new/037_extensions_file_mentions.frag
```

### Syntax

Recommended strict syntax:

```text
@[filename.ext]
```

Почему не просто `@filename`: в текущем AI Character Chat уже есть команды/паттерны с `@CharacterName#id`, особенно `/ai @Char#123`. Чтобы не ломать существующий UX, лучше распознавать только bracket syntax.

### Matching

- exact match by `name`;
- case-insensitive match by `normalizedName`;
- optional fuzzy match if exactly one close candidate;
- if multiple candidates: show clarification/modal or system message with candidates.

### Injection strategy

Use hook bus:

```js
__aeRegisterBeforeBotReplyHook('fileMentions', async function(opts) {
  // find latest user message
  // parse @[...] mentions
  // lookup file registry
  // fetch contextMessageId / preview
  // inject hidden system context before latest user message
  return modifiedOpts;
});
```

### Important point

Even though uploads now create AI-visible context messages, old context can fall out of context window after long chats. Mention module should re-inject the relevant file context near the latest message.

### UX

When mention is resolved:

- toast: `📎 Attached context: filename.ext`;
- optionally add hidden-from-ai? No, probably no visible chat message needed.

When not resolved:

- add system message hidden from AI or visible to user:
  - `File not found: ...`
  - show nearest candidates.

## 5. Future module: Базовая установка

### Цель

Система жёстких предустановок для модели, отдельно от upload/search. Например:

- language policy;
- no mixed language;
- answer style;
- citations requirement;
- concise/verbose mode;
- roleplay constraints.

### Предлагаемый файл

```text
modify/new/038_extensions_base_policy.frag
```

### Storage strategy

Use `db.misc` or `localStorage`.

Recommended hybrid:

- global defaults in `localStorage.__aePolicy`;
- per-thread overrides in `db.misc` or `thread.customData.__aePolicy` if safe.

Example:

```js
{
  version: 1,
  enabled: true,
  language: {
    mode: 'off' | 'auto' | 'ru' | 'en' | 'custom',
    customInstruction: ''
  },
  style: {
    mode: 'default' | 'concise' | 'detailed' | 'roleplay'
  },
  strength: 'normal' | 'strong' | 'extreme'
}
```

### Injection strategy

Use hook bus and inject hidden system message before latest user message:

```js
__aeRegisterBeforeBotReplyHook('basePolicy', async function(opts) {
  let policyText = __aeBuildPolicyPrompt(policy);
  if (!policyText) return opts;
  // insert system message before latest user message
  return modifiedOpts;
});
```

### Language policy design

Since language forcing mixed into search/upload did not fully solve mixed-language roleplay, it should be isolated here.

Possible prompt tiers:

#### Normal

```text
Language policy: Answer in Russian when the user's latest message is in Russian. Do not switch to English unless the user asks for English.
```

#### Strong

```text
LANGUAGE OVERRIDE: The latest user message is in Russian. Your entire next visible answer must be in Russian. Do not use English narration, English action tags, English filler, or English stage directions. Translate all roleplay actions into Russian. If a phrase naturally comes to you in English, rewrite it in Russian before outputting.
```

#### Extreme

Add a self-check instruction:

```text
Before finalizing, silently scan your answer for English words or phrases. If any are present and are not proper nouns or code/API terms, rewrite them in Russian. Output only the corrected Russian answer.
```

### Optional post-processing

The module could detect mixed-language output after generation, but the current architecture streams text. Post-processing streamed output is harder. Better first approach: strong prompt injection.

If later needed:

- disable streaming for policy-constrained replies, or
- intercept final message after generation and ask model to rewrite.

### UX commands

Possible commands:

```text
/policy
/policy on
/policy off
/language ru
/language auto
/language off
/language custom <instruction>
```

Also possible shortcut button:

```text
🧭 Policy
```

## 6. Recommended implementation order

1. **Проводник** — because it creates registry foundation.
2. **Упоминание** — depends on registry from Проводник.
3. **Базовая установка** — independent, but should use hook bus and should be loaded after web search/file mention hooks if it needs highest priority.

Recommended manifest order after current modules:

```json
"036_extensions_file_explorer.frag"
"037_extensions_file_mentions.frag"
"038_extensions_base_policy.frag"
```

If multiple hooks inject system messages, insertion order matters. Suggested order:

1. auto web search context;
2. file mention context;
3. base policy context closest to the latest user message.

So `basePolicy` should be registered after search/mentions, or hook bus should support priority later.

## 7. Possible hook-bus improvement

Current hook bus is ordered by registration order. If future modules grow, add priority:

```js
__aeRegisterBeforeBotReplyHook(name, fn, { priority: 100 })
```

Then sort before execution. Suggested priorities:

- web search: 100;
- file mentions: 200;
- base policy: 900.

Base policy should run last so its instruction is closest to the latest user message.
