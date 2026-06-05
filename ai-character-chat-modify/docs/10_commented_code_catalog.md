# 10. Catalog of commented-out code

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

Папка с извлечённым закомментированным кодом:
- `analysis/commented_original/`

Главный индекс:
- `analysis/commented_original/README.md`
- `analysis/commented_original/index.json`

## Что туда вынесено

### 1) HTML comment blocks
Путь:
- `analysis/commented_original/ai-character-chat-html/html_comments/`

Самое интересное там:
- old external dependency includes
- old bundle references
- hidden feedback modal implementation
- intro video block
- hidden thread settings / add shortcut / reply loop UI pieces

### 2) Code-like `//` comment runs
Путь:
- `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/`

Это и есть «самое вкусное»:
- альтернативные/старые реализации
- удалённые фичи
- старые character examples
- экспериментальный custom-code
- старые import/export пути
- старые summary/memory редакторы
- TTS / auto-reply loop эксперимент

## Особенно интересные блоки

### Старые/экспериментальные персонажи
- `code_like_run_04576_04579_*.frag` + соседние блоки — **Yoda** prototype
- `code_like_run_04626_04639_*.frag` и соседние — **Nick Wilde** / expression-classifier custom code trail
- `code_like_run_04720_04723_python-coder.frag` — **Python Coder** share-link character
- `code_like_run_04791_04797_phoebe.frag` — **Phoebe** quick character block

### Старые summary / memory UI
- `code_like_run_04300_04321_function-createinlinesummaryeditor-summarytext.frag`
- `code_like_run_04323_04329_async-function-updateinlinesummaryeditor.frag`
- `code_like_run_09859_09873_old-summaries-approach.frag`
- `code_like_run_10065_10073_async-function-regeneratememorieshandler.frag`
- `code_like_run_10154_10187_first-we-remove-edited-deleted-memories-*.frag`
- `code_like_run_10193_10225_if-messageidlevelschanged-*.frag`

### Старые/альтернативные bridge pieces
- `code_like_run_10838_10864_function-watchobject-obj-callback.frag`
- `code_like_run_10868_10888_oc-thread-messages-watcharray-*.frag`
- `code_like_run_10627_10643_this-is-what-allows-characters-to-make-arbitrary-requests-*.frag`

### Старые import/export / share flows
- `code_like_run_05043_05070_*` — old share URL / avatar warning logic
- `code_like_run_12584_12604_async-function-readfirstlineoftextblob-file.frag`
- `code_like_run_12628_12633_*` — old parallel raw-import path that caused Chrome crash
- `code_like_run_12721_12738_*` — old line-by-line Dexie import idea
- `code_like_run_13084_13085_*` — old blob rebuild import snippet

### UI/feature experiments
- `code_like_run_02710_02715_dragula-messagefeed.frag` — dragula experiment
- `code_like_run_12107_12224_*` — reply-loop / TTS auto conversation experiment
- `html_comment_01775_01790_*` — old inline feedback/chat toggle block
- `html_comment_01909_01922_*` — intro video block

## Зачем это полезно
Эти блоки помогают понять:
- какие фичи уже пробовались и были отключены;
- где автор экспериментировал с альтернативной архитектурой;
- какие недоделанные или спорные места в коде наиболее перспективны для future modding;
- какие идеи можно вернуть в следующей итерации уже как отдельные модули.

## Примечание
Каталог делится на:
- `html_comments/`
- `block_comments/`
- `line_comment_runs/`
- `code_like_line_comment_runs/`

Если нужно, на следующем шаге можно сделать ещё один проход и выделить из `code_like_line_comment_runs/` только curated subset «legacy features worth reviving».
