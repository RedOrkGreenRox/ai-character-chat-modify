# 16. Current ACCM architecture

Updated: 2026-06-05  
Scope: current state of the modified fork after ACCM runtime, Workshop, global Explorer, skillbooks, Base Policy language packs, gradual reveal, and Worker backend changes.

This is the main orientation document for future human/AI maintainers. Older docs `01`-`14` remain useful for understanding the original Perchance `ai-character-chat` app and the exact-fragment decomposition, but this file is the current source of truth for the ACCM extension layer.

---

## 1. What this repository is

The project is a modification workstation for the Perchance generator `ai-character-chat`.

The Perchance app has two source panes:

```text
original/ai-character-chat-html.txt  # main SPA-like HTML/JS app
original/ai-character-chat-list.txt  # Perchance list/DSL imports and helper functions
```

The repository decomposes those originals into exact fragments under:

```text
analysis/exact_components/
```

and rebuilds the modified result into:

```text
output/ai-character-chat-html.txt
739bf7b7d2a6f180c254293138f0947b77c4116f434b50d9cf2a9fcf89fc7559
```

Current policy:

- functional extensions live in `modify/new/*.frag`;
- bugs in existing extension modules should be fixed in the module that owns them;
- bugs in original/base components should be patched via `modify/replace/<component>.frag`;
- do not create random numbered `0xx_fix` modules for small one-off fixes.

---

## 2. How to verify the project

Primary command:

```bash
cd ai-character-chat-modify
python tools/regression.py
```

It checks:

1. exact roundtrip: `original/` → `reassembled/`;
2. overlay assembly;
3. `modify/manifest.json` consistency;
4. syntax of all `modify/new/*.frag` modules;
5. syntax of all final inline scripts in `output/ai-character-chat-html.txt`;
6. syntax of the Workshop Worker files if present.

Other useful commands from workspace root:

```bash
make regression
make indexes
make worker-check
make package-backend
```

Current expected result:

```text
REGRESSION OK
worker smoke tests OK
```

---

## 3. Current output hashes

At the time of this document:

```text
output/ai-character-chat-html.txt
739bf7b7d2a6f180c254293138f0947b77c4116f434b50d9cf2a9fcf89fc7559

output/ai-character-chat-list.txt
10d622471dac2f3de0e86cf4217f211408b6741b33677fecbaf0371ce93497a1
```

The list output is intentionally modified by `replace/004_named_characters_and_meta.frag` so the generator has ACCM-specific `$meta` title/description values instead of sharing the original `ai-character-chat` metadata. Earlier experiments imported `typewriter-plugin`, but that was removed. The gradual reveal is custom JavaScript now.

---

## 4. Overlay build state

Current overlay categories:

```text
modify/new/       # functional extension modules
modify/replace/   # patched original/base fragments
```

Current replace fragments:

```text
modify/replace/004_named_characters_and_meta.frag
modify/replace/019_module_character_catalog_and_crud.frag
modify/replace/023_module_reply_generation_pipeline.frag
modify/replace/029_module_import_hash_startup.frag
```

Why they exist:

- `004`: replace original `ai-character-chat` `$meta` title/description with ACCM-specific branding and feature-focused metadata.
- `019`: fix deletion of old/system/extension messages missing diagnostic arrays like `messageIdsUsed`.
- `023`: filter disabled lore/generated memories from retrieval; implement streaming gradual reveal in the original streaming function.
- `029`: sniff gzip magic bytes for Perchance/Dexie exports even when browser reports `application/json`.

---

## 5. Current extension module list

All modules are inserted after:

```text
html_028_module_reply_as_and_input_ux
```

Current modules:

