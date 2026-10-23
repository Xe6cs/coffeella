(() => {
  "use strict";
  const cms = window.CoffeellaCMS;
  const renderer = window.CoffeellaPageRenderer;
  const $ = (selector, root = document) => root.querySelector(selector);
  const listRoot = $("#pages-list");
  const editor = $("#page-editor");
  const form = $("#page-form");
  const blocksRoot = $("#blocks-editor");
  const previewRoot = $("#page-preview");
  const statusRoot = $("#pages-status");
  if (!cms?.configured || !listRoot || !editor || !form || !renderer) return;

  let pages = [];
  let currentPage = null;
  let isNew = false;
  let saving = false;

  const esc = renderer.escapeHtml;
  const message = (text) => { statusRoot.textContent = text || ""; };
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : "block-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
  const nowIso = () => new Date().toISOString();

  const fieldDefinitions = {
    hero: [
      ["eyebrow","سطر تمهيدي","text"],["heading","العنوان الرئيسي","text"],["body","النص","textarea"],
      ["buttonText","نص الزر","text"],["buttonHref","رابط الزر","url"],["imageUrl","رابط صورة خلفية أو صورة رئيسية","url"],
      ["background","لون الخلفية","color"],["textColor","لون النص","color"],["align","محاذاة المحتوى","select",[["right","يمين"],["center","وسط"],["left","يسار"]]]
    ],
    text: [
      ["heading","العنوان","text"],["body","النص","textarea"],["background","لون الخلفية","color"],
      ["textColor","لون النص","color"],["align","محاذاة النص","select",[["right","يمين"],["center","وسط"],["left","يسار"]]]
    ],
    image: [
      ["imageUrl","رابط الصورة","url"],["alt","وصف الصورة البديل","text"],["caption","تعليق أسفل الصورة","text"],
      ["background","لون الخلفية","color"],["align","محاذاة الصورة","select",[["right","يمين"],["center","وسط"],["left","يسار"]]]
    ],
    button: [
      ["text","نص الزر","text"],["href","الرابط (داخلي أو خارجي)","url"],["background","لون الزر","color"],
      ["color","لون النص","color"],["align","محاذاة الزر","select",[["right","يمين"],["center","وسط"],["left","يسار"]]]
    ],
    card: [
      ["heading","عنوان البطاقة","text"],["body","وصف البطاقة","textarea"],["imageUrl","رابط الصورة","url"],
      ["imageAlt","وصف الصورة البديل","text"],["buttonText","نص الرابط","text"],["href","الرابط","url"],
      ["background","لون الخلفية","color"],["textColor","لون النص","color"]
    ],
    menu: [
      ["heading","عنوان قسم المنيو","text"],["limit","عدد الأصناف المعروضة","number"],
      ["background","لون الخلفية","color"],["textColor","لون النص","color"]
    ],
    spacer: [["height","ارتفاع المسافة بالبكسل","number"]]
  };

  const blockTitles = {
    hero:"واجهة رئيسية", text:"كتلة نصية", image:"صورة", button:"زر رابط",
    card:"بطاقة", menu:"أصناف المنيو", divider:"فاصل", spacer:"مسافة"
  };
  const defaults = {
    hero:{eyebrow:"COFFEELLA",heading:"عنوان الصفحة",body:"اكتب وصف الصفحة هنا.",buttonText:"اكتشف المزيد",buttonHref:"#more",imageUrl:"",background:"#211814",textColor:"#f4ebdf",align:"right"},
    text:{heading:"عنوان القسم",body:"اكتب النص الذي سيظهر للزوار.",background:"transparent",textColor:"#f4ebdf",align:"right"},
    image:{imageUrl:"",alt:"",caption:"",background:"transparent",align:"center"},
    button:{text:"زر جديد",href:"#",background:"#d69a5c",color:"#1b120c",align:"center"},
    card:{heading:"عنوان البطاقة",body:"وصف مختصر للبطاقة.",imageUrl:"",imageAlt:"",buttonText:"اقرأ المزيد",href:"#",background:"#211814",textColor:"#f4ebdf"},
    menu:{heading:"من المنيو",limit:12,background:"transparent",textColor:"#f4ebdf"},
    divider:{},spacer:{height:32}
  };
  const createBlock = type => ({ id:newId(), type, props:structuredCloneSafe(defaults[type] || {}) });
  const structuredCloneSafe = value => JSON.parse(JSON.stringify(value));
  const starterLayout = () => ({version:1,blocks:[
    createBlock("hero"),
    createBlock("text"),
    createBlock("button")
  ]});
  const blankLayout = () => ({version:1,blocks:[]});
  const statusLabel = s => ({draft:"مسودة",published:"منشورة",archived:"مؤرشفة"}[s] || s);

  function load() {
    listRoot.innerHTML = '<p class="muted">جارٍ تحميل الصفحات…</p>';
    cms.client.from("pages")
      .select("id,slug,title,status,page_type,layout,published_at,updated_at,created_at")
      .order("updated_at",{ascending:false})
      .then(({data,error}) => {
        if (error) throw error;
        pages = data || [];
        renderList();
        message(pages.length ? "عدد الصفحات: " + pages.length.toLocaleString("ar-IQ") : "لا توجد صفحات بعد. أنشئ الصفحة الأولى.");
      })
      .catch(error => {
        listRoot.innerHTML = '<p class="error">تعذّر تحميل الصفحات: ' + esc(error.message || "خطأ غير معروف") + '</p>';
      });
  }

  function renderList() {
    if (!pages.length) {
      listRoot.innerHTML = '<div class="empty-state"><p>لم تُنشأ صفحات بعد.</p><p class="muted">اضغط «صفحة جديدة» للبدء.</p></div>';
      return;
    }
    listRoot.innerHTML = '<div class="page-list">' + pages.map(page => {
      const publicUrl = 'page.html?slug=' + encodeURIComponent(page.slug);
      return '<article class="page-list-item"><div class="page-list-item__content">' +
        '<strong>' + esc(page.title) + '</strong><span class="page-slug" dir="ltr">/' + esc(page.slug) + '</span>' +
        '<span class="page-status page-status--' + esc(page.status) + '">' + esc(statusLabel(page.status)) + '</span>' +
        '<small class="muted">آخر تعديل: ' + esc(new Date(page.updated_at || page.created_at).toLocaleString("ar-IQ")) + '</small>' +
        '</div><div class="page-list-item__actions">' +
        '<button type="button" class="btn secondary" data-page-edit="' + esc(page.id) + '">تعديل</button>' +
        (page.status === "published" ? '<a class="btn secondary" href="' + publicUrl + '" target="_blank" rel="noopener">عرض الصفحة ↗</a>' : "") +
        (page.status !== "archived" ? '<button type="button" class="btn secondary" data-page-archive="' + esc(page.id) + '">أرشفة</button>' : '<button type="button" class="btn secondary" data-page-restore="' + esc(page.id) + '">استعادة</button>') +
        '</div></article>';
    }).join("") + '</div>';
    listRoot.querySelectorAll("[data-page-edit]").forEach(btn => btn.addEventListener("click", () => {
      const page = pages.find(p => p.id === btn.dataset.pageEdit);
      if (page) editPage(page);
    }));
    listRoot.querySelectorAll("[data-page-archive]").forEach(btn => btn.addEventListener("click", () => changePageStatus(btn.dataset.pageArchive,"archived")));
    listRoot.querySelectorAll("[data-page-restore]").forEach(btn => btn.addEventListener("click", () => changePageStatus(btn.dataset.pageRestore,"draft")));
  }

  async function changePageStatus(id, status) {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    const label = status === "archived" ? "أرشفة هذه الصفحة؟ ستتوقف عن الظهور للعامة." : "استعادة هذه الصفحة كمسودة؟";
    if (!window.confirm(label)) return;
    try {
      const session = await cms.getSession();
      const {error} = await cms.client.from("pages").update({
        status, published_at:status === "published" ? (page.published_at || nowIso()) : null,
        updated_by:session?.user?.id || null
      }).eq("id",id);
      if (error) throw error;
      message(status === "archived" ? "تمت أرشفة الصفحة." : "تمت استعادة الصفحة كمسودة.");
      load();
    } catch(error) { message("تعذّر تحديث الصفحة: " + (error.message || "خطأ غير معروف")); }
  }

  function startNew() {
    isNew = true;
    currentPage = {id:null,slug:"page-" + Date.now().toString(36),title:"صفحة جديدة",status:"draft",page_type:"custom",layout:blankLayout(),seo:{},transition:null};
    $("#page-editor-title").textContent = "إنشاء صفحة جديدة";
    $("#page-title").value = currentPage.title;
    $("#page-slug").value = currentPage.slug;
    $("#page-status-label").textContent = "مسودة";
    $("#page-template").value = "blank";
    $("#page-template").disabled = false;
    listRoot.hidden = true;
    editor.hidden = false;
    renderBlocks();
    updatePreview();
    editor.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function editPage(page) {
    isNew = false;
    currentPage = structuredCloneSafe(page);
    currentPage.layout = currentPage.layout && Array.isArray(currentPage.layout.blocks) ? currentPage.layout : blankLayout();
    $("#page-editor-title").textContent = "تعديل: " + page.title;
    $("#page-title").value = page.title;
    $("#page-slug").value = page.slug;
    $("#page-status-label").textContent = statusLabel(page.status);
    $("#page-template").value = "blank";
    $("#page-template").disabled = true;
    listRoot.hidden = true;
    editor.hidden = false;
    renderBlocks();
    updatePreview();
    editor.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function closeEditor() {
    editor.hidden = true;
    listRoot.hidden = false;
    currentPage = null;
    isNew = false;
    load();
  }

  function fieldMarkup(def, props) {
    const [key,label,type,options] = def;
    const val = props[key] == null ? "" : String(props[key]);
    if (type === "textarea") return '<label class="block-field block-field--wide">' + esc(label) +
      '<textarea rows="3" data-prop="' + esc(key) + '" maxlength="5000">' + esc(val) + '</textarea></label>';
    if (type === "select") return '<label class="block-field">' + esc(label) + '<select data-prop="' + esc(key) + '">' +
      options.map(([v,l]) => '<option value="' + esc(v) + '"' + (val === v ? " selected" : "") + '>' + esc(l) + '</option>').join("") +
      '</select></label>';
    const inputType = type === "color" ? "color" : type === "url" ? "url" : type === "number" ? "number" : "text";
    const colorDefault = ({background:"#211814",textColor:"#f4ebdf",color:"#1b120c"})[key] || "#211814";
    const inputVal = type === "color" ? (/^#[0-9a-f]{6}$/i.test(val) ? val : colorDefault) : val;
    return '<label class="block-field">' + esc(label) + '<input type="' + inputType + '" data-prop="' + esc(key) + '"' +
      (type === "color" ? ' value="' + esc(inputVal) + '"' : ' value="' + esc(inputVal) + '"') +
      (type === "number" ? ' min="1" max="' + (key === "height" ? "240" : "100") + '"' : "") +
      (type === "url" ? ' maxlength="1000" placeholder="https://…"' : ' maxlength="5000"') +
      '></label>';
  }

  function renderBlocks() {
    const blocks = currentPage?.layout?.blocks || [];
    if (!blocks.length) {
      blocksRoot.innerHTML = '<div class="empty-state"><p>الصفحة فارغة.</p><p class="muted">اختر نوع مكوّن واضغط «إضافة مكوّن».</p></div>';
      return;
    }
    blocksRoot.innerHTML = blocks.map((block,index) => {
      const fields = fieldDefinitions[block.type] || [];
      return '<article class="block-editor" data-block-index="' + index + '">' +
        '<header class="block-editor__head"><span class="block-number">' + (index+1) + '</span><strong>' + esc(blockTitles[block.type] || block.type) + '</strong>' +
        '<div class="block-editor__controls"><button type="button" data-block-up="' + index + '" aria-label="نقل لأعلى" title="نقل لأعلى"' + (index === 0 ? " disabled" : "") + '>↑</button>' +
        '<button type="button" data-block-down="' + index + '" aria-label="نقل لأسفل" title="نقل لأسفل"' + (index === blocks.length-1 ? " disabled" : "") + '>↓</button>' +
        '<button type="button" class="block-delete" data-block-delete="' + index + '">حذف</button></div></header>' +
        '<div class="block-editor__fields">' + (fields.length ? fields.map(def => fieldMarkup(def,block.props || {})).join("") : '<p class="muted">لا توجد خصائص إضافية لهذا المكوّن.</p>') + '</div>' +
        '</article>';
    }).join("");
    blocksRoot.querySelectorAll("[data-prop]").forEach(input => input.addEventListener("input", syncFromInputs));
    blocksRoot.querySelectorAll("[data-prop]").forEach(input => input.addEventListener("change", syncFromInputs));
    blocksRoot.querySelectorAll("[data-block-up]").forEach(btn => btn.addEventListener("click", () => moveBlock(Number(btn.dataset.blockUp),-1)));
    blocksRoot.querySelectorAll("[data-block-down]").forEach(btn => btn.addEventListener("click", () => moveBlock(Number(btn.dataset.blockDown),1)));
    blocksRoot.querySelectorAll("[data-block-delete]").forEach(btn => btn.addEventListener("click", () => removeBlock(Number(btn.dataset.blockDelete))));
  }

  function syncFromInputs() {
    if (!currentPage) return;
    blocksRoot.querySelectorAll(".block-editor").forEach(card => {
      const index = Number(card.dataset.blockIndex);
      const block = currentPage.layout.blocks[index];
      if (!block) return;
      card.querySelectorAll("[data-prop]").forEach(input => {
        const key = input.dataset.prop;
        let value = input.value;
        if (input.type === "number") value = value === "" ? null : Number(value);
        block.props[key] = value;
      });
    });
    updatePreview();
  }

  function moveBlock(index, delta) {
    const blocks = currentPage.layout.blocks;
    const next = index + delta;
    if (next < 0 || next >= blocks.length) return;
    [blocks[index],blocks[next]] = [blocks[next],blocks[index]];
    renderBlocks(); updatePreview();
  }
  function removeBlock(index) {
    if (!window.confirm("حذف هذا المكوّن من الصفحة؟")) return;
    currentPage.layout.blocks.splice(index,1);
    renderBlocks(); updatePreview();
  }
  function updatePreview() {
    if (!currentPage) return;
    previewRoot.innerHTML = renderer.render(currentPage.layout);
  }

  $("#new-page").addEventListener("click", startNew);
  $("#cancel-page").addEventListener("click", closeEditor);
  $("#page-template").addEventListener("change", () => {
    if (!isNew || !currentPage) return;
    currentPage.layout = $("#page-template").value === "starter" ? starterLayout() : blankLayout();
    renderBlocks(); updatePreview();
  });
  $("#add-block").addEventListener("click", () => {
    if (!currentPage) return;
    const type = $("#block-type").value;
    currentPage.layout.blocks.push(createBlock(type));
    renderBlocks(); updatePreview();
    const cards = blocksRoot.querySelectorAll(".block-editor");
    cards[cards.length-1]?.scrollIntoView({behavior:"smooth",block:"center"});
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentPage || saving) return;
    syncFromInputs();
    const submitter = event.submitter;
    const nextStatus = submitter?.value === "published" ? "published" : "draft";
    const title = $("#page-title").value.trim();
    const slug = $("#page-slug").value.trim().toLowerCase();
    if (!title) { message("اكتب عنواناً للصفحة."); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      message("الرابط المختصر يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط.");
      $("#page-slug").focus();
      return;
    }
    if (!(currentPage.layout.blocks || []).length && !window.confirm("الصفحة فارغة. هل تريد حفظها بهذه الصورة؟")) return;
    saving = true;
    $("#save-page-draft").disabled = true;
    $("#publish-page").disabled = true;
    message("جارٍ حفظ الصفحة…");
    try {
      const session = await cms.getSession();
      const userId = session?.user?.id;
      const payload = {
        ...(currentPage.id ? {id:currentPage.id} : {}),
        slug,title,status:nextStatus,page_type:"custom",layout:currentPage.layout,
        seo:currentPage.seo || {},
        created_by:currentPage.created_by || userId || null,
        updated_by:userId || null,
        published_at:nextStatus === "published" ? (currentPage.published_at || nowIso()) : null
      };
      const query = currentPage.id
        ? cms.client.from("pages").update({
            slug,title,status:nextStatus,page_type:"custom",layout:currentPage.layout,
            seo:currentPage.seo || {},updated_by:userId || null,
            published_at:nextStatus === "published" ? (currentPage.published_at || nowIso()) : null
          }).eq("id",currentPage.id)
        : cms.client.from("pages").insert(payload);
      const {data,error} = await query.select("*").single();
      if (error) throw error;
      currentPage = structuredCloneSafe(data);
      isNew = false;
      $("#page-template").disabled = true;
      $("#page-editor-title").textContent = "تعديل: " + data.title;
      $("#page-status-label").textContent = statusLabel(data.status);
      message(data.status === "published" ? "تم حفظ الصفحة ونشرها." : "تم حفظ الصفحة كمسودة.");
      load();
    } catch(error) {
      message("تعذّر حفظ الصفحة: " + (error.message || "خطأ غير معروف"));
    } finally {
      saving = false;
      $("#save-page-draft").disabled = false;
      $("#publish-page").disabled = false;
    }
  });

  window.CoffeellaPageBuilder = { load };
  window.addEventListener("load", () => {
    const tabs = document.querySelectorAll('[data-tab="pages"]');
    tabs.forEach(tab => tab.addEventListener("click", load));
  });
})();
