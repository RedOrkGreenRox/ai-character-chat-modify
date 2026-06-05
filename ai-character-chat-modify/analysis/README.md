# Analysis indexes

Updated: 2026-06-05

This directory contains both original/base app analysis and current ACCM extension indexes.

## Current ACCM indexes

Read these first for the current modified fork:

```text
extension_module_manifest.json
extension_wrapper_chains.md
```

Regenerate them with:

```bash
cd ai-character-chat-modify
python tools/build_extension_indexes.py
```

## Original/base indexes

The following files describe the original Perchance `ai-character-chat` decomposition and API surface. They are still useful, but they do not by themselves describe all current ACCM overlays.

```text
exact_component_manifest.json
component_map.md
function_inventory.json
function_to_component_map.json
function_to_component_map.md
api_surface_matrix.json
dom_id_inventory.json
css_variable_inventory.json
perchance_research.md
commented_original/
```

## Current source of truth

For a human/AI maintainer, use this reading order:

1. `docs/16_current_accm_architecture.md`
2. `docs/BASELINE_CURRENT.md`
3. `analysis/extension_wrapper_chains.md`
4. `analysis/extension_module_manifest.json`
5. `modify/manifest.json`
6. `modify/new/*.frag` and `modify/replace/*.frag`
