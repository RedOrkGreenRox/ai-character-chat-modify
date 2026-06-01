# AI Character Chat — detailed documentation draft

Этот каталог — старт подробной документации по разбору `original/ai-character-chat-html.txt` и `original/ai-character-chat-list.txt`.

## Главное
- Точное разбиение на фрагменты: `analysis/exact_component_manifest.json`
- Человекочитаемая карта: `analysis/component_map.md`
- Исследование по Perchance: `analysis/perchance_research.md`
- Каталог закомментированного кода: `analysis/commented_original/README.md`

## Документы
1. `01_perchance_runtime_and_source_split.md`
2. `02_entrypoints_and_boot_sequence.md`
3. `03_dom_map.md`
4. `04_db_schema_and_persistence.md`
5. `05_business_logic_map.md`
6. `06_api_surfaces.md`
7. `07_styles_and_theme.md`
8. `08_memory_lore_summaries.md`
9. `09_function_index.md`
10. `10_commented_code_catalog.md`

## Важный принцип текущего этапа
Пока что разбор сделан так, чтобы сохранялась возможность **точной обратной сборки** без изменения байтов исходников. Поэтому документация идёт поверх exact-fragments, а не вместо них.
