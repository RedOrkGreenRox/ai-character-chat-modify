# 15. Extension modules — current state

Updated: 2026-06-05

For the complete current architecture, see:

```text
docs/16_current_accm_architecture.md
```

This file is a short operational summary of the current extension layer.

## Current module groups

### Core and original extension modules

```text
030_extensions_core.frag
031_extensions_processors.frag
032_extensions_web_search.frag
033_extensions_controls_io.frag
034_extensions_voice.frag
035_extensions_shortcuts_commands_init.frag
036_extensions_file_explorer.frag
037_extensions_file_mentions.frag
038_extensions_base_policy.frag
039_extensions_deep_web_search.frag
040_extensions_image_analysis.frag
041_extensions_voice_profile.frag
042_extensions_mobile_ui.frag
043_extensions_voice_widget.frag
```

### ACCM runtime and Workshop modules

```text
044_accm_runtime.frag
045_accm_gradual_message_reveal.frag
056_extensions_workshop.frag
058_accm_workshop_importers.frag
```

### Patched original/base fragments

```text
modify/replace/004_named_characters_and_meta.frag
modify/replace/019_module_character_catalog_and_crud.frag
modify/replace/023_module_reply_generation_pipeline.frag
modify/replace/029_module_import_hash_startup.frag
```

There should not be random numbered one-off fix modules. If a bug is in the original/base app, patch the owning component via `modify/replace/`. If a bug is in an extension module, patch that module.

## Runtime namespace

Current SDK namespace:

```js
window.__accm
```

Current registries:

```js
__accm.modules
__accm.commands
__accm.shortcuts
__accm.importers
__accm.packs
__accm.skillbooks
__accm.library
__accm.ui
__accm.ui.globalButtons
```

## Command state

The main command wrapper chain is now centralized:

```text
__aeHandleCommandText → 044_accm_runtime.frag
```

Commands migrated into `__accm.commands` include:

```text
/workshop, /ws
/files, /explorer
/policy
/policy status
/language <code>
```

## Shortcut state

Extension navigation is no longer added as per-thread shortcut buttons. It lives in the left ACCM sidebar.

`__aeEnsureShortcutButtons` is wrapped only by `044_accm_runtime.frag`, which can apply registered shortcuts if any future module uses them.

## Global ACCM launcher

ACCM controls are exposed through a fixed mid-left launcher that is mounted on `document.body`, so it remains clickable even when the original left sidebar is hidden or the user is not inside a normal chat view:

```text
▶ ACCM
  🏛 Workshop
  🗂️ Explorer
  🧩 Menu
  ✨ Effects
```

The arrow rotates on expand/collapse. The floating panel and nested panels scroll when too tall.

## Explorer

`/files` / `/explorer` opens global Explorer:

```text
Files
Memory
Objects
```

Memory tab supports enable/disable/delete for:

- lore entries;
- generated memories in `message.memoriesEndingHere`;
- legacy records in `db.memories`.

Disabled lore/generated memories are filtered from retrieval in `replace/023_module_reply_generation_pipeline.frag`.

Objects tab shows:

- installed library items;
- characters;
- skillbook registry;
- extension packs;
- extension modules.

Installed library items can be activated/deactivated per current chat.

## Base Policy

Base Policy uses language toggles, auto-saves on change, and has no Save/Off buttons.

Lightweight language presets are `extension-pack` style registry entries via `__accm.packs`. Real language/style/domain knowledge belongs in `skillbook` items.

## Workshop

Workshop frontend is in:

```text
056_extensions_workshop.frag
```

Workshop importers are in:

```text
058_accm_workshop_importers.frag
```

Current publish kinds:

```text
generator
generator-extension
lorebook
skillbook
character
extension-pack
```

The backend still accepts legacy `thread`, but the UI no longer presents it as a primary kind.

## Gradual reveal

Custom gradual message reveal is in:

```text
045_accm_gradual_message_reveal.frag
```

Streaming reveal itself is patched in:

```text
modify/replace/023_module_reply_generation_pipeline.frag
```

Current compromise:

- while streaming: plain text gradual display;
- after completion: final normal markdown render.

## Backend

Backend is in:

```text
../workshop-backend/src/worker.js
```

Current storage/auth model:

- D1 stores metadata and SHA-256 hashes of session tokens;
- Discord OAuth identifies users and sets an HttpOnly session cookie;
- frontend requests use `credentials: 'include'`, with in-memory bearer support kept only as a legacy fallback;
- GitHub OAuth linking starts through authenticated `POST /v1/auth/github/start`, so session tokens are not placed in query strings;
- GitHub OAuth publishes content as user-owned Gists;
- `GITHUB_GIST_PUBLIC: false`, meaning secret/unlisted Gists accessible by link.

## Verification

Run:

```bash
cd ai-character-chat-modify
python tools/regression.py
python tools/build_extension_indexes.py

cd /home/user
make worker-check
```

Expected:

```text
REGRESSION OK
worker smoke tests OK
```
