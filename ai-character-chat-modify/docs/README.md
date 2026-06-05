# Documentation index

Updated: 2026-06-05

## Start here

If you are a future AI/human maintainer, read these first:

```text
docs/16_current_accm_architecture.md   # current source of truth for the modified fork
docs/BASELINE_CURRENT.md               # current hashes, checks, key files
docs/FUTURE_WORK_RU.md                 # roadmap/backlog and design ideas
../../DOCS_SYNC_REPORT_2026-06-05_RU.md # latest documentation/comment synchronization notes
analysis/extension_wrapper_chains.md   # current wrapper chains
analysis/extension_module_manifest.json # machine-readable extension index
```

## Verification commands

From workspace root:

```bash
make regression
make indexes
make worker-check
```

Directly:

```bash
cd ai-character-chat-modify
python tools/regression.py
python tools/build_extension_indexes.py
```

Expected:

```text
REGRESSION OK
worker smoke tests OK
```

## Original/base app docs

These documents mainly describe the original Perchance `ai-character-chat` and exact decomposition. They are still useful, but for current ACCM overlays always cross-check `16_current_accm_architecture.md`.

```text
01_perchance_runtime_and_source_split.md
02_entrypoints_and_boot_sequence.md
03_dom_map.md
04_db_schema_and_persistence.md
05_business_logic_map.md
06_api_surfaces.md
07_styles_and_theme.md
08_memory_lore_summaries.md
09_function_index.md
10_commented_code_catalog.md
11_api_matrix.md
12_call_chains_and_hot_functions.md
13_machine_readable_indexes.md
14_extensions_modularization_and_future_modules.md
```

## Current ACCM extension docs

```text
15_extension_modules_current_state.md
16_current_accm_architecture.md
BASELINE_CURRENT.md
DESIGN_NOTES.md
FUTURE_WORK_RU.md
```

## Current backend docs

Backend lives outside this repo directory:

```text
../workshop-backend/README.md
../workshop-backend/docs/TOS-template.md
../workshop-backend/docs/PRIVACY-template.md
```

## Mini library

Sample import/publish data lives at workspace root:

```text
../mini-library/
```

It contains individual lorebook, skillbook, character files and ready Workshop publish payloads.
