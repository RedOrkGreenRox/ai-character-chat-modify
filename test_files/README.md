# Test files for AI Character Chat extensions

These files are intentionally small and safe. You can drag & drop them into the chat, use `/file`, or paste supported files/images from the clipboard.

Suggested tests:

1. Drop `sample_ru_notes.txt` — should create lore entries in Russian.
2. Drop `sample_recipe_borscht.md` — then ask in Russian: `Как сварить борщ?`
3. Drop `sample_table.csv` / `sample_data.json` — tests text extraction.
4. Drop `sample_document.docx` — tests mammoth DOCX extraction.
5. Drop `sample_pdf.pdf` — tests pdf.js text extraction.
6. Drop `sample_image.png` — tests image handling/caption fallback.
7. Drop `sample_audio.wav` — tests audio transcription pipeline.

8. Drop `sample_spreadsheet.xlsx` — tests Excel/SheetJS extraction.
9. Drop `sample_archive.zip` — tests ZIP extraction of supported inner files.
