# Exact component map

> **Status note (2026-06-03):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

Ниже — каноническое разбиение `original/ai-character-chat-html.txt` и `original/ai-character-chat-list.txt` на непересекающиеся точные фрагменты. Каждый фрагмент извлечён verbatim и может быть обратно собран без изменения байтов.

## Канонические источники

- `original/ai-character-chat-html.txt` → `reassembled/ai-character-chat-html.txt`
- `original/ai-character-chat-list.txt` → `reassembled/ai-character-chat-list.txt`

## Компоненты в порядке сборки

### ai-character-chat-html

- `analysis/exact_components/ai-character-chat-html/001_header_loading_shell.frag` — lines 1-19; tags: `structure-dom`, `entrypoint`, `loading`, `shell`  
  License header, page bootstrap globals, initial loading modal, emergency export container markup.
- `analysis/exact_components/ai-character-chat-html/002_emergency_export_script.frag` — lines 20-231; tags: `business-logic`, `db`, `recovery`, `entrypoint`  
  Emergency export/delete IndexedDB recovery flow and raw DB export helpers.
- `analysis/exact_components/ai-character-chat-html/003_dependency_bootstrap.frag` — lines 232-258; tags: `entrypoint`, `dependencies`  
  Dependency comments, external bundle notes, loadDependencies bootstrap.
- `analysis/exact_components/ai-character-chat-html/004_utility_foundations.frag` — lines 259-392; tags: `api`, `$-proxy`, `utilities`, `floating-window`  
  Core helpers: countTokens aliases, $/$$ DOM proxy, show/hide, delay, floating window.
- `analysis/exact_components/ai-character-chat-html/005_utility_formatting_io.frag` — lines 393-521; tags: `utilities`, `text`, `download`, `modal`  
  sanitizeHtml, text-to-speech, sha256, dedent, downloadTextOrBlob, cosineDistance, createLoadingModal.
- `analysis/exact_components/ai-character-chat-html/006_utility_background_and_json.frag` — lines 522-745; tags: `utilities`, `background`, `json`, `stylesheet`  
  Object override helpers, background media manager, stylesheet import, htmlToElement, jsonToBlob.
- `analysis/exact_components/ai-character-chat-html/007_utility_editor_prompt_modal.frag` — lines 746-1175; tags: `ui`, `modal`, `editor`, `messageInput`  
  CodeMirror loader, data-URL upload helper, prompt2 modal system and form controls.
- `analysis/exact_components/ai-character-chat-html/008_after_bundle_log.frag` — lines 1176-1179; tags: `entrypoint`, `logging`  
  Post-bundle load timing log.
- `analysis/exact_components/ai-character-chat-html/009_global_styles_themes.frag` — lines 1180-1740; tags: `styles`, `theme`, `css-variables`, `dark-light`  
  Global CSS variables, dark/light theme values, thread/message/feed styling, scrollbar rules, layout CSS.
- `analysis/exact_components/ai-character-chat-html/010_app_shell_dom.frag` — lines 1741-1993; tags: `structure-dom`, `chat-feed`, `modals`, `messageInput`, `buttons`  
  Top notification, three-column app shell, thread sidebar, character selection, chat interface, options popup, right column DOM.
- `analysis/exact_components/ai-character-chat-html/011_module_bootstrap_core.frag` — lines 1994-2108; tags: `entrypoint`, `business-logic`, `db`, `api`  
  Main module start, clear-data button, avatar toggle, platform guards, JSON5 lazy load, image helpers bootstrap.
- `analysis/exact_components/ai-character-chat-html/012_module_generate_character_from_url.frag` — lines 2109-2594; tags: `business-logic`, `character-import`, `network`, `entrypoint`  
  URL-based character generation/import pipeline and browser storage persistence helper.
- `analysis/exact_components/ai-character-chat-html/013_module_sanitization_markdown_scaffolding.frag` — lines 2595-2756; tags: `business-logic`, `rendering`, `markdown`, `sanitization`  
  DOMPurify hooks, marked renderer, global error handler, resize observer, prompt defaults, debug window bootstrap.
