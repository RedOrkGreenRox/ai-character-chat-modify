#!/usr/bin/env python3
from __future__ import annotations

import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / 'analysis' / 'exact_component_manifest.json'


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text())
    for source in manifest['sources']:
        source_path = ROOT / source['source_path']
        lines = source_path.read_text().splitlines(keepends=True)
        total_lines = len(lines)
        expected = 1
        extracted_blob = []
        component_dir = ROOT / source['component_dir']
        component_dir.mkdir(parents=True, exist_ok=True)

        for component in source['components']:
            start = component['line_start']
            end = component['line_end']
            if start != expected:
                raise SystemExit(
                    f"Gap or overlap in {source['id']}: expected next line {expected}, got {start} for {component['id']}"
                )
            if end < start:
                raise SystemExit(f"Invalid range in {component['id']}: {start}-{end}")
            if end > total_lines:
                raise SystemExit(f"Range out of bounds in {component['id']}: {end}>{total_lines}")

            fragment = ''.join(lines[start - 1:end])
            fragment_bytes = fragment.encode()
            (component_dir / component['file']).write_bytes(fragment_bytes)
            component['byte_sha256'] = sha256_bytes(fragment_bytes)
            component['line_count'] = end - start + 1
            extracted_blob.append(fragment)
            expected = end + 1

        if expected != total_lines + 1:
            raise SystemExit(
                f"Trailing gap in {source['id']}: covered through {expected - 1}, file has {total_lines} lines"
            )

        reconstructed = ''.join(extracted_blob).encode()
        original_bytes = source_path.read_bytes()
        if reconstructed != original_bytes:
            raise SystemExit(f"Extraction verification failed for {source['id']}")
        source['source_sha256'] = sha256_bytes(original_bytes)
        source['line_count'] = total_lines

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print('Extracted exact components and updated manifest checksums.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
