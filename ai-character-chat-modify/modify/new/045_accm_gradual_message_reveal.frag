
// ============================================
// ACCM GRADUAL MESSAGE REVEAL
// ============================================
// Custom full-message reveal effect. It preserves the rendered markdown/HTML DOM
// and reveals text nodes in place. It also watches final re-renders, so a message
// should not disappear and restart after finishing generation.
//
// Toggle: ACCM → ✨ Effects → Gradual text reveal
// ============================================

(function() {
  if (window.__accmGradualMessageRevealInstalled) return;
  window.__accmGradualMessageRevealInstalled = true;

  const REVEAL_CONFIG = {
    storageKey: '__accmTextRevealSettings',
    defaultEnabled: true,
    charsPerSecond: 180,
    minDurationMs: 220,
    maxDurationMs: 3800,
    maxChars: 12000,
    rescanIntervalMs: 700
  };

  window.__accmRevealedMessageKeys = window.__accmRevealedMessageKeys || new Set();
  window.__accmRevealedContainerKeys = window.__accmRevealedContainerKeys || new Set();
  const revealedMessageKeys = window.__accmRevealedMessageKeys;
  const scheduledElements = new WeakSet();
  const revealedContainerKeys = window.__accmRevealedContainerKeys;

  var style = document.createElement('style');
  style.textContent = `
    @keyframes accmWholeMessageFadeIn {
      from { opacity: 0; transform: translateY(4px); filter: blur(2px); }
      to   { opacity: 1; transform: translateY(0); filter: blur(0); }
    }
    .message.accm-whole-message-reveal {
      animation: accmWholeMessageFadeIn 520ms ease-out both;
    }
    @media (prefers-reduced-motion: reduce) {
      .message.accm-whole-message-reveal { animation: none; }
    }
  `;
  document.head.appendChild(style);

  function revealMessageContainer(messageEl) {
    if (!messageEl || !(messageEl instanceof HTMLElement)) return;
    if (!isEnabled()) return;
    var id = messageEl.dataset && messageEl.dataset.id;
    var key = id && id !== 'undefined' && id !== 'null' && id !== 'NaN' ? 'id:' + id : null;
    if (key && revealedContainerKeys.has(key)) return;
    if (key) revealedContainerKeys.add(key);
    messageEl.classList.add('accm-whole-message-reveal');
    setTimeout(function() { try { messageEl.classList.remove('accm-whole-message-reveal'); } catch(e) {} }, 800);
  }


  function loadSettings() {
    try {
      var raw = localStorage.getItem(REVEAL_CONFIG.storageKey);
      return Object.assign({ enabled: REVEAL_CONFIG.defaultEnabled }, raw ? JSON.parse(raw) : {});
    } catch(e) {
      return { enabled: REVEAL_CONFIG.defaultEnabled };
    }
  }

  function saveSettings(s) {
    localStorage.setItem(REVEAL_CONFIG.storageKey, JSON.stringify(Object.assign({ enabled: REVEAL_CONFIG.defaultEnabled }, s || {})));
  }

  function isEnabled() {
    return loadSettings().enabled !== false;
  }

  function setEnabled(value) {
    var s = loadSettings();
    s.enabled = !!value;
    saveSettings(s);
    if (typeof __aeToast === 'function') __aeToast('Gradual text reveal: ' + (s.enabled ? 'ON' : 'OFF'), 2200);
  }

  function collectTextNodes(root) {
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script,style,noscript')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function getMessageKey(el) {
    var msg = el && el.closest && el.closest('.message');
    if (!msg || !msg.dataset) return null;
    var id = msg.dataset.id;
    if (id && id !== 'undefined' && id !== 'null' && id !== 'NaN') return 'id:' + id;
    return null;
  }

  function isCurrentlyStreaming(el) {
    var msg = el && el.closest && el.closest('.message');
    return !!(msg && msg.dataset && msg.dataset.currentlyStreaming);
  }

  function scheduleReveal(el, delay) {
    if (!el || scheduledElements.has(el)) return;
    scheduledElements.add(el);
    setTimeout(function() {
      scheduledElements.delete(el);
      revealMessageText(el);
    }, delay == null ? 40 : delay);
  }

  function revealMessageText(el) {
    if (!el || el.dataset.accmRevealDone === '1') return;
    if (!isEnabled()) return;

    // Streaming has its own progressive appearance. Wait for final non-streaming state.
    if (isCurrentlyStreaming(el)) {
      scheduleReveal(el, 500);
      return;
    }

    var messageKey = getMessageKey(el);
    if (messageKey && revealedMessageKeys.has(messageKey)) {
      el.dataset.accmRevealDone = '1';
      return;
    }

    var textNodes = collectTextNodes(el);
    if (!textNodes.length) return;

    var originals = textNodes.map(function(n) { return n.nodeValue; });
    var totalChars = originals.reduce(function(sum, t) { return sum + t.length; }, 0);
    if (!totalChars) return;
    if (totalChars > REVEAL_CONFIG.maxChars) {
      el.dataset.accmRevealDone = '1';
      if (messageKey) revealedMessageKeys.add(messageKey);
      return;
    }

    el.dataset.accmRevealDone = '1';
    if (messageKey) revealedMessageKeys.add(messageKey);

    textNodes.forEach(function(n) { n.nodeValue = ''; });

    var duration = Math.max(REVEAL_CONFIG.minDurationMs, Math.min(REVEAL_CONFIG.maxDurationMs, totalChars / REVEAL_CONFIG.charsPerSecond * 1000));
    var start = performance.now();
    var finished = false;

    function render(count) {
      var remaining = count;
      for (var i = 0; i < textNodes.length; i++) {
        var t = originals[i];
        if (remaining >= t.length) {
          textNodes[i].nodeValue = t;
          remaining -= t.length;
        } else {
          textNodes[i].nodeValue = t.slice(0, Math.max(0, remaining));
          remaining = 0;
        }
      }
    }

    function finish() {
      if (finished) return;
      finished = true;
      render(totalChars);
      el.removeEventListener('click', finish);
    }

    el.addEventListener('click', finish, { once: true });

    function tick(now) {
      if (finished) return;
      if (!el.isConnected) return;
      var progress = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 2);
      render(Math.floor(totalChars * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else finish();
    }

    requestAnimationFrame(tick);
  }

  function scanExistingUnrevealed() {
    if (!isEnabled()) return;
    document.querySelectorAll('.messageText:not([data-accm-reveal-done="1"])').forEach(function(el) {
      // Avoid animating a huge backlog immediately after page load: if it has a stable id
      // and is already in the set, mark it done. Otherwise schedule normally.
      var key = getMessageKey(el);
      if (key && revealedMessageKeys.has(key)) {
        el.dataset.accmRevealDone = '1';
      } else {
        scheduleReveal(el, 10);
      }
    });
  }

  var observer = new MutationObserver(function(records) {
    records.forEach(function(record) {
      if (record.type === 'attributes') {
        var msg = record.target;
        if (msg instanceof HTMLElement && msg.classList.contains('message')) {
          var textEl = msg.querySelector('.messageText');
          if (textEl && !isCurrentlyStreaming(textEl)) scheduleReveal(textEl, 20);
        }
        return;
      }
      if (record.type === 'characterData') {
        var parent = record.target && record.target.parentElement;
        var textEl = parent && parent.closest && parent.closest('.messageText');
        if (textEl) scheduleReveal(textEl, 80);
        return;
      }
      record.addedNodes.forEach(function(node) {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches && node.matches('.message')) revealMessageContainer(node);
        node.querySelectorAll && node.querySelectorAll('.message').forEach(revealMessageContainer);
        if (node.matches && node.matches('.messageText')) scheduleReveal(node, 40);
        node.querySelectorAll && node.querySelectorAll('.messageText').forEach(function(el) { scheduleReveal(el, 40); });
      });
    });
  });

  function start() {
    var root = document.querySelector('#messageFeed') || document.body;
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-currently-streaming'] });
    // Mark messages that existed before the plugin as done to avoid replaying an old backlog.
    document.querySelectorAll('.messageText').forEach(function(el) {
      var key = getMessageKey(el);
      if (key) {
        revealedMessageKeys.add(key);
        revealedContainerKeys.add(key);
      }
      el.dataset.accmRevealDone = '1';
    });
    setInterval(scanExistingUnrevealed, REVEAL_CONFIG.rescanIntervalMs);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  if (window.__accm && window.__accm.ui && window.__accm.ui.globalButtons) {
    window.__accm.ui.globalButtons.register({
      id: 'effects',
      label: '✨ Effects',
      title: 'Visual effects',
      priority: 130,
      onClick: function() {},
      panelItems: [
        {
          id: 'gradual-text-reveal',
          type: 'toggle',
          label: 'Gradual text reveal',
          getValue: isEnabled,
          setValue: setEnabled
        }
      ]
    });
  }

  if (window.__accm && window.__accm.modules) {
    window.__accm.modules.register({ id: 'gradual-message-reveal', title: 'Gradual message reveal', provides: ['full-message text reveal', 'effects toggle'] });
  }

  console.log('[accm] Gradual message reveal enabled.');
})();
