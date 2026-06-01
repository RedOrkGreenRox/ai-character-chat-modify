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
    ok = True
    for source in manifest['sources']:
        src_path = ROOT / source['source_path']
        assembled_path = ROOT / source['assembled_output_path']
        src_bytes = src_path.read_bytes()
        assembled_bytes = assembled_path.read_bytes()
        src_hash = sha256_bytes(src_bytes)
        assembled_hash = sha256_bytes(assembled_bytes)
        same = src_bytes == assembled_bytes
        print(f"{source['id']}: {'OK' if same else 'FAIL'}")
        print(f"  original : {src_hash}  {src_path.relative_to(ROOT)}")
        print(f"  assembled: {assembled_hash}  {assembled_path.relative_to(ROOT)}")
        if not same:
            ok = False
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
