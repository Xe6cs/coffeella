(() => {
  "use strict";
  const config = window.COFFEELLA_CMS_CONFIG || {};
  const ready = !!(config.supabaseUrl && config.supabaseAnonKey &&
    !config.supabaseUrl.includes("YOUR_PROJECT") &&
    !config.supabaseAnonKey.includes("YOUR_SUPABASE"));
  let client = null;
  if (ready && window.supabase?.createClient) {
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  const cms = {
    get configured() { return !!client; },
    client,
    async getSettings() {
      if (!client) return null;
      const { data, error } = await client.from("site_settings").select("settings").eq("id", true).maybeSingle();
      if (error) throw error;
      return data?.settings || null;
    },
    async getMenu() {
      if (!client) return null;
      const { data: cats, error: catError } = await client.from("menu_categories")
        .select("id,slug,name_ar,name_en,short_name,photo_url,focus,position")
        .eq("is_published", true).order("position");
      if (catError) throw catError;
      const { data: groups, error: groupError } = await client.from("menu_groups")
        .select("id,category_id,legacy_key,name_ar,name_en,position")
        .eq("is_published", true).order("position");
      if (groupError) throw groupError;
      const { data: items, error: itemError } = await client.from("menu_items")
        .select("id,group_id,legacy_key,name_ar,name_en,description,price,price_min,price_max,discount_price,discount_percent,image_url,icon,position,is_available")
        .eq("is_published", true).eq("is_available", true).order("position");
      if (itemError) throw itemError;
      return (cats || []).map(c => ({
        id: c.slug, ar: c.name_ar, en: c.name_en, short: c.short_name || c.name_ar,
        photo: c.photo_url || "", focus: c.focus || "center",
        groups: (groups || []).filter(g => g.category_id === c.id).map(g => ({
          ar: g.name_ar, en: g.name_en,
          items: (items || []).filter(i => i.group_id === g.id).map(i => ({
            ar: i.name_ar, en: i.name_en,
            price: i.price_min != null && i.price_max != null ? [Number(i.price_min), Number(i.price_max)]
              : i.price != null ? Number(i.price) : 0,
            discountPrice: i.discount_price == null ? null : Number(i.discount_price),
            discountPercent: i.discount_percent == null ? null : Number(i.discount_percent),
            image: i.image_url || null, icon: i.icon || null
          }))
        }))
      }));
    },
    async getSession() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async track(event) {
      if (!client) return;
      try {
        const sessionId = window.CoffeellaAnalytics?.sessionId;
        if (!sessionId) return;
        const { data } = await client.auth.getUser();
        await client.from("analytics_events").insert({
          event_type: event.type,
          session_id: sessionId,
          user_id: data?.user?.id || null,
          page_path: location.pathname + (() => { const slug = new URLSearchParams(location.search).get("slug"); return slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? "?slug=" + slug : ""; })(),
          element_key: event.key || null,
          duration_ms: Number.isFinite(event.duration) ? Math.max(0, Math.min(86400000, Math.round(event.duration))) : null,
          properties: event.properties || {}
        });
      } catch (error) {
        console.debug("[Coffeella analytics]", error?.message || error);
      }
    }
  };
  window.CoffeellaCMS = cms;
})();
