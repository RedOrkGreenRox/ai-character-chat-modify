import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Path to fragment files
const corePath = resolve(ROOT, 'modify/new/030_extensions_core.frag');
const searchPath = resolve(ROOT, 'modify/new/032_extensions_web_search.frag');

async function main() {
  console.log('Reading fragment files...');
  const coreCode = await readFile(corePath, 'utf8');
  const searchCode = await readFile(searchPath, 'utf8');

  console.log('Setting up JSDOM / Browser Mock Sandbox Context...');

  // Mock localStorage
  const storageMap = new Map();
  const localStorageMock = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };

  // Mock document with createElement for div and textarea elements
  const documentMock = {
    createElement(tagName) {
      const state = {
        innerHTML: '',
        value: '',
      };
      return {
        set innerHTML(html) {
          state.innerHTML = html;
          // Simple entity decoder for textarea testing
          if (tagName === 'textarea') {
            state.value = html
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
          }
        },
        get innerHTML() {
          return state.innerHTML;
        },
        set value(val) {
          state.value = val;
        },
        get value() {
          return state.value;
        },
        get textContent() {
          // A very simple html tag stripper mock for testing strip HTML
          return state.innerHTML.replace(/<\/?[^>]+(>|$)/g, "");
        },
        get innerText() {
          return this.textContent;
        }
      };
    }
  };

  // Setup basic browser context
  const context = {
    window: {},
    document: documentMock,
    location: { href: 'https://perchance.org/ai-character-chat' },
    localStorage: localStorageMock,
    console: {
      log: (...args) => console.log('[Sandbox Log]', ...args),
      error: (...args) => console.error('[Sandbox Error]', ...args),
      warn: (...args) => console.warn('[Sandbox Warn]', ...args),
    },
    setTimeout: (fn, delay) => setTimeout(fn, delay),
    // Dexie mock
    db: {
      misc: {
        get: async () => null,
        put: async () => null,
      },
      lore: {
        where: () => ({
          toArray: async () => [],
        })
      }
    },
    // Globals in original perchance system
    getBotReply: function(opts) { return opts; },
    createMessageObj: function(args) { return args || {}; },
    __AE_PROCESSING_TASKS: new Map(),
    __aeRenderTaskPanel: () => {},
  };

  context.window = context;

  console.log('Initializing VM context and evaluating code...');
  vm.createContext(context);

  // Evaluate the fragment files
  vm.runInContext(coreCode, context, { filename: '030_extensions_core.frag' });
  vm.runInContext(searchCode, context, { filename: '032_extensions_web_search.frag' });

  console.log('Evaluation succeeded! Starting Unit Tests...');

  // Test 1: __aeChunkText
  console.log('Running Test 1: __aeChunkText');
  assert.ok(typeof context.__aeChunkText === 'function', '__aeChunkText is not defined');
  
  const sampleText = "The quick brown fox jumps over the lazy dog";
  const chunks = context.__aeChunkText(sampleText, 3);
  // Convert from VM Array to host Array for clean assertion comparison
  const hostChunks = Array.from(chunks);
  assert.deepEqual(hostChunks, [
    "The quick brown",
    "fox jumps over",
    "the lazy dog"
  ], 'Text chunking failed with basic input');

  const emptyChunks = context.__aeChunkText("", 5);
  assert.deepEqual(Array.from(emptyChunks), [], 'Empty text chunking should return empty array');

  // Test 2: __aeNormalizeFileName
  console.log('Running Test 2: __aeNormalizeFileName');
  assert.ok(typeof context.__aeNormalizeFileName === 'function', '__aeNormalizeFileName is not defined');
  assert.equal(context.__aeNormalizeFileName('  My File  Name.pdf  '), 'my file name.pdf');
  assert.equal(context.__aeNormalizeFileName('UPPERCASE.TXT'), 'uppercase.txt');
  assert.equal(context.__aeNormalizeFileName('multiple   spaces  .doc'), 'multiple spaces .doc');
  assert.equal(context.__aeNormalizeFileName(null), '');

  // Test 3: __aeCreateId
  console.log('Running Test 3: __aeCreateId');
  assert.ok(typeof context.__aeCreateId === 'function', '__aeCreateId is not defined');
  const id1 = context.__aeCreateId('test');
  const id2 = context.__aeCreateId('test');
  assert.ok(id1.startsWith('test_'), 'ID should start with provided prefix');
  assert.notEqual(id1, id2, 'Generated IDs should be unique');

  // Test 4: __aeStripHtml
  console.log('Running Test 4: __aeStripHtml');
  assert.ok(typeof context.__aeStripHtml === 'function', '__aeStripHtml is not defined');
  const stripped = context.__aeStripHtml('<div>Hello <b>world</b>!</div>');
  assert.equal(stripped, 'Hello world!', 'HTML stripping failed');

  // Test 5: __aeDecodeHtmlEntities
  console.log('Running Test 5: __aeDecodeHtmlEntities');
  assert.ok(typeof context.__aeDecodeHtmlEntities === 'function', '__aeDecodeHtmlEntities is not defined');
  const sampleEntityText = '&lt;hello&gt;';
  const decoded = context.__aeDecodeHtmlEntities(sampleEntityText);
  assert.equal(decoded, '<hello>', 'HTML entity decoding failed');
  console.log('__aeDecodeHtmlEntities returned:', JSON.stringify(decoded));

  // Test 6: __aeExtractJsonArray
  console.log('Running Test 6: __aeExtractJsonArray');
  assert.ok(typeof context.__aeExtractJsonArray === 'function', '__aeExtractJsonArray is not defined');
  const extractedArray = context.__aeExtractJsonArray('Here is a list: [1, "two", 3] and some extra text.');
  assert.deepEqual(JSON.parse(JSON.stringify(extractedArray)), [1, "two", 3]);
  assert.equal(context.__aeExtractJsonArray('No array here!'), null);
  assert.equal(context.__aeExtractJsonArray('Malformed [1, 2, "three"'), null);

  // Test 7: __aeExtractJsonObject
  console.log('Running Test 7: __aeExtractJsonObject');
  assert.ok(typeof context.__aeExtractJsonObject === 'function', '__aeExtractJsonObject is not defined');
  const extractedObj = context.__aeExtractJsonObject('This is a json: {"a": 1, "b": "hello"} end.');
  assert.deepEqual(JSON.parse(JSON.stringify(extractedObj)), { a: 1, b: "hello" });
  assert.equal(context.__aeExtractJsonObject('No object here!'), null);

  console.log('\n=========================================');
  console.log('🎉 ALL FRONTEND UTILITY UNIT TESTS PASSED 🎉');
  console.log('=========================================');
}

main().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
