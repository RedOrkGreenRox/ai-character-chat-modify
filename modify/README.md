# Modify overlay system

This directory contains your modifications to the base fragments.

## Structure

```
modify/
├── replace/          ← Replace a base fragment entirely
│                      File name must match the base fragment file name.
│                      Example: replace/023_reply_generation_pipeline.frag
│                      will replace analysis/exact_components/.../023_...frag
│
├── inject_after/     ← Insert code AFTER a specific base fragment
│                      File name must match the base fragment file name.
│                      Example: inject_after/015_module_db_bootstrap_upgrades.frag
│                      will be inserted right after that fragment.
│
├── inject_before/    ← Insert code BEFORE a specific base fragment
│                      File name must match the base fragment file name.
│
└── new/              ← Completely new modules
                       Position is defined in modify/manifest.json
                       under "insert_after" or "insert_before" fields.
```

## How to use

### 1. Edit an existing fragment
Copy the base fragment into `replace/`, then edit it freely:
```bash
cp analysis/exact_components/ai-character-chat-html/026_module_send_button_commands.frag \
   modify/replace/026_module_send_button_commands.frag
# Now edit modify/replace/026_module_send_button_commands.frag
```

### 2. Add code after an existing fragment
Create a file in `inject_after/` named after the base fragment:
```bash
# Add a new DB table after the DB bootstrap
cat > modify/inject_after/015_module_db_bootstrap_upgrades.frag << 'EOF'
// === NEW: WebSocket sync table ===
db.version(91).stores({ websocketSyncState: '++id,threadId,lastSyncTime' });
EOF
```

### 3. Add a completely new module
Create a file in `new/` and register its position in `modify/manifest.json`:
```bash
cat > modify/new/030_weather_command.frag << 'EOF'
// === NEW MODULE: /weather slash command ===
// ... your code ...
EOF
```

Then add to `modify/manifest.json`:
```json
{
  "new_modules": {
    "030_weather_command.frag": {
      "source": "ai-character-chat-html",
      "insert_after": "html_026_module_send_button_commands"
    }
  }
}
```

### 4. Build
```bash
python tools/assemble_modified.py
```

### 5. Diff against original
```bash
diff original/ai-character-chat-html.txt output/ai-character-chat-html.txt
```

### 6. Roll back
Just delete the file from `modify/replace/`, `modify/inject_after/`, etc.

## Precedence
For each base fragment, the assembly checks:
1. Does `modify/replace/<fragment_file>` exist? → Use it instead of base.
2. Otherwise → Use the base fragment as-is.
3. Always check `modify/inject_before/<fragment_file>` → Prepend if exists.
4. Always check `modify/inject_after/<fragment_file>` → Append if exists.
5. Always check `modify/manifest.json` → Insert new modules at declared positions.
