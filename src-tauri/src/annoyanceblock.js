
(() => {
  "use strict";

  window.__ANNOYANCE_BLOCKER_ACTIVE__ = true;
  window.__ANNOYANCE_BLOCKER_INJECTED_AT__ = new Date().toISOString();
  console.debug("[annoyanceblock] frame injected", {
    href: location.href,
    host: location.hostname,
    topFrame: window.top === window,
  });


  if (window.__COSMETIC_BLOCKER_DISABLED__ === true) return;

  const DISABLED_HOSTS = new Set([
  ]);

  if (DISABLED_HOSTS.has(location.hostname)) return;



const BLOCKED_HOSTS = new Set([
  "adbpage.com",
  "adcash.com",
  "adexchangeclear.com",
  "gamerhit.co",
]);

const BLOCKED_URL_PATTERNS = [/disable-devtool/i];
const POPUP_URL_PATTERNS = [
  /adbpage\.com/i,
  /adcash/i,
  /adexchangeclear\.com/i,
  /gamerhit\.co/i,
];
const POPUP_SELECTOR =
  'iframe[src*="adbpage"], iframe[src*="adexchangeclear"], iframe[src*="gamerhit"], iframe[src*="adcash"]';

const seenBlockedUrls = new Set();

function isBlockedUrl(input) {
  try {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input?.url || input?.src || input?.href || "";

    const url = new URL(raw, location.href);
    const host = url.hostname.toLowerCase();

    const blocked =
      [...BLOCKED_HOSTS].some(
        (blocked) => host === blocked || host.endsWith("." + blocked)
      ) || BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url.href));

    if (blocked && !seenBlockedUrls.has(url.href)) {
      seenBlockedUrls.add(url.href);
      console.debug("[annoyanceblock] matched blocked URL:", url.href);
    }

    return blocked;
  } catch (_) {
    return false;
  }
}

function blockFetchAndXhr() {
  const originalFetch = window.fetch;

  window.fetch = function (input, init) {
    if (isBlockedUrl(input)) {
      console.debug("[annoyanceblock] blocked fetch:", input);

      return Promise.resolve(
        new Response("{}", {
          status: 204,
          statusText: "Blocked",
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
    }

    return originalFetch.call(this, input, init);
  };

  const OriginalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function () {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;

    let blocked = false;

    xhr.open = function (method, url, ...rest) {
      if (isBlockedUrl(url)) {
        blocked = true;
        console.debug("[annoyanceblock] blocked XHR:", url);
        return;
      }

      return originalOpen.call(this, method, url, ...rest);
    };

    xhr.send = function (...args) {
      if (blocked) {
        try {
          Object.defineProperty(this, "readyState", { value: 4 });
          Object.defineProperty(this, "status", { value: 204 });
          Object.defineProperty(this, "responseText", { value: "{}" });
        } catch (_) {}

        queueMicrotask(() => {
          try {
            this.onreadystatechange?.();
            this.onload?.();
            this.onloadend?.();
          } catch (_) {}
        });

        return;
      }

      return originalSend.apply(this, args);
    };

    return xhr;
  };
}

function logFetchAndXhr() {
  const originalFetch = window.fetch;

  window.fetch = function (input, init) {
    try {
      console.debug("[annoyanceblock] fetch", {
        url:
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input?.url || "",
        href: location.href,
        host: location.hostname,
        topFrame: window.top === window,
      });
    } catch (_) {}

    return originalFetch.call(this, input, init);
  };

  const OriginalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function () {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;

    xhr.open = function (method, url, ...rest) {
      try {
        console.debug("[annoyanceblock] xhr", {
          method,
          url,
          href: location.href,
          host: location.hostname,
          topFrame: window.top === window,
        });
      } catch (_) {}

      return originalOpen.call(this, method, url, ...rest);
    };

    return xhr;
  };
}

function blockDynamicScriptAndFrameUrls() {
  const EMPTY_SCRIPT_URL = "data:application/javascript,/* blocked by annoyanceblock */";
  const EMPTY_FRAME_URL = "about:blank";

  function replacementUrlFor(el, value) {
    if (!isBlockedUrl(value)) return null;

    if (el instanceof HTMLScriptElement) {
      console.debug("[annoyanceblock] neutralized script URL:", value);
      return EMPTY_SCRIPT_URL;
    }

    if (el instanceof HTMLIFrameElement) {
      console.debug("[annoyanceblock] neutralized frame URL:", value);
      return EMPTY_FRAME_URL;
    }

    return null;
  }

  function patchSrcDescriptor(proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, "src");
    if (!descriptor?.set || !descriptor?.get) return;

    Object.defineProperty(proto, "src", {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        const replacement = replacementUrlFor(this, value);
        return descriptor.set.call(this, replacement || value);
      },
    });
  }

  try {
    patchSrcDescriptor(HTMLScriptElement.prototype);
    patchSrcDescriptor(HTMLIFrameElement.prototype);
  } catch (_) {}

  const originalSetAttribute = Element.prototype.setAttribute;

  Element.prototype.setAttribute = function (name, value) {
    if (String(name).toLowerCase() === "src") {
      const replacement = replacementUrlFor(this, value);
      if (replacement) {
        return originalSetAttribute.call(this, name, replacement);
      }
    }

    return originalSetAttribute.call(this, name, value);
  };
}

function clearServiceWorkersAndCachesOnce() {
  const key = "__annoyanceblock_sw_cache_clear_attempted__";

  try {
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
  } catch (_) {}

  try {
    navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
      if (registrations.length > 0) {
        console.debug("[annoyanceblock] unregistered service workers:", registrations.length);
      }
    });
  } catch (_) {}

  try {
    caches?.keys?.().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
      if (keys.length > 0) {
        console.debug("[annoyanceblock] cleared caches:", keys);
      }
    });
  } catch (_) {}
}

