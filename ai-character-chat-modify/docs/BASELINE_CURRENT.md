# Current baseline

Date: 2026-06-05

## State

This baseline records the current restored working state after adding:

- Mobile UI module
- Voice widget module
- Workshop frontend module
- gzip JSON import fix
- regression tooling
- extension indexes
- ACCM runtime/SDK foundation
- Workshop command/shortcut/importers migrated to registries
- Workshop importers extracted to 058_accm_workshop_importers.frag and registered through __accm.importers
- Base Policy languages migrated to built-in extension-pack language packs with toggle UI
- Workshop accepted kinds updated to canonical taxonomy: generator, generator-extension, lorebook, skillbook, character, extension-pack
- File Explorer and Base Policy commands migrated to command registry
- Workshop My Library delete UI
- D1 item delete order fixed: votes/installs/reports are removed before items to satisfy FK constraints
- Safe message delete fixed in replace/019_module_character_catalog_and_crud.frag for older/system messages missing diagnostic arrays
- Base Policy prompt strengthened to cover dialogue, narration, actions, stage directions and text inside asterisks
- Ad-hoc fix modules 057/059 removed; source-level fixes live in replace/ fragments
- Direct gzip/Dexie JSON import fixed in replace/029_module_import_hash_startup.frag instead of a separate fix extension
- Base Policy UI no longer exposes fallback; it uses first enabled language as primary/default internally
- __accm.skillbooks registry added; Workshop skillbooks now install through skillbook installer registry
- Language taxonomy clarified: lightweight Base Policy presets are extension-packs, full language/style knowledge is skillbook
- mini-library.json added at workspace root with sample lorebooks, skillbooks and characters
- mini-library split into folder structure with individual import-ready lorebooks, skillbooks, characters and workshop payloads
- Global Explorer first pass: Files tab defaults to all chats, Memory tab browses lore/memory read-only
- Workshop native character JSON importer added: simple character JSON now adds directly to character list instead of opening the external character prompt with name only
- New extension system messages now receive their DB id before rendering, so delete buttons work without requiring a reload
- Base Policy language prompt now sits after the latest user message and explicitly treats allowed languages as the complete language set for this chat
- Native character imports now generate deterministic SVG avatars when no avatar URL is supplied
- Memory/lore retrieval filters disabled lore and generated memories via replace/023_module_reply_generation_pipeline.frag
- Explorer Memory tab now supports enable/disable/delete for lore, generated memories and legacy memories with indented hierarchy
- Global launcher buttons added through __accm.ui.globalButtons for Workshop and Explorer, available outside chats
- AI avatar generation added for native character imports using root.textToImagePlugin, with deterministic SVG fallback
- Workshop add/install status messages moved from chat system messages to disappearing toasts where appropriate
- Gradual text reveal module added by default
- Explorer Objects tab added with library activations, characters, skillbooks, packs and extension modules
- Skillbooks now install into __accm.library and can be enabled/disabled per chat from Explorer Objects tab
- Per-thread old extension shortcut buttons removed; extension navigation now lives in ACCM sidebar
- ACCM sidebar now has rotating arrow and nested Menu panel actions
- More expressive, easily verifiable skillbooks added to mini-library: Noir Clue Ledger, Action-first RP, Strict Russian Actions
- Official typewriter adapter removed again; custom full-message gradual reveal plugin added with sidebar toggle
- Workshop Gists now default to secret/unlisted (public:false), accessible by link but not public-listed
- ACCM sidebar supports toggle controls and nested menu panel items
- Explorer enable/disable controls converted from buttons to checkbox toggles
- Base Policy language toggles now auto-save; Save/Off/Back buttons removed from the policy panel
- ACCM sidebar nested menu panel now scrolls when it does not fit
- ACCM sidebar main button list now scrolls as well as nested panels
- Gradual reveal now remembers revealed DB message ids to avoid replaying after final re-render
- ACCM sidebar scrolling adjusted: main list and nested panels both have independent constrained scroll areas
- Gradual reveal now also applies a whole-message fade and avoids replaying per DB message id after final re-render
- Gradual reveal now wraps streaming chunk rendering to reduce chunk jumps during generation
- ACCM nested panels now open as full sidebar sub-panels with their own scroll area instead of inline below the button
- Reverted failed streaming chunk wrapper; gradual reveal remains post-render only until a safer streaming approach is designed
- Reverted full-sidebar submenu panel; restored inline nested menu panel with scroll
- Explorer no longer gets overridden by mobile menu to an Extensions/ACCM Menu window; standalone Explorer title is preserved
- Streaming gradual reveal implemented in replace/023 handleStreamingReplyChunk with received/displayed buffers
- Streaming gradual reveal slowed to smaller steady chunks to reduce visible text jumps during generation
- Streaming gradual reveal now renders plain text while streaming and final markdown after completion to avoid word-sized markdown re-render jumps
- Custom gradual reveal is used; official typewriter-plugin is not currently imported due markdown/streaming limitations
- Binary publish wrapper support added: non-text files become accm.binary-file.v1 JSON wrappers
- Character PNG/WebP/JPEG binary wrappers can be installed via Workshop binary character-card importer
- Extension-pack Workshop importer added; extension packs register in __accm.packs and __accm.library
- Mini-library now includes extension-pack examples
- ACCM launcher moved to an always-available fixed mid-left button/panel mounted on `document.body`
- `$meta` title/description replaced with ACCM-specific metadata via `modify/replace/004_named_characters_and_meta.frag`