- `analysis/exact_components/ai-character-chat-html/014_module_layout_navigation.frag` — lines 2757-2889; tags: `structure-dom`, `navigation`, `mobile`, `entrypoint`  
  Left-column open/close behavior, header bar visibility, mobile right-column toggle logic.
- `analysis/exact_components/ai-character-chat-html/015_module_db_bootstrap_upgrades.frag` — lines 2890-3339; tags: `db`, `entrypoint`, `migration`, `business-logic`  
  Dexie bootstrap, schema version 90, upgrades for characters/threads/messages/memories/lore.
- `analysis/exact_components/ai-character-chat-html/016_module_export_handler.frag` — lines 3340-3483; tags: `business-logic`, `db`, `export`  
  Export modal, filtering logic, lore/memory/export pruning and compressed export output.
- `analysis/exact_components/ai-character-chat-html/017_module_thread_list_and_thread_export.frag` — lines 3484-4001; tags: `structure-dom`, `thread-list`, `business-logic`, `export`  
  Thread list rendering, search/folders/favorites, duplicate/export/delete thread interactions, thread JSON export.
- `analysis/exact_components/ai-character-chat-html/018_module_message_feed_and_scene.frag` — lines 4002-4444; tags: `structure-dom`, `chat-feed`, `business-logic`, `scene`  
  Message feed rendering, lazy prepend, scene background/music, inline reminder rendering.
- `analysis/exact_components/ai-character-chat-html/019_module_character_catalog_and_crud.frag` — lines 4445-5290; tags: `structure-dom`, `character-list`, `business-logic`, `entrypoint`  
  Character cards, starter/example characters, character list rendering, character/thread deletion helpers.
- `analysis/exact_components/ai-character-chat-html/020_module_thread_entry_shortcuts_character_prompt.frag` — lines 5291-6312; tags: `entrypoint`, `thread`, `shortcuts`, `messageInput`, `api`  
  Thread creation/show flow, shortcut parser/renderer, character editor modal, message text parsing, addCharacter/createMessageObj entry utilities.
- `analysis/exact_components/ai-character-chat-html/021_module_message_models_lore_embeddings.frag` — lines 6313-6724; tags: `business-logic`, `lore`, `memory`, `db`  
  DB message/thread insertion, lore loading, token counting, local embedding loader/bootstrap.
- `analysis/exact_components/ai-character-chat-html/022_module_prepare_messages_and_custom_code_format.frag` — lines 6725-7155; tags: `business-logic`, `api`, `oc`, `rendering`  
  prepareMessagesForBot, reader rendering pipeline, character name/avatar resolvers, custom-code message format bridge.
- `analysis/exact_components/ai-character-chat-html/023_module_reply_generation_pipeline.frag` — lines 7156-8235; tags: `business-logic`, `memory`, `lore`, `reply-generation`, `entrypoint`  
  Core bot reply construction: role instructions, reminders, summaries, memories/lore retrieval, AI completion helpers.
- `analysis/exact_components/ai-character-chat-html/024_module_streaming_regen_message_controls.frag` — lines 8236-9008; tags: `business-logic`, `streaming`, `chat-feed`, `regeneration`  
  Streaming reply orchestration, regenerate flow, typing indicator, addMessageToFeed, swipe/variant controls.
- `analysis/exact_components/ai-character-chat-html/025_module_message_render_edit_delete_user_system_chars.frag` — lines 9009-9749; tags: `structure-dom`, `chat-feed`, `business-logic`, `styles`  
  Message element creation, image tag rendering, inline edit/delete handlers, user/system character resolvers.
- `analysis/exact_components/ai-character-chat-html/026_module_send_button_commands.frag` — lines 9750-10525; tags: `messageInput`, `business-logic`, `commands`, `api`  
  sendButtonClickHandler, slash commands (/ai,/user,/sys,/sum,/mem,/lore,/image...), queue helper, custom-code-visible character property map preface.
- `analysis/exact_components/ai-character-chat-html/027_module_custom_code_iframe_api.frag` — lines 10526-11797; tags: `api`, `oc`, `custom-code`, `db`, `entrypoint`  
  Custom-code iframe creation, oc/thread API surface, postMessage bridge, sync plumbing, DB update reconciliation.
