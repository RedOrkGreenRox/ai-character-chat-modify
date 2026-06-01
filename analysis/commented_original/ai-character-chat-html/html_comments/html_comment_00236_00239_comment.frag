<!--
notes to self:
 - Adding a new character property that can safely be undefined by default (=> no dexie db upgrade needed) just involves adding it to `characterDetailsPrompt` (with correct parsing/unparsing if needed) and optionally `characterPropertiesVisibleToCustomCode`, and possibly update getCharacterHash. If you need to react to custom code changes, you may need to add rendering/etc calls in `updateDbWithNewDataFromCustomCode`. In cases where undefined is not viable as default, you will also need to check/update `getUserCharacterObj` and `getSystemCharacterObj`.
-->
