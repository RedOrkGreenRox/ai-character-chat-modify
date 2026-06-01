# Analysis workspace

## Files
- `exact_component_manifest.json` — canonical manifest with exact line ranges, tags and SHA-256 checksums.
- `component_map.md` — human-readable map by component and by criteria.
- `perchance_research.md` — notes from Perchance docs review relevant to this codebase.
- `exact_components/` — verbatim fragments extracted from `original/`.

## Scripts
Run from repo root:

```bash
python tools/extract_exact_components.py
python tools/assemble_exact_components.py
python tools/verify_exact_components.py
```

## Guarantee
`assemble_exact_components.py` concatenates the fragments back into:
- `reassembled/ai-character-chat-html.txt`
- `reassembled/ai-character-chat-list.txt`

`verify_exact_components.py` confirms they are byte-for-byte identical to the originals.
