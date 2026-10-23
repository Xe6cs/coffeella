(() => {
  "use strict";
  const cms = window.CoffeellaCMS;
  const renderer = window.CoffeellaPageRenderer;
  const root = document.getElementById("page-content");
  const esc = renderer?.escapeHtml || (value => String(value || ""));
  const slug = new URLSearchParams(location.search).get("slug") || "";
  const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const message = (title, body) => {
    root.innerHTML = '<section class="page-message"><h1>' + esc(title) + '</h1><p>' + esc(body) + '</p><p><a class="page-button" href="index.html">العودة إلى المنيو</a></p></section>';
  };
  const applySettings = settings => {
    const colors = settings?.theme?.colors || {};
    const allowed = new Set(["bg","bg-2","surface","text","muted","accent","accent-2","accent-ink"]);
    Object.entries(colors).forEach(([key,value]) => {
      if (allowed.has(key) && typeof value === "string" && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value)) {
        document.documentElement.style.setProperty("--" + key,value);
      }
    });
  };
  async function init() {
    if (!validSlug) {
      document.title = "الصفحة غير موجودة | كوفيلا";
      message("الصفحة غير موجودة","الرابط غير صحيح أو لم يتم تحديد صفحة.");
      return;
    }
    if (!cms?.configured || !renderer) {
      document.title = "تعذّر الاتصال | كوفيلا";
      message("تعذّر تحميل الصفحة","تحقق من إعداد الاتصال بقاعدة البيانات ثم حدّث الصفحة.");
      return;
    }
    try {
      const [pageResult, settingsResult] = await Promise.all([
        cms.client.from("pages").select("title,slug,layout,seo,transition")
          .eq("slug",slug).eq("status","published").maybeSingle(),
        cms.getSettings()
      ]);
      if (pageResult.error) throw pageResult.error;
      applySettings(settingsResult);
      const page = pageResult.data;
      if (!page) {
        document.title = "الصفحة غير موجودة | كوفيلا";
        document.querySelector('meta[name="robots"]')?.setAttribute("content","noindex,nofollow");
        message("الصفحة غير موجودة","قد تكون الصفحة مسودة أو مؤرشفة، أو أن الرابط غير صحيح.");
        return;
      }
      document.title = page.title + " | كوفيلا كافيه";
      const description = page.seo?.description;
      if (description) document.querySelector('meta[name="description"]')?.setAttribute("content",String(description).slice(0,300));
      try {
        const menu = await cms.getMenu();
        if (menu?.length) window.COFFEELLA_MENU = menu;
      } catch (_) {
        // The bundled menu remains available as a graceful fallback for menu blocks.
      }
      root.innerHTML = renderer.render(page.layout);
      if (!root.innerHTML.trim()) {
        root.innerHTML = '<section class="page-message"><h1>' + esc(page.title) + '</h1><p>هذه الصفحة منشورة حالياً من دون مكوّنات.</p></section>';
      }
    } catch (error) {
      console.error("[Coffeella page]",error?.message || error);
      message("تعذّر تحميل الصفحة","حدث خطأ أثناء جلب محتوى الصفحة. حدّث الصفحة، وإذا استمر الخطأ راجع إعدادات الوصول.");
    }
  }
  init();
})();
