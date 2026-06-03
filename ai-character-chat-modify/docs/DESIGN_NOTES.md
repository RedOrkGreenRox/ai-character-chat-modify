# Design notes

Updated: 2026-06-03

This document records design decisions and tradeoffs. For the operational current architecture, read `docs/16_current_accm_architecture.md`.

---

## 1. Core direction

The project is no longer just a group of independent `__ae*` patches. It is becoming an extension platform on top of Perchance `ai-character-chat`.

Current direction:

```text
Perchance ai-character-chat
  + exact fragment workstation
  + ACCM runtime registries
  + Workshop
  + Global Explorer
  + skillbooks / extension-packs
  + Cloudflare Worker backend
```

Key principle:

- add new features through registries where possible;
- patch original/base fragments only when the bug/behaviour lives there;
- avoid one-off numbered fix modules.

---

## 2. Registry decisions

Current runtime namespace:

```js
window.__accm
```

Current registries:

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

Design decision: wrappers should gradually move into registries.

Good:

```js
__accm.commands.register({ id, aliases, handler })
```

Avoid:

```js
var old = __aeHandleCommandText;
__aeHandleCommandText = async function(...) { ... }
```

Current command/shortcut wrapper ownership is centralized in `044_accm_runtime.frag`.

---

## 3. Taxonomy decisions

Current primary Workshop `kind` values:

```text
generator
generator-extension
lorebook
skillbook
character
extension-pack
```

Everything else should be represented as tags, subtype fields, capability fields, schemas, or metadata.

Examples:

```text
scene-pack        → kind: extension-pack, tags: [scene, ambience]
dice-system       → kind: extension-pack, tags: [dice, dnd]
ui-theme          → kind: extension-pack, tags: [theme, ui]
agent-tool        → kind: generator-extension, tags: [agent-tool, pyodide]
language-style    → kind: skillbook, tags: [language, style]
```

Language decision:

- lightweight language preset for Base Policy = `extension-pack`;
- full grammar/style/domain language guide = `skillbook`.

---

## 4. Base Policy design

Current Base Policy:

- language toggles;
- auto-save;
- no Save/Off buttons;
- uncheck all languages to disable;
- English enabled by default.

Storage currently remains thread-local:

```js
thread.customData.__aeBasePolicy = {
  allowedLanguagePacks,
  primaryLanguagePack,
  fallbackLanguagePack // backward-compatible alias
}
```

The UI should avoid exposing “fallback” as a separate user concept. Internally the first enabled language is primary/default.

Known model behaviour issue:

Some models strongly follow character examples and may ignore language policy for actions/narration. The prompt now explicitly covers:

- dialogue;
- narration;
- roleplay actions in asterisks;
- thoughts;
- stage directions;
- citations prose;
- OOC notes.

---

## 5. Workshop design

Backend choice:

- Cloudflare Worker + D1;
- Discord OAuth for identity;
- GitHub OAuth for publishing;
- GitHub Gists owned by authors for content.

Gist visibility:

```js
GITHUB_GIST_PUBLIC: false
```

Meaning:

- secret/unlisted;
- accessible by link;
- not shown in public Gist lists;
- not true private access control.

Workshop frontend should remain usable entirely inside the Perchance generator UI.

Current publish/install state:

- text/json/md/js publish works;
- native character JSON import works;
- skillbooks install into `__accm.library` and can be activated per chat;
- binary Tavern PNG publish is not implemented yet.

---

## 6. Library and activations

Library means globally installed objects:

```text
installed once globally
activated per chat as needed
```

Current implementation:

```js
__accm.library
```

Stored in:

```text
db.misc.__accmLibrary
```

Current use:

- skillbooks install as library objects;
- Explorer → Objects toggles active/inactive per chat;
- active skillbooks are injected into generation context.

Future use:

- lorebooks;
- extension packs;
- prompt packs;
- agent tools;
- scene packs.

---

## 7. Explorer design

Current Explorer tabs:

```text
Files
Memory
Objects
```

Current state:

- Files are global by default;
- Memory supports enable/disable/delete;
- Objects shows installed library items, characters, skillbooks, packs, modules.

Future Explorer should become more structured:

```text
Files
Lorebooks
Skillbooks
Characters
Extension packs
Memory
Disabled
```

Composite files such as ZIP archives should eventually be represented as trees with indentation.

---

## 8. Gradual reveal design

Current design:

- custom reveal, not official `typewriter-plugin`;
- toggle in `ACCM → Effects`;
- while streaming: plain text displayed gradually;
- after final generation: original markdown render takes over;
- post-render reveal is a fallback for non-streamed/newly inserted messages.

Why not official plugin:

- official `typewriter-plugin` is plain-text oriented;
- docs warn about line break limitations;
- chat messages may contain markdown, images, code, HTML, iframes;
- official plugin is still useful as reference, but not robust enough for full chat rendering.

Known tradeoff:

- markdown formatting is not live during streaming in gradual mode.

---

## 9. Replace patch policy

Current replace patches:

```text
019_module_character_catalog_and_crud.frag
023_module_reply_generation_pipeline.frag
029_module_import_hash_startup.frag
```

Use replace patches when fixing original/base behaviour.

Do not create new modules like:

```text
057_some_tiny_fix.frag
059_another_tiny_fix.frag
```

If many compatibility fixes are genuinely needed and cannot be patched in source modules, use one clearly named compatibility module, not many numbered fixes.

---

## 10. Backend hardening still planned

Not implemented yet:

- dedicated `TOKEN_ENCRYPTION_KEY` instead of deriving from Discord secret;
- session token hashing in D1;
- one-time GitHub link token instead of query `?session=`;
- Gist healthcheck scheduled Worker;
- tags table / FTS for large catalogs;
- binary publish path for Tavern PNG cards.

---

## 11. AI-agent platform ideas from uploaded planning notes

Ideas from `uploads/chats.txt` remain future work:

- RAG/Skillbooks;
- Pyodide/Fengari/SQLite WASM tools;
- ReAct loops;
- hybrid RPG engine;
- Spider-chart/metastate;
- AI initiative/background events;
- client-side DOCX/PDF export;
- BYOK/local models.

These should be built only after the current registry/library/explorer architecture is stable.