function blockDynamicResourceInsertion() {
  const resourceAttrs = ["src", "href", "data"];

  function guardElement(el) {
    if (!(el instanceof Element)) return false;

    for (const attr of resourceAttrs) {
      const value = el.getAttribute(attr);
      if (value && isBlockedUrl(value)) {
        console.debug("[annoyanceblock] blocked dynamic resource:", value);
        safeRemove(el);
        return true;
      }
    }

    return false;
  }

  const originalSetAttribute = Element.prototype.setAttribute;

  Element.prototype.setAttribute = function (name, value) {
    if (
      ["src", "href", "data"].includes(String(name).toLowerCase()) &&
      isBlockedUrl(value)
    ) {
      console.debug("[annoyanceblock] blocked setAttribute:", name, value);
      return;
    }

    return originalSetAttribute.call(this, name, value);
  };

  const originalAppendChild = Node.prototype.appendChild;

  Node.prototype.appendChild = function (node) {
    if (guardElement(node)) return node;

    if (node instanceof Element) {
      for (const nested of node.querySelectorAll?.("[src], [href], [data]") || []) {
        if (guardElement(nested)) return node;
      }
    }

    return originalAppendChild.call(this, node);
  };

  const originalInsertBefore = Node.prototype.insertBefore;

  Node.prototype.insertBefore = function (node, ref) {
    if (guardElement(node)) return node;

    if (node instanceof Element) {
      for (const nested of node.querySelectorAll?.("[src], [href], [data]") || []) {
        if (guardElement(nested)) return node;
      }
    }

    return originalInsertBefore.call(this, node, ref);
  };
}

