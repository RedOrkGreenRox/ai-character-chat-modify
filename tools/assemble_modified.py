#!/usr/bin/env python3
"""Assemble modified output from base fragments + modify/ overlay.

Precedence for each base fragment:
  1. modify/replace/<frag_file>    → replaces base entirely
  2. modify/inject_before/<frag>   → prepended before fragment
  3. modify/inject_after/<frag>    → appended after fragment
  4. modify/new/*                  → inserted at positions from manifest.json

Output goes to output/<source_filename>.
"""
from __future__ import annotations

import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / 'analysis' / 'exact_component_manifest.json'
MODIFY_DIR = ROOT / 'modify'
MODIFY_MANIFEST = MODIFY_DIR / 'manifest.json'
OUTPUT_DIR = ROOT / 'output'

REPLACE_DIR = MODIFY_DIR / 'replace'
INJECT_BEFORE_DIR = MODIFY_DIR / 'inject_before'
INJECT_AFTER_DIR = MODIFY_DIR / 'inject_after'
NEW_DIR = MODIFY_DIR / 'new'


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_modify_manifest() -> dict:
    if MODIFY_MANIFEST.exists():
        return json.loads(MODIFY_MANIFEST.read_text())
    return {'new_modules': {}}


def collect_new_modules_for_source(source_id: str, mod_manifest: dict) -> list[tuple[str, str, bytes]]:
    """Return [(insert_after_component_id, module_name, content), ...] for this source."""
    results = []
    new_modules = mod_manifest.get('new_modules', {})
    for mod_file, config in new_modules.items():
        if config.get('source') != source_id:
            continue
        insert_after = config.get('insert_after', '')
        insert_before = config.get('insert_before', '')
        mod_path = NEW_DIR / mod_file
        if mod_path.exists():
            results.append((insert_after, insert_before, mod_file, mod_path.read_bytes()))
        else:
            print(f'  WARNING: new module {mod_file} declared but file not found')
    return results


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text())
    mod_manifest = load_modify_manifest()

    stats = {'base': 0, 'replaced': 0, 'inject_before': 0, 'inject_after': 0, 'new_modules': 0}

    for source in manifest['sources']:
        source_id = source['id']
        component_dir = ROOT / source['component_dir']
        source_path = ROOT / source['source_path']
        output_path = OUTPUT_DIR / Path(source['source_path']).name
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Collect new modules for this source
        new_modules = collect_new_modules_for_source(source_id, mod_manifest)

        chunks: list[tuple[str, bytes]] = []  # (label, bytes)

        for component in source['components']:
            comp_id = component['id']
            frag_file = component['file']

            # Check inject_before
            inject_before_path = INJECT_BEFORE_DIR / frag_file
            if inject_before_path.exists():
                chunks.append((f'inject_before:{frag_file}', inject_before_path.read_bytes()))
                stats['inject_before'] += 1

            # Check replace vs base
            replace_path = REPLACE_DIR / frag_file
            if replace_path.exists():
                frag_bytes = replace_path.read_bytes()
                chunks.append((f'replaced:{frag_file}', frag_bytes))
                stats['replaced'] += 1
                if frag_bytes != (component_dir / frag_file).read_bytes():
                    print(f'  REPLACED: {frag_file} (modified)')
                else:
                    print(f'  REPLACED: {frag_file} (identical to base)')
            else:
                frag_bytes = (component_dir / frag_file).read_bytes()
                chunks.append((f'base:{frag_file}', frag_bytes))
                stats['base'] += 1

            # Check inject_after
            inject_after_path = INJECT_AFTER_DIR / frag_file
            if inject_after_path.exists():
                chunks.append((f'inject_after:{frag_file}', inject_after_path.read_bytes()))
                stats['inject_after'] += 1

            # Check new modules that should be inserted after this component
            for insert_after_id, insert_before_id, mod_file, mod_bytes in new_modules:
                if insert_after_id == comp_id:
                    chunks.append((f'new_module:{mod_file}', mod_bytes))
                    stats['new_modules'] += 1
                    print(f'  NEW MODULE: {mod_file} (after {comp_id})')

            # Check new modules that should be inserted before the NEXT component
            # (handled at top of next iteration via insert_before_id check isn't ideal,
            #  but for simplicity we handle insert_after here)

        # Handle new modules with insert_before pointing to a component
        # Re-scan for insert_before that didn't match an insert_after
        for insert_after_id, insert_before_id, mod_file, mod_bytes in new_modules:
            if insert_before_id and not insert_after_id:
                # Find position of the target component and insert before it
                target_idx = None
                for i, (label, _) in enumerate(chunks):
                    if insert_before_id in label:
                        target_idx = i
                        break
                if target_idx is not None:
                    chunks.insert(target_idx, (f'new_module:{mod_file}', mod_bytes))
                    stats['new_modules'] += 1
                    print(f'  NEW MODULE: {mod_file} (before {insert_before_id})')

        output_bytes = b''.join(b for _, b in chunks)
        output_path.write_bytes(output_bytes)

        original_bytes = source_path.read_bytes()
        original_hash = sha256_bytes(original_bytes)
        output_hash = sha256_bytes(output_bytes)
        is_modified = original_bytes != output_bytes

        print(f'\n  Source: {source_id}')
        print(f'  Output: {output_path.relative_to(ROOT)} ({len(output_bytes)} bytes)')
        print(f'  Original hash:  {original_hash}')
        print(f'  Output hash:    {output_hash}')
        print(f'  Status:         {"MODIFIED" if is_modified else "IDENTICAL TO ORIGINAL"}')
        print(f'  Fragments:      {len(chunks)} chunks ({len(source["components"])} base + overlays)')
        print()

    print('=== Assembly stats ===')
    print(f'  Base fragments (unchanged): {stats["base"]}')
    print(f'  Replaced fragments:         {stats["replaced"]}')
    print(f'  Inject-before snippets:     {stats["inject_before"]}')
    print(f'  Inject-after snippets:      {stats["inject_after"]}')
    print(f'  New modules:                {stats["new_modules"]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