- `analysis/exact_components/ai-character-chat-html/028_module_reply_as_and_input_ux.frag` — lines 11798-12473; tags: `messageInput`, `structure-dom`, `options`, `ui`  
  Reply-as flows, thread options, message input resizing/history, settings modal, UI bindings.
- `analysis/exact_components/ai-character-chat-html/029_module_import_hash_startup.frag` — lines 12474-13619; tags: `entrypoint`, `import`, `share-links`, `startup`, `db`  
  Character hashing, import pipelines, external character formats, hash/share-link bootstrap, initial screen startup.

### ai-character-chat-list

- `analysis/exact_components/ai-character-chat-list/001_imports_and_notes.frag` — lines 1-20; tags: `entrypoint`, `imports`, `perchance`  
  Top-level Perchance imports and author notes.
- `analysis/exact_components/ai-character-chat-list/002_share_link_generation.frag` — lines 21-65; tags: `business-logic`, `share-links`, `upload`  
  Share-link generation and gzip compression helper.
- `analysis/exact_components/ai-character-chat-list/003_url_loading_and_sandbox.frag` — lines 66-156; tags: `business-logic`, `share-links`, `sandbox`, `entrypoint`  
  Load shared character data from URL/cloud storage and sandboxed Perchance text evaluation.
- `analysis/exact_components/ai-character-chat-list/004_named_characters_and_meta.frag` — lines 157-221; tags: `entrypoint`, `meta`, `share-links`  
  Named URL characters and $meta.dynamic metadata generation.
- `analysis/exact_components/ai-character-chat-list/005_summary_selection_helper.frag` — lines 222-242; tags: `business-logic`, `memory`, `summaries`  
  Helper that filters summarized vs unsummarized message objects.
- `analysis/exact_components/ai-character-chat-list/006_summary_injection_and_budget.frag` — lines 243-474; tags: `business-logic`, `summaries`, `memory`, `db`  
  Summary injection back into DB, context-budget computation, prep for hierarchical summarization.
- `analysis/exact_components/ai-character-chat-list/007_summary_generation_and_memories.frag` — lines 475-648; tags: `business-logic`, `summaries`, `memories`, `ai-text-plugin`  
  Hierarchical summary generation, memory extraction, debug logging, and background summary queueing.
- `analysis/exact_components/ai-character-chat-list/008_confirm_async.frag` — lines 649-673; tags: `ui`, `modal`, `helpers`  
  confirmAsync modal helper.
- `analysis/exact_components/ai-character-chat-list/009_comment_channels_defaults.frag` — lines 674-691; tags: `structure-dom`, `comments`, `entrypoint`  
  Comment channel list and default comment plugin options.

## Структура DOM

- `html_001_header_loading_shell` (`ai-character-chat-html` 1-19) — License header, page bootstrap globals, initial loading modal, emergency export container markup.
- `html_010_app_shell_dom` (`ai-character-chat-html` 1741-1993) — Top notification, three-column app shell, thread sidebar, character selection, chat interface, options popup, right column DOM.
- `html_014_module_layout_navigation` (`ai-character-chat-html` 2757-2889) — Left-column open/close behavior, header bar visibility, mobile right-column toggle logic.
- `html_017_module_thread_list_and_thread_export` (`ai-character-chat-html` 3484-4001) — Thread list rendering, search/folders/favorites, duplicate/export/delete thread interactions, thread JSON export.
- `html_018_module_message_feed_and_scene` (`ai-character-chat-html` 4002-4444) — Message feed rendering, lazy prepend, scene background/music, inline reminder rendering.
- `html_019_module_character_catalog_and_crud` (`ai-character-chat-html` 4445-5290) — Character cards, starter/example characters, character list rendering, character/thread deletion helpers.
- `html_025_module_message_render_edit_delete_user_system_chars` (`ai-character-chat-html` 9009-9749) — Message element creation, image tag rendering, inline edit/delete handlers, user/system character resolvers.
- `html_028_module_reply_as_and_input_ux` (`ai-character-chat-html` 11798-12473) — Reply-as flows, thread options, message input resizing/history, settings modal, UI bindings.
- `list_009_comment_channels_defaults` (`ai-character-chat-list` 674-691) — Comment channel list and default comment plugin options.

