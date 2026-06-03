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
        component_dir = ROOT / source['component_dir']
        output_path = ROOT / source['assembled_output_path']
        output_path.parent.mkdir(parents=True, exist_ok=True)
        chunks = []
        for component in source['components']:
            frag_path = component_dir / component['file']
            frag_bytes = frag_path.read_bytes()
            expected_hash = component.get('byte_sha256')
            if expected_hash and sha256_bytes(frag_bytes) != expected_hash:
                raise SystemExit(f"Checksum mismatch for component {component['id']}: {frag_path}")
            chunks.append(frag_bytes)
        output_bytes = b''.join(chunks)
        output_path.write_bytes(output_bytes)
        print(f"assembled: {output_path.relative_to(ROOT)} ({len(output_bytes)} bytes)")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
