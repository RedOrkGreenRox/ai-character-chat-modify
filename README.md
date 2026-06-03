# ai-character-chat-modify

Modification workstation for Perchance `ai-character-chat`.

## Current state

The repository contains:

- exact original Perchance HTML/list sources in `original/`;
- exact component decomposition in `analysis/exact_components/`;
- overlay modifications in `modify/`;
- assembled Perchance-ready output in `output/`;
- current ACCM extension/runtime/Workshop work.

## Start here

For current architecture and status, read:

```text
docs/16_current_accm_architecture.md
docs/BASELINE_CURRENT.md
analysis/extension_wrapper_chains.md
analysis/extension_module_manifest.json
```

Older reports are historical. The current source of truth is `docs/16_current_accm_architecture.md`.

## Build and verify

```bash
python tools/regression.py
```

or from workspace root:

```bash
make regression
make worker-check
```

## Output files for Perchance

```text
output/ai-character-chat-html.txt
output/ai-character-chat-list.txt
```

Currently the list output is identical to original; the HTML output contains ACCM overlays.

## Backend and sample library

Workspace-level supporting projects:

```text
../workshop-backend/
../workshop-backend.zip
../mini-library/
```