| Module | Role |
|---|---|
| `030_extensions_core.frag` | Settings, loaders, lore helpers, file registry, AI-context messages, task panel, before-reply hook bus. |
| `031_extensions_processors.frag` | File processors: text, PDF, DOCX, image, audio, spreadsheet, archive. |
| `032_extensions_web_search.frag` | Web search, auto-search hook, DDG search, synthesis. |
| `033_extensions_controls_io.frag` | Feature toggles, status, hidden file input, drag/drop, paste upload. |
| `034_extensions_voice.frag` | Original voice recording implementation. |
| `035_extensions_shortcuts_commands_init.frag` | Core command interception, send button wrapper, showThread shortcut normalization; old extension shortcut buttons are removed here. |
| `044_accm_runtime.frag` | ACCM SDK foundation: commands, shortcuts, importers, packs, skillbooks, library, always-available fixed ACCM launcher, UI registry. |
| `045_accm_gradual_message_reveal.frag` | Custom gradual reveal settings/toggle and post-render reveal support. Streaming reveal is implemented in replace/023. |
| `036_extensions_file_explorer.frag` | Global Explorer: Files, Memory, Objects tabs; enable/disable/delete for lore/memory; global files view. |
| `037_extensions_file_mentions.frag` | `@[filename]` mention context hook. |
| `038_extensions_base_policy.frag` | Base Policy language-pack toggles, auto-save, prompt injection, language commands. |
| `039_extensions_deep_web_search.frag` | Deep web search wrapper for `__aeSearchWeb`. |
| `040_extensions_image_analysis.frag` | Optional advanced image analysis wrapper. |
| `041_extensions_voice_profile.frag` | Voice acoustic profile helper. |
| `042_extensions_mobile_ui.frag` | Mobile fullscreen windows and unified menu shell; no longer overrides Explorer into a generic Extensions window. |
| `043_extensions_voice_widget.frag` | Large voice recording widget. |
| `056_extensions_workshop.frag` | Workshop UI/API/auth/catalog/publish/library view. |
| `058_accm_workshop_importers.frag` | Workshop importers/installers for Perchance exports, lorebooks, skillbooks, characters, threads, fallback download. |

---

## 6. ACCM runtime / SDK

Namespace:

```js
window.__accm
```

Provided registries:

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

### 6.1 Commands

Use:

```js
__accm.commands.register({
  id,
  aliases,
  match,
  handler,
  priority
})
```

The runtime wraps `__aeHandleCommandText` once. New modules should register commands rather than wrapping `__aeHandleCommandText`.

Currently migrated:

- `/workshop`, `/ws`;
- `/files`, `/explorer`;
- `/policy`;
- `/policy status`;
- `/language <code>`.

### 6.2 Shortcuts

Use:

```js
__accm.shortcuts.register({ id, name, message, ... })
```

The runtime wraps `__aeEnsureShortcutButtons` once. Per-thread old extension shortcut buttons are no longer used for navigation; global navigation lives in the ACCM sidebar.

### 6.3 Importers

Use:

```js
__accm.importers.register({ id, test, install, priority })
```

Workshop item installation now goes through this registry.

### 6.4 Packs

`__accm.packs` stores technical extension/data packs.

Important taxonomy rule:

- lightweight language preset for Base Policy = `extension-pack`;
- real language knowledge/style/grammar/domain guide = `skillbook`.

### 6.5 Skillbooks

`__accm.skillbooks` manages semantic/knowledge packs.

Currently:

- Workshop `kind: skillbook` installs into `__accm.library`;
- installed skillbooks can be activated per chat in Explorer → Objects;
- active skillbooks are injected into generation context via a before-reply hook.

### 6.6 Library and activations

`__accm.library` stores installed objects in:

```text
db.misc key: __accmLibrary
```

Concept:

```text
installed globally + activated per chat
```

Used currently for skillbooks.

---

## 7. Global ACCM launcher

ACCM navigation is now an always-available fixed launcher at the middle-left edge of the viewport:

```text
▶ ACCM
```

It is mounted directly on `document.body`, not inside the original left sidebar, so it remains clickable on chat pages, catalog/import screens, mobile layouts, and other app states where `#leftColumn` may be hidden or unavailable.

When expanded it opens a compact floating panel:

