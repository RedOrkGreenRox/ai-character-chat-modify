
<!-- open characters base code + a loooot of hacky edits which I initially tried to keep track of, but have failed -->


<!--
notes to self:
 - Adding a new character property that can safely be undefined by default (=> no dexie db upgrade needed) just involves adding it to `characterDetailsPrompt` (with correct parsing/unparsing if needed) and optionally `characterPropertiesVisibleToCustomCode`, and possibly update getCharacterHash. If you need to react to custom code changes, you may need to add rendering/etc calls in `updateDbWithNewDataFromCustomCode`. In cases where undefined is not viable as default, you will also need to check/update `getUserCharacterObj` and `getSystemCharacterObj`.
-->


<!--
<script src="https://cdnjs.cloudflare.com/ajax/libs/dexie/4.0.8/dexie.min.js"></script>
<script src="https://unpkg.com/dexie-export-import@4.1.2/dist/dexie-export-import.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked@4.2.12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.1/dist/purify.min.js"></script>
-->
<!-- BUNDLE OF ABOVE SCRIPTS: -->
<!-- old version 1: <script src="https://user.uploads.dev/file/9992637c7d690500ce39ae476424fd7c.js"></script> -->
<!-- old version 2: <script src="https://user.uploads.dev/file/e7f08d9c863ca4a4a6c2eed28bf21ef9.js"></script> -->

<!-- <script id="mainDependencyBundleScriptEl" src="https://user.uploads.dev/file/356cdae1f07f47ea93584f5dafea8a8c.js"></script> -->
<script>
  root.loadDependencies(); // dependencies script now put inside a generator that exports a function to execute it
</script>

<!-- <script src="https://cdn.jsdelivr.net/npm/msgpackr@1.11.0/dist/index.min.js"></script> -->