## Key files

```text
modify/new/042_extensions_mobile_ui.frag
modify/new/043_extensions_voice_widget.frag
modify/new/044_accm_runtime.frag
modify/new/056_extensions_workshop.frag
modify/replace/004_named_characters_and_meta.frag
modify/replace/019_module_character_catalog_and_crud.frag
modify/replace/029_module_import_hash_startup.frag
tools/regression.py
tools/build_extension_indexes.py
analysis/extension_module_manifest.json
analysis/extension_wrapper_chains.md
../workshop-backend/src/worker.js
../workshop-backend/tests/worker-smoke.mjs
```

## Backend

Worker URL currently hardcoded/configured as:

```text
https://accm-workshop.accm.workers.dev
```

Backend mode:

```text
Discord OAuth identity
GitHub OAuth for publishing
GitHub Gists as author-owned content storage
Cloudflare D1 as metadata database
```

## Current verification command

From workspace root:

```bash
make regression
make worker-check
make indexes
```

Or directly:

```bash
cd ai-character-chat-modify
python tools/regression.py
```

## Last successful regression

```text
exact component roundtrip: OK
overlay assembly: OK
manifest consistency: OK
modify/new syntax: OK
inline scripts syntax: OK
worker syntax: OK
worker smoke tests: OK
```

## Last output hashes

After latest assembly:

```text
output/ai-character-chat-html.txt
739bf7b7d2a6f180c254293138f0947b77c4116f434b50d9cf2a9fcf89fc7559

output/ai-character-chat-list.txt
10d622471dac2f3de0e86cf4217f211408b6741b33677fecbaf0371ce93497a1
```

## Current security/auth baseline

- Workshop sessions are cookie-first: Discord login sets `accm_ws_session` as `HttpOnly; Secure; SameSite=None`.
- Frontend requests include credentials; in-memory bearer is only a legacy fallback and is not persisted in `localStorage`.
- GitHub linking starts via authenticated `POST /v1/auth/github/start`; session tokens are not passed in query strings.
- D1 stores SHA-256 hashes of session tokens.
- GitHub tokens are encrypted at rest with AES-GCM using `TOKEN_ENCRYPTION_KEY` when configured, falling back to `DISCORD_CLIENT_SECRET` for compatibility.
- Executable Workshop content has a static safety gate that blocks obvious high-risk APIs (`eval`, `new Function`, dynamic import, cookie/storage/network APIs, `<script>`).

## Known limitations

- Workshop publish handles text/json/js and binary files via `accm.binary-file.v1` wrappers; PNG/WebP/JPEG character-card wrappers can be installed, but broader binary asset UX still needs polish.
- Workshop delete UI exists in My Library for own uploads, but moderation UI is still backend-only.
- Workshop ToS text is now visible in shortened form, but not yet a full legal page/view.
- Global Workshop and Explorer buttons exist in the ACCM sidebar, but their UI polish is still early.
- Global File/Memory/Object Explorer exists; type-specific tabs and richer object management are still future work.
- Extension modules still use some wrapper chains; registry migration is in progress, not complete.
