(function (window, document) {
  'use strict';

  var PARAM = 'mabrig_attribution';
  var STORAGE_KEY = 'mabrig_attribution_v1';
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

  function looksLikeToken(value) {
    return typeof value === 'string' &&
      value.length > 20 &&
      value.length < 2048 &&
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
  }

  function readCookie() {
    var entries = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < entries.length; i += 1) {
      var pair = entries[i].trim().split('=');
      if (pair.shift() === PARAM) {
        try { return decodeURIComponent(pair.join('=')); } catch (_) { return ''; }
      }
    }
    return '';
  }

  function persist(token) {
    if (!looksLikeToken(token)) return '';
    try {
      window.sessionStorage.setItem(STORAGE_KEY, token);
      window.localStorage.setItem(STORAGE_KEY, token);
    } catch (_) {}
    document.cookie =
      PARAM + '=' + encodeURIComponent(token) +
      '; Path=/; Max-Age=' + COOKIE_MAX_AGE +
      '; SameSite=Lax' +
      (window.location.protocol === 'https:' ? '; Secure' : '');
    return token;
  }

  function fromUrl() {
    try {
      var token = new URL(window.location.href).searchParams.get(PARAM) || '';
      return looksLikeToken(token) ? token : '';
    } catch (_) {
      return '';
    }
  }

  function get() {
    var token = fromUrl();
    if (token) return persist(token);

    try {
      token = window.sessionStorage.getItem(STORAGE_KEY) || '';
      if (looksLikeToken(token)) return token;
    } catch (_) {}

    try {
      token = window.localStorage.getItem(STORAGE_KEY) || '';
      if (looksLikeToken(token)) return token;
    } catch (_) {}

    token = readCookie();
    return looksLikeToken(token) ? token : '';
  }

  function clear() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    document.cookie = PARAM + '=; Path=/; Max-Age=0; SameSite=Lax';
  }

  function injectIntoForm(form) {
    if (!form || !form.querySelector) return;
    var token = get();
    if (!token) return;

    var input = form.querySelector('input[name="' + PARAM + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = PARAM;
      form.appendChild(input);
    }
    input.value = token;
  }

  function injectForms(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.tagName === 'FORM') injectIntoForm(root);
    var forms = root.querySelectorAll('form');
    for (var i = 0; i < forms.length; i += 1) injectIntoForm(forms[i]);
  }

  function decorateUrl(url) {
    var token = get();
    if (!token) return url;
    try {
      var parsed = new URL(url, window.location.href);
      parsed.searchParams.set(PARAM, token);
      return parsed.toString();
    } catch (_) {
      return url;
    }
  }

  function metadata(existing) {
    var copy = {};
    var source = existing && typeof existing === 'object' ? existing : {};
    Object.keys(source).forEach(function (key) { copy[key] = source[key]; });
    var token = get();
    if (token) copy[PARAM] = token;
    return copy;
  }

  persist(fromUrl() || get());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { injectForms(document); });
  } else {
    injectForms(document);
  }

  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        for (var i = 0; i < record.addedNodes.length; i += 1) {
          injectForms(record.addedNodes[i]);
        }
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.MabrigAttribution = {
    capture: function () { return persist(fromUrl() || get()); },
    get: get,
    clear: clear,
    decorateUrl: decorateUrl,
    metadata: metadata,
    paystackMetadata: metadata,
    flutterwaveMeta: metadata,
    injectForms: function () { injectForms(document); },
    parameterName: PARAM
  };
})(window, document);
