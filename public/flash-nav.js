// Forge Flash Navigation SDK
// Injected into generated apps when Flash Navigation is enabled.
// Intercepts navigation events, captures state, generates the next page on-demand.

(function () {
  'use strict';

  if (!window.__flashNavEnabled) return;

  // ── Constants ──────────────────────────────────────────────────────────────
  var BASE_URL = window.__flashNavBase || '';
  var OVERLAY_ID = '__flash-nav-overlay';
  var BADGE_ID = '__flash-nav-badge';
  var FAB_ID = '__flash-nav-fab';
  var FAB_INPUT_ID = '__flash-nav-fab-input';

  // Properties to skip when collecting window-level state variables
  var STATE_CAPTURE_BLACKLIST = [
    'location','history','document','window','navigator','screen',
    'performance','console','setTimeout','setInterval','clearTimeout','clearInterval',
    'requestAnimationFrame','cancelAnimationFrame','alert','confirm','prompt',
    'addEventListener','removeEventListener','dispatchEvent','fetch','XMLHttpRequest',
    'Worker','SharedWorker','Blob','File','FileReader','URL','URLSearchParams',
    'crypto','indexedDB','localStorage','sessionStorage','caches','cache',
    'ServiceWorker','PushManager','Notification','WebSocket',
    'RTCPeerConnection','MediaStream','HTMLElement','Element','Node',
    '__flashNavEnabled','__flashNavBase','forge','echarts','lucide','katex',
    'Matter','tailwind'
  ];

  // ── Inject global styles ───────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#' + OVERLAY_ID + '{',
    '  position:fixed;inset:0;z-index:99998;',
    '  display:none;flex-direction:column;align-items:center;justify-content:center;',
    '  background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);',
    '  font-family:system-ui,sans-serif;',
    '}',
    '#' + OVERLAY_ID + '.visible{display:flex;}',
    '#' + OVERLAY_ID + ' .__fn-inner{',
    '  display:flex;flex-direction:column;align-items:center;gap:12px;',
    '}',
    '#' + OVERLAY_ID + ' .__fn-spinner{',
    '  width:40px;height:40px;border-radius:50%;',
    '  border:3px solid rgba(255,255,255,0.15);',
    '  border-top-color:#3b82f6;',
    '  animation:__fn-spin 0.7s linear infinite;',
    '}',
    '@keyframes __fn-spin{to{transform:rotate(360deg)}}',
    '#' + OVERLAY_ID + ' .__fn-label{',
    '  color:#fff;font-size:14px;font-weight:500;letter-spacing:0.02em;',
    '}',
    '#' + OVERLAY_ID + ' .__fn-intent{',
    '  color:rgba(255,255,255,0.5);font-size:12px;max-width:260px;text-align:center;',
    '}',
    // Badge
    '#' + BADGE_ID + '{',
    '  position:fixed;bottom:16px;left:50%;transform:translateX(-50%) translateY(60px);',
    '  z-index:99999;background:rgba(15,15,20,0.92);backdrop-filter:blur(12px);',
    '  border:1px solid rgba(59,130,246,0.4);border-radius:100px;',
    '  padding:6px 14px;font-size:12px;color:#93c5fd;font-family:system-ui,sans-serif;',
    '  font-weight:500;letter-spacing:0.03em;white-space:nowrap;',
    '  transition:transform 0.35s cubic-bezier(.34,1.56,.64,1),opacity 0.35s ease;',
    '  opacity:0;pointer-events:none;',
    '}',
    '#' + BADGE_ID + '.visible{',
    '  transform:translateX(-50%) translateY(0);opacity:1;',
    '}',
    // FAB
    '#' + FAB_ID + '{',
    '  position:fixed;bottom:56px;right:16px;z-index:99997;',
    '  display:flex;flex-direction:column;align-items:flex-end;gap:8px;',
    '}',
    '#' + FAB_ID + ' .__fn-fab-btn{',
    '  background:rgba(15,15,20,0.9);backdrop-filter:blur(12px);',
    '  border:1px solid rgba(59,130,246,0.5);border-radius:100px;',
    '  padding:8px 14px;color:#93c5fd;font-size:12px;font-weight:500;',
    '  font-family:system-ui,sans-serif;cursor:pointer;',
    '  transition:background 0.2s,transform 0.2s;white-space:nowrap;',
    '  display:flex;align-items:center;gap:6px;',
    '}',
    '#' + FAB_ID + ' .__fn-fab-btn:hover{background:rgba(30,30,45,0.95);transform:translateY(-1px);}',
    '#' + FAB_ID + ' .__fn-fab-input-row{',
    '  display:none;align-items:center;gap:6px;',
    '}',
    '#' + FAB_ID + ' .__fn-fab-input-row.open{display:flex;}',
    '#' + FAB_ID + ' .__fn-fab-input{',
    '  background:rgba(15,15,20,0.95);border:1px solid rgba(59,130,246,0.5);',
    '  border-radius:8px;padding:7px 12px;color:#e2e8f0;font-size:12px;',
    '  font-family:system-ui,sans-serif;width:220px;outline:none;',
    '}',
    '#' + FAB_ID + ' .__fn-fab-input::placeholder{color:rgba(148,163,184,0.5);}',
    '#' + FAB_ID + ' .__fn-fab-go{',
    '  background:#2563eb;border:none;border-radius:6px;padding:7px 12px;',
    '  color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif;',
    '  transition:background 0.2s;',
    '}',
    '#' + FAB_ID + ' .__fn-fab-go:hover{background:#1d4ed8;}',
  ].join('\n');
  document.head.appendChild(style);

  // ── Overlay ────────────────────────────────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = [
    '<div class="__fn-inner">',
    '  <div class="__fn-spinner"></div>',
    '  <div class="__fn-label">Generating next page\u2026</div>',
    '  <div class="__fn-intent" id="__fn-intent-text"></div>',
    '</div>',
  ].join('');
  document.body.appendChild(overlay);

  // ── Generation Badge ───────────────────────────────────────────────────────
  var badge = document.createElement('div');
  badge.id = BADGE_ID;
  document.body.appendChild(badge);
  var badgeTimer = null;

  function showBadge(text) {
    badge.textContent = text;
    badge.classList.add('visible');
    if (badgeTimer) clearTimeout(badgeTimer);
    badgeTimer = setTimeout(function () { badge.classList.remove('visible'); }, 5000);
  }

  // ── Floating "Imagine any screen" button ──────────────────────────────────
  var fab = document.createElement('div');
  fab.id = FAB_ID;
  fab.innerHTML = [
    '<div class="__fn-fab-input-row" id="' + FAB_INPUT_ID + '">',
    '  <input class="__fn-fab-input" id="__fn-fab-text" placeholder="Imagine any screen\u2026" />',
    '  <button class="__fn-fab-go" id="__fn-fab-go-btn">\u2192</button>',
    '</div>',
    '<button class="__fn-fab-btn" id="__fn-fab-toggle">',
    '  <span>\u2728</span> Imagine any screen',
    '</button>',
  ].join('');
  document.body.appendChild(fab);

  var fabToggle = document.getElementById('__fn-fab-toggle');
  var fabInputRow = document.getElementById(FAB_INPUT_ID);
  var fabTextInput = document.getElementById('__fn-fab-text');
  var fabGoBtn = document.getElementById('__fn-fab-go-btn');

  fabToggle.addEventListener('click', function () {
    fabInputRow.classList.toggle('open');
    if (fabInputRow.classList.contains('open')) fabTextInput.focus();
  });

  function handleFabGo() {
    var val = fabTextInput.value.trim();
    if (!val) return;
    fabInputRow.classList.remove('open');
    fabTextInput.value = '';
    flashNavigate(val, null);
  }
  fabGoBtn.addEventListener('click', handleFabGo);
  fabTextInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleFabGo();
    if (e.key === 'Escape') fabInputRow.classList.remove('open');
  });

  // ── State capture ─────────────────────────────────────────────────────────
  function captureState() {
    // 1. Prefer window.__appState if the app exposes it
    if (window.__appState && typeof window.__appState === 'object') {
      try { return JSON.parse(JSON.stringify(window.__appState)); } catch (e) { /* ignore */ }
    }
    // 2. Collect any window-level vars that look like app state
    var state = {};
    try {
      for (var k in window) {
        try {
          if (STATE_CAPTURE_BLACKLIST.indexOf(k) !== -1) continue;
          if (k.startsWith('__') || k.startsWith('webkit') || k.startsWith('on')) continue;
          var v = window[k];
          var t = typeof v;
          if (t === 'function' || t === 'undefined') continue;
          if (v === null) continue;
          if (t === 'number' || t === 'string' || t === 'boolean') {
            state[k] = v;
          } else if (t === 'object') {
            try { JSON.stringify(v); state[k] = v; } catch (e) { /* skip non-serializable */ }
          }
        } catch (e) { /* skip inaccessible props */ }
      }
    } catch (e) { /* ignore */ }
    return state;
  }

  // ── Navigate to next page ─────────────────────────────────────────────────
  var isNavigating = false;

  function flashNavigate(intent, targetEl) {
    if (isNavigating) return;
    isNavigating = true;

    var state = captureState();
    var currentHTML = document.documentElement.outerHTML;

    // Show overlay
    overlay.classList.add('visible');
    var intentEl = document.getElementById('__fn-intent-text');
    if (intentEl) intentEl.textContent = intent.length > 60 ? intent.slice(0, 57) + '\u2026' : intent;

    var startTime = Date.now();

    fetch(BASE_URL + '/api/generate-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: intent, state: state, currentHTML: currentHTML })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Generate page failed: ' + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var tokenHeader = res.headers.get('X-Token-Count');

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            var tokens = tokenHeader ? parseInt(tokenHeader, 10) : Math.round(buffer.length / 4);
            overlay.classList.remove('visible');
            isNavigating = false;
            injectPage(buffer);
            showBadge('\u26a1 Generated in ' + elapsed + 's \u2022 ~' + tokens + ' tokens');
            return;
          }
          buffer += decoder.decode(r.value, { stream: true });
          return pump();
        });
      }
      return pump();
    })
    .catch(function (err) {
      overlay.classList.remove('visible');
      isNavigating = false;
      console.error('[FlashNav] generation error:', err);
      showBadge('\u26a0 Flash Nav error \u2014 try again');
    });
  }

  // ── Inject generated HTML ─────────────────────────────────────────────────
  function injectPage(html) {
    // Strip markdown fences if AI wrapped it
    var cleaned = html.trim()
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    // Push history entry
    window.history.pushState({ flashNav: true }, '', window.location.pathname);

    // Replace document
    document.open();
    document.write(cleaned);
    document.close();
  }

  // ── Intercept navigation clicks ───────────────────────────────────────────
  var NAV_LABELS = /^(view|go to|open|show|stats|settings|dashboard|home|back|profile|history|reports|analytics|schedule|calendar|help|about|contact|login|logout|sign in|sign up|register|explore|discover|browse|search|create|new|add|start|launch|enter)$/i;

  function isNavigationIntent(el) {
    // Never intercept elements opted out
    if (el.dataset && el.dataset.flashNav === 'skip') return false;
    // Explicit opt-in
    if (el.dataset && el.dataset.flashNav === 'true') return true;

    var tag = el.tagName.toLowerCase();

    // <a> with a relative or hash-less href
    if (tag === 'a') {
      var href = el.getAttribute('href') || '';
      if (!href || href === '#') return false;
      // Skip any non-HTTP/relative schemes — includes javascript:, data:, vbscript:, mailto:, tel:, etc.
      if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(href) && !href.startsWith('http')) return false;
      if (href.startsWith('//')) return false;
      return true;
    }

    // Nav buttons with navigation-like text
    var label = (el.textContent || '').trim();
    var isInNav = !!el.closest('nav, [role="navigation"]');
    if (isInNav) return true;

    if (tag === 'button') {
      if (NAV_LABELS.test(label)) return true;
      var ariaLabel = (el.getAttribute('aria-label') || '').trim();
      if (NAV_LABELS.test(ariaLabel)) return true;
    }

    return false;
  }

  document.addEventListener('click', function (e) {
    if (isNavigating) { e.preventDefault(); e.stopPropagation(); return; }

    var el = e.target;
    // Walk up to find a clickable
    for (var i = 0; i < 5; i++) {
      if (!el || el === document.body) break;
      if (isNavigationIntent(el)) {
        e.preventDefault();
        e.stopPropagation();
        var label = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || 'next page').trim();
        if (label.length > 80) label = label.slice(0, 77) + '\u2026';
        flashNavigate(label, el);
        return;
      }
      el = el.parentElement;
    }
  }, true);

  // ── Handle browser back ───────────────────────────────────────────────────
  // When the user navigates back via browser controls, simply allow the default
  // browser behavior (history.go(-1) was already triggered by the browser).
  // We do not attempt to re-generate the previous page to avoid recursive loops.
  window.addEventListener('popstate', function () {
    // No-op: browser handles back/forward natively via history entries.
    // Flash Nav pushState entries will just reload the page on further back navigations.
  });

  console.log('\u26a1 Forge Flash Navigation initialized.');
})();