## Бизнес-логика

- `html_002_emergency_export_script` (`ai-character-chat-html` 20-231) — Emergency export/delete IndexedDB recovery flow and raw DB export helpers.
- `html_011_module_bootstrap_core` (`ai-character-chat-html` 1994-2108) — Main module start, clear-data button, avatar toggle, platform guards, JSON5 lazy load, image helpers bootstrap.
- `html_012_module_generate_character_from_url` (`ai-character-chat-html` 2109-2594) — URL-based character generation/import pipeline and browser storage persistence helper.
- `html_013_module_sanitization_markdown_scaffolding` (`ai-character-chat-html` 2595-2756) — DOMPurify hooks, marked renderer, global error handler, resize observer, prompt defaults, debug window bootstrap.
- `html_015_module_db_bootstrap_upgrades` (`ai-character-chat-html` 2890-3339) — Dexie bootstrap, schema version 90, upgrades for characters/threads/messages/memories/lore.
- `html_016_module_export_handler` (`ai-character-chat-html` 3340-3483) — Export modal, filtering logic, lore/memory/export pruning and compressed export output.
- `html_017_module_thread_list_and_thread_export` (`ai-character-chat-html` 3484-4001) — Thread list rendering, search/folders/favorites, duplicate/export/delete thread interactions, thread JSON export.
- `html_018_module_message_feed_and_scene` (`ai-character-chat-html` 4002-4444) — Message feed rendering, lazy prepend, scene background/music, inline reminder rendering.
- `html_019_module_character_catalog_and_crud` (`ai-character-chat-html` 4445-5290) — Character cards, starter/example characters, character list rendering, character/thread deletion helpers.
- `html_021_module_message_models_lore_embeddings` (`ai-character-chat-html` 6313-6724) — DB message/thread insertion, lore loading, token counting, local embedding loader/bootstrap.
- `html_022_module_prepare_messages_and_custom_code_format` (`ai-character-chat-html` 6725-7155) — prepareMessagesForBot, reader rendering pipeline, character name/avatar resolvers, custom-code message format bridge.
- `html_023_module_reply_generation_pipeline` (`ai-character-chat-html` 7156-8235) — Core bot reply construction: role instructions, reminders, summaries, memories/lore retrieval, AI completion helpers.
- `html_024_module_streaming_regen_message_controls` (`ai-character-chat-html` 8236-9008) — Streaming reply orchestration, regenerate flow, typing indicator, addMessageToFeed, swipe/variant controls.
- `html_025_module_message_render_edit_delete_user_system_chars` (`ai-character-chat-html` 9009-9749) — Message element creation, image tag rendering, inline edit/delete handlers, user/system character resolvers.
- `html_026_module_send_button_commands` (`ai-character-chat-html` 9750-10525) — sendButtonClickHandler, slash commands (/ai,/user,/sys,/sum,/mem,/lore,/image...), queue helper, custom-code-visible character property map preface.
- `list_002_share_link_generation` (`ai-character-chat-list` 21-65) — Share-link generation and gzip compression helper.
- `list_003_url_loading_and_sandbox` (`ai-character-chat-list` 66-156) — Load shared character data from URL/cloud storage and sandboxed Perchance text evaluation.
- `list_005_summary_selection_helper` (`ai-character-chat-list` 222-242) — Helper that filters summarized vs unsummarized message objects.
- `list_006_summary_injection_and_budget` (`ai-character-chat-list` 243-474) — Summary injection back into DB, context-budget computation, prep for hierarchical summarization.
- `list_007_summary_generation_and_memories` (`ai-character-chat-list` 475-648) — Hierarchical summary generation, memory extraction, debug logging, and background summary queueing.

## API / oc.* / db.* / $.*

