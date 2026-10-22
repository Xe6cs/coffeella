(() => {
  "use strict";

  const MENU = window.COFFEELLA_MENU || [];
  const $ = (sel, root = document) => root.querySelector(sel);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const els = {
    menu: $("#menu"),
    cats: $("#cats"),
    chips: $("#chips"),
    sections: $("#sections"),
    status: $("#status"),
    empty: $("#empty"),
    q: $("#q"),
    clear: $("#q-clear"),
    toolbar: $("#toolbar"),
    totop: $("#totop"),
  };

  /* ── أدوات ───────────────────────────── */

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => n.toLocaleString("en-US");
  const priceHTML = (p) =>
    Array.isArray(p) ? `${money(p[0])}<span class="sep">–</span>${money(p[1])}` : money(p);
  const countOf = (cat) => cat.groups.reduce((n, g) => n + g.items.length, 0);

  // صيغة العدد بالعربية: صنف واحد، صنفان، 3 أصناف، 18 صنفاً
  const arCount = (n) => {
    if (n === 1) return "صنف واحد";
    if (n === 2) return "صنفان";
    if (n >= 3 && n <= 10) return `${n} أصناف`;
    return `${n} صنفاً`;
  };

  // توحيد الحروف لبحث متسامح (أ/إ/آ → ا، ة → ه، ى → ي، é → e …) مع خريطة مواقع للتظليل
  const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  const normChar = (c) => {
    if (/[ً-ْـ]/.test(c)) return ""; // تشكيل وتطويل
    if (/[أإآٱ]/.test(c)) return "ا";
    if (c === "ة") return "ه";
    if (c === "ى") return "ي";
    if (c === "ؤ") return "و";
    if (c === "ئ") return "ي";
    const d = ARABIC_DIGITS.indexOf(c);
    if (d > -1) return String(d);
    return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  };
  const normalize = (s) => {
    let out = "";
    const map = [];
    for (let i = 0; i < s.length; i++) {
      const n = normChar(s[i]);
      for (let k = 0; k < n.length; k++) { out += n[k]; map.push(i); }
    }
    return { text: out, map };
  };
  const normQuery = (s) => normalize(s.trim().replace(/\s+/g, " ")).text.replace(/[’'`]/g, "");

  const highlight = (raw, q) => {
    if (!q) return esc(raw);
    const { text, map } = normalize(raw);
    const at = text.indexOf(q);
    if (at < 0) return esc(raw);
    const start = map[at];
    const end = map[at + q.length - 1] + 1;
    return esc(raw.slice(0, start)) + "<mark>" + esc(raw.slice(start, end)) + "</mark>" + esc(raw.slice(end));
  };

  /* ── العرض ───────────────────────────── */

  const total = MENU.reduce((n, c) => n + countOf(c), 0);

  els.cats.innerHTML = MENU.map((cat) => `
    <a class="cat" href="#${cat.id}">
      <img src="${esc(cat.photo)}" alt="" loading="lazy" style="object-position:${esc(cat.focus || "center")}">
      <span class="cat__label">
        <span class="cat__name"><span class="cat__short">${esc(cat.short || cat.ar)}</span><span class="cat__full">${esc(cat.ar)}</span></span>
        <span class="cat__meta">${arCount(countOf(cat))}<span class="cat__en" lang="en"> · ${esc(cat.en)}</span></span>
      </span>
    </a>`).join("");

  els.chips.innerHTML = MENU.map((cat) => `
    <a class="chip" href="#${cat.id}" data-cat="${cat.id}">
      <span>${esc(cat.short || cat.ar)}</span><span class="chip__count" data-count>${countOf(cat)}</span>
    </a>`).join("");

  els.sections.innerHTML = MENU.map((cat) => `
    <section class="section" id="${cat.id}" aria-labelledby="${cat.id}-title">
      <div class="section__banner">
        <img src="${esc(cat.photo)}" alt="" loading="lazy" style="object-position:${esc(cat.focus || "center")}">
        <div>
          <h2 class="section__title" id="${cat.id}-title">${esc(cat.ar)}</h2>
          <p class="section__sub"><span class="section__en" lang="en" dir="ltr">${esc(cat.en)}</span><span>${arCount(countOf(cat))}</span></p>
        </div>
      </div>
      ${cat.groups.length > 1 ? `
      <ul class="section__index" aria-label="أقسام ${esc(cat.ar)}">
        ${cat.groups.map((g, gi) => `<li><a href="#${cat.id}-${gi}">${esc(g.ar)}</a></li>`).join("")}
      </ul>` : ""}
      ${cat.groups.map((g, gi) => `
      <div class="group" id="${cat.id}-${gi}">
        ${cat.groups.length > 1 ? `
        <div class="group__head">
          <h3 class="group__title">${esc(g.ar)}</h3>
          <span class="group__en" lang="en" dir="ltr">${esc(g.en)}</span>
        </div>` : ""}
        <ul class="items">
          ${g.items.map((it) => `
          <li class="item">
            <span class="item__ar" data-raw="${esc(it.ar)}">${esc(it.ar)}</span>
            <span class="item__dots" aria-hidden="true"></span>
            <span class="item__price" dir="ltr">${priceHTML(it.price)}</span>
            <span class="item__en" lang="en" dir="ltr" data-raw="${esc(it.en)}">${esc(it.en)}</span>
          </li>`).join("")}
        </ul>
      </div>`).join("")}
    </section>`).join("");

  // نص البحث لكل صنف: الاسم العربي + الإنجليزي + اسم المجموعة والقسم
  const index = [];
  MENU.forEach((cat, ci) => {
    const sectionEl = els.sections.children[ci];
    cat.groups.forEach((g, gi) => {
      const groupEl = $(`#${cat.id}-${gi}`, sectionEl);
      groupEl.querySelectorAll(".item").forEach((li, ii) => {
        const it = g.items[ii];
        index.push({
          li, cat: cat.id,
          ar: li.querySelector(".item__ar"),
          en: li.querySelector(".item__en"),
          hay: normQuery(`${it.ar} ${it.en} ${g.ar} ${g.en} ${cat.ar} ${cat.en}`),
        });
      });
    });
  });

  const defaultStatus = `${arCount(total)} في ${MENU.length} أقسام · الأسعار بالدينار العراقي`;
  els.status.textContent = defaultStatus;

  /* ── البحث ───────────────────────────── */

  const runSearch = () => {
    const raw = els.q.value;
    const q = normQuery(raw);
    els.clear.hidden = !raw;

    let shown = 0;
    const perCat = {};
    for (const row of index) {
      const hit = !q || row.hay.includes(q);
      row.li.hidden = !hit;
      if (hit) { shown++; perCat[row.cat] = (perCat[row.cat] || 0) + 1; }
      row.ar.innerHTML = highlight(row.ar.dataset.raw, q);
      row.en.innerHTML = highlight(row.en.dataset.raw, q);
    }

    els.sections.querySelectorAll(".group").forEach((g) => {
      g.hidden = !g.querySelector(".item:not([hidden])");
    });
    els.sections.querySelectorAll(".section").forEach((s) => {
      s.hidden = !perCat[s.id];
      const idx = s.querySelector(".section__index");
      if (idx) idx.hidden = !!q;
    });
    els.chips.querySelectorAll(".chip").forEach((c) => {
      const n = perCat[c.dataset.cat] || 0;
      c.querySelector("[data-count]").textContent = n;
      c.classList.toggle("is-empty", !n);
    });

    els.empty.hidden = shown > 0;
    if (!q) {
      els.status.textContent = defaultStatus;
    } else if (shown) {
      els.status.innerHTML = `نتائج «${esc(raw.trim())}»: <strong>${arCount(shown)}</strong>`;
    } else {
      els.status.textContent = "";
    }
    updateActive();
  };

  // ثبّت شريط البحث أعلى الشاشة وأظهر بداية النتائج مباشرة تحته
  const scrollToResults = () => {
    const y = els.menu.getBoundingClientRect().top + scrollY - els.toolbar.offsetHeight;
    if (Math.abs(scrollY - y) > 1) scrollTo({ top: y, behavior: "instant" });
  };

  let searchTimer;
  els.q.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      runSearch();
      scrollToResults();
    }, 60);
  });
  els.q.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { els.q.value = ""; runSearch(); }
    if (e.key === "Enter") els.q.blur();
  });
  els.clear.addEventListener("click", () => {
    els.q.value = "";
    runSearch();
    scrollToResults();
    els.q.focus({ preventScroll: true });
  });

  /* ── التنقل بين الأقسام ──────────────── */

  const setToolbarHeight = () => {
    document.documentElement.style.setProperty("--toolbar-h", `${els.toolbar.offsetHeight}px`);
  };
  setToolbarHeight();
  addEventListener("resize", setToolbarHeight);

  let activeId = null;
  const chipFor = (id) => els.chips.querySelector(`[data-cat="${id}"]`);

  const centerChip = (chip) => {
    const bar = els.chips.getBoundingClientRect();
    const r = chip.getBoundingClientRect();
    const delta = r.left + r.width / 2 - (bar.left + bar.width / 2);
    if (Math.abs(delta) > 4) els.chips.scrollBy({ left: delta, behavior: reduceMotion ? "auto" : "smooth" });
  };

  // القسم النشط هو آخر قسم ظاهر تجاوز رأسه أسفل شريط التنقل
  function updateActive() {
    const line = els.toolbar.offsetHeight + 24;
    let current = null;
    els.sections.querySelectorAll(".section:not([hidden])").forEach((s) => {
      if (s.getBoundingClientRect().top - line <= 0) current = s.id;
    });
    if (!current) {
      const first = els.sections.querySelector(".section:not([hidden])");
      if (first && first.getBoundingClientRect().top < innerHeight * 0.6) current = first.id;
    }
    if (current === activeId) return;
    activeId = current;
    els.chips.querySelectorAll(".chip").forEach((c) => {
      if (c.dataset.cat === current) c.setAttribute("aria-current", "true");
      else c.removeAttribute("aria-current");
    });
    if (current) centerChip(chipFor(current));
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      updateActive();
      els.toolbar.classList.toggle("is-stuck", els.toolbar.getBoundingClientRect().top <= 0.5);
      els.totop.hidden = scrollY < innerHeight * 1.2;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // عند اختيار قسم أثناء البحث: امسح البحث أولاً حتى يظهر القسم كاملاً
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (els.q.value && (target.closest("#sections") || target === els.sections)) {
      els.q.value = "";
      runSearch();
    }
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", id === "top" ? location.pathname : `#${id}`);
  });

  els.totop.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  // افتح على القسم المطلوب إن وُجد رابط مباشر (#cold مثلاً)
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }
})();
