/* Layout editor: pick a project, change its text and the layout of its blocks
   from fixed options, and preview the real project page at several screen
   sizes. Changes stay in this browser until downloaded. */
(function () {
  "use strict";

  var S = window.Site, esc = S.esc;
  var DRAFT_KEY = "works-layout-draft-v1";
  var IMG_EXT = /\.(webp|jpe?g|png|gif|avif|svg)$/i;

  var DEVICES = [
    { id: "desktop", label: "Desktop", w: 1440, h: 900 },
    { id: "laptop", label: "Laptop", w: 1280, h: 800 },
    { id: "half", label: "Half screen", w: 960, h: 1000 },
    { id: "tabletL", label: "Tablet landscape", w: 1180, h: 820 },
    { id: "tabletP", label: "Tablet portrait", w: 820, h: 1180 },
    { id: "phoneL", label: "Phone landscape", w: 844, h: 390 },
    { id: "phone", label: "Phone", w: 390, h: 844 }
  ];
  var WIDTHS = [["full", "Full"], ["wide", "Wide"], ["twothirds", "Two thirds"], ["half", "Half"], ["third", "Third"]];
  var SPAN = { full: 12, wide: 10, twothirds: 8, half: 6, third: 4 };
  var BLOCK_NAMES = { image: "Image", gallery: "Gallery", text: "Text", quote: "Quote", video: "Video", embed: "Embedded page", links: "Links", spacer: "Spacer" };

  var st = {
    site: null, slugs: [], titles: {}, live: {}, draft: {}, hist: {}, future: {}, images: {},
    slug: null, sel: "header", device: "desktop", ready: false
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function pretty(x) { return JSON.stringify(x, null, 2) + "\n"; }
  function attr(v) { return esc(v == null ? "" : v); }
  function P() { return st.draft[st.slug]; }

  /* ---------- load ---------- */
  S.getJSON("content/site.json").then(function (site) {
    st.site = site;
    var works = site.works || site.shelf || [];
    st.slugs = works.filter(function (e) { return e.project && !S.isURL(e.project); }).map(function (e) { return e.project; });
    return Promise.all(st.slugs.map(function (slug) {
      return S.getJSON("projects/" + slug + "/project.json").then(function (p) { st.live[slug] = p; st.titles[slug] = p.title || slug; })
        .catch(function () { st.titles[slug] = slug + " (not found)"; });
    }));
  }).then(function () {
    st.slugs = st.slugs.filter(function (s) { return st.live[s]; });
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
    st.slugs.forEach(function (s) {
      st.draft[s] = saved && saved.drafts && saved.drafts[s] ? saved.drafts[s] : clone(st.live[s]);
      st.hist[s] = []; st.future[s] = [];
    });
    var want = new URLSearchParams(location.search).get("p");
    st.slug = st.slugs.indexOf(want) > -1 ? want : (saved && st.slugs.indexOf(saved.slug) > -1 ? saved.slug : st.slugs[0]);
    st.device = saved && saved.device || "desktop";
    if (!st.slug) { $("[data-side]").innerHTML = '<p class="m-error">No projects in this repository yet. Add one in the site manager.</p>'; return; }
    buildTop(); openProject(st.slug);
    if (saved && changedSlugs().length) toast("Restored your unsaved layout changes");
  }).catch(function (err) {
    $("[data-side]").innerHTML = '<p class="m-error">Could not load the site (' + esc(err.message) + "). Open this page from the published site or a local server.</p>";
  });

  function saveDraft() {
    var drafts = {};
    changedSlugs().forEach(function (s) { drafts[s] = st.draft[s]; });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ slug: st.slug, device: st.device, drafts: drafts })); } catch (e) {}
    status();
  }
  function changedSlugs() { return st.slugs.filter(function (s) { return pretty(st.draft[s]) !== pretty(st.live[s]); }); }
  function status() {
    var n = changedSlugs().length, el = $("[data-status]");
    el.textContent = n ? n + (n === 1 ? " project changed" : " projects changed") : "No changes";
    el.classList.toggle("has-changes", !!n);
    $("[data-undo]").disabled = !st.hist[st.slug].length;
    $("[data-redo]").disabled = !st.future[st.slug].length;
  }
  window.addEventListener("beforeunload", function () { saveDraft(); });

  /* every edit goes through here: history, draft, preview */
  var typing = null;
  function change(fn, opts) {
    opts = opts || {};
    var before = pretty(P());
    // a run of keystrokes in one field is one undo step
    if (!(opts.typing && typing === opts.typing)) { st.hist[st.slug].push(before); if (st.hist[st.slug].length > 200) st.hist[st.slug].shift(); }
    typing = opts.typing || null;
    st.future[st.slug] = [];
    fn(P());
    saveDraft(); sendPreview();
    if (!opts.typing) drawSide();
  }
  function undo() {
    var h = st.hist[st.slug]; if (!h.length) return;
    st.future[st.slug].push(pretty(P())); st.draft[st.slug] = JSON.parse(h.pop()); typing = null;
    saveDraft(); sendPreview(); drawSide();
  }
  function redo() {
    var f = st.future[st.slug]; if (!f.length) return;
    st.hist[st.slug].push(pretty(P())); st.draft[st.slug] = JSON.parse(f.pop()); typing = null;
    saveDraft(); sendPreview(); drawSide();
  }

  /* ---------- top bar ---------- */
  function buildTop() {
    var pick = $("[data-project-pick]");
    pick.innerHTML = st.slugs.map(function (s) { return '<option value="' + attr(s) + '">' + esc(st.titles[s]) + "</option>"; }).join("");
    pick.onchange = function () { openProject(pick.value); };
    $("[data-devices]").innerHTML = DEVICES.map(function (d) {
      return '<button type="button" data-device="' + d.id + '" title="' + d.label + ", " + d.w + " by " + d.h + '">' + deviceIcon(d) + '<span>' + d.label + "</span></button>";
    }).join("");
    $$("[data-device]").forEach(function (b) { b.onclick = function () { st.device = b.dataset.device; saveDraft(); fitFrame(); }; });
    $("[data-undo]").onclick = undo; $("[data-redo]").onclick = redo;
    $("[data-download]").onclick = download;
    $("[data-revert]").onclick = function () {
      var b = this;
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sure? Revert"; setTimeout(function () { b.dataset.sure = ""; b.textContent = "Revert project"; }, 3000); return; }
      b.dataset.sure = ""; b.textContent = "Revert project";
      change(function () { st.draft[st.slug] = clone(st.live[st.slug]); });
      toast("Back to the published version");
    };
    document.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;   // let fields undo their own typing
      e.preventDefault(); if (e.shiftKey) redo(); else undo();
    });
    window.addEventListener("resize", fitFrame);
  }
  function deviceIcon(d) {
    var k = 16 / Math.max(d.w, d.h), w = Math.max(5, Math.round(d.w * k)), h = Math.max(5, Math.round(d.h * k));
    return '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="' + (9 - w / 2) + '" y="' + (9 - h / 2) + '" width="' + w + '" height="' + h + '" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
  }

  function openProject(slug) {
    st.slug = slug; st.sel = "header"; typing = null; st.ready = false;
    $("[data-project-pick]").value = slug;
    history.replaceState(null, "", "?p=" + encodeURIComponent(slug));
    $("[data-preview]").src = "project.html?p=" + encodeURIComponent(slug) + "&preview=1";
    listImages(slug);
    saveDraft(); drawSide(); fitFrame();
  }

  /* ---------- preview ---------- */
  var sendTimer = null;
  function sendPreview(scroll) {
    clearTimeout(sendTimer);
    sendTimer = setTimeout(function () {
      var w = $("[data-preview]").contentWindow;
      if (!w || !st.ready) return;
      w.postMessage({ type: "works-layout", project: P() }, location.origin);
      w.postMessage({ type: "works-layout-select", index: st.sel, scroll: !!scroll }, location.origin);
    }, 90);
  }
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === "works-layout-ready") { st.ready = true; sendPreview(); }
    if (e.data.type === "works-layout-pick") { select(e.data.index === "header" || e.data.index === "intro" ? "header" : +e.data.index, false); }
  });
  function fitFrame() {
    var d = DEVICES.filter(function (x) { return x.id === st.device; })[0] || DEVICES[0];
    $$("[data-device]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.device === d.id)); });
    var stage = $("[data-stage]"), frame = $("[data-frame]"), iframe = $("[data-preview]");
    var availW = stage.clientWidth - 48, availH = stage.clientHeight - 70;
    // the frame keeps the device's true width and height (so the page sees a real
    // screen of that size) and is scaled down to fit the stage
    var k = Math.min(1, availW / d.w, availH / d.h);
    iframe.style.width = d.w + "px"; iframe.style.height = d.h + "px"; iframe.style.transform = "scale(" + k + ")";
    frame.style.width = d.w * k + "px"; frame.style.height = d.h * k + "px";
    $("[data-device-label]").textContent = d.label + " · " + d.w + " px wide" + (k < 1 ? " · shown at " + Math.round(k * 100) + "%" : "");
  }

  /* ---------- side panel ---------- */
  function select(i, scroll) {
    st.sel = i; typing = null; drawSide();
    sendPreview(scroll !== false);
    var row = $('[data-pick="' + i + '"]'); if (row) row.scrollIntoView({ block: "nearest" });
  }

  function seg(name, options, value, cls) {
    return '<div class="l-seg ' + (cls || "") + '" role="radiogroup">' + options.map(function (o) {
      return '<label' + (o[2] ? ' title="' + attr(o[2]) + '"' : "") + '><input type="radio" name="' + name + '" value="' + attr(o[0]) + '"' + (String(o[0]) === String(value) ? " checked" : "") + "><span>" + esc(o[1]) + "</span></label>";
    }).join("") + "</div>";
  }
  function fld(label, inner, hint) {
    return '<div class="m-field"><span class="m-label">' + label + "</span>" + inner + (hint ? '<span class="m-hint">' + hint + "</span>" : "") + "</div>";
  }
  function txt(key, value, ph) { return '<input data-k="' + key + '" value="' + attr(value) + '" placeholder="' + attr(ph || "") + '">'; }
  function area(key, value, rows, ph) { return '<textarea data-k="' + key + '" rows="' + (rows || 4) + '" placeholder="' + attr(ph || "") + '">' + esc(value || "") + "</textarea>"; }

  function blockLabel(b) {
    var t = b.type === "text" ? (b.heading || (b.body || "").slice(0, 40)) : b.type === "image" ? b.src : b.type === "gallery" ? (b.items || []).length + " images" :
      b.type === "quote" ? b.text : b.type === "video" ? (b.src || b.youtube || b.vimeo) : b.type === "embed" ? b.url : b.type === "links" ? b.heading : "";
    return (t || "").toString().slice(0, 48);
  }
  function widthOf(b) {
    var l = b.layout || {};
    if (l.width) return l.width;
    if (/^(image|gallery|video|embed)$/.test(b.type)) return b.width === "wide" ? "wide" : b.width === "text" ? "twothirds" : "full";
    return "full";
  }
  /* rows exactly as the page builds them, to explain what sits beside what */
  function rowsOf(p) {
    var rows = [], cur = null;
    (p.blocks || []).forEach(function (b, i) {
      if (!b || b.hidden) return;
      var span = SPAN[widthOf(b)], beside = b.layout && b.layout.beside;
      if (beside && cur && cur.total + span <= 12) { cur.items.push(i); cur.total += span; }
      else { cur = { items: [i], total: span, wanted: beside && !!cur }; rows.push(cur); }
    });
    return rows;
  }

  function drawSide() {
    var p = P(), side = $("[data-side]"), blocks = p.blocks || [], rows = rowsOf(p), rowOf = {};
    rows.forEach(function (r, k) { r.items.forEach(function (i) { rowOf[i] = { row: k, first: r.items[0] === i, wrapped: r.wanted && r.items[0] === i, n: r.items.length }; }); });
    var keepScroll = side.scrollTop;
    side.innerHTML =
      '<div class="l-sec"><div class="l-sec-head"><h2>Page</h2><span class="m-muted">' + esc(p.title || st.slug) + "</span></div>" +
      '<ol class="l-list">' +
      '<li class="l-item' + (st.sel === "header" ? " is-sel" : "") + '" data-pick="header"><span class="l-kind">Header</span><span class="l-what">Title, introduction and facts</span></li>' +
      blocks.map(function (b, i) {
        var r = rowOf[i];
        return '<li class="l-item' + (st.sel === i ? " is-sel" : "") + (b.hidden ? " is-hidden" : "") + (r && !r.first ? " is-beside" : "") + '" data-pick="' + i + '" draggable="true" data-drag="' + i + '">' +
          '<span class="m-grip" aria-hidden="true">&#8942;&#8942;</span>' +
          '<span class="l-kind">' + esc(BLOCK_NAMES[b.type] || b.type) + "</span>" +
          '<span class="l-what">' + esc(blockLabel(b)) + "</span>" +
          '<span class="l-w">' + (b.hidden ? "hidden" : (WIDTHS.filter(function (w) { return w[0] === widthOf(b); })[0] || ["", ""])[1]) + (r && !r.first ? " · beside" : "") + "</span></li>";
      }).join("") + "</ol>" +
      '<div class="l-add"><span class="m-label">Add after the selected block</span>' + Object.keys(BLOCK_NAMES).map(function (k) { return '<button type="button" class="m-btn m-small" data-add="' + k + '">+ ' + BLOCK_NAMES[k] + "</button>"; }).join("") + "</div></div>" +
      '<div class="l-sec l-inspector">' + (st.sel === "header" ? headerPanel(p) : blockPanel(blocks[st.sel], st.sel, rowOf[st.sel])) + "</div>";
    side.scrollTop = keepScroll;
    wireSide(side);
  }

  function headerPanel(p) {
    var l = p.layout || {};
    return '<div class="l-sec-head"><h2>Header</h2></div>' +
      '<h3 class="l-h3">Layout</h3>' +
      fld("Title position", seg("lh-header", [["left", "Left"], ["center", "Centred"]], l.header || "left")) +
      fld("Facts", seg("lh-facts", [["side", "Beside the introduction"], ["below", "Below it, in columns"]], l.facts || "side")) +
      fld("Introduction size", seg("lh-intro", [["xsmall", "Very small"], ["small", "Small"], ["normal", "Medium"], ["large", "Large"], ["xlarge", "Very large"]], l.intro || "normal")) +
      '<h3 class="l-h3">Text</h3>' +
      fld("Title", txt("title", p.title)) + fld("Description", txt("subtitle", p.subtitle)) +
      '<div class="m-grid2">' + fld("Category", txt("category", p.category)) + fld("Year", txt("year", p.year)) + "</div>" +
      fld("Introduction", area("intro", Array.isArray(p.intro) ? p.intro.join("\n\n") : p.intro, 7, "A blank line starts a new paragraph."), "**bold**, *italic* and [label](https://...) work.") +
      '<span class="m-label">Facts</span><div data-facts>' + (p.meta || []).map(function (m, i) {
        return '<div class="m-pair"><input data-fact="' + i + '" data-fk="0" value="' + attr(m[0]) + '" placeholder="Label"><input data-fact="' + i + '" data-fk="1" value="' + attr(m[1]) + '" placeholder="Value">' +
          '<button type="button" class="m-icon" data-factup="' + i + '" aria-label="Move up">&#8593;</button><button type="button" class="m-icon" data-factdel="' + i + '" aria-label="Remove">&#215;</button></div>';
      }).join("") + '</div><button type="button" class="m-btn m-small" data-factadd>Add a fact</button>';
  }

  function blockPanel(b, i, r) {
    if (!b) return '<p class="m-muted">Select a block in the list or click it in the preview.</p>';
    var l = b.layout || {}, w = widthOf(b), media = /^(image|gallery)$/.test(b.type);
    var fitNote = "";
    if (l.beside && r && r.wrapped) fitNote = '<p class="l-note">This block does not fit beside the one before (widths add up to more than full), so it starts a new row. Make one of them narrower.</p>';
    else if (l.beside && i === firstVisible()) fitNote = '<p class="l-note">This is the first block, so there is nothing to sit beside.</p>';
    return '<div class="l-sec-head"><h2>' + esc(BLOCK_NAMES[b.type] || b.type) + ' <span class="m-muted">block ' + S.pad(i) + '</span></h2><span class="m-row-btns">' +
      '<button type="button" class="m-icon" data-move="-1" aria-label="Move up">&#8593;</button><button type="button" class="m-icon" data-move="1" aria-label="Move down">&#8595;</button>' +
      '<button type="button" class="m-btn m-small" data-dup>Duplicate</button><button type="button" class="m-btn m-small" data-hide>' + (b.hidden ? "Show" : "Hide") + "</button>" +
      '<button type="button" class="m-btn m-small m-ghost-bad" data-del>Delete</button></span></div>' +
      '<h3 class="l-h3">Layout</h3>' +
      fld("Width", seg("ll-width", WIDTHS, w), "On half screens and tablets, Third becomes Half and wider blocks become Full. On phones every block is Full.") +
      fld("Row", seg("ll-beside", [["0", "Start a new row"], ["1", "Beside the block before"]], l.beside ? "1" : "0")) + fitNote +
      fld("Position in the row", seg("ll-align", [["start", "Left"], ["center", "Centre"], ["end", "Right"]], l.align || "start"), "Used when the row is narrower than full. The first block of a row sets it.") +
      fld("Vertical alignment", seg("ll-valign", [["start", "Top"], ["center", "Middle"], ["end", "Bottom"]], l.valign || "start"), "For blocks of different heights side by side.") +
      fld("Space above", seg("ll-space", [["none", "None"], ["small", "Small"], ["normal", "Normal"], ["large", "Large"]], l.space || "normal")) +
      (media ? fld("Image shape", seg("ll-ratio", [["original", "Original"], ["16/9", "16:9"], ["3/2", "3:2"], ["4/3", "4:3"], ["1/1", "Square"], ["3/4", "Portrait"]], l.ratio || "original"), "Other shapes crop the image; a click still opens the whole image.") +
        (l.ratio && l.ratio !== "original" ? fld("Keep in view", seg("ll-focus", [["center", "Centre"], ["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"]], l.focus || "center")) : "") : "") +
      (b.type === "text" ? fld("Heading", seg("ll-text", [["side", "Beside the text"], ["stacked", "Above the text"]], l.text || "side"), "Beside only when the block is wide enough; otherwise above.") +
        fld("Text size", seg("ll-size", [["xsmall", "Very small"], ["small", "Small"], ["normal", "Medium"], ["large", "Large"], ["xlarge", "Very large"]], l.size || "normal"), "Sizes scale down gently on phones.") +
        fld("Alignment", seg("ll-textAlign", [["left", "Left"], ["center", "Centred"]], l.textAlign || "left")) : "") +
      '<h3 class="l-h3">Content</h3>' + contentFields(b);
  }
  function firstVisible() { var bl = P().blocks || []; for (var i = 0; i < bl.length; i++) if (!bl[i].hidden) return i; return -1; }

  function contentFields(b) {
    var img = 'list="l-imgs" spellcheck="false" placeholder="01.webp"';
    var dl = '<datalist id="l-imgs">' + (st.images[st.slug] || []).map(function (n) { return '<option value="' + attr(n) + '">'; }).join("") + "</datalist>";
    switch (b.type) {
      case "image":
        return dl + fld("Image file", '<input data-k="src" value="' + attr(b.src) + '" ' + img + ">") + fld("Caption", txt("caption", b.caption)) + fld("Alt text", txt("alt", b.alt, "What the image shows"));
      case "gallery":
        return dl + fld("Columns", seg("gal-columns", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], b.columns || 2)) +
          (b.items || []).map(function (x, j) {
            x = typeof x === "string" ? { src: x } : x;
            return '<div class="m-pair"><input data-item="' + j + '" data-ik="src" value="' + attr(x.src) + '" ' + img + '><input data-item="' + j + '" data-ik="caption" value="' + attr(x.caption) + '" placeholder="Caption">' +
              '<button type="button" class="m-icon" data-itemdel="' + j + '" aria-label="Remove">&#215;</button></div>';
          }).join("") + '<button type="button" class="m-btn m-small" data-itemadd>Add image</button>' + fld("Gallery caption", txt("caption", b.caption));
      case "text":
        return fld("Heading", txt("heading", b.heading)) + fld("Text", area("body", b.body, 8, "A blank line starts a new paragraph."), "**bold**, *italic* and [label](https://...) work.");
      case "quote":
        return fld("Quote", area("text", b.text, 3)) + fld("By", txt("by", b.by));
      case "video":
        return fld("Video file (in the folder)", txt("src", b.src, "walkthrough.mp4")) + fld("or YouTube id", txt("youtube", b.youtube)) + fld("or Vimeo id", txt("vimeo", b.vimeo)) + fld("Caption", txt("caption", b.caption));
      case "embed":
        return fld("Page address", txt("url", b.url, "https://")) + fld("Shape (width / height)", txt("ratio", b.ratio, "16 / 10")) + fld("Caption", txt("caption", b.caption));
      case "links":
        return fld("Heading", txt("heading", b.heading)) + (b.items || []).map(function (x, j) {
          return '<div class="m-pair"><input data-item="' + j + '" data-ik="label" value="' + attr(x.label) + '" placeholder="Label"><input data-item="' + j + '" data-ik="url" value="' + attr(x.url) + '" placeholder="https://">' +
            '<button type="button" class="m-icon" data-itemdel="' + j + '" aria-label="Remove">&#215;</button></div>';
        }).join("") + '<button type="button" class="m-btn m-small" data-itemadd>Add link</button>';
      default:
        return '<p class="m-hint">A spacer adds room between blocks. Use Space above for finer control.</p>';
    }
  }

  function setLayout(b, k, v) {
    b.layout = b.layout || {};
    var defaults = { beside: false, align: "start", valign: "start", space: "normal", ratio: "original", focus: "center", text: "side", size: "normal", textAlign: "left" };
    if (k === "beside") v = v === "1";
    if (v === defaults[k]) delete b.layout[k]; else b.layout[k] = v;
    if (k === "width") { delete b.width; if (v === "full") delete b.layout.width; }
    if (k === "ratio" && v === "original") delete b.layout.focus;
    if (!Object.keys(b.layout).length) delete b.layout;
  }

  function wireSide(side) {
    $$("[data-pick]", side).forEach(function (li) {
      li.onclick = function (e) { if (e.target.closest("button")) return; select(li.dataset.pick === "header" ? "header" : +li.dataset.pick); };
    });
    // drag to reorder blocks
    var from = null;
    $$("[data-drag]", side).forEach(function (li) {
      li.addEventListener("dragstart", function (e) { from = +li.dataset.drag; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", from); li.classList.add("is-drag"); });
      li.addEventListener("dragend", function () { li.classList.remove("is-drag"); });
      li.addEventListener("dragover", function (e) { e.preventDefault(); li.classList.add("is-over"); });
      li.addEventListener("dragleave", function () { li.classList.remove("is-over"); });
      li.addEventListener("drop", function (e) {
        e.preventDefault(); li.classList.remove("is-over");
        var to = +li.dataset.drag; if (from == null || from === to) return;
        change(function (p) { var x = p.blocks.splice(from, 1)[0]; p.blocks.splice(to, 0, x); });
        select(to); from = null;
      });
    });
    $$("[data-add]", side).forEach(function (bt) {
      bt.onclick = function () {
        var at = typeof st.sel === "number" ? st.sel + 1 : 0;
        change(function (p) { p.blocks = p.blocks || []; p.blocks.splice(at, 0, newBlock(bt.dataset.add)); });
        select(at);
      };
    });
    var insp = $(".l-inspector", side);
    // header
    $$('input[name^="lh-"]', insp).forEach(function (r) {
      r.onchange = function () {
        var k = r.name.slice(3), def = { header: "left", facts: "side", intro: "normal" }[k];
        change(function (p) { p.layout = p.layout || {}; if (r.value === def) delete p.layout[k]; else p.layout[k] = r.value; if (!Object.keys(p.layout).length) delete p.layout; });
      };
    });
    $$("[data-fact]", insp).forEach(function (inp) {
      inp.oninput = function () { change(function (p) { p.meta[+inp.dataset.fact][+inp.dataset.fk] = inp.value; }, { typing: "fact" + inp.dataset.fact + inp.dataset.fk }); };
    });
    $$("[data-factup]", insp).forEach(function (bt) { bt.onclick = function () { var i = +bt.dataset.factup; if (i) change(function (p) { var x = p.meta.splice(i, 1)[0]; p.meta.splice(i - 1, 0, x); }); }; });
    $$("[data-factdel]", insp).forEach(function (bt) { bt.onclick = function () { change(function (p) { p.meta.splice(+bt.dataset.factdel, 1); }); }; });
    var fa = $("[data-factadd]", insp); if (fa) fa.onclick = function () { change(function (p) { p.meta = p.meta || []; p.meta.push(["", ""]); }); };

    // text fields (header or block)
    $$("[data-k]", insp).forEach(function (inp) {
      inp.oninput = function () {
        var k = inp.dataset.k, v = inp.value;
        change(function (p) {
          var target = st.sel === "header" ? p : p.blocks[st.sel];
          if (v === "" && k !== "title") delete target[k]; else target[k] = v;
        }, { typing: st.sel + ":" + k });
        if (st.sel !== "header") { var li = $('[data-pick="' + st.sel + '"] .l-what'); if (li) li.textContent = blockLabel(P().blocks[st.sel]); }
      };
    });
    if (st.sel === "header") return;
    var i = st.sel;
    $$('input[name^="ll-"]', insp).forEach(function (r) { r.onchange = function () { change(function (p) { setLayout(p.blocks[i], r.name.slice(3), r.value); }); }; });
    $$('input[name="gal-columns"]', insp).forEach(function (r) { r.onchange = function () { change(function (p) { p.blocks[i].columns = +r.value; }); }; });
    $$("[data-item]", insp).forEach(function (inp) {
      inp.oninput = function () {
        change(function (p) {
          var b = p.blocks[i], j = +inp.dataset.item;
          if (typeof b.items[j] === "string") b.items[j] = { src: b.items[j] };
          b.items[j][inp.dataset.ik] = inp.value;
        }, { typing: "item" + inp.dataset.item + inp.dataset.ik });
      };
    });
    $$("[data-itemdel]", insp).forEach(function (bt) { bt.onclick = function () { change(function (p) { p.blocks[i].items.splice(+bt.dataset.itemdel, 1); }); }; });
    var ia = $("[data-itemadd]", insp); if (ia) ia.onclick = function () { change(function (p) { var b = p.blocks[i]; b.items = b.items || []; b.items.push(b.type === "links" ? { label: "", url: "" } : { src: "", caption: "" }); }); };
    $$("[data-move]", insp).forEach(function (bt) {
      bt.onclick = function () {
        var j = i + +bt.dataset.move; if (j < 0 || j >= P().blocks.length) return;
        change(function (p) { var x = p.blocks.splice(i, 1)[0]; p.blocks.splice(j, 0, x); }); select(j);
      };
    });
    $("[data-dup]", insp).onclick = function () { change(function (p) { p.blocks.splice(i + 1, 0, clone(p.blocks[i])); }); select(i + 1); };
    $("[data-hide]", insp).onclick = function () { change(function (p) { var b = p.blocks[i]; if (b.hidden) delete b.hidden; else b.hidden = true; }); };
    $("[data-del]", insp).onclick = function () {
      var bt = this;
      if (bt.dataset.sure !== "1") { bt.dataset.sure = "1"; bt.textContent = "Sure? Delete"; return; }
      change(function (p) { p.blocks.splice(i, 1); });
      select(Math.min(i, P().blocks.length - 1) < 0 ? "header" : Math.min(i, P().blocks.length - 1));
    };
  }

  function newBlock(type) {
    return ({ image: { type: "image", src: "" }, gallery: { type: "gallery", columns: 2, items: [{ src: "" }, { src: "" }] }, text: { type: "text", heading: "New heading", body: "Text." },
      quote: { type: "quote", text: "A short statement." }, video: { type: "video", src: "" }, embed: { type: "embed", url: "https://" }, links: { type: "links", items: [{ label: "", url: "" }] }, spacer: { type: "spacer" } })[type];
  }

  function listImages(slug) {
    var set = new Set();
    (st.draft[slug].blocks || []).forEach(function (b) {
      if (b.src) set.add(b.src);
      (b.items || []).forEach(function (x) { if (typeof x === "string") set.add(x); else if (x.src) set.add(x.src); });
    });
    st.images[slug] = Array.from(set);
    var repo = st.site.repo;
    if (!repo) return;
    fetch("https://api.github.com/repos/" + repo + "/contents/projects/" + encodeURIComponent(slug)).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { (list || []).forEach(function (f) { if (f.type === "file" && IMG_EXT.test(f.name) && f.name !== "cover.webp") set.add(f.name); }); st.images[slug] = Array.from(set).sort(); })
      .catch(function () {});
  }

  /* ---------- download ---------- */
  function download() {
    var slugs = changedSlugs();
    if (!slugs.length) { toast("Nothing has changed yet"); return; }
    var dashes = slugs.some(function (s) { return /[\u2013\u2014]/.test(pretty(st.draft[s])); });
    var entries = slugs.map(function (s) { return { name: "projects/" + s + "/project.json", data: new TextEncoder().encode(pretty(st.draft[s])) }; });
    entries.push({ name: "UPLOAD-NOTES.txt", data: new TextEncoder().encode("Upload the projects folder in this zip to the root of the repository (Add file, Upload files),\nthen commit. Each project.json replaces the published one.\n\n" + entries.map(function (e) { return e.name; }).join("\n") + "\n") });
    var d = new Date(), stamp = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(window.Zip.make(entries)); a.download = "works-layout-" + stamp + ".zip";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Downloaded " + slugs.length + " project" + (slugs.length > 1 ? "s" : "") + ". Upload the projects folder on GitHub, then commit." + (dashes ? " Note: some text has long dashes." : ""));
  }

  function toast(msg) {
    var t = document.createElement("div"); t.className = "m-toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 3600); setTimeout(function () { t.remove(); }, 4200);
  }

  window.LayoutEditor = { state: st, select: select };
})();