```text
🏛 Workshop
🗂️ Explorer
🧩 Menu
✨ Effects
```

The panel and nested sub-panels scroll when they exceed available height. A close button collapses the launcher without changing the current page.

`Menu` expands nested actions, including:

- choose files;
- Explorer;
- voice;
- Base Policy;
- search;
- status;
- commands;
- cancel processing;
- full menu window.

---

## 8. Global Explorer

Opened via:

```text
/files
/explorer
ACCM → Explorer
```

Current tabs:

```text
Files
Memory
Objects
```

### Files tab

- global by default;
- can switch all chats/current chat when a chat is active;
- supports preview, mention, recall, forget;
- cross-chat recall works fully only if `fullText` was stored; large files may only have preview.

### Memory tab

Shows:

- lore entries;
- generated memories from `message.memoriesEndingHere`;
- legacy `db.memories` records.

Actions:

- enable/disable via checkbox toggles;
- delete;
- generated memories are shown hierarchically by thread/message/level indentation.

Retrieval filtering:

- disabled lore is filtered in replace/023;
- disabled generated memories are filtered in replace/023.

### Objects tab

Shows:

- installed library items;
- characters;
- skillbook registry;
- extension packs;
- extension modules.

Installed library items can be activated/deactivated per current chat via checkbox toggles and deleted globally.

---

## 9. Base Policy

Opened via:

```text
/policy
ACCM → Menu → Base Policy
```

Current UI:

- language toggles;
- auto-save on checkbox change;
- no Save/Off buttons;
- unchecking all languages disables the policy.

Default:

```text
English enabled
```

Storage:

```js
thread.customData.__aeBasePolicy = {
  allowedLanguagePacks: ['accm.lang.en'],
  primaryLanguagePack: 'accm.lang.en',
  fallbackLanguagePack: 'accm.lang.en' // backward-compatible alias only
}
```

Prompt behaviour:

- all visible words must be in allowed languages;
- actions inside asterisks, narration, stage directions, thoughts, citations prose, etc. must obey the policy;
- if asked what languages the character knows/can use, the allowed list is treated as the complete answer for this chat;
- if asked for a phrase in each known/available language, the character should provide one phrase for every allowed language.

---

## 10. Gradual message reveal

Toggle:

```text
ACCM → Effects → Gradual text reveal
```

Storage:

```text
localStorage.__accmTextRevealSettings
```

Current behaviour:

- post-render full-message reveal for newly rendered message containers;
- text-node reveal fallback for normal rendered messages;
- streaming reveal is implemented directly in replace/023 by modifying `handleStreamingReplyChunk`:
  - received buffer stores incoming AI text;
  - displayed buffer reveals received text gradually;
  - during streaming it renders plain text for smoothness;
  - after generation finishes, original final markdown rendering is used.

Known tradeoff:

- while streaming, markdown is not fully rendered; after completion it is rendered normally.

---

## 11. Workshop frontend

Opened via:

```text
/workshop
/ws
ACCM → Workshop
```

Backend URL currently hardcoded:

```text
https://accm-workshop.accm.workers.dev
```

Current Workshop UI:

- Home;
- Catalog;
- My Library;
- Publish.

Current publish kinds:

```text
generator
generator-extension
lorebook
skillbook
character
extension-pack
```

Legacy backend kind:

```text
thread
```

still accepted for old records but not shown as a main UI kind.

### Character imports

Native simple character JSON is handled by `workshop.native-character-json`.

If no avatar is supplied:

1. try AI avatar generation with `root.textToImagePlugin` from the character description;
2. fallback to deterministic SVG initials avatar.

Binary image files uploaded through Workshop publish are wrapped as `accm.binary-file.v1` JSON. PNG/WebP/JPEG character-card wrappers are installed by `workshop.binary-character-card` via the existing external character-card importer.

### Skillbooks and extension packs

`kind: skillbook` installs into `__accm.library` and is enabled in the current chat if a chat is active.

