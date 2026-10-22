(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const cms = window.CoffeellaCMS;
  const ui = {
    setup: $("#setup-notice"), login: $("#login-panel"), form: $("#login-form"),
    error: $("#login-error"), dashboard: $("#dashboard"), signOut: $("#sign-out"),
    currentUser: $("#current-user"), status: $("#global-status")
  };
  if (!cms?.configured) {
    ui.setup.hidden = false;
    ui.login.hidden = true;
    return;
  }
  const say = (message) => { ui.status.textContent = message || ""; };
  const fmt = (n) => Number(n || 0).toLocaleString("ar-IQ");
  const minutes = (ms) => {
    const sec = Math.round(Number(ms || 0) / 1000);
    return sec < 60 ? `${fmt(sec)} ث` : `${fmt(Math.floor(sec / 60))} د ${fmt(sec % 60)} ث`;
  };
  async function refreshAuth() {
    const session = await cms.getSession();
    ui.login.hidden = !!session;
    ui.dashboard.hidden = !session;
    ui.signOut.hidden = !session;
    ui.currentUser.textContent = session?.user?.email || "";
    if (session) await loadOverview();
  }
  ui.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ui.error.textContent = "";
    const button = ui.form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const { error } = await cms.client.auth.signInWithPassword({
        email: $("#email").value.trim(), password: $("#password").value
      });
      if (error) throw error;
      await refreshAuth();
    } catch (error) { ui.error.textContent = error.message || "تعذر تسجيل الدخول."; }
    finally { button.disabled = false; }
  });
  ui.signOut.addEventListener("click", async () => {
    await cms.client.auth.signOut();
    await refreshAuth();
  });
  cms.client.auth.onAuthStateChange((_event, session) => {
    ui.login.hidden = !!session;
    ui.dashboard.hidden = !session;
    ui.signOut.hidden = !session;
    ui.currentUser.textContent = session?.user?.email || "";
  });
  document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== btn.dataset.tab);
    if (btn.dataset.tab === "products") loadProducts();
    if (btn.dataset.tab === "analytics") loadAnalytics();
    if (btn.dataset.tab === "design") loadDesign();
  }));
  async function loadOverview() {
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [events, products] = await Promise.all([
        cms.client.from("analytics_events").select("event_type,duration_ms,page_path,element_key,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
        cms.client.from("menu_items").select("id", { count: "exact", head: true }).eq("is_published", true)
      ]);
      if (events.error) throw events.error;
      if (products.error) throw products.error;
      const rows = events.data || [];
      $("#stat-views").textContent = fmt(rows.filter(r => r.event_type === "page_view").length);
      $("#stat-clicks").textContent = fmt(rows.filter(r => r.event_type === "button_click").length);
      $("#stat-time").textContent = minutes(rows.reduce((n, r) => n + (r.event_type === "page_leave" ? Number(r.duration_ms || 0) : 0), 0));
      $("#stat-products").textContent = fmt(products.count || 0);
      $("#recent-events").innerHTML = table(["الحدث", "الصفحة", "العنصر", "الوقت"], rows.slice(0, 12).map(r => [
        eventLabel(r.event_type), r.page_path, r.element_key || "—", new Date(r.created_at).toLocaleString("ar-IQ")
      ]));
    } catch (error) {
      $("#recent-events").textContent = "لم تتوفر بيانات بعد أو لا توجد صلاحية لقراءة التحليلات.";
      say(error.message || "تعذر تحميل الملخص.");
    }
  }
  const eventLabel = (s) => ({page_view:"مشاهدة صفحة",page_leave:"مغادرة صفحة",section_view:"مشاهدة قسم",section_leave:"مغادرة قسم",button_click:"ضغط زر"}[s] || s);
  function table(headers, rows) {
    if (!rows.length) return '<p class="muted">لا توجد بيانات بعد.</p>';
    return '<table><thead><tr>' + headers.map(h => '<th>' + escapeHtml(h) + '</th>').join("") + '</tr></thead><tbody>' +
      rows.map(row => '<tr>' + row.map(v => '<td>' + escapeHtml(v == null ? "" : String(v)) + '</td>').join("") + '</tr>').join("") +
      '</tbody></table>';
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  async function loadProducts() {
    const root = $("#products-list");
    root.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
    try {
      const { data, error } = await cms.client.from("menu_items")
        .select("id,name_ar,name_en,price,price_min,price_max,is_published,is_available")
        .order("name_ar").limit(500);
      if (error) throw error;
      if (!data?.length) { root.innerHTML = '<p class="muted">لا توجد أصناف في قاعدة البيانات. يجب استيراد menu-data.js أولاً.</p>'; return; }
      root.innerHTML = '<table><thead><tr><th>الاسم</th><th>الاسم الإنجليزي</th><th>السعر</th><th>منشور</th><th>متاح</th><th>حفظ</th></tr></thead><tbody>' +
        data.map(i => '<tr data-id="' + escapeHtml(i.id) + '"><td><input data-field="name_ar" value="' + escapeHtml(i.name_ar) + '"></td><td><input data-field="name_en" value="' + escapeHtml(i.name_en || "") + '"></td><td><input data-field="price" type="number" min="0" step="250" value="' + escapeHtml(i.price ?? "") + '"></td><td><input data-field="is_published" type="checkbox" ' + (i.is_published ? "checked" : "") + '></td><td><input data-field="is_available" type="checkbox" ' + (i.is_available ? "checked" : "") + '></td><td><button class="btn secondary save-item">حفظ</button></td></tr>').join("") +
        '</tbody></table>';
      root.querySelectorAll(".save-item").forEach(btn => btn.addEventListener("click", async () => {
        const tr = btn.closest("tr");
        const get = key => tr.querySelector('[data-field="' + key + '"]');
        const priceRaw = get("price").value;
        const payload = { name_ar:get("name_ar").value.trim(), name_en:get("name_en").value.trim(),
          price:priceRaw === "" ? null : Number(priceRaw), is_published:get("is_published").checked,
          is_available:get("is_available").checked };
        btn.disabled = true;
        try {
          const { error } = await cms.client.from("menu_items").update(payload).eq("id", tr.dataset.id);
          if (error) throw error;
          say("تم حفظ الصنف.");
        } catch (error) { say(error.message || "تعذر حفظ الصنف."); }
        finally { btn.disabled = false; }
      }));
    } catch (error) { root.textContent = error.message || "تعذر تحميل الأصناف."; }
  }
  $("#reload-products").addEventListener("click", loadProducts);
  async function loadDesign() {
    try {
      const settings = await cms.getSettings();
      const colors = settings?.theme?.colors || {};
      Object.entries(colors).forEach(([key, value]) => {
        const input = $("#design-form").elements.namedItem(key);
        if (input && /^#[0-9a-f]{6}$/i.test(value)) input.value = value;
      });
    } catch (error) { say(error.message || "تعذر تحميل إعدادات التصميم."); }
  }
  $("#design-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const { data, error: readError } = await cms.client.from("site_settings").select("settings").eq("id", true).single();
      if (readError) throw readError;
      const settings = data.settings || {};
      settings.theme = settings.theme || {};
      settings.theme.colors = settings.theme.colors || {};
      for (const [key, value] of new FormData(e.currentTarget).entries()) settings.theme.colors[key] = value;
      const { error } = await cms.client.from("site_settings").update({ settings, updated_by: (await cms.getSession())?.user?.id }).eq("id", true);
      if (error) throw error;
      $("#design-status").textContent = "حُفظت الألوان. تأكد من تفعيل تحميل الإعدادات في الواجهة العامة.";
    } catch (error) { $("#design-status").textContent = error.message || "تعذر حفظ الألوان."; }
    finally { button.disabled = false; }
  });
  async function loadAnalytics() {
    const root = $("#analytics-report");
    root.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await cms.client.from("analytics_events")
        .select("event_type,page_path,element_key,duration_ms,created_at")
        .gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      const rows = data || [];
      const byPage = {};
      const byButton = {};
      rows.forEach(r => {
        if (r.event_type === "page_view") byPage[r.page_path] = (byPage[r.page_path] || 0) + 1;
        if (r.event_type === "button_click") byButton[r.element_key || "(بدون معرّف)"] = (byButton[r.element_key || "(بدون معرّف)"] || 0) + 1;
      });
      root.innerHTML = '<h3>مشاهدات الصفحات (30 يوماً)</h3>' + table(["الصفحة","المشاهدات"], Object.entries(byPage).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,fmt(v)])) +
        '<h3>ضغطات الأزرار (30 يوماً)</h3>' + table(["الزر","الضغطات"], Object.entries(byButton).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,fmt(v)]));
    } catch (error) { root.textContent = error.message || "تعذر تحميل التحليلات."; }
  }
  $("#reload-analytics").addEventListener("click", loadAnalytics);
  refreshAuth().catch(error => { ui.error.textContent = error.message || "تعذر بدء لوحة التحكم."; });
})();