- `html_004_utility_foundations` (`ai-character-chat-html` 259-392) — Core helpers: countTokens aliases, $/$$ DOM proxy, show/hide, delay, floating window.
- `html_011_module_bootstrap_core` (`ai-character-chat-html` 1994-2108) — Main module start, clear-data button, avatar toggle, platform guards, JSON5 lazy load, image helpers bootstrap.
- `html_020_module_thread_entry_shortcuts_character_prompt` (`ai-character-chat-html` 5291-6312) — Thread creation/show flow, shortcut parser/renderer, character editor modal, message text parsing, addCharacter/createMessageObj entry utilities.
- `html_022_module_prepare_messages_and_custom_code_format` (`ai-character-chat-html` 6725-7155) — prepareMessagesForBot, reader rendering pipeline, character name/avatar resolvers, custom-code message format bridge.
- `html_026_module_send_button_commands` (`ai-character-chat-html` 9750-10525) — sendButtonClickHandler, slash commands (/ai,/user,/sys,/sum,/mem,/lore,/image...), queue helper, custom-code-visible character property map preface.
- `html_027_module_custom_code_iframe_api` (`ai-character-chat-html` 10526-11797) — Custom-code iframe creation, oc/thread API surface, postMessage bridge, sync plumbing, DB update reconciliation.

## API / $.messageInput и send-flow

- `html_007_utility_editor_prompt_modal` (`ai-character-chat-html` 746-1175) — CodeMirror loader, data-URL upload helper, prompt2 modal system and form controls.
- `html_010_app_shell_dom` (`ai-character-chat-html` 1741-1993) — Top notification, three-column app shell, thread sidebar, character selection, chat interface, options popup, right column DOM.
- `html_020_module_thread_entry_shortcuts_character_prompt` (`ai-character-chat-html` 5291-6312) — Thread creation/show flow, shortcut parser/renderer, character editor modal, message text parsing, addCharacter/createMessageObj entry utilities.
- `html_026_module_send_button_commands` (`ai-character-chat-html` 9750-10525) — sendButtonClickHandler, slash commands (/ai,/user,/sys,/sum,/mem,/lore,/image...), queue helper, custom-code-visible character property map preface.
- `html_028_module_reply_as_and_input_ux` (`ai-character-chat-html` 11798-12473) — Reply-as flows, thread options, message input resizing/history, settings modal, UI bindings.

## Стили / тема / CSS-переменные

- `html_009_global_styles_themes` (`ai-character-chat-html` 1180-1740) — Global CSS variables, dark/light theme values, thread/message/feed styling, scrollbar rules, layout CSS.
- `html_025_module_message_render_edit_delete_user_system_chars` (`ai-character-chat-html` 9009-9749) — Message element creation, image tag rendering, inline edit/delete handlers, user/system character resolvers.

## Точки входа / bootstrap

- `html_001_header_loading_shell` (`ai-character-chat-html` 1-19) — License header, page bootstrap globals, initial loading modal, emergency export container markup.
- `html_002_emergency_export_script` (`ai-character-chat-html` 20-231) — Emergency export/delete IndexedDB recovery flow and raw DB export helpers.
- `html_003_dependency_bootstrap` (`ai-character-chat-html` 232-258) — Dependency comments, external bundle notes, loadDependencies bootstrap.
- `html_008_after_bundle_log` (`ai-character-chat-html` 1176-1179) — Post-bundle load timing log.
- `html_011_module_bootstrap_core` (`ai-character-chat-html` 1994-2108) — Main module start, clear-data button, avatar toggle, platform guards, JSON5 lazy load, image helpers bootstrap.
- `html_012_module_generate_character_from_url` (`ai-character-chat-html` 2109-2594) — URL-based character generation/import pipeline and browser storage persistence helper.
- `html_014_module_layout_navigation` (`ai-character-chat-html` 2757-2889) — Left-column open/close behavior, header bar visibility, mobile right-column toggle logic.
- `html_015_module_db_bootstrap_upgrades` (`ai-character-chat-html` 2890-3339) — Dexie bootstrap, schema version 90, upgrades for characters/threads/messages/memories/lore.
- `html_019_module_character_catalog_and_crud` (`ai-character-chat-html` 4445-5290) — Character cards, starter/example characters, character list rendering, character/thread deletion helpers.
- `html_020_module_thread_entry_shortcuts_character_prompt` (`ai-character-chat-html` 5291-6312) — Thread creation/show flow, shortcut parser/renderer, character editor modal, message text parsing, addCharacter/createMessageObj entry utilities.
- `html_023_module_reply_generation_pipeline` (`ai-character-chat-html` 7156-8235) — Core bot reply construction: role instructions, reminders, summaries, memories/lore retrieval, AI completion helpers.
- `html_027_module_custom_code_iframe_api` (`ai-character-chat-html` 10526-11797) — Custom-code iframe creation, oc/thread API surface, postMessage bridge, sync plumbing, DB update reconciliation.
- `html_029_module_import_hash_startup` (`ai-character-chat-html` 12474-13619) — Character hashing, import pipelines, external character formats, hash/share-link bootstrap, initial screen startup.
- `list_001_imports_and_notes` (`ai-character-chat-list` 1-20) — Top-level Perchance imports and author notes.
- `list_003_url_loading_and_sandbox` (`ai-character-chat-list` 66-156) — Load shared character data from URL/cloud storage and sandboxed Perchance text evaluation.
- `list_004_named_characters_and_meta` (`ai-character-chat-list` 157-221) — Named URL characters and $meta.dynamic metadata generation.
- `list_009_comment_channels_defaults` (`ai-character-chat-list` 674-691) — Comment channel list and default comment plugin options.