`kind: extension-pack` installs through `workshop.extension-pack`, registers metadata/content in `__accm.packs`, and is also stored in `__accm.library` for Explorer/Object management.

---

## 12. Workshop backend

Location:

```text
../workshop-backend/src/worker.js
```

Architecture:

- Cloudflare Worker;
- D1 for users/sessions/items/votes/installs/reports;
- Discord OAuth for identity;
- GitHub OAuth for publishing;
- GitHub Gists for author-owned content storage.

Current auth/session behaviour:

- Discord login sets `accm_ws_session` as `HttpOnly; Secure; SameSite=None` cookie;
- the frontend uses `fetch(..., { credentials: 'include' })` and no longer persists session tokens in `localStorage`;
- in-memory bearer support remains only as a legacy fallback;
- GitHub linking starts with `POST /v1/auth/github/start`, authenticated by cookie/bearer, and no longer passes session tokens in the URL;
- D1 stores SHA-256 hashes of session tokens, not raw session tokens.

Gist visibility:

```js
GITHUB_GIST_PUBLIC: false
```

Meaning:

- secret/unlisted Gist;
- accessible by link;
- not listed publicly on the author's Gist page;
- not true private access control.

Important delete behaviour:

The Worker deletes dependent rows before deleting `items`:

```sql
DELETE FROM votes WHERE item_id=?
DELETE FROM installs WHERE item_id=?
DELETE FROM reports WHERE item_id=?
DELETE FROM items WHERE id=?
```

This avoids D1 foreign-key failures.

Smoke tests:

```bash
cd workshop-backend
npm test
```

---

## 13. Mini library

Location:

```text
../mini-library/
```

Structure:

```text
mini-library/
├── README.md
├── catalog.json
├── lorebooks/
├── skillbooks/
├── characters/
└── workshop-items/
```

Includes sample:

- lorebooks;
- skillbooks;
- characters;
- ready Workshop publish payloads.

Expressive test skillbooks include:

- Noir Clue Ledger;
- Action-first RP;
- Strict Russian Actions.

---

## 14. Current wrapper chains

Generate current report:

```bash
cd ai-character-chat-modify
python tools/build_extension_indexes.py
```

Output:

```text
analysis/extension_wrapper_chains.md
analysis/extension_module_manifest.json
```

Current key state:

- `__aeHandleCommandText` is wrapped only by `044_accm_runtime.frag`;
- `__aeEnsureShortcutButtons` is wrapped only by `044_accm_runtime.frag`;
- remaining wrappers are older architecture pieces:
  - deep search wraps `__aeSearchWeb`;
  - advanced image wraps `__aeProcessImageFile`;
  - core wraps `getBotReply`;
  - shortcuts init wraps `sendButtonClickHandler` and `showThread`.

---

## 15. Known limitations and next steps

Known limitations:

- Workshop moderation UI is still primitive/backend-only;
- Global Explorer UI is functional but visually rough;
- Skillbook activation exists, but UX is early;
- extension-pack installation exists, but pack-specific behaviour is still minimal and needs per-pack capability handlers;
- binary publish uses JSON wrappers; this works for character-card image imports, but broader binary asset UX still needs polish;
- streaming reveal uses plain text during generation and final markdown after completion.

Recommended next engineering steps:

1. Continue moving wrappers into registries.
2. Add richer `extension-pack` capability handlers and permission metadata.
3. Improve binary asset UX beyond the current `accm.binary-file.v1` wrapper path.
4. Improve Explorer UI into type-specific tabs: Characters, Lorebooks, Skillbooks, Extension packs, Disabled.
5. Add a dedicated `TOKEN_ENCRYPTION_KEY` in production instead of relying on the Discord secret fallback.
6. Add Gist healthcheck scheduled Worker.
7. Split the monolithic Worker into route/helper modules when moving away from Dashboard copy-paste deployment.
8. Add a unified safe-render layer to reduce raw `innerHTML` usage in extension UI.
