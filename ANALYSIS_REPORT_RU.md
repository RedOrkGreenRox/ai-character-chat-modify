# Актуальный отчёт по `ai-character-chat-modify`

Дата актуализации: 2026-06-03

Этот файл заменяет старый исторический отчёт. Главный подробный документ по текущей архитектуре:

```text
docs/16_current_accm_architecture.md
```

## 1. Что это за проект

Репозиторий — рабочая станция для модификации Perchance `ai-character-chat`.

Исходная Perchance-структура:

```text
original/ai-character-chat-html.txt
original/ai-character-chat-list.txt
```

Exact decomposition:

```text
analysis/exact_components/
```

Модификации:

```text
modify/new/      # функциональные overlay-модули
modify/replace/  # точечные замены оригинальных компонентов
```

Собранный результат:

```text
output/ai-character-chat-html.txt
output/ai-character-chat-list.txt
```

## 2. Как проверять текущее состояние

Главная команда:

```bash
cd ai-character-chat-modify
python tools/regression.py
```

Она проверяет:

- exact roundtrip `original -> reassembled`;
- overlay assembly;
- корректность `modify/manifest.json`;
- синтаксис всех `modify/new/*.frag`;
- синтаксис inline scripts итогового HTML;
- синтаксис Worker-файлов.

Дополнительно:

```bash
python tools/build_extension_indexes.py
make worker-check
```

Ожидаемый результат:

```text
REGRESSION OK
worker smoke tests OK
```

## 3. Текущая архитектура ACCM

Добавлен namespace:

```js
window.__accm
```

Основные registry:

```js
__accm.commands
__accm.shortcuts
__accm.importers
__accm.packs
__accm.skillbooks
__accm.library
__accm.ui
__accm.ui.globalButtons
```

Цель — уходить от цепочек monkey-patch wrapper'ов к регистрируемым модулям.

## 4. Текущие функциональные модули

```text
030_extensions_core.frag
031_extensions_processors.frag
032_extensions_web_search.frag
033_extensions_controls_io.frag
034_extensions_voice.frag
035_extensions_shortcuts_commands_init.frag
044_accm_runtime.frag
045_accm_gradual_message_reveal.frag
036_extensions_file_explorer.frag
037_extensions_file_mentions.frag
038_extensions_base_policy.frag
039_extensions_deep_web_search.frag
040_extensions_image_analysis.frag
041_extensions_voice_profile.frag
042_extensions_mobile_ui.frag
043_extensions_voice_widget.frag
056_extensions_workshop.frag
058_accm_workshop_importers.frag
```

## 5. Текущие replace-патчи оригинала

```text
modify/replace/019_module_character_catalog_and_crud.frag
modify/replace/023_module_reply_generation_pipeline.frag
modify/replace/029_module_import_hash_startup.frag
```

Назначение:

- `019` — безопасное удаление сообщений без `messageIdsUsed`.
- `023` — фильтрация disabled lore/memories; streaming gradual reveal.
- `029` — gzip sniffing для Dexie JSON exports с ошибочным `.json`/`application/json`.

Правило: не создавать отдельные `0xx_fix` расширения для таких случаев. Если ошибка в исходном компоненте — использовать `modify/replace/`.

## 6. Workshop

Frontend:

```text
modify/new/056_extensions_workshop.frag
modify/new/058_accm_workshop_importers.frag
```

Backend:

```text
../workshop-backend/src/worker.js
../fixed-worker.js
```

Backend stack:

- Cloudflare Worker;
- D1 metadata DB;
- Discord OAuth identity;
- GitHub OAuth publish;
- user-owned GitHub Gists for content.

Gists are currently created as secret/unlisted:

```js
GITHUB_GIST_PUBLIC: false
```

This means accessible by link, not truly private access-controlled.

Current publish kinds:

```text
generator
generator-extension
lorebook
skillbook
character
extension-pack
```

Legacy backend kind `thread` is still accepted but no longer shown as a primary kind in UI.

## 7. Explorer

Command:

```text
/files
/explorer
```

Sidebar:

```text
ACCM → Explorer
```

Tabs:

```text
Files
Memory
Objects
```

Memory supports:

- enable/disable via toggles;
- delete;
- hierarchical generated memory display by thread/message/level.

Objects supports:

- installed library items;
- per-chat activation toggles;
- characters;
- skillbooks;
- extension packs;
- extension modules.

## 8. Skillbooks

Skillbooks are semantic/knowledge packs.

Current status:

- Workshop skillbooks install into `__accm.library`;
- can be activated/deactivated per chat from Explorer → Objects;
- active skillbooks are injected into prompt via before-reply hook;
- mini-library contains sample skillbooks.

## 9. Base Policy

Base Policy currently uses language toggles and auto-save.

Important taxonomy:

- lightweight Base Policy language preset = `extension-pack`;
- language/style/grammar/domain knowledge = `skillbook`.

Current default:

```text
English enabled
```

Unchecking all languages disables the policy.

## 10. Gradual reveal

Module:

```text
045_accm_gradual_message_reveal.frag
```

Streaming logic lives in replace patch:

```text
modify/replace/023_module_reply_generation_pipeline.frag
```

Current behaviour:

- toggle in sidebar: `ACCM → Effects → Gradual text reveal`;
- streaming displays gradual plain text;
- final message is rendered as markdown after completion.

## 11. Mini library

Sample content lives at workspace root:

```text
../mini-library/
```

Contains:

```text
lorebooks/
skillbooks/
characters/
workshop-items/
catalog.json
```

Use this for quick publish/import tests.

## 12. Current machine-readable indexes

Regenerate:

```bash
python tools/build_extension_indexes.py
```

Outputs:

```text
analysis/extension_module_manifest.json
analysis/extension_wrapper_chains.md
```

These are the best quick map for future AI agents.

## 13. Main next steps

See:

```text
docs/FUTURE_WORK_RU.md
```

Important planned items:

- cleaner Explorer UI;
- true extension-pack installation flow;
- binary/base64 publish for Tavern cards;
- Worker hardening: token encryption key, hashed sessions, one-time GitHub link token;
- Gist healthcheck;
- more registry migrations away from wrappers.
