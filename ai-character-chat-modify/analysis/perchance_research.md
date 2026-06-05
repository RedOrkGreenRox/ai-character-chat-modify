# Perchance research notes

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## Consulted docs/pages
- https://perchance.org/learn-web
- https://perchance.org/learn-perchance-syntax-output-formatting
- https://perchance.org/custom-code
- https://perchance.org/ai-text-plugin
- https://perchance.org/ai-character-chat-docs
- https://perchance.org/examples

## High-value takeaways for this repo

### 1) How Perchance splits responsibility
Perchance generators typically have two relevant layers:

1. **Lists / generator syntax**
   - Perchance-native definitions, imports, `$meta`, lists, helper functions.
   - In this repo that layer is mirrored by `original/ai-character-chat-list.txt`.

2. **HTML panel**
   - Normal web-page code: HTML + CSS + JavaScript.
   - In this repo that layer is mirrored by `original/ai-character-chat-html.txt`.

This is the key architectural fact for the whole decomposition work.

### 2) What the official docs say about HTML in Perchance
From Perchance's own Learn Web / formatting docs:
- HTML is written in the **bottom-right HTML panel**.
- CSS and JS can be embedded directly in that panel with normal `<style>` / `<script>` tags.
- Perchance output formatting pages explicitly teach mixing HTML and CSS for generator output.
- Perchance is not limited to random text generation; it can host richer web apps/UI when you use the HTML side.

That maps directly onto this codebase: `ai-character-chat-html.txt` is effectively a full SPA-like client app living inside the Perchance HTML panel.

### 3) How the lists layer is consumed from HTML
The practical bridge is the `root.*` access pattern:
- list-side imports/functions become callable from the HTML side as `root.loadDependencies()`, `root.aiTextPlugin(...)`, `root.textToImagePlugin(...)`, etc.
- this repo relies heavily on that model.

Concrete examples from this codebase:
- `root.loadDependencies()`
- `root.aiTextPlugin(...)`
- `root.textToImagePlugin(...)`
- `root.generateShareLinkForCharacter(...)`
- `root.loadDataFromUrlThatReferencesCloudStorageFile()`
- `root.injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded(...)`

So for refactoring purposes:
- `ai-character-chat-list.txt` = exported runtime/services layer
- `ai-character-chat-html.txt` = consuming application layer

### 4) What `ai-text-plugin` documentation contributes here
The `ai-text-plugin` docs confirm the expected Perchance import/usage pattern:
- imports look like `ai = {import:ai-text-plugin}` in the list editor
- HTML/JS later calls the imported function
- prompt objects can contain `instruction`, `startWith`, `stopSequences`, `onChunk`, `onFinish`, etc.

That directly explains why the HTML file treats `root.aiTextPlugin` as a first-class service used for:
- reply generation
- naming threads
- summary generation
- memory query generation
- character generation from URL content

### 5) What `custom-code` / AI Character Chat docs imply for this repo
The AI Character Chat docs and general custom-code docs indicate that Perchance allows custom JavaScript attached to characters/generators.
In this repository, that becomes a dedicated **custom-code iframe runtime** with an exposed `oc` API.

Important consequence:
- `oc.*` in this repo is **not** native browser API and not standard Perchance global API in the page itself.
- It is a custom bridge intentionally exposed to sandboxed iframe code.
- Therefore `oc.thread`, `oc.character`, `oc.generateText`, `oc.textToImage`, `oc.window.show/hide`, etc. should be treated as an internal runtime contract of this app.

### 6) HTML-specific implications for this exact codebase
Because this whole app lives in the Perchance HTML panel:
- DOM structure is declared directly in `ai-character-chat-html.txt`
- global styles and theme variables also live there
- IndexedDB/Dexie bootstrapping also lives there
- event handlers for `#messageInput`, `#sendButton`, thread list, message feed, options popups, import/export inputs, etc. also live there
- iframe custom-code bridge and `postMessage` sync logic also live there

So the HTML file is not “just markup”; it contains:
- markup
- stylesheet/theme system
- main app runtime
- chat engine orchestration
- import/export system
- custom-code API bridge

### 7) Why exact fragment splitting was chosen
The current task explicitly requires:
- exact decomposition into smaller pieces
- exact reassembly
- byte-for-byte identity with the originals at this stage

That means a normal semantic rewrite into standalone ES modules would be premature.
So the current split is implemented as:
- **non-overlapping exact fragments**, extracted verbatim from the originals
- each fragment tagged by role (`structure-dom`, `business-logic`, `api`, `styles`, `entrypoint`, `db`, `memory`, `custom-code`, `messageInput`, etc.)
- a deterministic assembler that concatenates fragments back into exact originals

This preserves correctness first, while still making the project navigable.

## Practical repo-specific interpretation

### `original/ai-character-chat-list.txt`
Use this as the source of truth for:
- plugin imports
- Perchance runtime helpers
- URL/share-link loading
- `$meta.dynamic`
- hierarchical summaries / memory generation helpers
- confirm modal helper
- comments plugin config

### `original/ai-character-chat-html.txt`
Use this as the source of truth for:
- top-level DOM shell
- all chat UI
- CSS variables and dark/light theme behavior
- Dexie schema and migration logic
- thread/message rendering
- slash commands and send pipeline
- custom-code iframe runtime / `oc` sync bridge
- import/export / startup bootstrap