function neutralizeDisableDevtool() {
  const noop = () => {};
  const stub = Object.freeze({
    DetectorType: Object.freeze({}),
    isRunning: false,
    isSuspend: true,
    isDevToolOpened: () => false,
    md5: noop,
    version: "disabled",
    addListener: noop,
    removeListener: noop,
  });

  try {
    Object.defineProperty(window, "DisableDevtool", {
      value: stub,
      writable: false,
      configurable: false,
    });
  } catch (_) {}
}



  const CONFIG = {
    removeSelectors: [
      '[class*="ad-container"]',
      '[class*="ad-wrapper"]',
      '[class*="ad-slot"]',
      '[class*="ad-unit"]',
      '[class*="ad-banner"]',
      '[id*="ad-container"]',
      '[id*="ad-slot"]',
      '[id*="google-ad"]',
      '[id*="dfp-ad"]',
      'iframe[src*="doubleclick.net"]',
      'iframe[src*="googlesyndication"]',
      'iframe[src*="adnxs.com"]',
      'iframe[src*="moatads.com"]',
      'iframe[src*="amazon-adsystem"]',
      '[class*="interstitial"]',
      '[class*="ad-interstitial"]',
      '[id*="interstitial"]',
    ],

    overlaySelectors: [
      '[class*="modal-overlay"]',
      '[class*="popup-overlay"]',
      '[class*="lightbox-overlay"]',
      '[id*="modal-overlay"]',
      '[id*="popup-container"]',
    ],

    bodyLockClasses: ["modal-open", "no-scroll", "overflow-hidden", "noscroll"],

    overlayZIndexThreshold: 999,
    observerDebounceMs: 80,
    initialPassCount: 3,
    initialPassIntervalMs: 600,
  };


  function safeRemove(el) {
    try {
      el?.parentNode?.removeChild(el);
    } catch (_) {
    }
  }

  function isAllowedElement(el) {
    return Boolean(
      el.closest?.(
        [
          "video",
          "[role='dialog']",
          "[class*='player']",
          "[id*='player']",
          "[class*='login']",
          "[id*='login']",
          "[class*='auth']",
          "[id*='auth']",
        ].join(",")
      )
    );
  }

  function isBlockingOverlay(el) {
    if (isAllowedElement(el)) return false;

    const style = window.getComputedStyle(el);
    const z = parseInt(style.zIndex, 10);
    const pos = style.position;

    return (
      !Number.isNaN(z) &&
      z >= CONFIG.overlayZIndexThreshold &&
      (pos === "fixed" || pos === "absolute")
    );
  }

  function unlockBody() {
    const targets = [document.body, document.documentElement].filter(Boolean);

    for (const target of targets) {
      for (const cls of CONFIG.bodyLockClasses) {
        target.classList.remove(cls);
      }
      if (target.style.overflow === "hidden") {
        target.style.overflow = "";
      }
    }
  }


  function removeAdElements() {
    for (const selector of CONFIG.removeSelectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (!isAllowedElement(el)) safeRemove(el);
        });
      } catch (_) {}
    }
  }

  function removeOverlays() {
    let removed = 0;
    for (const selector of CONFIG.overlaySelectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (isBlockingOverlay(el)) {
            safeRemove(el);
            removed++;
          }
        });
      } catch (_) {}
    }
    if (removed > 0) unlockBody();
  }

  function removeFakeButtons() {
    const patterns = [
      '[class*="fake-close"]',
      '[class*="fake-download"]',
      '[class*="ad-close-btn"]',
      '[id*="close-ad"]',
    ];
    for (const sel of patterns) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (!isAllowedElement(el)) safeRemove(el);
        });
      } catch (_) {}
    }
  }


  function blockPopups() {
    try {
      window.open = function (url) {
        console.debug("[annoyanceblock] blocked window.open:", url);
        return null;
      };
    } catch (_) {}
  }


  function blockClickRedirects() {
    document.addEventListener(
      "click",
      (e) => {
        const el = e.target;
        if (!(el instanceof Element)) return;

        const anchor = el.closest("a[href]");
        if (!anchor) return;

        const href = anchor.getAttribute("href") || "";
        const target = anchor.getAttribute("target") || "";
        if (target.toLowerCase() === "_blank" || POPUP_URL_PATTERNS.some((p) => p.test(href))) {
          e.preventDefault();
          e.stopImmediatePropagation();
          console.debug("[annoyanceblock] blocked redirect click to:", href);
        }
      },
      true
    );
  }

  function preserveContextMenu() {
    const stopPageHandler = (e) => {
      e.stopImmediatePropagation();
    };

    for (const target of [window, document]) {
      target.addEventListener("contextmenu", stopPageHandler, true);
    }
  }

  function preserveDevToolsShortcuts() {
    const isDevToolsShortcut = (e) =>
      e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i");

    const stopPageHandler = (e) => {
      if (isDevToolsShortcut(e)) {
        e.stopImmediatePropagation();
      }
    };

    for (const target of [window, document]) {
      target.addEventListener("keydown", stopPageHandler, true);
      target.addEventListener("keyup", stopPageHandler, true);
    }
  }

  function preserveConsoleLogs() {
    try {
      console.clear = () => {};
    } catch (_) {}
  }

  function hideAdPopups() {
    const css = `
      ${POPUP_SELECTOR} {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;

    try {
      const style = document.createElement("style");
      style.id = "__annoyanceblock_popup_css__";
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    } catch (_) {}

    const hide = (el) => {
      try {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
        el.style.setProperty("pointer-events", "none", "important");
      } catch (_) {}
    };

    const hideMatchingPopups = () => {
      for (const el of document.querySelectorAll(POPUP_SELECTOR)) {
        hide(el);

        let parent = el.parentElement;
        for (let depth = 0; parent && depth < 4; depth++) {
          const style = window.getComputedStyle(parent);
          const z = parseInt(style.zIndex, 10);
          const popupLike =
            (style.position === "fixed" || style.position === "absolute") &&
            (!Number.isNaN(z) ? z >= 100 : true);

          if (popupLike && !isAllowedElement(parent)) {
            hide(parent);
            break;
          }

          parent = parent.parentElement;
        }
      }
    };

    hideMatchingPopups();

    const popupObserver = new MutationObserver(() => {
      setTimeout(hideMatchingPopups, 0);
    });

    const startPopupObserver = () => {
      const root = document.documentElement || document.body;
      if (!root) {
        setTimeout(startPopupObserver, 25);
        return;
      }
      popupObserver.observe(root, { childList: true, subtree: true });
    };

    startPopupObserver();
  }


  function clean() {
    removeAdElements();
    removeOverlays();
    removeFakeButtons();
  }


  let debounceTimer = null;

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(clean, CONFIG.observerDebounceMs);
  });

  function startObserver() {
    const root = document.documentElement || document.body;
    if (!root) {
      setTimeout(startObserver, 25);
      return;
    }
    observer.observe(root, { childList: true, subtree: true });
  }


neutralizeDisableDevtool();
clearServiceWorkersAndCachesOnce();
blockFetchAndXhr();
blockDynamicScriptAndFrameUrls();
blockPopups();
blockClickRedirects();
hideAdPopups();
preserveContextMenu();
preserveDevToolsShortcuts();
preserveConsoleLogs();

console.debug("[annoyanceblock] active -", location.hostname);
})();
