#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'original' / 'ai-character-chat-html.txt'
LIST = ROOT / 'original' / 'ai-character-chat-list.txt'
ANALYSIS = ROOT / 'analysis'


def extract_functions_from_lines(lines, source_id):
    defs = []
    patterns = [
        re.compile(r'^\s*async function\s+([A-Za-z0-9_]+)\s*\('),
        re.compile(r'^\s*function\s+([A-Za-z0-9_]+)\s*\('),
        re.compile(r'^\s*window\.([A-Za-z0-9_]+)\s*=\s*async function\s*\('),
        re.compile(r'^\s*window\.([A-Za-z0-9_]+)\s*=\s*function\s*\('),
        re.compile(r'^\s*window\.([A-Za-z0-9_]+)\s*=\s*async function\s+[A-Za-z0-9_]*\s*\('),
        re.compile(r'^\s*window\.([A-Za-z0-9_]+)\s*=\s*function\s+[A-Za-z0-9_]*\s*\('),
        re.compile(r'^\s*const\s+([A-Za-z0-9_]+)\s*=\s*async\s*\('),
        re.compile(r'^\s*const\s+([A-Za-z0-9_]+)\s*=\s*\('),
        re.compile(r'^\s*async\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*=>'),
        re.compile(r'^\s*([A-Za-z0-9_]+)\s*\([^)]*\)\s*=>'),
    ]
    for i, line in enumerate(lines, 1):
        for pat in patterns:
            m = pat.search(line)
            if m:
                defs.append({'name': m.group(1), 'line_start': i, 'signature': line.rstrip(), 'source_id': source_id})
                break
    # dedupe same line/name from overlapping patterns
    uniq = []
    seen = set()
    for d in defs:
        key = (d['name'], d['line_start'])
        if key not in seen:
            uniq.append(d)
            seen.add(key)
    return uniq


def end_lines_from_starts(lines, defs):
    defs = sorted(defs, key=lambda d: d['line_start'])
    for idx, d in enumerate(defs):
        next_start = defs[idx + 1]['line_start'] if idx + 1 < len(defs) else len(lines) + 1
        d['line_end_guess'] = next_start - 1
    return defs


def build_call_matrix(lines, defs):
    names = sorted({d['name'] for d in defs}, key=len, reverse=True)
    for d in defs:
        body = ''.join(lines[d['line_start'] - 1:d['line_end_guess']])
        calls = []
        for name in names:
            if name == d['name']:
                continue
            if re.search(r'\b' + re.escape(name) + r'\s*\(', body):
                calls.append(name)
        d['calls_internal'] = sorted(set(calls))
        d['uses_root'] = sorted(set(re.findall(r'root\.([A-Za-z0-9_]+)', body)))
        d['uses_db_tables'] = sorted(set(re.findall(r'db\.([A-Za-z0-9_]+)', body)))
        d['uses_dollar_ids'] = sorted(set(re.findall(r'\$\.([A-Za-z0-9_]+)', body)))
    return defs


def html_id_inventory(lines):
    ids = []
    for i, line in enumerate(lines, 1):
        for m in re.finditer(r'id="([^"]+)"', line):
            ids.append({'id': m.group(1), 'line': i, 'snippet': line.strip()[:220]})
    return ids


def css_var_inventory(lines):
    vars = []
    for i, line in enumerate(lines, 1):
        for m in re.finditer(r'(--[A-Za-z0-9\-]+)\s*:\s*([^;]+);', line):
            vars.append({'name': m.group(1), 'value': m.group(2).strip(), 'line': i})
    return vars


def main():
    html_lines = HTML.read_text().splitlines(keepends=True)
    list_lines = LIST.read_text().splitlines(keepends=True)

    html_defs = build_call_matrix(html_lines, end_lines_from_starts(html_lines, extract_functions_from_lines(html_lines, 'html')))
    list_defs = build_call_matrix(list_lines, end_lines_from_starts(list_lines, extract_functions_from_lines(list_lines, 'list')))

    (ANALYSIS / 'function_inventory.json').write_text(json.dumps({
        'html': html_defs,
        'list': list_defs,
    }, ensure_ascii=False, indent=2) + '\n')

    (ANALYSIS / 'dom_id_inventory.json').write_text(json.dumps(html_id_inventory(html_lines), ensure_ascii=False, indent=2) + '\n')
    (ANALYSIS / 'css_variable_inventory.json').write_text(json.dumps(css_var_inventory(html_lines), ensure_ascii=False, indent=2) + '\n')

    api = {
        'root_imports_from_list': [
            'loadDependencies', 'aiTextPlugin', 'textToImagePlugin', 'commentsPlugin', 'tabbedCommentsPlugin',
            'uploadPlugin', 'superFetch', 'fullscreenButtonPlugin', 'combineEmojis', 'bugReport',
            'generateShareLinkForCharacter', 'compressBlobWithGzip', 'loadDataFromUrlThatReferencesCloudStorageFile',
            'decompressBlobWithGzip', 'evaluatePerchanceTextInSandbox', 'getMessageObjsWithoutSummarizedOnes',
            'injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded', 'confirmAsync'
        ],
        'db_tables': ['characters', 'threads', 'messages', 'misc', 'summaries', 'memories', 'lore', 'textEmbeddingCache', 'textCompressionCache'],
        'dom_helpers': ['$', '$$', 'showEl', 'hideEl', 'delay', 'htmlToElement', 'createLoadingModal', 'createFloatingWindow'],
        'custom_code_oc': {
            'thread_fields': ['name', 'messages', 'userCharacter', 'systemCharacter', 'character', 'customData', 'messageWrapperStyle', 'shortcutButtons'],
            'thread_events': ['MessageAdded', 'MessageEdited', 'MessageDeleted', 'MessageInserted', 'StreamingMessageChunk', 'StreamingMessage'],
            'character_fields': ['name', 'avatar', 'roleInstruction', 'reminderMessage', 'initialMessages', 'customCode', 'imagePromptPrefix', 'imagePromptSuffix', 'imagePromptTriggers', 'shortcutButtons', 'messageInputPlaceholder', 'stopSequences', 'modelName', 'userCharacter', 'streamingResponse', 'customData', 'maxTokensPerMessage', 'avatarUrl'],
            'methods': ['getChatCompletion', 'getInstructCompletion', 'generateText', 'textToImage', 'window.show', 'window.hide']
        }
    }
    (ANALYSIS / 'api_surface_matrix.json').write_text(json.dumps(api, ensure_ascii=False, indent=2) + '\n')
    print('Deep indexes written.')


if __name__ == '__main__':
    main()
