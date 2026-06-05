#!/usr/bin/env python3
"""Project regression checks for ai-character-chat-modify.

This script is intentionally dependency-light: Python stdlib + `node` on PATH.
It is the main CLI entrypoint before/after changing overlay modules.

Checks:
  1. exact component roundtrip original -> reassembled
  2. overlay assembly output/
  3. modify/manifest.json consistency
  4. syntax of every modify/new/*.frag as an ES module
  5. syntax of every inline script in output HTML
  6. syntax of ../workshop-backend/src/worker.js if present
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent


def run(cmd: list[str], cwd: Path = ROOT) -> None:
    print("$", " ".join(cmd))
    p = subprocess.run(cmd, cwd=str(cwd), text=True)
    if p.returncode != 0:
        raise SystemExit(p.returncode)


def run_capture(cmd: list[str], cwd: Path = ROOT) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=True)


def require_node() -> None:
    p = run_capture(["node", "--version"], cwd=ROOT)
    if p.returncode != 0:
        raise SystemExit("node is required for JS syntax checks but was not found on PATH")
    print("node:", p.stdout.strip())


def node_check_source(source: str, suffix: str, label: str) -> None:
    fd, tmp = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    path = Path(tmp)
    try:
        path.write_text(source, encoding="utf-8")
        p = run_capture(["node", "--check", str(path)], cwd=ROOT)
        if p.returncode != 0:
            print(f"\nJS SYNTAX FAIL: {label}")
            print(p.stderr)
            raise SystemExit(1)
    finally:
        try:
            path.unlink()
        except FileNotFoundError:
            pass


def check_manifest() -> None:
    print("\n== manifest consistency ==")
    base_manifest = json.loads((ROOT / "analysis/exact_component_manifest.json").read_text(encoding="utf-8"))
    modify_manifest_path = ROOT / "modify/manifest.json"
    modify_manifest = json.loads(modify_manifest_path.read_text(encoding="utf-8"))

    component_ids: dict[str, set[str]] = {}
    for source in base_manifest["sources"]:
        component_ids[source["id"]] = {c["id"] for c in source["components"]}

    new_modules = modify_manifest.get("new_modules", {})
    declared = set(new_modules.keys())
    actual = {p.name for p in (ROOT / "modify/new").glob("*.frag")}

    missing_files = sorted(declared - actual)
    undeclared_files = sorted(actual - declared)
    if missing_files:
        print("Declared new modules missing files:", missing_files)
        raise SystemExit(1)
    if undeclared_files:
        print("Files in modify/new not declared in manifest:", undeclared_files)
        raise SystemExit(1)

    for mod_file, cfg in new_modules.items():
        source = cfg.get("source")
        if source not in component_ids:
            raise SystemExit(f"{mod_file}: unknown source {source!r}")
        insert_after = cfg.get("insert_after")
        insert_before = cfg.get("insert_before")
        if insert_after and insert_after not in component_ids[source]:
            raise SystemExit(f"{mod_file}: insert_after target not found: {insert_after}")
        if insert_before and insert_before not in component_ids[source]:
            raise SystemExit(f"{mod_file}: insert_before target not found: {insert_before}")
        if not insert_after and not insert_before:
            raise SystemExit(f"{mod_file}: must have insert_after or insert_before")

    print(f"manifest OK: {len(declared)} new modules")


def check_fragments() -> None:
    print("\n== modify/new syntax ==")
    paths = sorted((ROOT / "modify/new").glob("*.frag"))
    for p in paths:
        node_check_source(p.read_text(encoding="utf-8"), ".mjs", f"modify/new/{p.name}")
    print(f"fragments OK: {len(paths)}")


def check_inline_scripts() -> None:
    print("\n== output inline scripts syntax ==")
    html_path = ROOT / "output/ai-character-chat-html.txt"
    html = html_path.read_text(encoding="utf-8", errors="ignore")
    count = 0
    for i, m in enumerate(re.finditer(r"<script\b([^>]*)>(.*?)</script>", html, flags=re.I | re.S), 1):
        attrs = m.group(1) or ""
        body = m.group(2) or ""
        if "src=" in attrs.lower():
            continue
        count += 1
        suffix = ".mjs" if "module" in attrs.lower() else ".js"
        node_check_source(body, suffix, f"inline script #{i} {attrs.strip()}")
    print(f"inline scripts OK: {count}")


def check_worker() -> None:
    print("\n== workshop worker syntax ==")
    candidates = [
        WORKSPACE / "workshop-backend/src/worker.js",
    ]
    checked = 0
    for path in candidates:
        if path.exists():
            run(["node", "--check", str(path)], cwd=WORKSPACE)
            checked += 1
    if checked == 0:
        print("worker not found; skipped")
    else:
        print(f"worker files OK: {checked}")


def run_security_linter() -> None:
    print("\n== security & secrets linter ==")
    failed = False
    
    files_to_check = []
    files_to_check.extend((ROOT / "modify/new").glob("*.frag"))
    files_to_check.extend((ROOT / "modify/replace").glob("*.frag"))
    
    worker_path = ROOT.parent / "workshop-backend/src/worker.js"
    if worker_path.exists():
        files_to_check.append(worker_path)
        
    for path in files_to_check:
        try:
            content = path.read_text(encoding="utf-8")
        except Exception:
            continue
            
        for line_num, line in enumerate(content.splitlines(), 1):
            trimmed = line.strip()
            if trimmed.startswith("//") or trimmed.startswith("/*") or trimmed.startswith("*"):
                continue
                
            if "eval(" in line and "Blocked for security reasons" not in line and "console.warn" not in line:
                if not re.search(r'//.*eval\(', line):
                    print(f"  [SEC FAIL] {path.relative_to(ROOT.parent)}:{line_num} - Found 'eval()' call: {trimmed}")
                    failed = True
                    
            if "postMessage" in line and '"*"' in line and not re.search(r'//.*postMessage', line):
                print(f"  [SEC FAIL] {path.relative_to(ROOT.parent)}:{line_num} - Found wildcard postMessage(\"*\") call: {trimmed}")
                failed = True
                
            if "fallback-seed" in line and not re.search(r'//.*fallback-seed', line):
                print(f"  [SEC FAIL] {path.relative_to(ROOT.parent)}:{line_num} - Found hardcoded 'fallback-seed' secret fallback: {trimmed}")
                failed = True
                
            if re.search(r'\bsk-[A-Za-z0-9]{32,}\b', line):
                print(f"  [SEC FAIL] {path.relative_to(ROOT.parent)}:{line_num} - Found potential hardcoded OpenAI API key.")
                failed = True
                
    if failed:
        print("\n❌ SECURITY LINTER FAILED: Vulnerabilities or hardcoded secrets found!")
        raise SystemExit(1)
    else:
        print("security linter OK: No vulnerabilities or hardcoded secrets found.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-worker", action="store_true")
    args = parser.parse_args()

    require_node()
    print("\n== exact component roundtrip ==")
    run([sys.executable, "tools/verify_exact_components.py"])

    print("\n== overlay assembly ==")
    run([sys.executable, "tools/assemble_modified.py"])

    check_manifest()
    check_fragments()
    check_inline_scripts()
    if not args.skip_worker:
      check_worker()

    print("\n== frontend utility unit tests ==")
    run(["node", "tools/test_frontend_utils.mjs"])

    run_security_linter()

    print("\nREGRESSION OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
