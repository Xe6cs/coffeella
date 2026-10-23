(() => {
  "use strict";
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
  const safeColor = (value, fallback) => {
    const v = String(value || "").trim();
    return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v) ? v : fallback;
  };
  const safeUrl = (value) => {
    const v = String(value || "").trim();
    if (!v) return "";
    if (v.startsWith("#") || v.startsWith("/") && !v.startsWith("//")) return v;
    if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
    if (/^[a-z0-9][a-z0-9._/-]*(?:\?[a-z0-9=&_%.-]*)?$/i.test(v) && !v.includes("..")) return v;
    return "";
  };
  const alignClass = (align) => ({left:"is-left",center:"is-center",right:"is-right"}[align] || "is-right");
  const price = (value) => Array.isArray(value)
    ? Number(value[0] || 0).toLocaleString("en-US") + " – " + Number(value[1] || 0).toLocaleString("en-US")
    : Number(value || 0).toLocaleString("en-US");
  const link = (href, label, css, extra="") => {
    const url = safeUrl(href);
    if (!url) return "";
    const external = /^https?:/i.test(url);
    return '<a class="' + esc(css || "page-button") + '" href="' + esc(url) + '"' +
      (external ? ' target="_blank" rel="noopener noreferrer"' : "") + extra + '>' + esc(label || "فتح الرابط") + '</a>';
  };
  const renderBlock = (block) => {
    const p = block?.props || {};
    const bg = safeColor(p.background, "transparent");
    const color = safeColor(p.textColor || p.color, "inherit");
    const style = ' style="background-color:' + esc(bg) + ';color:' + esc(color) + '"';
    const align = alignClass(p.align);
    if (block.type === "hero") {
      const imageUrl = safeUrl(p.imageUrl);
      return '<section class="content-hero ' + align + '"' + style + '>' +
        (imageUrl ? '<img class="content-hero__image" src="' + esc(imageUrl) + '" alt="' + esc(p.imageAlt || "") + '" loading="lazy">' : "") +
        '<div class="content-hero__copy">' +
        (p.eyebrow ? '<p class="content-eyebrow">' + esc(p.eyebrow) + '</p>' : "") +
        '<h1>' + esc(p.heading || "عنوان رئيسي") + '</h1>' +
        (p.body ? '<p class="content-body">' + esc(p.body) + '</p>' : "") +
        (p.buttonText && safeUrl(p.buttonHref) ? link(p.buttonHref,p.buttonText,"page-button page-button--primary") : "") +
        '</div></section>';
    }
    if (block.type === "text") {
      return '<section class="content-text ' + align + '"' + style + '>' +
        (p.heading ? '<h2>' + esc(p.heading) + '</h2>' : "") +
        (p.body ? '<p class="content-body">' + esc(p.body) + '</p>' : "") +
        '</section>';
    }
    if (block.type === "image") {
      const src = safeUrl(p.imageUrl);
      if (!src) return '<section class="content-image-placeholder">أضف رابط صورة لهذا المكوّن.</section>';
      return '<figure class="content-image ' + align + '"' + style + '><img src="' + esc(src) + '" alt="' + esc(p.alt || "") + '" loading="lazy">' +
        (p.caption ? '<figcaption>' + esc(p.caption) + '</figcaption>' : "") + '</figure>';
    }
    if (block.type === "button") {
      return '<section class="content-button ' + align + '"' + style + '>' +
        link(p.href,p.text || "زر جديد","page-button", ' style="background-color:' + esc(safeColor(p.background,"#d69a5c")) + ';color:' + esc(safeColor(p.color,"#1b120c")) + '"') +
        '</section>';
    }
    if (block.type === "card") {
      const src = safeUrl(p.imageUrl);
      return '<section class="content-card-wrap"' + style + '><article class="content-card">' +
        (src ? '<img src="' + esc(src) + '" alt="' + esc(p.imageAlt || "") + '" loading="lazy">' : "") +
        '<div class="content-card__body"><h2>' + esc(p.heading || "عنوان البطاقة") + '</h2>' +
        (p.body ? '<p class="content-body">' + esc(p.body) + '</p>' : "") +
        (p.buttonText && safeUrl(p.href) ? link(p.href,p.buttonText,"page-button page-button--primary") : "") +
        '</div></article></section>';
    }
    if (block.type === "menu") {
      const menu = window.COFFEELLA_MENU || [];
      const limit = Math.max(1,Math.min(100,Number(p.limit) || 12));
      const items = [];
      menu.forEach(cat => (cat.groups || []).forEach(group => (group.items || []).forEach(item => {
        if (items.length < limit) items.push({name:item.ar || item.en,price:item.price,category:cat.ar || cat.en});
      })));
      return '<section class="content-menu"' + style + '><h2>' + esc(p.heading || "من المنيو") + '</h2>' +
        (items.length ? '<div class="content-menu__grid">' + items.map(i =>
          '<article class="content-menu__item"><span>' + esc(i.name) + '<small>' + esc(i.category) + '</small></span><strong>' + esc(price(i.price)) + ' د.ع</strong></article>'
        ).join("") + '</div>' : '<p class="content-body">لا توجد أصناف لعرضها حالياً.</p>') +
        '</section>';
    }
    if (block.type === "divider") return '<hr class="content-divider">';
    if (block.type === "spacer") {
      const height = Math.max(8, Math.min(240, Number(p.height) || 32));
      return '<div class="content-spacer" style="height:' + height + 'px" aria-hidden="true"></div>';
    }
    return "";
  };
  const render = (layout) => {
    const blocks = Array.isArray(layout?.blocks) ? layout.blocks : [];
    return blocks.map(renderBlock).join("");
  };
  window.CoffeellaPageRenderer = { render, escapeHtml: esc, safeUrl, safeColor };
})();
