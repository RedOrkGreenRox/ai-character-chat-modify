#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'analysis' / 'commented_original'
SOURCES = [
    ROOT / 'original' / 'ai-character-chat-html.txt',
    ROOT / 'original' / 'ai-character-chat-list.txt',
]

CODE_LIKE_RE = re.compile(
    r'(\b(function|async|await|const|let|var|if|for|while|return|import|class|new)\b|=>|[{}();=]|'
    r'\b(window|document|oc|db|root|Dexie|CodeMirror)\.|\$\.|<script|<div|<button|<style|</)'
)


def slugify(text: str) -> str:
    text = re.sub(r'[^a-zA-Z0-9]+', '-', text.lower()).strip('-')
    return text[:80] or 'comment'


def write_block(target_dir: Path, prefix: str, start: int, end: int, content: str, title_hint: str) -> str:
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f'{prefix}_{start:05d}_{end:05d}_{slugify(title_hint)}.frag'
    (target_dir / filename).write_text(content)
    return filename


def extract_html_comments(source_path: Path, text: str):
    lines = text.splitlines(keepends=True)
    in_block = False
    start = None
    buf = []
    items = []
    for i, line in enumerate(lines, 1):
        stripped = line.lstrip()
        if not in_block and stripped.startswith('<!--'):
            in_block = True
            start = i
            buf = [line]
            if '-->' in stripped and stripped.index('-->') > stripped.index('<!--'):
                content = ''.join(buf)
                items.append((start, i, content))
                in_block = False
                buf = []
        elif in_block:
            buf.append(line)
            if '-->' in line:
                content = ''.join(buf)
                items.append((start, i, content))
                in_block = False
                buf = []
    return items


def extract_block_comments(source_path: Path, text: str):
    lines = text.splitlines(keepends=True)
    in_block = False
    start = None
    buf = []
    items = []
    for i, line in enumerate(lines, 1):
        stripped = line.lstrip()
        if not in_block and stripped.startswith('/*'):
            in_block = True
            start = i
            buf = [line]
            if '*/' in stripped and stripped.index('*/') > stripped.index('/*'):
                items.append((start, i, ''.join(buf)))
                in_block = False
                buf = []
        elif in_block:
            buf.append(line)
            if '*/' in line:
                items.append((start, i, ''.join(buf)))
                in_block = False
                buf = []
    return items


def extract_line_comment_runs(source_path: Path, text: str):
    lines = text.splitlines(keepends=True)
    items = []
    run = []
    start = None
    for i, line in enumerate(lines, 1):
        stripped = line.lstrip()
        if stripped.startswith('//'):
            if start is None:
                start = i
                run = [line]
            else:
                run.append(line)
        else:
            if start is not None:
                items.append((start, i - 1, ''.join(run)))
                start = None
                run = []
    if start is not None:
        items.append((start, len(lines), ''.join(run)))
    return items


def classify_line_run(content: str):
    raw_lines = content.splitlines()
    uncommented = [re.sub(r'^\s*//\s?', '', l) for l in raw_lines]
    nonempty = [l for l in uncommented if l.strip()]
    code_like_lines = sum(1 for l in nonempty if CODE_LIKE_RE.search(l))
    is_code_like = len(nonempty) >= 2 and code_like_lines >= 2
    title_hint = next((l.strip() for l in nonempty if l.strip()), 'commented-line-run')
    return is_code_like, code_like_lines, len(nonempty), title_hint


def main() -> int:
    if OUT.exists():
        # keep explicit outputs tidy between reruns
        for path in sorted(OUT.rglob('*'), reverse=True):
            if path.is_file():
                path.unlink()
        for path in sorted(OUT.rglob('*'), reverse=True):
            if path.is_dir():
                try:
                    path.rmdir()
                except OSError:
                    pass
    OUT.mkdir(parents=True, exist_ok=True)

    index = {'sources': []}

    for source_path in SOURCES:
        text = source_path.read_text()
        rel = source_path.relative_to(ROOT)
        source_id = source_path.stem
        src_entry = {
            'source_path': str(rel),
            'source_id': source_id,
            'html_comments': [],
            'block_comments': [],
            'line_comment_runs': [],
            'code_like_line_comment_runs': [],
        }

        html_dir = OUT / source_id / 'html_comments'
        for start, end, content in extract_html_comments(source_path, text):
            title = re.sub(r'^\s*<!--\s*', '', content.splitlines()[0]).strip()
            filename = write_block(html_dir, 'html_comment', start, end, content, title)
            src_entry['html_comments'].append({'line_start': start, 'line_end': end, 'file': str((html_dir / filename).relative_to(ROOT))})

        block_dir = OUT / source_id / 'block_comments'
        for start, end, content in extract_block_comments(source_path, text):
            title = re.sub(r'^\s*/\*\s*', '', content.splitlines()[0]).strip()
            filename = write_block(block_dir, 'block_comment', start, end, content, title)
            src_entry['block_comments'].append({'line_start': start, 'line_end': end, 'file': str((block_dir / filename).relative_to(ROOT))})

        line_dir = OUT / source_id / 'line_comment_runs'
        code_like_dir = OUT / source_id / 'code_like_line_comment_runs'
        for start, end, content in extract_line_comment_runs(source_path, text):
            is_code_like, code_like_lines, nonempty_count, title = classify_line_run(content)
            filename = write_block(line_dir, 'line_comment_run', start, end, content, title)
            entry = {
                'line_start': start,
                'line_end': end,
                'file': str((line_dir / filename).relative_to(ROOT)),
                'nonempty_uncommented_lines': nonempty_count,
                'code_like_lines': code_like_lines,
                'title_hint': title,
            }
            src_entry['line_comment_runs'].append(entry)
            if is_code_like:
                code_filename = write_block(code_like_dir, 'code_like_run', start, end, content, title)
                src_entry['code_like_line_comment_runs'].append({**entry, 'file': str((code_like_dir / code_filename).relative_to(ROOT))})

        index['sources'].append(src_entry)

    (OUT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n')

    md = []
    md.append('# Commented original code catalog\n')
    md.append('Каталог комментариев и закомментированных кусков, извлечённых из `original/` без изменения текста. Особенно полезен каталог `code_like_line_comment_runs/` — там собраны длинные `//`-блоки, похожие на выключенный код, старые фичи, альтернативные реализации и экспериментальные персонажи.\n')
    for src in index['sources']:
        md.append(f'## {src["source_path"]}\n')
        md.append(f'- HTML comment blocks: **{len(src["html_comments"])}**')
        md.append(f'- Block comments (`/* ... */`): **{len(src["block_comments"])}**')
        md.append(f'- All `//` runs: **{len(src["line_comment_runs"])}**')
        md.append(f'- Code-like `//` runs: **{len(src["code_like_line_comment_runs"])}**\n')
        md.append('### Code-like `//` runs\n')
        for item in src['code_like_line_comment_runs']:
            md.append(f'- lines {item["line_start"]}-{item["line_end"]}: `{item["file"]}`  ')
            md.append(f'  hint: `{item["title_hint"][:120]}`')
        md.append('')
        md.append('### HTML comment blocks\n')
        for item in src['html_comments']:
            md.append(f'- lines {item["line_start"]}-{item["line_end"]}: `{item["file"]}`')
        md.append('')
    (OUT / 'README.md').write_text('\n'.join(md).rstrip() + '\n')
    print(f'Wrote commented-original catalog to {OUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
