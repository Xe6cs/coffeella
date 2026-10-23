(() => {
  "use strict";
  const applySettings = (settings) => {
    const colors = settings?.theme?.colors || {};
    const root = document.documentElement;
    const allowed = new Set(["bg","bg-2","surface","line","line-2","text","muted","faint","accent","accent-2","accent-ink","label"]);
    Object.entries(colors).forEach(([key, value]) => {
      if (allowed.has(key) && typeof value === "string" && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value)) {
        root.style.setProperty("--" + key, value);
      }
    });
    const fonts = settings?.theme?.fonts || {};
    const fontMap = { arabic: "--f-ar", display: "--f-display", english: "--f-en" };
    Object.entries(fonts).forEach(([key, value]) => {
      if (fontMap[key] && typeof value === "string" && /^[\w\s,"'-]{1,100}$/.test(value)) {
        root.style.setProperty(fontMap[key], value);
      }
    });
  };
  const start = async () => {
    try {
      if (window.CoffeellaCMS?.configured) {
        const [menu, settings] = await Promise.all([
          window.CoffeellaCMS.getMenu(),
          window.CoffeellaCMS.getSettings()
        ]);
        if (menu?.length) window.COFFEELLA_MENU = menu;
        applySettings(settings);
      }
    } catch (error) {
      console.warn("[Coffeella CMS] Using bundled menu fallback:", error?.message || error);
    }
    const app = document.createElement("script");
    app.src = "app.js";
    app.async = false;
    document.body.appendChild(app);
  };
  start();
})();
