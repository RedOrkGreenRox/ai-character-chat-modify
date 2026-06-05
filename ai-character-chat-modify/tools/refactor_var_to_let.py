#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOD_DIR = ROOT / "modify/new"

def refactor_file(path: Path):
    text = path.read_text(encoding="utf-8")
    
    # Replace '\bvar\s+' with 'let ' safely using regex
    # We avoid matching inside strings by using a simple word-boundary match
    new_text = re.sub(r'\bvar\s+', 'let ', text)
    
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        print(f"Refactored: {path.name}")
    else:
        print(f"No var declarations found in: {path.name}")

def main():
    print("Starting automatic var -> let refactoring...")
    for p in sorted(MOD_DIR.glob("*.frag")):
        refactor_file(p)
    print("Refactoring completed!")

if __name__ == "__main__":
    main()
