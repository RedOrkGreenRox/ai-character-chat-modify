# 15. Extension modules — current state

## Current module list

The extension overlay is now split into 12 build-time modules:

1. `030_extensions_core.frag`
2. `031_extensions_processors.frag`
3. `032_extensions_web_search.frag`
4. `033_extensions_controls_io.frag`
5. `034_extensions_voice.frag`
6. `035_extensions_shortcuts_commands_init.frag`
7. `036_extensions_file_explorer.frag`
8. `037_extensions_file_mentions.frag`
9. `038_extensions_base_policy.frag`
10. `039_extensions_deep_web_search.frag`
11. `040_extensions_image_analysis.frag`
12. `041_extensions_voice_profile.frag`

All modules are inserted after `html_028_module_reply_as_and_input_ux` via `modify/manifest.json`.

## Hook bus

`030_extensions_core.frag` provides:

```js
__aeRegisterBeforeBotReplyHook(name, fn)
```

Current hook users:

- `032_extensions_web_search.frag` — `autoWebSearch`
- `037_extensions_file_mentions.frag` — `fileMentions`
- `038_extensions_base_policy.frag` — `basePolicy`

Because hooks run in registration order and each module is loaded in manifest order, the effective context order is:

1. web search context;
2. file mention context;
3. base policy context closest to the latest user turn.

## File registry / Explorer

`030_extensions_core.frag` now stores an upload registry in `db.misc`:

```js
key: '__aeFileRegistry'
```

Each file record can contain:

- `id`
- `threadId`
- `name`
- `normalizedName`
- `kind`
- `metaText`
- `uploadedAt`
- `status`
- `contextMessageId`
- `contextActive`
- `contextCharCount`
- `preview`
- `fullText` for small files only

`036_extensions_file_explorer.frag` adds:

- `/files`
- `/explorer`
- `🗂️ Files` shortcut button

The explorer supports:

- refresh;
- current thread / all threads toggle;
- insert `@[filename]`;
- recall file context to AI;
- preview;
- forget.

## Mentions

`037_extensions_file_mentions.frag` supports:

```text
@[filename.ext]
```

Mention resolution:

1. exact normalized name match;
2. simple fuzzy contains match;
3. ambiguous/not-found notes are injected as file mention resolution notes.

Mention hook re-injects the relevant file context before the latest user message, so old uploaded files can be recalled after they fall out of the active file context buffer.

## Base Policy

`038_extensions_base_policy.frag` adds persistent per-chat policy settings.

Commands:

```text
/policy
/policy status
/language off
/language en
/language ru
/language es
/language pt
/language fr
/language de
/language id
/language pl
/language ja
/language zh
```

Supported presets:

- off
- English
- Russian
- Spanish
- Portuguese
- French
- German
- Indonesian
- Polish
- Japanese
- Chinese

Policy is stored in:

```js
thread.customData.__aeBasePolicy
```

The policy hook injects a high-priority system context before every bot reply. This is per-chat persistent behavior rather than a one-shot message command.

## File context buffer

Core constants:

```js
const __AE_FILE_CONTEXT_BUFFER_CHARS = 60000;
const __AE_CONTEXT_PREVIEW_CHARS = 12000;
```

Uploaded files create hidden-from-user, visible-to-AI context messages. The registry tracks their approximate char count. If total active file context for the thread exceeds the buffer, oldest contexts are marked hidden from AI (`hiddenFrom` includes both `user` and `ai`).

A `@[filename]` mention can reactivate/re-inject context.

## Embedded images in documents

`031_extensions_processors.frag` now attempts image extraction:

- DOCX/XLSX/ODS/ZIP-like documents: scan archive entries for image extensions and process them as normal images.
- PDF: render the first few pages as PNG images and process them as image captions.

Limits:

```js
const __AE_MAX_EMBEDDED_IMAGES = 10;
const __AE_MAX_PDF_IMAGE_PAGES = 3;
```

Image extraction stops when file context buffer is full.

## Validation

Last verified:

- `python tools/assemble_modified.py`
- `python tools/verify_exact_components.py`
- all extracted final HTML script blocks checked with `node --check`

Last output hash:

```text
output/ai-character-chat-html.txt
e45284dfdeec1054463fd6a2da88311870547402e84cc3b729a1b3604aca3b1c
```

## Latest stability fixes

- Transient hook-injected messages now receive synthetic negative IDs via `__aeCreateTransientMessageObj(...)`. This prevents the original reply pipeline from throwing `Message ID is undefined` when web-search/file-mention/base-policy contexts are injected only into prompt-time `opts.messages`.
- A visible processing task panel is shown while files are being processed. It includes a **cancel all** button.
- Processing can be cancelled globally via `__aeAbortAllProcessing(...)`; file loops check `__aeAssertNotCancelled()` between heavy steps.
- Very large files only index the first `__AE_MAX_LORE_CHUNKS_PER_FILE` lore chunks to avoid freezing the page.
- Image captioning now normalizes images through canvas when possible and hides low-level model errors like `offset is out of bounds` behind a clean metadata fallback.

## Unified menu

The old set of extension shortcut buttons has been collapsed into one shortcut:

```text
🧩 Menu
```

It opens a floating menu with toggles for file/PDF/DOCX/Excel/ZIP/image/audio/web/deep-search/advanced-image/voice-profile features, plus actions for file picker, file explorer, voice recording, base policy, status, cancellation, and manual search.

## Additional modules

### `039_extensions_deep_web_search.frag`

Adds deep search:

- `/search deep <query>`
- `/toggle deepsearch`

Deep search fetches top result pages through `root.superFetch`, extracts readable text, scores chunks by query terms, and synthesizes an answer using fetched excerpts rather than only snippets.

### `040_extensions_image_analysis.frag`

Optional advanced image analysis:

- `/toggle imageanalysis`
- caption + object detection + OCR attempt

This is disabled by default because models are heavier.

### `041_extensions_voice_profile.frag`

Optional voice acoustic profile:

- `/toggle voiceprofile`
- duration, loudness, approximate pitch, pace, tone hints

It avoids hard identity claims and states that age/gender are not reliably inferred.
