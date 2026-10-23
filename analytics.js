(() => {
  "use strict";
  const KEY = "coffeella-session-id";
  let sessionId;
  try {
    sessionId = sessionStorage.getItem(KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(KEY, sessionId);
    }
  } catch (_) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }
  const startedAt = Date.now();
  let pageStartedAt = Date.now();
  let lastPath = location.pathname;
  const pending = [];
  const enqueue = (event) => {
    const item = { ...event };
    pending.push(item);
    if (window.CoffeellaCMS?.configured) window.CoffeellaCMS.track(item);
  };
  const trackPage = () => {
    enqueue({ type: "page_view", properties: { title: document.title } });
    pageStartedAt = Date.now();
    lastPath = location.pathname;
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-analytics], a.btn, button.btn, .chip, .cat, .toolbar__brand");
    if (!el) return;
    const key = el.getAttribute("data-analytics") || el.id || el.getAttribute("aria-label") ||
      (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80) || el.className.baseVal || el.className;
    enqueue({ type: "button_click", key: String(key).slice(0, 160), properties: {
      tag: el.tagName.toLowerCase(),
      destination: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null
    }});
  }, { capture: true });
  const leavePage = () => {
    const duration = Math.max(0, Date.now() - pageStartedAt);
    const payload = JSON.stringify({ type: "page_leave", duration, properties: { title: document.title } });
    if (navigator.sendBeacon && window.COFFEELLA_CMS_CONFIG?.supabaseUrl) {
      // Beacon cannot securely insert into Supabase REST without an authorization header.
      // Use the normal client when available; no tokens are written to URLs or logs.
      window.CoffeellaCMS?.track({ type: "page_leave", duration, properties: { title: document.title } });
    } else {
      window.CoffeellaCMS?.track({ type: "page_leave", duration, properties: { title: document.title } });
    }
    void payload;
  };
  window.addEventListener("pagehide", leavePage);
  window.addEventListener("pageshow", (e) => { if (e.persisted) { pageStartedAt = Date.now(); trackPage(); }});
  window.addEventListener("hashchange", () => {
    enqueue({ type: "section_view", key: location.hash.slice(1), properties: {} });
  });
  window.CoffeellaAnalytics = { sessionId, startedAt, track: enqueue };
  trackPage();
})();
