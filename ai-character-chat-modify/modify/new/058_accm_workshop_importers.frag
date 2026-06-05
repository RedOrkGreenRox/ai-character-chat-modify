
// ============================================
// ACCM WORKSHOP IMPORTERS
// ============================================
// Registers Workshop content installers through __accm.importers.
// This keeps 056_extensions_workshop.frag focused on UI/API and makes future
// item kinds (skillbook, extension-pack, generator-extension) additive.
// ============================================

(function() {
  if (window.__accmWorkshopImportersInstalled) return;
  window.__accmWorkshopImportersInstalled = true;

  let ae = window.__accm;
  if (!ae || !ae.importers) {
    console.warn('[accm] Workshop importers skipped: runtime/importer registry missing.');
    return;
  }

  function ws() {
    return window.__accm && window.__accm.workshop;
  }

  if (ae.skillbooks) {
    ae.skillbooks.registerInstaller({
      id: 'workshop.skillbook-lore-fallback',
      priority: 100,
      test: async function(payload) {
        return payload.item && payload.item.kind === 'skillbook' && !!(ws() && ws().installLorebook);
      },
      install: async function(payload) {
        let item = Object.assign({}, payload.item || {}, {
          id: (payload.item && payload.item.id) || ('workshop.skillbook.' + Date.now()),
          kind: 'skillbook',
          content: payload.content,
          source: 'workshop',
          installedAt: Date.now()
        });
        if (ae.skillbooks) {
          ae.skillbooks.register({
            id: item.id,
            kind: 'skillbook',
            name: item.name,
            label: item.name,
            description: item.summary || '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            source: 'workshop',
            workshopItem: payload.item
          });
        }
        if (ae.library) {
          await ae.library.install(item);
          if (typeof activeThreadId === 'number' && Number.isFinite(activeThreadId)) await ae.library.setActive(item.id, activeThreadId, true);
        }
        __aeToast('🏛 Skillbook installed' + (typeof activeThreadId === 'number' ? ' and enabled for this chat' : '') + ': ' + (item.name || item.id), 6000);
        return true;
      }
    });
  }

  ae.importers.register({
    id: 'workshop.perchance-dexie-export',
    priority: 10,
    test: async function(payload) {
      return !!(ws() && ws().isDexieExportText && ws().isDexieExportText(payload.content) && typeof tryImportingDexieFile === 'function');
    },
    install: async function(payload) {
      let item = payload.item;
      let df = new File([payload.content], (item.name || 'perchance-export') + '.json', { type: 'application/json' });
      let dr = await tryImportingDexieFile(df, {});
      __aeToast('🏛 Perchance export import attempted: ' + item.name + ' (' + dr + ')', 5000);
      return true;
    }
  });

  ae.importers.register({
    id: 'workshop.lorebook',
    priority: 100,
    test: async function(payload) {
      return payload.item && payload.item.kind === 'lorebook' && !!(ws() && ws().installLorebook);
    },
    install: async function(payload) {
      await ws().installLorebook(payload.item, payload.content);
      return true;
    }
  });

  ae.importers.register({
    id: 'workshop.skillbook',
    priority: 110,
    test: async function(payload) {
      return payload.item && payload.item.kind === 'skillbook' && !!(ae.skillbooks && ae.skillbooks.install);
    },
    install: async function(payload) {
      return await ae.skillbooks.install(payload);
    }
  });

  function __accmTryParseJson(text) {
    try { return JSON.parse(text); } catch(e) { return null; }
  }

  function __accmDecodeBinaryWrapper(text) {
    let json = __accmTryParseJson(text);
    if (!json || json.schema !== 'accm.binary-file.v1' || !json.base64) return null;
    let bin = atob(json.base64);
    let bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], json.filename || 'binary-file', { type: json.mime || 'application/octet-stream' });
  }

  function __accmLooksLikeNativeCharacterJson(json) {
    return !!(json && json.name && (json.roleInstruction || json.reminderMessage || json.initialMessages || json.tagline));
  }

  function __accmGeneratedAvatarDataUrl(name) {
    name = String(name || '?').trim() || '?';
    let initials = name.split(/\s+/).slice(0, 2).map(function(x) { return x[0] || ''; }).join('').toUpperCase() || '?';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    let hue = hash % 360;
    let bg1 = 'hsl(' + hue + ', 62%, 38%)';
    let bg2 = 'hsl(' + ((hue + 38) % 360) + ', 72%, 24%)';
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + bg1 + '"/><stop offset="1" stop-color="' + bg2 + '"/></linearGradient></defs>' +
      '<rect width="512" height="512" rx="96" fill="url(#g)"/>' +
      '<circle cx="384" cy="112" r="72" fill="rgba(255,255,255,0.14)"/>' +
      '<text x="256" y="292" text-anchor="middle" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="156" font-weight="800" fill="white" letter-spacing="-8">' + initials.replace(/[<>&]/g, '') + '</text>' +
      '<text x="256" y="362" text-anchor="middle" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="32" fill="rgba(255,255,255,0.72)">ACCM</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  async function __accmResizeAvatarDataUrl(dataUrl, size) {
    size = size || 512;
    try {
      let img = await new Promise(function(resolve, reject) {
        let el = new Image();
        el.onload = function() { resolve(el); };
        el.onerror = function() { reject(new Error('Could not load generated avatar image.')); };
        el.src = dataUrl;
      });
      let canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      let ctx = canvas.getContext('2d');
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, size, size);
      let side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
      let sx = ((img.naturalWidth || img.width) - side) / 2;
      let sy = ((img.naturalHeight || img.height) - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      let out = canvas.toDataURL('image/jpeg', 0.88);
      canvas.width = canvas.height = 0;
      return out;
    } catch(e) {
      console.warn('[accm] avatar resize failed:', e);
      return dataUrl;
    }
  }

  function __accmAvatarPromptForCharacter(character) {
    let desc = String(character.roleInstruction || '').replace(/{{char}}/g, character.name || 'the character').replace(/{{user}}/g, 'the user');
    desc = desc.replace(/\s+/g, ' ').slice(0, 900);
    return [
      'high quality square profile portrait avatar, character headshot, expressive face, clean composition, detailed digital painting',
      'character name: ' + (character.name || 'Unnamed'),
      desc ? 'character description: ' + desc : '',
      'no text, no logo, no watermark, centered face, suitable for a chat avatar'
    ].filter(Boolean).join(', ');
  }

  async function __accmGenerateAiAvatarForCharacter(character) {
    if (!root || typeof root.textToImagePlugin !== 'function') return null;
    let prompt = __accmAvatarPromptForCharacter(character);
    let resultObj = root.textToImagePlugin({
      prompt: prompt,
      negativePrompt: 'text, watermark, logo, blurry, low quality, deformed face, extra limbs, bad anatomy, cropped head',
      resolution: '512x512',
      style: 'z-index:10000; opacity:0.45; position:fixed; top:0.5rem; right:0.5rem; transform-origin:top right; transform:scale(0.32);'
    });
    let iframeEl = null;
    try {
      if (resultObj.iframeHtml) {
        let tmp = document.createElement('div');
        tmp.innerHTML = resultObj.iframeHtml;
        iframeEl = tmp.firstElementChild;
        if (iframeEl) document.body.append(iframeEl);
      }
      let resultData = await resultObj.onFinishPromise;
      if (resultData && resultData.dataUrl) return await __accmResizeAvatarDataUrl(resultData.dataUrl, 512);
    } finally {
      try { if (iframeEl) iframeEl.remove(); } catch(e) {}
    }
    return null;
  }

  function __accmNormalizeNativeCharacterJson(json) {
    let avatar = Object.assign({ url: '', size: 1, shape: 'square' }, json.avatar || {});

    let initialMessages = Array.isArray(json.initialMessages) ? json.initialMessages.map(function(m) {
      if (typeof m === 'string') return { author: 'ai', content: m };
      return {
        author: m.author || (m.characterId === -1 ? 'user' : m.characterId === -2 ? 'system' : 'ai'),
        content: m.content || m.message || '',
        hiddenFrom: Array.isArray(m.hiddenFrom) ? m.hiddenFrom : []
      };
    }).filter(function(m) { return m.content; }) : [];

    return {
      name: json.name || 'Unnamed',
      tagline: json.tagline || '',
      roleInstruction: json.roleInstruction || json.description || '',
      reminderMessage: json.reminderMessage || '',
      initialMessages: initialMessages,
      loreBookUrls: Array.isArray(json.loreBookUrls) ? json.loreBookUrls : [],
      modelName: json.modelName || 'perchance-ai',
      textEmbeddingModelName: json.textEmbeddingModelName || 'Xenova/bge-base-en-v1.5',
      temperature: json.temperature == null ? 0.8 : json.temperature,
      maxTokensPerMessage: json.maxTokensPerMessage == null ? 500 : json.maxTokensPerMessage,
      fitMessagesInContextMethod: json.fitMessagesInContextMethod || 'summarizeOld',
      autoGenerateMemories: json.autoGenerateMemories || 'none',
      avatar: avatar,
      scene: Object.assign({ background: { url: '' }, music: { url: '' } }, json.scene || {}),
      userCharacter: Object.assign({ avatar: {} }, json.userCharacter || {}),
      systemCharacter: Object.assign({ avatar: {} }, json.systemCharacter || {}),
      streamingResponse: json.streamingResponse !== false,
      customCode: json.customCode || '',
      customData: json.customData || {},
      folderPath: json.folderPath || '',
      shortcutButtons: Array.isArray(json.shortcutButtons) ? json.shortcutButtons : []
    };
  }

  ae.importers.register({
    id: 'workshop.binary-character-card',
    priority: 120,
    test: async function(payload) {
      if (!payload.item || payload.item.kind !== 'character') return false;
      let file = __accmDecodeBinaryWrapper(payload.content);
      return !!(file && (file.type || '').startsWith('image/') && typeof tryImportingExternalCharacterFileFormat === 'function');
    },
    install: async function(payload) {
      let file = __accmDecodeBinaryWrapper(payload.content);
      let r = await tryImportingExternalCharacterFileFormat(file, {});
      __aeToast('🏛 Character card import attempted: ' + (payload.item.name || file.name) + ' (' + r + ')', 5000);
      return true;
    }
  });

  ae.importers.register({
    id: 'workshop.native-character-json',
    priority: 150,
    test: async function(payload) {
      if (!payload.item || payload.item.kind !== 'character') return false;
      return __accmLooksLikeNativeCharacterJson(__accmTryParseJson(payload.content));
    },
    install: async function(payload) {
      let json = __accmTryParseJson(payload.content);
      let character = __accmNormalizeNativeCharacterJson(json);
      if (!character.avatar.url) {
        try {
          __aeToast('🏛 Generating AI avatar for ' + character.name + '...', 8000);
          character.avatar.url = await __accmGenerateAiAvatarForCharacter(character);
        } catch(e) {
          console.warn('[accm] AI avatar generation failed:', e);
        }
      }
      if (!character.avatar.url) character.avatar.url = __accmGeneratedAvatarDataUrl(character.name || 'Unnamed');
      let characterObj = await addCharacter(character);
      try { if (typeof renderCharacterList === 'function') await renderCharacterList(); } catch(e) { console.warn('[accm] renderCharacterList failed after character import:', e); }
      __aeToast('🏛 Character added: ' + character.name, 5000);
      return true;
    }
  });

  ae.importers.register({
    id: 'workshop.character-json',
    priority: 200,
    test: async function(payload) {
      return payload.item && payload.item.kind === 'character' && typeof tryImportingExternalCharacterFileFormat === 'function';
    },
    install: async function(payload) {
      let item = payload.item;
      let f = new File([payload.content], (item.name || 'character') + '.json', { type: 'application/json' });
      let r = await tryImportingExternalCharacterFileFormat(f, {});
      __aeToast('🏛 Character import attempted: ' + item.name + ' (' + r + ')', 5000);
      return true;
    }
  });

  ae.importers.register({
    id: 'workshop.thread-json',
    priority: 210,
    test: async function(payload) {
      return payload.item && payload.item.kind === 'thread' && typeof tryImportingDexieFile === 'function';
    },
    install: async function(payload) {
      let item = payload.item;
      let tf = new File([payload.content], (item.name || 'thread') + '.json', { type: 'application/json' });
      let tr = await tryImportingDexieFile(tf, {});
      __aeToast('🏛 Thread import attempted: ' + item.name + ' (' + tr + ')', 5000);
      return true;
    }
  });

  ae.importers.register({
    id: 'workshop.extension-pack',
    priority: 300,
    test: async function(payload) {
      return payload.item && payload.item.kind === 'extension-pack';
    },
    install: async function(payload) {
      let item = payload.item || {};
      let json = __accmTryParseJson(payload.content) || {};
      let pack = Object.assign({}, json, item, {
        id: json.id || item.id || ('workshop.pack.' + Date.now()),
        kind: 'extension-pack',
        source: 'workshop',
        content: payload.content,
        installedAt: Date.now()
      });
      if (!Array.isArray(pack.tags)) pack.tags = Array.isArray(item.tags) ? item.tags : [];
      if (ae.packs) ae.packs.register(pack);
      if (ae.library) await ae.library.install(pack);
      __aeToast('🏛 Extension pack installed: ' + (pack.name || pack.label || pack.id), 5000);
      return true;
    }
  });

  ae.importers.register({
    id: 'workshop.download-fallback',
    priority: 900,
    test: async function() { return true; },
    install: async function(payload) {
      let item = payload.item;
      if (ws() && ws().downloadText) {
        ws().downloadText((item.name || item.id || 'workshop-item') + (item.kind === 'generator' || item.kind === 'generator-extension' ? '.js' : '.json'), payload.content, item.kind === 'generator' || item.kind === 'generator-extension' ? 'application/javascript' : 'application/json');
      }
      __aeToast('🏛 Downloaded: ' + item.name + '. This item type is not auto-installed yet.', 6000);
      return true;
    }
  });

  console.log('[accm] Workshop importers registered.');
})();
