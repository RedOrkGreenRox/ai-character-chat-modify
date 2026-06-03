# 13. Machine-readable indexes

> **Status note (2026-06-03):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

В этой итерации были добавлены дополнительные индексы для следующего этапа анализа.

## Новые JSON-индексы

### `analysis/function_inventory.json`
Содержит:
- список найденных function-like definitions;
- line start / rough end;
- rough internal call references;
- `uses_root`;
- `uses_db_tables`;
- `uses_dollar_ids`.

Это эвристический индекс, не полноценный AST.

### `analysis/function_to_component_map.json`
Связывает функции с canonical exact-components.

Markdown-версия:
- `analysis/function_to_component_map.md`

### `analysis/dom_id_inventory.json`
Все найденные `id="..."` в HTML.

Замечание:
- там есть и динамические шаблонные `id` внутри строк/комментариев;
- то есть это инвентарь, а не только runtime-real DOM nodes.

### `analysis/css_variable_inventory.json`
Все CSS custom properties (`--...`) с line numbers.

### `analysis/api_surface_matrix.json`
Сводка по:
- `root.*`
- DB tables
- DOM helpers
- `oc.*`

## Для чего это полезно дальше
Эти файлы можно использовать для:
- автогенерации dependency graph;
- поиска hot paths;
- выделения модулей следующего уровня;
- построения map «какая функция зависит от каких DOM ids / DB tables / root helpers».

## Ограничения
- это regex/heuristic extraction, не AST parser;
- `line_end_guess` — приблизительное окончание по следующему определению;
- во вложенных функциях и больших блоках возможны ложные срабатывания;
- list-side Perchance syntax извлекается только частично как function-like patterns.

Но как навигационный индекс этого уже достаточно, и он сильно ускоряет следующий проход.