## Dexie / IndexedDB

- `html_002_emergency_export_script` (`ai-character-chat-html` 20-231) — Emergency export/delete IndexedDB recovery flow and raw DB export helpers.
- `html_011_module_bootstrap_core` (`ai-character-chat-html` 1994-2108) — Main module start, clear-data button, avatar toggle, platform guards, JSON5 lazy load, image helpers bootstrap.
- `html_015_module_db_bootstrap_upgrades` (`ai-character-chat-html` 2890-3339) — Dexie bootstrap, schema version 90, upgrades for characters/threads/messages/memories/lore.
- `html_016_module_export_handler` (`ai-character-chat-html` 3340-3483) — Export modal, filtering logic, lore/memory/export pruning and compressed export output.
- `html_021_module_message_models_lore_embeddings` (`ai-character-chat-html` 6313-6724) — DB message/thread insertion, lore loading, token counting, local embedding loader/bootstrap.
- `html_027_module_custom_code_iframe_api` (`ai-character-chat-html` 10526-11797) — Custom-code iframe creation, oc/thread API surface, postMessage bridge, sync plumbing, DB update reconciliation.
- `html_029_module_import_hash_startup` (`ai-character-chat-html` 12474-13619) — Character hashing, import pipelines, external character formats, hash/share-link bootstrap, initial screen startup.
- `list_006_summary_injection_and_budget` (`ai-character-chat-list` 243-474) — Summary injection back into DB, context-budget computation, prep for hierarchical summarization.

## Custom-code / oc bridge

- `html_027_module_custom_code_iframe_api` (`ai-character-chat-html` 10526-11797) — Custom-code iframe creation, oc/thread API surface, postMessage bridge, sync plumbing, DB update reconciliation.

## Share links / URL data

- `html_029_module_import_hash_startup` (`ai-character-chat-html` 12474-13619) — Character hashing, import pipelines, external character formats, hash/share-link bootstrap, initial screen startup.
- `list_002_share_link_generation` (`ai-character-chat-list` 21-65) — Share-link generation and gzip compression helper.
- `list_003_url_loading_and_sandbox` (`ai-character-chat-list` 66-156) — Load shared character data from URL/cloud storage and sandboxed Perchance text evaluation.
- `list_004_named_characters_and_meta` (`ai-character-chat-list` 157-221) — Named URL characters and $meta.dynamic metadata generation.

## Memory / lore / summaries

- `html_021_module_message_models_lore_embeddings` (`ai-character-chat-html` 6313-6724) — DB message/thread insertion, lore loading, token counting, local embedding loader/bootstrap.
- `html_023_module_reply_generation_pipeline` (`ai-character-chat-html` 7156-8235) — Core bot reply construction: role instructions, reminders, summaries, memories/lore retrieval, AI completion helpers.
- `list_005_summary_selection_helper` (`ai-character-chat-list` 222-242) — Helper that filters summarized vs unsummarized message objects.
- `list_006_summary_injection_and_budget` (`ai-character-chat-list` 243-474) — Summary injection back into DB, context-budget computation, prep for hierarchical summarization.
