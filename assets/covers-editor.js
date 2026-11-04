/* Cover animation editor: size, position and speed of each book's drawing, and
   thickness and transparency of each ink (black lines, orange accent). Settings
   are a default for all books plus optional values for single books, saved in
   content/site.json under "covers". Changes stay in this browser until downloaded. */
(function () {
  "use strict";

  var S = window.Site, esc = S.esc;
  var DRAFT_KEY = "works-covers-draft-v1";

  /* Every control: path in the settings, label, range in display units, and how
     display units map to stored values. */
  var FIELDS = [
    { group: "Drawing", path: "size", label: "Size", min: 40, max: 200, step: 5, unit: "%", def: 1, k: 100 },
    { group: "Drawing", path: "x", label: "Move left or right", min: -45, max: 45, step: 1, unit: "", def: 0, k: 1, hint: "Negative moves left." },
    { group: "Drawing", path: "y", label: "Move up or down", min: -60, max: 20, step: 1, unit: "", def: 0, k: 1, hint: "Negative moves up." },
    { group: "Drawing", path: "speed", label: "Speed", min: 0, max: 300, step: 5, unit: "%", def: 1, k: 100, hint: "0 holds a still frame." },
    { group: "Lines (ink)", path: "ink.weight", label: "Thickness", min: 20, max: 400, step: 5, unit: "%", def: 1, k: 100 },
    { group: "Lines (ink)", path: "ink.opacity", label: "Opacity", min: 0, max: 100, step: 1, unit: "%", def: 1, k: 100, hint: "100 is solid; lower is more transparent." },
    { group: "Accent (orange)", path: "accent.weight", label: "Thickness", min: 20, max: 400, step: 5, unit: "%", def: 1, k: 100 },
    { group: "Accent (orange)", path: "accent.opacity", label: "Opacity", min: 0, max: 100, step: 1, unit: "%", def: 1, k: 100 }
  ];

  var st = { site: null, liveCovers: null, covers: null, books: [], sel: "default", hist: [], future: [] };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function pretty(x) { return JSON.stringify(x, null, 2) + "\n"; }
  function attr(v) { return esc(v == null ? "" : v); }

  function get(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function set(o, path, v) { var ks = path.split("."), last = ks.pop(); ks.forEach(function (k) { o = o[k] = o[k] || {}; }); o[last] = v; }
  function del(o, path) {
    var ks = path.split("."), last = ks.pop(), parents = [o];
    ks.forEach(function (k) { o = o && o[k]; parents.push(o); });
    if (o) delete o[last];
    for (var i = ks.length - 1; i >= 0; i--) { var p = parents[i], c = p && p[ks[i]]; if (c && !Object.keys(c).length) delete p[ks[i]]; }
  }
  /* tidy: drop empty objects and book entries */
  function tidy(c) {
    c = clone(c);
    ["default"].concat(Object.keys(c.books || {}).map(function (k) { return "books." + k; })).forEach(function (path) {
      var o = get(c, path); if (!o) return;
      ["ink", "accent"].forEach(function (k) { if (o[k] && !Object.keys(o[k]).length) delete o[k]; });
    });
    Object.keys(c.books || {}).forEach(function (k) { if (!Object.keys(c.books[k]).length) delete c.books[k]; });
    if (c.books && !Object.keys(c.books).length) delete c.books;
    if (c["default"] && !Object.keys(c["default"]).length) delete c["default"];
    return c;
  }
  function target(sel) { return sel === "default" ? st.covers["default"] : (st.covers.books[sel] = st.covers.books[sel] || {}); }
  function siteWith(covers) { var s = clone(st.site); var c = tidy(covers); if (Object.keys(c).length) s.covers = c; else delete s.covers; return s; }
  function changed() { return pretty(siteWith(st.covers)) !== pretty(siteWith(st.liveCovers)); }

  /* ---------- load ---------- */
  S.getJSON("content/site.json").then(function (site) {
    st.site = site;
    st.liveCovers = { "default": {}, books: {} };
    if (site.covers) { st.liveCovers["default"] = clone(site.covers["default"] || {}); st.liveCovers.books = clone(site.covers.books || {}); }
    st.covers = clone(st.liveCovers);
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d && d.covers) { st.covers = { "default": d.covers["default"] || {}, books: d.covers.books || {} }; if (changed()) toast("Restored your unsaved cover changes"); }
    } catch (e) {}
    return S.loadSite(site);
  }).then(function (r) {
    st.books = r.books.filter(function (it) { return it.shelf && it.shelf.art && window.Covers.has(it.shelf.art); });
    buildTop(); drawStage(); drawSide(); status();
  }).catch(function (err) {
    $("[data-side]").innerHTML = '<p class="m-error">Could not load the site (' + esc(err.message) + "). Open this page from the published site or a local server.</p>";
  });

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ covers: tidy(st.covers) })); } catch (e) {}
    status();
  }
  function status() {
    var c = changed(), el = $("[data-status]");
    el.textContent = c ? "Unsaved changes" : "No changes";
    el.classList.toggle("has-changes", c);
    $("[data-undo]").disabled = !st.hist.length; $("[data-redo]").disabled = !st.future.length;
  }
  function snapshot() { st.hist.push(JSON.stringify(st.covers)); if (st.hist.length > 200) st.hist.shift(); st.future = []; }
  function restore(json) { st.covers = JSON.parse(json); st.covers["default"] = st.covers["default"] || {}; st.covers.books = st.covers.books || {}; applyAll(); drawSide(); saveDraft(); }

  /* ---------- top bar ---------- */
  function buildTop() {
    var T = window.SITE_THEMES;
    $("[data-themes]").innerHTML = Object.keys(T.THEMES).map(function (k) {
      return '<button type="button" data-theme="' + k + '" aria-pressed="' + (k === T.current) + '">' + esc(T.THEMES[k]) + "</button>";
    }).join("");
    $$("[data-theme]").forEach(function (b) { b.onclick = function () { T.set(b.dataset.theme); }; });
    window.addEventListener("site-theme", function (e) {
      $$("[data-theme]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.theme === e.detail)); });
      window.Covers.refresh(); drawSide();
    });
    $("[data-undo]").onclick = function () { if (st.hist.length) { st.future.push(JSON.stringify(st.covers)); restore(st.hist.pop()); } };
    $("[data-redo]").onclick = function () { if (st.future.length) { st.hist.push(JSON.stringify(st.covers)); restore(st.future.pop()); } };
    $("[data-revert]").onclick = function () {
      var b = this;
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sure? Revert all"; setTimeout(function () { b.dataset.sure = ""; b.textContent = "Revert all"; }, 3000); return; }
      b.dataset.sure = ""; b.textContent = "Revert all";
      snapshot(); restore(JSON.stringify(st.liveCovers)); toast("Back to the published settings");
    };
    $("[data-download]").onclick = download;
    document.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && document.activeElement.type !== "range") return;
      e.preventDefault(); $(e.shiftKey ? "[data-redo]" : "[data-undo]").click();
    });
  }

  /* ---------- stage: every cover, live ---------- */
  function coverHTML(it) {
    var meta = [it.category, it.year].filter(Boolean).map(esc).join(" · ");
    return '<span class="c-book"><span class="art-cover"><span class="ac-title">' + esc(it.shelf.coverText || it.title) + "</span>" +
      '<canvas class="ac-canvas" data-art="' + attr(it.shelf.art) + '"></canvas>' +
      '<span class="ac-foot"><span class="ac-desc">' + esc(it.shelf.coverNote || it.subtitle || "") + '</span><span class="ac-tag">' + meta + "</span></span></span></span>";
  }
  function drawStage() {
    var stage = $("[data-stage]");
    $$("canvas", stage).forEach(function (c) { window.Covers.unmount(c); });
    var sel = st.books.filter(function (b) { return b.id === st.sel; })[0];
    stage.innerHTML =
      '<p class="c-hint">Every book on the shelf, animating as it will on the site. Click one to give it its own settings, or choose <strong>All books</strong> on the left to change the default. Use the theme buttons above to check each theme.</p>' +
      '<div class="c-grid">' +
      (sel ? '<div class="c-card is-big" data-id="' + attr(sel.id) + '">' + coverHTML(sel) + '<div class="c-big-info"><strong>' + esc(sel.title) + "</strong>Drawing: " + esc(sel.shelf.art) + ". This is the open book at a large size; the grid below shows the shelf size.</div></div>" : "") +
      st.books.map(function (it) {
        return '<button type="button" class="c-card' + (it.id === st.sel ? " is-sel" : "") + '" data-id="' + attr(it.id) + '">' + coverHTML(it) +
          '<span class="c-name">' + esc(it.title) + (st.covers.books[it.id] && Object.keys(tidy({ books: { x: st.covers.books[it.id] } }).books || {}).length ? '<span class="c-own">own settings</span>' : "") + "</span>" +
          '<span class="c-sub">' + esc(it.shelf.art) + "</span></button>";
      }).join("") + "</div>";
    $$(".c-card", stage).forEach(function (card, i) {
      var c = $("canvas", card), id = card.dataset.id, cs = S.coverStyle({ covers: tidy(st.covers) }, id);
      S.applyCoverBox(c, cs);
      window.Covers.mount(c, c.dataset.art, i, cs);
      window.Covers.activate(c);
      if (!card.classList.contains("is-big")) card.onclick = function () { select(id); };
    });
  }
  function applyAll() {
    var covers = tidy(st.covers);
    $$(".c-card").forEach(function (card) {
      var c = $("canvas", card), cs = S.coverStyle({ covers: covers }, card.dataset.id);
      S.applyCoverBox(c, cs);
      window.Covers.setStyle(c, cs);
    });
    $$(".c-card:not(.is-big)").forEach(function (card) {
      var own = st.covers.books[card.dataset.id], has = own && Object.keys(tidy({ books: { x: own } }).books || {}).length;
      var name = $(".c-name", card), tag = $(".c-own", name);
      if (has && !tag) name.insertAdjacentHTML("beforeend", '<span class="c-own">own settings</span>');
      if (!has && tag) tag.remove();
    });
  }
  function select(id) { st.sel = id; drawSide(); drawStage(); }

  /* ---------- side panel ---------- */
  function drawSide() {
    var side = $("[data-side]"), isDef = st.sel === "default", book = st.books.filter(function (b) { return b.id === st.sel; })[0];
    var own = isDef ? st.covers["default"] : st.covers.books[st.sel] || {};
    var base = S.coverStyle({ covers: { "default": st.covers["default"] } }, "__none__");
    var groups = [];
    FIELDS.forEach(function (f) { if (groups.indexOf(f.group) < 0) groups.push(f.group); });
    var accent = getComputedStyle(document.documentElement).getPropertyValue("--cover-accent").trim(), ink = getComputedStyle(document.documentElement).getPropertyValue("--cover-ink").trim();
    side.innerHTML =
      '<div class="l-sec"><div class="l-sec-head"><h2>Covers</h2><span class="m-muted">' + st.books.length + " books</span></div>" +
      '<ol class="l-list"><li class="l-item' + (isDef ? " is-sel" : "") + '" data-pick="default"><span class="l-kind">All books</span><span class="l-what">Default for every cover</span></li>' +
      st.books.map(function (it) {
        var has = st.covers.books[it.id] && Object.keys(tidy({ books: { x: st.covers.books[it.id] } }).books || {}).length;
        return '<li class="l-item' + (st.sel === it.id ? " is-sel" : "") + '" data-pick="' + attr(it.id) + '"><span class="l-kind">' + esc(it.shelf.art) + '</span><span class="l-what">' + esc(it.title) + "</span>" +
          '<span class="l-w">' + (has ? "own" : "default") + "</span></li>";
      }).join("") + "</ol></div>" +
      '<div class="l-sec l-inspector"><div class="l-sec-head"><h2>' + (isDef ? "All books" : esc(book ? book.title : st.sel)) + "</h2>" +
      (isDef ? "" : '<button type="button" class="m-btn m-small" data-clear>Use the defaults</button>') + "</div>" +
      '<p class="m-hint">' + (isDef ? "These apply to every cover unless a book has its own value." : "Change a value to give this book its own setting. The arrow beside a value returns it to the default.") + "</p>" +
      groups.map(function (g) {
        var sw = g.indexOf("Accent") === 0 ? accent : g.indexOf("Lines") === 0 ? ink : "";
        return '<h3 class="l-h3">' + (sw ? '<span class="c-swatch" style="background:' + attr(sw) + '"></span>' : "") + esc(g) + "</h3>" +
          FIELDS.filter(function (f) { return f.group === g; }).map(function (f) {
            var mine = get(own, f.path), inherited = isDef ? f.def : (get(base, f.path) !== undefined ? get(base, f.path) : f.def);
            var v = mine !== undefined ? mine : inherited, shown = Math.round(v * f.k * 100) / 100;
            return '<div class="c-field' + (!isDef && mine !== undefined ? " is-own" : "") + '"><span class="m-label"><span>' + esc(f.label) + "</span></span>" +
              '<div class="c-slider"><input type="range" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + shown + '" data-f="' + f.path + '" aria-label="' + attr(g + " " + f.label) + '">' +
              '<input type="number" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + shown + '" data-n="' + f.path + '" aria-label="' + attr(g + " " + f.label + " value") + '">' +
              '<button type="button" class="c-reset" data-reset="' + f.path + '" title="' + (isDef ? "Back to the original" : "Back to the default") + '"' + (mine === undefined ? " disabled" : "") + ">&#8634;</button></div>" +
              (f.hint ? '<span class="m-hint">' + esc(f.hint) + "</span>" : "") + "</div>";
          }).join("");
      }).join("") + "</div>";

    $$("[data-pick]", side).forEach(function (li) { li.onclick = function () { select(li.dataset.pick); }; });
    var clear = $("[data-clear]", side);
    if (clear) clear.onclick = function () { snapshot(); delete st.covers.books[st.sel]; applyAll(); drawSide(); saveDraft(); };
    var dragging = {};
    function put(path, display) {
      var f = FIELDS.filter(function (x) { return x.path === path; })[0];
      var n = Math.min(f.max, Math.max(f.min, parseFloat(display)));
      if (isNaN(n)) return;
      set(target(st.sel), path, Math.round(n / f.k * 10000) / 10000);
      $('[data-f="' + path + '"]', side).value = n; $('[data-n="' + path + '"]', side).value = n;
      var field = $('[data-f="' + path + '"]', side).closest(".c-field");
      if (st.sel !== "default") field.classList.add("is-own");
      $('[data-reset="' + path + '"]', side).disabled = false;
      applyAll(); saveDraft();
    }
    $$("[data-f]", side).forEach(function (r) {
      r.addEventListener("input", function () { if (!dragging[r.dataset.f]) { snapshot(); dragging[r.dataset.f] = true; } put(r.dataset.f, r.value); });
      r.addEventListener("change", function () { dragging[r.dataset.f] = false; markList(); });
    });
    $$("[data-n]", side).forEach(function (n) { n.addEventListener("change", function () { snapshot(); put(n.dataset.n, n.value); markList(); }); });
    $$("[data-reset]", side).forEach(function (b) {
      b.onclick = function () { snapshot(); del(target(st.sel), b.dataset.reset); applyAll(); drawSide(); saveDraft(); };
    });
  }
  function markList() {
    $$('.l-item[data-pick]:not([data-pick="default"])').forEach(function (li) {
      var own = st.covers.books[li.dataset.pick], has = own && Object.keys(tidy({ books: { x: own } }).books || {}).length;
      $(".l-w", li).textContent = has ? "own" : "default";
    });
  }

  /* ---------- download ---------- */
  function download() {
    if (!changed()) { toast("Nothing has changed yet"); return; }
    var text = pretty(siteWith(st.covers));
    var entries = [
      { name: "content/site.json", data: new TextEncoder().encode(text) },
      { name: "UPLOAD-NOTES.txt", data: new TextEncoder().encode("Upload the content folder in this zip to the root of the repository (Add file, Upload files), then commit.\nIt replaces content/site.json; only the \"covers\" settings changed.\nIf the site manager has unsaved changes, download and upload those first, then reopen this tool.\n") }
    ];
    var d = new Date(), stamp = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(window.Zip.make(entries)); a.download = "works-covers-" + stamp + ".zip";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Downloaded. Upload the content folder on GitHub, then commit.");
  }

  function toast(msg) {
    var t = document.createElement("div"); t.className = "m-toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 3400); setTimeout(function () { t.remove(); }, 4000);
  }

  window.CoverEditor = { state: st, select: select };
})();
