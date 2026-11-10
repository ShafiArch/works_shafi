/* Site manager: add, edit, order and remove works; edit the top bar and site
   settings; then download the changed files to upload to the repository.
   Nothing is sent anywhere. Work in progress is kept in this browser until you
   download or discard it. */
(function () {
  "use strict";

  var S = window.Site, esc = S.esc;
  var DRAFT_KEY = "works-manager-draft-v1";
  var IMG_EXT = /\.(webp|jpe?g|png|gif|avif|svg)$/i;

  var ART_LABELS = {
    lego: "Modules on water (Lego City)", flyover: "Deck on piers (Space Under Flyover)",
    healing: "Planted frame (Natural Healing)", homestead: "Round huts (Sundar Bari)",
    interior: "Double height room (IDA Interior)", graph: "Node graph (Grasshopper)",
    web: "Browser window", repo: "Branch and files", tower: "Rising floor plates", plan: "Site plan with route",
    fabrication: "Parametric screen (Fabrication)", simulation: "Airflow through a room (Simulation)"
  };
  var TYPES = {
    project: { label: "Project", hint: "A folder in this repository with its own project page: images, text, video." },
    website: { label: "Website", hint: "Any web address. The book opens that site." },
    repository: { label: "Repository", hint: "A GitHub repository. Details can be filled from GitHub." },
    remote: { label: "Project from another site", hint: "A project.json published elsewhere, such as another GitHub Pages repository. It opens on this site's project page." }
  };
  var CATEGORIES = ["Competition", "Thesis", "Professional", "Research", "Visualization", "Website", "Repository", "Tool", "Teaching"];
  var BLOCK_TYPES = { image: "Image", gallery: "Gallery", text: "Text", quote: "Quote", video: "Video", embed: "Embedded page", links: "Links", spacer: "Spacer" };

  /* ---------- state ---------- */
  var st = {
    live: null,          // site.json as published (normalised)
    liveText: "",        // site.json text as published
    site: null,          // site.json being edited
    liveProjects: {},    // slug -> project.json as published
    projects: {},        // slug -> project.json being edited
    remote: {},          // address -> fetched project.json (read only)
    known: {},           // slug -> Set of image file names in that folder
    blobs: {},           // repo path -> Blob (new images and covers)
    blobUrls: {},        // repo path -> object URL for previews
    removed: {},         // slug -> true for local projects taken off the site
    tab: "works",
    repo: null
  };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function isURL(s) { return /^https?:\/\/[^\s.]+\.[^\s]+/i.test(s || ""); }
  function slugify(s) { return S.slugify(s); }
  function entryId(e) { return S.entryId(e); }
  function pretty(obj) { return JSON.stringify(obj, null, 2) + "\n"; }
  function attr(v) { return esc(v == null ? "" : v); }
  function clean(obj) {
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete obj[k];
      else if (v && typeof v === "object" && !Array.isArray(v)) { clean(v); if (!Object.keys(v).length) delete obj[k]; }
    });
    return obj;
  }

  function typeOf(e) {
    if (e.project) return S.isURL(e.project) ? "remote" : "project";
    if (e.type === "repository" || e.type === "website") return e.type;
    return /github\.com\//i.test(e.url || "") && !/\.github\.io/i.test(e.url || "") ? "repository" : "website";
  }

  /* Merged view of an entry: what the site will show for it. */
  function info(e) {
    var t = typeOf(e), base = {};
    if (t === "project") base = st.projects[e.project] || {};
    if (t === "remote") base = st.remote[e.project] || {};
    var it = Object.assign({}, base, e);
    it.shelf = Object.assign({}, base.shelf || {}, e.shelf || {});
    it.kind = t; it.id = entryId(e);
    if (!it.title) it.title = t === "project" || t === "remote" ? e.project : "(untitled)";
    return it;
  }

  function placement(e) {
    if (e.hidden) return "hidden";
    return st.site.carousel.indexOf(entryId(e)) > -1 ? "book" : "list";
  }

  /* ---------- output files ---------- */
  var SITE_ORDER = ["name", "repo", "tagline", "shelfTitle", "front", "autoplaySeconds", "showIndex", "nav", "works", "carousel", "contents", "about", "footer"];
  function siteOut() {
    var src = st.site, out = {};
    SITE_ORDER.forEach(function (k) { if (src[k] !== undefined) out[k] = src[k]; });
    Object.keys(src).forEach(function (k) { if (out[k] === undefined && k !== "shelf") out[k] = src[k]; });
    return out;
  }

  /* Every file that differs from the published site: { path: { text | blob, why } } */
  function changes() {
    var files = {};
    var siteText = pretty(siteOut());
    if (siteText !== st.liveText) files["content/site.json"] = { text: siteText, why: "Works, shelf order, top bar or settings" };
    Object.keys(st.projects).forEach(function (slug) {
      if (st.removed[slug]) return;
      var inUse = st.site.works.some(function (e) { return e.project === slug; });
      if (!inUse) return;
      var text = pretty(st.projects[slug]), before = st.liveProjects[slug];
      if (!before || text !== pretty(before)) files["projects/" + slug + "/project.json"] = { text: text, why: before ? "Project page edited" : "New project" };
    });
    Object.keys(st.blobs).forEach(function (path) {
      var slug = (path.match(/^projects\/([^/]+)\//) || [])[1];
      if (slug && (st.removed[slug] || !st.site.works.some(function (e) { return e.project === slug; }))) return;
      files[path] = { blob: st.blobs[path], why: /cover/.test(path) ? "Book cover image" : "Image" };
    });
    return files;
  }

  /* ---------- draft ---------- */
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), site: st.site, projects: st.projects, removed: st.removed }));
    } catch (e) { /* storage full or blocked: changes stay in this tab */ }
    status();
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  function status() {
    var n = Object.keys(changes()).length, box = $("[data-status]");
    box.textContent = n ? n + (n === 1 ? " file changed" : " files changed") : "No changes";
    box.classList.toggle("has-changes", !!n);
    var nb = $('[data-tab="download"]');
    if (nb) nb.setAttribute("data-count", n || "");
  }
  window.addEventListener("beforeunload", function (e) {
    if (Object.keys(st.blobs).length && Object.keys(changes()).length) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- loading ---------- */
  function repoName() {
    if (st.site && st.site.repo) return st.site.repo;
    var m = location.hostname.match(/^([^.]+)\.github\.io$/i), seg = location.pathname.split("/")[1];
    return m && seg ? m[1] + "/" + seg : null;
  }

  function normalise(site) {
    site = clone(site);
    if (!site.works) site.works = site.shelf || [];
    delete site.shelf;
    if (!Array.isArray(site.carousel)) site.carousel = site.works.filter(function (e) { return !e.hidden && e.book !== false; }).map(entryId);
    site.works.forEach(function (e) { delete e.book; });
    if (!site.nav) site.nav = [];
    return site;
  }

  function load() {
    return window.GH.read("content/site.json").then(function (text) {
      if (text == null) throw new Error("content/site.json not found");
      var raw = JSON.parse(text);
      if (raw.repo) window.GH.setFallbackRepo(raw.repo);
      st.live = normalise(raw);
      st.liveText = text;
      st.site = clone(st.live);
      return Promise.all(st.site.works.map(function (e) {
        var t = typeOf(e);
        if (t === "project") return window.GH.read("projects/" + e.project + "/project.json").then(function (txt) {
          if (txt == null) throw new Error("missing");
          var p = JSON.parse(txt);
          st.liveProjects[e.project] = p; st.projects[e.project] = clone(p);
        }).catch(function () { st.projects[e.project] = { title: e.project }; });
        if (t === "remote") return fetchRemote(e.project);
      }));
    }).then(function () {
      st.repo = repoName();
      offerDraft();
      render();
    }).catch(function (err) {
      $("[data-main]").innerHTML = '<p class="m-error">The site content could not be loaded (' + esc(err.message) + '). Open this page from the published site, or from a local server (see GUIDE.md).</p>';
    });
  }

  function fetchRemote(addr) {
    var base = S.projectBase(addr);
    return fetch(base + "project.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (p) { st.remote[addr] = p; return p; });
  }

  function offerDraft() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
    if (!d || !d.site) return;
    var same = pretty(normalise(d.site)) === pretty(st.site) && JSON.stringify(d.projects) === JSON.stringify(st.projects);
    if (same) { clearDraft(); return; }
    var b = $("[data-banner]");
    b.hidden = false;
    b.innerHTML = "<span>You have unsaved changes from " + esc(new Date(d.at).toLocaleString()) + ". Images added then are not kept; add them again if needed.</span>" +
      '<button type="button" class="m-btn m-primary" data-restore>Restore</button><button type="button" class="m-btn" data-drop>Start from the published site</button>';
    $("[data-restore]", b).onclick = function () {
      st.site = normalise(d.site); st.projects = d.projects || st.projects; st.removed = d.removed || {};
      b.hidden = true; render(); status();
    };
    $("[data-drop]", b).onclick = function () { clearDraft(); b.hidden = true; };
  }

  /* ---------- small UI helpers ---------- */
  function field(label, inner, hint, cls) {
    return '<label class="m-field ' + (cls || "") + '"><span class="m-label">' + label + "</span>" + inner +
      (hint ? '<span class="m-hint">' + hint + "</span>" : "") + "</label>";
  }
  function input(name, value, extra) { return '<input name="' + name + '" value="' + attr(value) + '" ' + (extra || "") + ">"; }
  function area(name, value, rows, extra) { return '<textarea name="' + name + '" rows="' + (rows || 4) + '" ' + (extra || "") + ">" + esc(value || "") + "</textarea>"; }
  function select(name, options, value, extra) {
    return '<select name="' + name + '" ' + (extra || "") + ">" + options.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
      return '<option value="' + attr(v) + '"' + (String(v) === String(value) ? " selected" : "") + ">" + esc(l) + "</option>";
    }).join("") + "</select>";
  }
  function moveIn(arr, i, d) {
    var j = i + d;
    if (j < 0 || j >= arr.length) return false;
    var x = arr.splice(i, 1)[0]; arr.splice(j, 0, x); return true;
  }
  function toast(msg, bad) {
    var t = document.createElement("div");
    t.className = "m-toast" + (bad ? " is-bad" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 2600);
    setTimeout(function () { t.remove(); }, 3200);
  }

  /* Drag to reorder (mouse), with the arrow buttons as the keyboard and touch way. */
  function sortable(list, arr, after) {
    var from = null;
    $$("[data-row]", list).forEach(function (row) {
      row.draggable = true;
      row.addEventListener("dragstart", function (e) { from = +row.dataset.row; row.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", from); });
      row.addEventListener("dragend", function () { row.classList.remove("is-drag"); $$(".is-over", list).forEach(function (r) { r.classList.remove("is-over"); }); });
      row.addEventListener("dragover", function (e) { e.preventDefault(); row.classList.add("is-over"); });
      row.addEventListener("dragleave", function () { row.classList.remove("is-over"); });
      row.addEventListener("drop", function (e) {
        e.preventDefault();
        var to = +row.dataset.row;
        if (from == null || from === to) return;
        var x = arr.splice(from, 1)[0]; arr.splice(to, 0, x); from = null; after();
      });
    });
  }

  /* ---------- tabs ---------- */
  function render() {
    $$("[data-tab]").forEach(function (b) { b.setAttribute("aria-current", b.dataset.tab === st.tab ? "page" : "false"); });
    var main = $("[data-main]");
    ({ works: renderWorks, front: renderFront, shelf: renderShelf, topbar: renderTopbar, settings: renderSettings, download: renderDownload })[st.tab](main);
    status();
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tab], [data-goto]");
    if (!t) return;
    st.tab = t.dataset.tab || t.dataset.goto; render(); window.scrollTo(0, 0);
  });

  function typeBadge(t) { return '<span class="m-badge m-badge-' + t + '">' + esc(TYPES[t].label) + "</span>"; }

  /* Works: the work list order, placement, edit and remove */
  function renderWorks(main) {
    var works = st.site.works;
    main.innerHTML =
      '<div class="m-head"><div><h1>Works</h1><p class="m-muted">Everything on the site, in work list order. Drag a row or use the arrows to reorder. Placement decides whether a work is a book on the shelf, in the work list only, or hidden.</p></div>' +
      '<button type="button" class="m-btn m-primary" data-add>Add a work</button></div>' +
      (works.length ? '<ol class="m-rows" data-list>' + works.map(function (e, i) {
        var it = info(e), t = typeOf(e), p = placement(e);
        return '<li class="m-row" data-row="' + i + '">' +
          '<span class="m-grip" aria-hidden="true">&#8942;&#8942;</span>' +
          '<span class="m-n">' + S.pad(i) + "</span>" +
          '<span class="m-main-cell"><strong>' + esc(it.title) + "</strong> " + typeBadge(t) +
          '<span class="m-sub">' + esc([it.category, it.year].filter(Boolean).join(" · ")) + (t === "project" ? ' · <code>projects/' + esc(e.project) + "</code>" : t === "remote" ? " · <code>" + esc(e.project) + "</code>" : " · " + esc(it.url || "")) + "</span></span>" +
          select("place-" + i, [["book", "Book and work list"], ["list", "Work list only"], ["hidden", "Hidden"]], p, 'data-place="' + i + '" aria-label="Placement"') +
          '<span class="m-row-btns">' +
          '<button type="button" class="m-icon" data-up="' + i + '" aria-label="Move up">&#8593;</button>' +
          '<button type="button" class="m-icon" data-down="' + i + '" aria-label="Move down">&#8595;</button>' +
          '<button type="button" class="m-btn m-small" data-edit="' + i + '">Edit</button>' +
          (t === "project" && st.liveProjects[e.project] ? '<a class="m-btn m-small" href="layout.html?p=' + encodeURIComponent(e.project) + '">Layout</a>' : "") +
          '<button type="button" class="m-btn m-small m-ghost-bad" data-remove="' + i + '">Remove</button></span></li>';
      }).join("") + "</ol>" : '<p class="m-empty">No works yet. Add the first one.</p>');

    $("[data-add]", main).onclick = function () { openEditor(null); };
    $$("[data-place]", main).forEach(function (s) {
      s.onchange = function () { setPlacement(works[+s.dataset.place], s.value); saveDraft(); render(); };
    });
    $$("[data-up]", main).forEach(function (b) { b.onclick = function () { if (moveIn(works, +b.dataset.up, -1)) { saveDraft(); render(); } }; });
    $$("[data-down]", main).forEach(function (b) { b.onclick = function () { if (moveIn(works, +b.dataset.down, 1)) { saveDraft(); render(); } }; });
    $$("[data-edit]", main).forEach(function (b) { b.onclick = function () { openEditor(+b.dataset.edit); }; });
    $$("[data-remove]", main).forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sure? Remove"; setTimeout(function () { if (b.isConnected) { b.dataset.sure = ""; b.textContent = "Remove"; } }, 3000); return; }
        removeWork(+b.dataset.remove);
      };
    });
    var list = $("[data-list]", main);
    if (list) sortable(list, works, function () { saveDraft(); render(); });
  }

  function setPlacement(e, p) {
    var id = entryId(e), c = st.site.carousel, at = c.indexOf(id);
    if (p === "hidden") e.hidden = true; else delete e.hidden;
    if (p === "book" && at < 0) c.push(id);
    if (p !== "book" && at > -1) c.splice(at, 1);
  }

  function removeWork(i) {
    var e = st.site.works[i], id = entryId(e), at = st.site.carousel.indexOf(id);
    if (at > -1) st.site.carousel.splice(at, 1);
    st.site.works.splice(i, 1);
    if (typeOf(e) === "project") {
      if (st.liveProjects[e.project]) st.removed[e.project] = true;
      else { delete st.projects[e.project]; dropBlobs("projects/" + e.project + "/"); }
    }
    saveDraft(); render();
    toast("Removed " + (info(e).title || id));
  }
  function dropBlobs(prefix) {
    Object.keys(st.blobs).forEach(function (p) {
      if (p.indexOf(prefix) === 0) { URL.revokeObjectURL(st.blobUrls[p]); delete st.blobs[p]; delete st.blobUrls[p]; }
    });
  }

  /* Shelf order: the carousel */
  function renderShelf(main) {
    var c = st.site.carousel, byId = {};
    st.site.works.forEach(function (e) { byId[entryId(e)] = e; });
    var gone = c.filter(function (id) { return !byId[id]; });
    if (gone.length) { st.site.carousel = c = c.filter(function (id) { return byId[id]; }); saveDraft(); }
    var off = st.site.works.filter(function (e) { return c.indexOf(entryId(e)) < 0 && !e.hidden; });
    main.innerHTML =
      '<div class="m-head"><div><h1>Shelf order</h1><p class="m-muted">The books on the front page carousel, left to right. This order is separate from the work list.</p></div></div>' +
      '<div class="m-spines">' + c.map(function (id) {
        var it = info(byId[id]), tone = it.shelf.tone && it.shelf.tone !== "auto" ? it.shelf.tone : ["light", "dark", "mid"][c.indexOf(id) % 3];
        return '<span class="m-spine tone-' + esc(tone) + '"><span>' + esc(it.shelf.spine || it.title) + "</span></span>";
      }).join("") + "</div>" +
      (c.length ? '<ol class="m-rows" data-list>' + c.map(function (id, i) {
        var it = info(byId[id]);
        return '<li class="m-row" data-row="' + i + '"><span class="m-grip" aria-hidden="true">&#8942;&#8942;</span><span class="m-n">' + S.pad(i) + "</span>" +
          '<span class="m-main-cell"><strong>' + esc(it.title) + "</strong> " + typeBadge(typeOf(byId[id])) + "</span>" +
          '<span class="m-row-btns"><button type="button" class="m-icon" data-up="' + i + '" aria-label="Move left">&#8593;</button>' +
          '<button type="button" class="m-icon" data-down="' + i + '" aria-label="Move right">&#8595;</button>' +
          '<button type="button" class="m-btn m-small" data-off="' + i + '">Take off the shelf</button></span></li>';
      }).join("") + "</ol>" : '<p class="m-empty">No books on the shelf.</p>') +
      (off.length ? '<h2 class="m-h2">In the work list only</h2><ul class="m-rows">' + off.map(function (e) {
        var it = info(e);
        return '<li class="m-row"><span class="m-main-cell"><strong>' + esc(it.title) + "</strong> " + typeBadge(typeOf(e)) + "</span>" +
          '<span class="m-row-btns"><button type="button" class="m-btn m-small" data-on="' + attr(entryId(e)) + '">Put on the shelf</button></span></li>';
      }).join("") + "</ul>" : "");
    $$("[data-up]", main).forEach(function (b) { b.onclick = function () { if (moveIn(c, +b.dataset.up, -1)) { saveDraft(); render(); } }; });
    $$("[data-down]", main).forEach(function (b) { b.onclick = function () { if (moveIn(c, +b.dataset.down, 1)) { saveDraft(); render(); } }; });
    $$("[data-off]", main).forEach(function (b) { b.onclick = function () { c.splice(+b.dataset.off, 1); saveDraft(); render(); }; });
    $$("[data-on]", main).forEach(function (b) { b.onclick = function () { c.push(b.dataset.on); saveDraft(); render(); }; });
    var list = $("[data-list]", main);
    if (list) sortable(list, c, function () { saveDraft(); render(); });
  }

  /* Top bar links */
  function renderTopbar(main) {
    var nav = st.site.nav;
    main.innerHTML =
      '<div class="m-head"><div><h1>Top bar</h1><p class="m-muted">Links at the top right of every page, in this order. Web addresses open in a new tab. A link to <code>index.html#index</code> opens the work list.</p></div>' +
      '<div class="m-head-btns"><button type="button" class="m-btn" data-addwork>Add the Work list link</button><button type="button" class="m-btn m-primary" data-addlink>Add a link</button></div></div>' +
      '<div class="m-topbar-preview"><strong>' + esc(st.site.name || "") + "</strong><span>" + nav.map(function (n) { return esc(n.label || "?"); }).join("") + "</span></div>" +
      (nav.length ? '<ol class="m-rows" data-list>' + nav.map(function (n, i) {
        return '<li class="m-row m-row-form" data-row="' + i + '"><span class="m-grip" aria-hidden="true">&#8942;&#8942;</span>' +
          field("Label", input("label-" + i, n.label, 'data-nav="' + i + '" data-k="label" placeholder="GitHub"'), "", "m-grow-1") +
          field("Address", input("href-" + i, n.href, 'data-nav="' + i + '" data-k="href" placeholder="https://"'), '<span class="m-warn-text" data-navwarn="' + i + '">' + navWarn(n.href) + "</span>", "m-grow-2") +
          '<span class="m-row-btns"><button type="button" class="m-icon" data-up="' + i + '" aria-label="Move left">&#8593;</button>' +
          '<button type="button" class="m-icon" data-down="' + i + '" aria-label="Move right">&#8595;</button>' +
          '<button type="button" class="m-btn m-small m-ghost-bad" data-del="' + i + '">Remove</button></span></li>';
      }).join("") + "</ol>" : '<p class="m-empty">No links in the top bar.</p>');
    $("[data-addlink]", main).onclick = function () { nav.push({ label: "", href: "https://" }); saveDraft(); render(); var ins = $$("[data-k=label]"); if (ins.length) ins[ins.length - 1].focus(); };
    $("[data-addwork]", main).onclick = function () { nav.unshift({ label: "Work", href: "index.html#index" }); saveDraft(); render(); };
    $$("[data-nav]", main).forEach(function (inp) {
      inp.oninput = function () {
        var i = +inp.dataset.nav;
        nav[i][inp.dataset.k] = inp.value.trim(); saveDraft();
        $(".m-topbar-preview span", main).innerHTML = nav.map(function (n) { return esc(n.label || "?"); }).join("");
        var w = $('[data-navwarn="' + i + '"]', main); if (w) w.textContent = navWarn(nav[i].href);
      };
    });
    $$("[data-up]", main).forEach(function (b) { b.onclick = function () { if (moveIn(nav, +b.dataset.up, -1)) { saveDraft(); render(); } }; });
    $$("[data-down]", main).forEach(function (b) { b.onclick = function () { if (moveIn(nav, +b.dataset.down, 1)) { saveDraft(); render(); } }; });
    $$("[data-del]", main).forEach(function (b) { b.onclick = function () { nav.splice(+b.dataset.del, 1); saveDraft(); render(); }; });
    var list = $("[data-list]", main);
    if (list) sortable(list, nav, function () { saveDraft(); render(); });
  }

  /* Front page: one click between the bookshelf and the contents cards, and the cards themselves */
  function renderFront(main) {
    var s = st.site, mode = s.front === "contents" ? "contents" : "shelf";
    var conf = s.contents = s.contents || { title: "Contents", cards: [] };
    if (!Array.isArray(conf.cards)) conf.cards = [];
    var cards = conf.cards, works = s.works;
    var arts = Object.keys(ART_LABELS).filter(function (k) { return window.Covers && window.Covers.has(k); }).map(function (k) { return [k, ART_LABELS[k]]; });
    function choice(v, title, text) {
      return '<button type="button" class="m-front-opt' + (mode === v ? " is-on" : "") + '" data-front="' + v + '" aria-pressed="' + (mode === v) + '">' +
        '<span class="m-front-pic m-front-' + v + '" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><strong>' + title + "</strong><span>" + text + "</span></button>";
    }
    main.innerHTML =
      '<div class="m-head"><div><h1>Front page</h1><p class="m-muted">Pick the layout of the home page. Both keep their settings, so you can switch back at any time. Publish to make the change live.</p></div>' +
      '<div class="m-head-btns"><a class="m-btn" href="index.html?front=' + mode + '" target="_blank" rel="noopener">Preview the published site</a></div></div>' +
      '<div class="m-front-opts">' + choice("shelf", "Bookshelf", "Books turning on a shelf. Order in Shelf order.") + choice("contents", "Contents cards", "Numbered cards with a drawing, like a contents page.") + "</div>" +
      '<h2 class="m-h2">Contents cards</h2>' +
      '<div class="m-form m-grid2">' + field("Heading", input("ct-title", conf.title, 'data-ct-title placeholder="Contents"'), "Top right, above the cards.") + "</div>" +
      (cards.length ? '<ol class="m-rows" data-list>' + cards.map(function (c, i) {
        var picked = c.works || [];
        return '<li class="m-row m-ct-row" data-row="' + i + '"><span class="m-grip" aria-hidden="true">&#8942;&#8942;</span><span class="m-n">' + (i + 1) + ".</span>" +
          '<div class="m-ct-body">' +
          '<div class="m-ct-line">' + field("Title", input("ct-t" + i, c.title, 'data-ct="' + i + '" data-k="title"'), "", "m-grow-2") +
          field("Drawing", select("ct-a" + i, arts, c.art, 'data-ct="' + i + '" data-k="art"'), "", "m-grow-1") + "</div>" +
          field("Lines under the title (one per line, up to three)", area("ct-l" + i, (c.lines || []).join("\n"), 3, 'data-ct="' + i + '" data-k="lines"'), "Empty with nothing to open shows In preparation.") +
          '<div class="m-field"><span class="m-label">Opens</span><div class="m-chips">' + works.map(function (e) {
            var id = entryId(e), on = picked.indexOf(id) >= 0;
            return '<label class="m-chip' + (on ? " is-on" : "") + '"><input type="checkbox" data-ct-work="' + i + '" value="' + attr(id) + '"' + (on ? " checked" : "") + "><span>" + esc(info(e).title || id) + "</span></label>";
          }).join("") + '</div><span class="m-hint">One work opens it directly; several open a page of their own cards.</span></div>' +
          field("Or a web address", input("ct-u" + i, c.url, 'data-ct="' + i + '" data-k="url" placeholder="https://"'), "Used instead of the works when filled.") +
          "</div>" +
          '<span class="m-row-btns"><button type="button" class="m-icon" data-up="' + i + '" aria-label="Move up">&#8593;</button>' +
          '<button type="button" class="m-icon" data-down="' + i + '" aria-label="Move down">&#8595;</button>' +
          '<button type="button" class="m-btn m-small m-ghost-bad" data-del="' + i + '">Remove</button></span></li>';
      }).join("") + "</ol>" : '<p class="m-empty">No cards yet.</p>') +
      '<p><button type="button" class="m-btn m-primary" data-addcard>Add a card</button></p>';

    $$("[data-front]", main).forEach(function (b) { b.onclick = function () { s.front = b.dataset.front; saveDraft(); render(); toast(b.dataset.front === "contents" ? "Front page: contents cards" : "Front page: bookshelf"); }; });
    $("[data-ct-title]", main).oninput = function () { conf.title = this.value; saveDraft(); };
    $$("[data-ct]", main).forEach(function (inp) {
      inp.oninput = inp.onchange = function () {
        var c = cards[+inp.dataset.ct], k = inp.dataset.k;
        if (k === "lines") c.lines = inp.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 3);
        else if (k === "url") { if (inp.value.trim() && inp.value.trim() !== "https://") c.url = inp.value.trim(); else delete c.url; }
        else c[k] = inp.value;
        if (k === "title" && /^card-\d+$/.test(c.id || "") && inp.value.trim()) c.id = uniqueCardId(slugify(inp.value), c);
        saveDraft();
      };
    });
    $$("[data-ct-work]", main).forEach(function (cb) {
      cb.onchange = function () {
        var c = cards[+cb.dataset.ctWork], list = c.works = c.works || [];
        var at = list.indexOf(cb.value);
        if (cb.checked && at < 0) list.push(cb.value); else if (!cb.checked && at >= 0) list.splice(at, 1);
        cb.parentNode.classList.toggle("is-on", cb.checked); saveDraft();
      };
    });
    $("[data-addcard]", main).onclick = function () {
      var n = 1; while (cards.some(function (c) { return c.id === "card-" + n; })) n++;
      cards.push({ id: "card-" + n, title: "", art: "web", lines: [], works: [] }); saveDraft(); render();
      var t = $$('[data-k="title"]', main); if (t.length) t[t.length - 1].focus();
    };
    $$("[data-up]", main).forEach(function (b) { b.onclick = function () { if (moveIn(cards, +b.dataset.up, -1)) { saveDraft(); render(); } }; });
    $$("[data-down]", main).forEach(function (b) { b.onclick = function () { if (moveIn(cards, +b.dataset.down, 1)) { saveDraft(); render(); } }; });
    $$("[data-del]", main).forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sure? Remove"; setTimeout(function () { if (b.isConnected) { b.dataset.sure = ""; b.textContent = "Remove"; } }, 3000); return; }
        cards.splice(+b.dataset.del, 1); saveDraft(); render();
      };
    });
    var list = $("[data-list]", main);
    if (list) sortable(list, cards, function () { saveDraft(); render(); });
  }
  function uniqueCardId(base, self) {
    var cards = st.site.contents.cards, id = base || "card", n = 1;
    while (cards.some(function (c) { return c !== self && c.id === id; })) id = base + "-" + (++n);
    return id;
  }

  function navWarn(h) {
    if (!h || h === "https://") return "Add the address.";
    if (isURL(h) || /\.html/.test(h) || h.charAt(0) === "#") return "";
    return "Start web addresses with https://";
  }

  /* Site settings */
  function renderSettings(main) {
    var s = st.site;
    main.innerHTML =
      '<div class="m-head"><div><h1>Site settings</h1><p class="m-muted">Name, footer and front page behaviour.</p></div></div>' +
      '<div class="m-form m-grid2">' +
      field("Name", input("name", s.name), "Top left of every page.") +
      field("Tagline", input("tagline", s.tagline), "Used in the browser tab title.") +
      field("About (footer)", area("about", s.about, 3), "Shown at the bottom left. **bold**, *italic* and [links](https://...) work.", "m-span2") +
      field("Footer name", input("footer", s.footer), "Bottom right, before the year.") +
      field("Shelf title", input("shelfTitle", s.shelfTitle), "Not shown; read aloud by screen readers.") +
      field("Autoplay (seconds per book)", input("autoplaySeconds", s.autoplaySeconds, 'type="number" min="0" step="0.5"'), "0 turns autoplay off.") +
      field("Repository", input("repo", s.repo, 'placeholder="ShafiArch/works_shafi"'), "Lets this tool list the images already in a project folder.") +
      '<label class="m-check m-span2"><input type="checkbox" name="showIndex"' + (s.showIndex !== false ? " checked" : "") + "> Show the Work list button under the shelf</label>" +
      "</div>";
    $$("input, textarea", main).forEach(function (inp) {
      inp.oninput = inp.onchange = function () {
        var k = inp.name;
        if (inp.type === "checkbox") s[k] = inp.checked;
        else if (inp.type === "number") s[k] = inp.value === "" ? 0 : parseFloat(inp.value);
        else s[k] = inp.value;
        saveDraft();
      };
    });
  }

  /* ---------- checks ---------- */
  var DASH = /[\u2013\u2014]|\s--\s/;
  function check() {
    var errs = [], warns = [], ids = {};
    st.site.works.forEach(function (e, i) {
      var it = info(e), t = typeOf(e), id = entryId(e), name = '"' + (it.title || id) + '"';
      if (ids[id]) errs.push("Two works share the id " + id + ". Change the folder name or title of one of them.");
      ids[id] = 1;
      if ((t === "website" || t === "repository") && !isURL(e.url)) errs.push(name + " needs a web address starting with https://");
      if (t === "remote" && !st.remote[e.project]) warns.push(name + ": the project.json at " + e.project + " could not be read from here. It may still work once published.");
      if (t === "project" && !/^[a-z0-9][a-z0-9-]*$/.test(e.project)) errs.push(name + ": folder names use lowercase letters, numbers and hyphens only.");
      if (t === "project") {
        var p = st.projects[e.project] || {}, known = knownImages(e.project);
        (p.blocks || []).forEach(function (b) {
          refs(b).forEach(function (src) {
            if (src && !S.isURL(src) && known && !known.has(src)) warns.push(name + ": the image " + src + " is not in projects/" + e.project + "/ yet. Upload it, or add it in the editor.");
          });
        });
      }
    });
    st.site.nav.forEach(function (n) {
      if (!n.label) errs.push("A top bar link has no label.");
      if (!n.href || n.href === "https://") errs.push("The top bar link " + (n.label || "") + " has no address.");
    });
    var texts = [pretty(siteOut())].concat(Object.keys(st.projects).map(function (k) { return pretty(st.projects[k]); }));
    if (texts.some(function (t) { return DASH.test(t); })) warns.push("Some text contains long dashes (en or em dashes). The writing rule is to use commas, semicolons, parentheses or periods instead.");
    return { errs: errs, warns: warns, dashes: texts.some(function (t) { return DASH.test(t); }) };
  }
  function refs(b) {
    var out = [];
    if (b.type === "image") out.push(b.src);
    if (b.type === "gallery") (b.items || []).forEach(function (x) { out.push(typeof x === "string" ? x : x.src); });
    if (b.type === "video" && b.src) out.push(b.src);
    if (b.type === "video" && b.poster) out.push(b.poster);
    return out.filter(Boolean);
  }
  function fixDashes() {
    function fx(v) {
      if (typeof v === "string") return v.replace(/\s*[\u2013\u2014]\s*/g, ", ").replace(/\s--\s/g, ", ");
      if (Array.isArray(v)) return v.map(fx);
      if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { v[k] = fx(v[k]); }); return v; }
      return v;
    }
    fx(st.site); Object.keys(st.projects).forEach(function (k) { fx(st.projects[k]); });
    saveDraft();
  }

  /* ---------- download ---------- */
  function renderDownload(main) {
    var files = changes(), paths = Object.keys(files).sort(), c = check();
    var removed = Object.keys(st.removed).filter(function (s) { return st.removed[s]; });
    main.innerHTML =
      '<div class="m-head"><div><h1>Review and publish</h1><p class="m-muted">Only the files that changed are included. <strong>Publish</strong> commits them straight to GitHub; the zip is the manual way.</p></div></div>' +
      (c.errs.length ? '<div class="m-alert is-bad"><strong>Fix before publishing</strong><ul>' + c.errs.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul></div>" : "") +
      (c.warns.length ? '<div class="m-alert"><strong>Worth a look</strong><ul>' + c.warns.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>" +
        (c.dashes ? '<button type="button" class="m-btn m-small" data-fixdash>Replace long dashes with commas</button>' : "") + "</div>" : "") +
      (paths.length ? '<table class="m-table"><thead><tr><th>File</th><th>Change</th><th>Size</th><th></th></tr></thead><tbody>' + paths.map(function (p) {
        var f = files[p], size = f.blob ? f.blob.size : new Blob([f.text]).size;
        return "<tr><td><code>" + esc(p) + "</code></td><td>" + esc(f.why) + "</td><td>" + fmtSize(size) + '</td><td><button type="button" class="m-btn m-small" data-one="' + attr(p) + '">Download</button></td></tr>';
      }).join("") + "</tbody></table>" +
        '<div class="m-download"><button type="button" class="m-btn m-primary m-big" data-publish' + (c.errs.length ? " disabled" : "") + ">Publish to GitHub</button>" +
        '<button type="button" class="m-btn" data-zip' + (c.errs.length ? " disabled" : "") + '>Download changes (.zip)</button>' +
        '<span class="m-muted">' + paths.length + " file" + (paths.length === 1 ? "" : "s") + "</span></div>" : '<p class="m-empty">Nothing has changed yet.</p>') +
      (removed.length ? '<div class="m-alert"><strong>Folders of removed projects</strong><p>' + removed.map(function (s) { return "<code>projects/" + esc(s) + "/</code>"; }).join(", ") + "</p>" +
        '<label class="m-check"><input type="checkbox" data-delfolders' + (st.deleteFolders !== false ? " checked" : "") + "> Delete these folders when publishing</label>" +
        '<p class="m-hint">With the zip, delete them by hand on GitHub (open the folder, then the file menu, Delete directory).</p></div>' : "") +
      '<h2 class="m-h2">' + (window.GH.connected() ? "Uploading by hand (without Publish)" : "Uploading to GitHub by hand") + '</h2><ol class="m-steps">' +
      "<li>Unzip the download. You get a <code>content</code> folder and, if projects changed, a <code>projects</code> folder.</li>" +
      "<li>Open the repository on GitHub" + (st.repo ? ' (<a href="https://github.com/' + esc(st.repo) + '" target="_blank" rel="noopener">github.com/' + esc(st.repo) + "</a>)" : "") + ", then <strong>Add file</strong>, <strong>Upload files</strong>.</li>" +
      "<li>Drag the unzipped folders (not the zip itself) into the page. Files with the same path are replaced.</li>" +
      "<li>Write a short message such as <em>Add new project</em> and press <strong>Commit changes</strong>.</li>" +
      "<li>The site updates in a minute or two. If it does not, open the Actions tab and re run the pages job.</li></ol>" +
      '<p class="m-muted">After uploading, press <strong>Discard changes</strong> at the top to clear this draft.</p>';
    var zip = $("[data-zip]", main);
    if (zip) zip.onclick = function () { downloadZip(files); };
    var pub = $("[data-publish]", main);
    if (pub) pub.onclick = publishNow;
    var df = $("[data-delfolders]", main);
    if (df) df.onchange = function () { st.deleteFolders = df.checked; };
    $$("[data-one]", main).forEach(function (b) {
      b.onclick = function () { var f = files[b.dataset.one]; save(f.blob || new Blob([f.text], { type: "application/json" }), b.dataset.one.split("/").pop()); };
    });
    var fd = $("[data-fixdash]", main);
    if (fd) fd.onclick = function () { fixDashes(); render(); toast("Long dashes replaced"); };
  }
  /* ---------- publish straight to GitHub ---------- */
  function ownedPart(site) {
    var c = normalise(site); delete c.covers; delete c.book;
    return pretty(c);
  }
  function publishNow() {
    var files = changes(), paths = Object.keys(files).sort();
    var removed = Object.keys(st.removed).filter(function (s) { return st.removed[s] && !st.site.works.some(function (e) { return e.project === s; }); });
    var merged = null;
    window.GH.publish({
      title: "Publish site changes",
      message: publishMessage(paths),
      build: function () {
        var plan = { files: [], conflicts: [], notes: [] };
        return window.GH.read("content/site.json").then(function (t) {
          var remote = t ? JSON.parse(t) : {};
          // this tool owns everything in site.json except the cover and book settings
          merged = siteOut();
          if (remote.covers) merged.covers = remote.covers; else delete merged.covers;
          if (remote.book) merged.book = remote.book; else delete merged.book;
          if (files["content/site.json"] || t == null) {
            if (t != null && ownedPart(remote) !== ownedPart(st.live)) plan.conflicts.push("content/site.json: works, shelf order, top bar or settings");
            if (!t || pretty(merged) !== t) plan.files.push({ path: "content/site.json", text: pretty(merged), why: "Works, shelf order, top bar or settings" });
          }
          return Promise.all(paths.filter(function (p) { return /project\.json$/.test(p); }).map(function (p) {
            var slug = p.split("/")[1], before = st.liveProjects[slug];
            return window.GH.read(p).then(function (rt) {
              var now = rt == null ? null : pretty(JSON.parse(rt));
              if (before ? now !== pretty(before) : now !== null) plan.conflicts.push(p + (before ? " was changed on GitHub" : " already exists on GitHub"));
              plan.files.push({ path: p, text: files[p].text, why: files[p].why });
            });
          }));
        }).then(function () {
          paths.forEach(function (p) { if (files[p].blob) plan.files.push({ path: p, blob: files[p].blob, why: files[p].why }); });
          if (!removed.length || st.deleteFolders === false || !window.GH.connected()) return;
          return Promise.all(removed.map(function (slug) {
            return window.GH.listTree("projects/" + slug + "/").then(function (list) {
              list.forEach(function (path) { plan.files.push({ path: path, remove: true }); });
            });
          }));
        }).then(function () { return plan; });
      },
      done: function (commit, plan) {
        // what is now on GitHub becomes the new starting point
        st.site.covers = merged.covers; st.site.book = merged.book;
        if (!merged.covers) delete st.site.covers;
        if (!merged.book) delete st.site.book;
        st.live = normalise(merged); st.liveText = pretty(siteOut());
        plan.files.forEach(function (f) {
          var m = f.path.match(/^projects\/([^/]+)\/project\.json$/);
          if (m && !f.remove) st.liveProjects[m[1]] = clone(st.projects[m[1]]);
        });
        removed.forEach(function (slug) {
          if (plan.files.some(function (f) { return f.remove && f.path.indexOf("projects/" + slug + "/") === 0; })) {
            delete st.removed[slug]; delete st.liveProjects[slug]; delete st.projects[slug];
          }
        });
        Object.keys(st.blobs).forEach(function (p) { var m = p.match(/^projects\/([^/]+)\/(.+)$/); if (m && st.known[m[1]]) st.known[m[1]].add(m[2]); });
        st.blobs = {};
        clearDraft(); render();
      }
    });
  }
  function publishMessage(paths) {
    var newProjects = paths.filter(function (p) { var m = p.match(/^projects\/([^/]+)\/project\.json$/); return m && !st.liveProjects[m[1]]; })
      .map(function (p) { var slug = p.split("/")[1]; return (st.projects[slug] || {}).title || slug; });
    if (newProjects.length) return "Add " + newProjects.join(", ");
    var edited = paths.filter(function (p) { return /project\.json$/.test(p); }).map(function (p) { var slug = p.split("/")[1]; return (st.projects[slug] || {}).title || slug; });
    if (edited.length) return "Update " + edited.join(", ");
    return "Update works, shelf and top bar";
  }

  function fmtSize(n) { return n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB"; }
  function save(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function downloadZip(files) {
    var list = Object.keys(files).sort();
    Promise.all(list.map(function (p) {
      var f = files[p];
      return f.blob ? f.blob.arrayBuffer().then(function (b) { return { name: p, data: new Uint8Array(b) }; })
        : Promise.resolve({ name: p, data: new TextEncoder().encode(f.text) });
    })).then(function (entries) {
      var note = "Upload the folders in this zip to the root of the repository (Add file, Upload files),\nthen commit. Files with the same path are replaced.\n\n" + list.map(function (p) { return p + "    " + files[p].why; }).join("\n") + "\n";
      entries.push({ name: "UPLOAD-NOTES.txt", data: new TextEncoder().encode(note) });
      var d = new Date(), stamp = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      save(window.Zip.make(entries), "works-changes-" + stamp + ".zip");
      toast("Zip downloaded");
    });
  }

  /* ---------- images ---------- */
  function knownImages(slug) {
    if (!st.known[slug]) st.known[slug] = null;
    return st.known[slug];
  }
  function listFolder(slug) {
    var set = new Set();
    var p = st.projects[slug] || {};
    (p.blocks || []).forEach(function (b) { refs(b).forEach(function (r) { if (!S.isURL(r)) set.add(r); }); });
    if (p.shelf && p.shelf.cover) set.add(p.shelf.cover);
    Object.keys(st.blobs).forEach(function (path) { var m = path.match(/^projects\/([^/]+)\/(.+)$/); if (m && m[1] === slug) set.add(m[2]); });
    st.known[slug] = set;
    var repo = st.repo;
    if (!repo || !st.liveProjects[slug]) return Promise.resolve(set);
    return fetch("https://api.github.com/repos/" + repo + "/contents/projects/" + encodeURIComponent(slug))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) { list.forEach(function (f) { if (f.type === "file" && IMG_EXT.test(f.name)) set.add(f.name); }); return set; })
      .catch(function () { return set; });
  }
  function imgUrl(slug, name) {
    var path = "projects/" + slug + "/" + name;
    return st.blobUrls[path] || path;
  }

  function toWeb(file, maxEdge, quality) {
    return createImageBitmap(file).then(function (bmp) {
      var k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
      var w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
      return blobOf(c, quality).then(function (b) { return { blob: b, w: w, h: h }; });
    });
  }
  function blobOf(canvas, quality) {
    return new Promise(function (res) {
      canvas.toBlob(function (b) {
        if (b && b.type === "image/webp") return res(b);
        canvas.toBlob(function (j) { res(j); }, "image/jpeg", quality || 0.85);   // browsers without WebP export
      }, "image/webp", quality || 0.82);
    });
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  /* Portrait crop for a book cover, same maths as tools/images.py */
  function cropCover(src, fx, fy, zoom) {
    return loadImg(src).then(function (img) {
      var ratio = 0.74, W = img.naturalWidth, H = img.naturalHeight;
      var ch = Math.min(H, W / ratio) / zoom, cw = ch * ratio;
      var x0 = Math.min(Math.max(fx * W - cw / 2, 0), W - cw), y0 = Math.min(Math.max(fy * H - ch / 2, 0), H - ch);
      var c = document.createElement("canvas"); c.width = 900; c.height = Math.round(900 / ratio);
      c.getContext("2d").drawImage(img, x0, y0, cw, ch, 0, 0, c.width, c.height);
      return blobOf(c, 0.84);
    });
  }
  function addBlob(path, blob) {
    if (st.blobUrls[path]) URL.revokeObjectURL(st.blobUrls[path]);
    st.blobs[path] = blob; st.blobUrls[path] = URL.createObjectURL(blob);
  }

  /* ---------- the editor ---------- */
  var F = null;   // form state while the drawer is open

  function openEditor(index) {
    var e = index == null ? null : st.site.works[index];
    var t = e ? typeOf(e) : "project";
    var it = e ? info(e) : { shelf: {} };
    F = {
      index: index, isNew: !e, type: t, place: e ? placement(e) : "book", position: "end",
      title: e ? (e.title || (t === "project" ? it.title : "")) : "",
      subtitle: e ? (e.subtitle != null ? e.subtitle : t === "project" ? it.subtitle : "") : "",
      category: e ? (e.category != null ? e.category : t === "project" ? it.category : "") : "",
      year: e ? (e.year != null ? e.year : t === "project" ? it.year : "") : "",
      slug: t === "project" && e ? e.project : "", slugTouched: !!e,
      url: e && e.url || "", open: e && e.open || "tab", remote: t === "remote" && e ? e.project : "",
      id: e && (t === "website" || t === "repository") ? entryId(e) : "",
      spine: (e && e.shelf && e.shelf.spine) || (t === "project" ? it.shelf.spine : "") || "",
      tone: (it.shelf.tone) || "auto",
      art: it.shelf.art || "",
      coverMode: it.shelf.art ? "art" : it.shelf.cover ? "image" : (e ? "type" : "art"),
      cover: it.shelf.cover || "",
      coverText: (t === "project" || !e ? it.shelf.coverText : e.shelf && e.shelf.coverText) || "",
      coverNote: (t === "project" || !e ? it.shelf.coverNote : e.shelf && e.shelf.coverNote) || "",
      crop: { src: "", fx: 0.5, fy: 0.5, zoom: 1, dirty: false },
      meta: t === "project" && it.meta ? clone(it.meta) : [["Type", ""], ["Site", ""]],
      intro: t === "project" ? (Array.isArray(it.intro) ? it.intro.join("\n\n") : it.intro || "") : "",
      blocks: t === "project" && it.blocks ? clone(it.blocks) : [],
      autoBlocks: true, maxEdge: 4000
    };
    if (t === "project" && e) {
      // local entry overrides move into project.json on save
      var p = st.projects[e.project] || {};
      F.title = e.title || p.title || ""; F.subtitle = e.subtitle || p.subtitle || ""; F.category = e.category || p.category || ""; F.year = e.year || p.year || "";
    }
    if (!F.art && F.coverMode === "art") F.art = { website: "web", repository: "repo" }[t] || "tower";
    var drawer = $("[data-drawer]");
    drawer.hidden = false;
    document.body.classList.add("m-drawer-open");
    drawEditor();
    if (t === "project" && F.slug) listFolder(F.slug).then(function () { if (F) { drawImages(); drawBlocks(); } });
  }
  function closeEditor() {
    var cv = $(".m-preview canvas");
    if (cv && window.Covers) window.Covers.unmount(cv);
    F = null;
    $("[data-drawer]").hidden = true;
    document.body.classList.remove("m-drawer-open");
  }

  function drawEditor() {
    var d = $("[data-drawer]"), t = F.type, isProj = t === "project", link = t === "website" || t === "repository";
    d.innerHTML =
      '<div class="m-drawer-panel" role="dialog" aria-modal="true" aria-label="' + (F.isNew ? "Add a work" : "Edit work") + '">' +
      '<div class="m-drawer-head"><h2>' + (F.isNew ? "Add a work" : "Edit " + esc(F.title || "work")) + '</h2><button type="button" class="m-icon" data-close aria-label="Close">&#215;</button></div>' +
      '<div class="m-drawer-body">' +

      // type
      '<section class="m-sec"><h3>Type</h3><div class="m-types">' + Object.keys(TYPES).map(function (k) {
        return '<label class="m-type' + (k === t ? " is-on" : "") + (F.isNew ? "" : " is-locked") + '"><input type="radio" name="type" value="' + k + '"' + (k === t ? " checked" : "") + (F.isNew ? "" : " disabled") + ">" +
          "<strong>" + esc(TYPES[k].label) + "</strong><span>" + esc(TYPES[k].hint) + "</span></label>";
      }).join("") + "</div>" + (F.isNew ? "" : '<p class="m-hint">The type of an existing work cannot change. Remove it and add a new one instead.</p>') + "</section>" +

      // where
      '<section class="m-sec"><h3>' + (isProj ? "Folder" : t === "remote" ? "Where it lives" : "Address") + "</h3>" +
      (isProj ? field("Folder name", '<span class="m-prefix"><span>projects/</span>' + input("slug", F.slug, (F.isNew ? "" : "readonly ") + 'placeholder="seattle-library" spellcheck="false"') + "</span>",
        F.isNew ? "Lowercase letters, numbers and hyphens. Filled from the title until you change it." : "Folder names stay fixed once published.") : "") +
      (link ? field(t === "repository" ? "GitHub address" : "Web address", input("url", F.url, 'placeholder="https://" spellcheck="false"'),
        t === "repository" ? '<button type="button" class="m-btn m-small" data-github>Fill details from GitHub</button>' : "") +
        field("When clicked", select("open", [["tab", "Open in a new tab"], ["embed", "Show inside this site, with a back link"]], F.open), "Some sites refuse to be shown inside another site; a new tab always works.") : "") +
      (t === "remote" ? field("Address of the project folder", input("remote", F.remote, 'placeholder="https://shafiarch.github.io/Another_Repo/my-project/" spellcheck="false"'),
        '<button type="button" class="m-btn m-small" data-check>Check</button> <span data-remote-msg>' + (st.remote[F.remote] ? "Found: " + esc(st.remote[F.remote].title || "") : "") + "</span>") : "") +
      "</section>" +

      // basics
      '<section class="m-sec"><h3>Title and description</h3>' + (t === "remote" ? '<p class="m-hint">Leave empty to use what the project.json says.</p>' : "") +
      '<div class="m-grid2">' +
      field("Title (book title)", input("title", F.title, t === "remote" && st.remote[F.remote] ? 'placeholder="' + attr(st.remote[F.remote].title) + '"' : ""), "", "m-span2") +
      field("Description", area("subtitle", F.subtitle, 2), "One line under the title; also the small text on the cover.", "m-span2") +
      field("Category", input("category", F.category, 'list="m-cats"') + '<datalist id="m-cats">' + CATEGORIES.map(function (c) { return '<option value="' + c + '">'; }).join("") + "</datalist>") +
      field("Year", input("year", F.year, 'inputmode="numeric" placeholder="2026"')) +
      "</div></section>" +

      // placement
      '<section class="m-sec"><h3>Placement</h3><div class="m-seg">' +
      [["book", "Book on the shelf and in the work list"], ["list", "Work list only"], ["hidden", "Hidden for now"]].map(function (o) {
        return '<label><input type="radio" name="place" value="' + o[0] + '"' + (F.place === o[0] ? " checked" : "") + "><span>" + o[1] + "</span></label>";
      }).join("") + "</div>" +
      (F.isNew ? field("Position", select("position", [["end", "At the end of the work list and shelf"], ["start", "At the start"]], F.position)) : "") +
      "</section>" +

      // book
      '<section class="m-sec m-book-sec"><h3>The book</h3><div class="m-book-grid"><div>' +
      field("Spine text", input("spine", F.spine, 'placeholder="' + attr(F.title || "Same as the title") + '"'), "Shorter text for the spine if the title is long.") +
      field("Spine colour", select("tone", [["auto", "Automatic"], ["light", "Light"], ["mid", "Mid"], ["dark", "Dark"], ["accent", "Accent"]], F.tone)) +
      field("Cover", select("coverMode", [["art", "Line drawing (animated)"], ["image", "Image"], ["type", "Title only"]], F.coverMode)) +
      '<div data-cover-opts></div>' +
      field("Cover title", input("coverText", F.coverText, 'placeholder="Same as the title"')) +
      field("Cover description", area("coverNote", F.coverNote, 2, 'placeholder="Same as the description"')) +
      '</div><div class="m-preview" data-preview></div></div></section>' +

      // project page
      (isProj ? '<section class="m-sec"><h3>Facts</h3><p class="m-hint">Shown beside the introduction. Empty rows are left out.</p><div data-meta></div>' +
        '<button type="button" class="m-btn m-small" data-addmeta>Add a fact</button></section>' +
        '<section class="m-sec"><h3>Introduction</h3>' + area("intro", F.intro, 6, 'placeholder="A blank line starts a new paragraph."') +
        '<p class="m-hint">**bold**, *italic* and [label](https://...) work.</p></section>' +
        '<section class="m-sec"><h3>Images</h3><p class="m-hint">JPG, PNG or WebP. Export PSD files to JPG or PNG first. Images are converted to WebP and resized here.</p>' +
        '<div class="m-drop" data-drop><input type="file" accept="image/*" multiple data-files id="m-files"><label for="m-files"><strong>Choose images</strong> or drop them here</label></div>' +
        '<div class="m-row-opts">' + field("Longest edge", select("maxEdge", [[2400, "2400 px"], [3200, "3200 px"], [4000, "4000 px (presentation boards)"]], F.maxEdge)) +
        '<label class="m-check"><input type="checkbox" name="autoBlocks"' + (F.autoBlocks ? " checked" : "") + "> Add a full width image block for each new image</label></div>" +
        '<div class="m-thumbs" data-thumbs></div></section>' +
        '<section class="m-sec"><h3>Page content</h3><p class="m-hint">The project page below the introduction, top to bottom.</p><div data-blocks></div>' +
        '<div class="m-addblock">' + Object.keys(BLOCK_TYPES).map(function (k) { return '<button type="button" class="m-btn m-small" data-addblock="' + k + '">+ ' + BLOCK_TYPES[k] + "</button>"; }).join("") + "</div></section>" : "") +

      '</div><div class="m-drawer-foot"><span class="m-foot-msg" data-foot-msg></span>' +
      '<button type="button" class="m-btn" data-close>Cancel</button><button type="button" class="m-btn m-primary" data-save>' + (F.isNew ? "Add" : "Save") + "</button></div></div>";

    var panel = $(".m-drawer-panel", d);
    $$("[data-close]", d).forEach(function (b) { b.onclick = closeEditor; });
    d.onclick = function (ev) { if (ev.target === d) closeEditor(); };
    $$('input[name="type"]', d).forEach(function (r) {
      r.onchange = function () {
        F.type = r.value;
        if (F.coverMode === "art" && (!F.art || ["web", "repo", "tower"].indexOf(F.art) > -1)) F.art = { website: "web", repository: "repo" }[F.type] || "tower";
        if (!F.category || ["Website", "Repository"].indexOf(F.category) > -1) F.category = { website: "Website", repository: "Repository" }[F.type] || F.category;
        if (F.category === "Website" && F.type !== "website") F.category = "";
        if (F.category === "Repository" && F.type !== "repository") F.category = "";
        drawEditor();
      };
    });
    $$("input[name], textarea[name], select[name]", panel).forEach(function (inp) {
      if (inp.name === "type") return;
      var ev = inp.type === "radio" || inp.type === "checkbox" || inp.tagName === "SELECT" ? "change" : "input";
      inp.addEventListener(ev, function () { onField(inp); });
    });
    var gh = $("[data-github]", d); if (gh) gh.onclick = fillFromGitHub;
    var ck = $("[data-check]", d); if (ck) ck.onclick = checkRemote;
    if (isProj) {
      $("[data-addmeta]", d).onclick = function () { F.meta.push(["", ""]); drawMeta(); };
      $$("[data-addblock]", d).forEach(function (b) { b.onclick = function () { F.blocks.push(newBlock(b.dataset.addblock)); drawBlocks(); }; });
      var files = $("[data-files]", d), drop = $("[data-drop]", d);
      files.onchange = function () { addFiles(files.files); files.value = ""; };
      drop.addEventListener("dragover", function (ev) { ev.preventDefault(); drop.classList.add("is-over"); });
      drop.addEventListener("dragleave", function () { drop.classList.remove("is-over"); });
      drop.addEventListener("drop", function (ev) { ev.preventDefault(); drop.classList.remove("is-over"); addFiles(ev.dataTransfer.files); });
      drawMeta(); drawImages(); drawBlocks();
    }
    drawCoverOpts(); drawPreview();
    document.onkeydown = function (ev) { if (ev.key === "Escape" && F) closeEditor(); };
  }

  function onField(inp) {
    var k = inp.name, v = inp.type === "checkbox" ? inp.checked : inp.value;
    if (k === "place") F.place = v;
    else if (k === "slug") { F.slug = slugify(v); F.slugTouched = true; if (inp.value !== F.slug && !/-$/.test(inp.value)) inp.value = F.slug; }
    else if (k === "maxEdge") F.maxEdge = +v;
    else F[k] = v;
    if (k === "title" && F.isNew && F.type === "project" && !F.slugTouched) {
      F.slug = slugify(v); var s = $('input[name="slug"]'); if (s) s.value = F.slug;
    }
    if (k === "coverMode") { if (v === "art" && !F.art) F.art = "tower"; drawCoverOpts(); }
    if (["title", "subtitle", "category", "year", "spine", "tone", "art", "coverMode", "coverText", "coverNote", "remote"].indexOf(k) > -1) drawPreview();
    $("[data-foot-msg]").textContent = "";
  }

  function drawCoverOpts() {
    var box = $("[data-cover-opts]"); if (!box) return;
    if (F.coverMode === "art") {
      box.innerHTML = field("Drawing", select("art", Object.keys(ART_LABELS).filter(function (k) { return window.Covers && window.Covers.has(k); }).map(function (k) { return [k, ART_LABELS[k]]; }), F.art),
        "New drawings can be added in assets/covers.js.");
    } else if (F.coverMode === "image") {
      var names = F.type === "project" && F.slug ? Array.from(knownImages(F.slug) || []).filter(function (n) { return n !== "cover.webp"; }) : [];
      box.innerHTML =
        (names.length ? field("Crop from", select("cropSrc", [["", "Choose an image"]].concat(names.map(function (n) { return [n, n]; })), F.crop.srcName || "")) : "") +
        field(names.length ? "Or upload an image" : "Upload an image", '<input type="file" accept="image/*" data-coverfile>') +
        '<div class="m-crop"' + (F.crop.src ? "" : " hidden") + ">" +
        field("Across", '<input type="range" min="0" max="1" step="0.01" value="' + F.crop.fx + '" data-crop="fx">') +
        field("Down", '<input type="range" min="0" max="1" step="0.01" value="' + F.crop.fy + '" data-crop="fy">') +
        field("Zoom", '<input type="range" min="1" max="3" step="0.05" value="' + F.crop.zoom + '" data-crop="zoom">') + "</div>" +
        (F.cover && !F.crop.src ? '<p class="m-hint">Current cover: <code>' + esc(F.cover) + "</code>. Choose an image to make a new one.</p>" : "");
      var cs = $('select[name="cropSrc"]', box);
      if (cs) cs.onchange = function () { F.crop.srcName = cs.value; F.crop.src = cs.value ? imgUrl(F.slug, cs.value) : ""; F.crop.dirty = !!cs.value; drawCoverOpts(); drawPreview(); };
      var cf = $("[data-coverfile]", box);
      cf.onchange = function () {
        var f = cf.files[0]; if (!f) return;
        if (F.crop.ownUrl) URL.revokeObjectURL(F.crop.ownUrl);
        F.crop.ownUrl = URL.createObjectURL(f); F.crop.src = F.crop.ownUrl; F.crop.srcName = ""; F.crop.dirty = true;
        drawCoverOpts(); drawPreview();
      };
      $$("[data-crop]", box).forEach(function (r) { r.oninput = function () { F.crop[r.dataset.crop] = +r.value; F.crop.dirty = true; drawPreview(); }; });
    } else box.innerHTML = "";
    $$("select[name], input[name]", box).forEach(function (inp) { if (inp.name === "art") inp.onchange = function () { F.art = inp.value; drawPreview(); }; });
  }

  /* Cover preview using the site's own cover styles and drawings */
  function drawPreview() {
    var box = $("[data-preview]"); if (!box) return;
    var old = $("canvas", box); if (old && window.Covers) window.Covers.unmount(old);
    var remote = F.type === "remote" ? st.remote[F.remote] || {} : {};
    var title = F.coverText || F.title || remote.title || "Title", note = F.coverNote || F.subtitle || remote.subtitle || "";
    var meta = [F.category || remote.category, F.year || remote.year].filter(Boolean).map(esc).join(" · ");
    var tone = F.tone === "auto" ? "light" : F.tone;
    var face;
    if (F.coverMode === "art") {
      face = '<span class="art-cover"><span class="ac-title">' + esc(title) + '</span><canvas class="ac-canvas"></canvas>' +
        '<span class="ac-foot"><span class="ac-desc">' + esc(note) + '</span><span class="ac-tag">' + meta + "</span></span></span>";
    } else if (F.coverMode === "image") {
      face = '<span class="m-crop-frame"><img alt="" data-cropimg></span>';
    } else {
      face = S.typeCover({ title: title, shelf: { coverText: title, coverNote: note } }, st.site);
    }
    box.innerHTML = '<div class="m-preview-label">Preview</div><div class="m-bookview"><span class="m-spine tone-' + esc(tone) + '"><span>' + esc(F.spine || F.title || "Spine") + "</span></span>" +
      '<span class="m-cover">' + face + "</span></div>";
    var cv = $("canvas", box);
    if (cv && window.Covers) { window.Covers.mount(cv, F.art, 0); window.Covers.activate(cv); }
    var im = $("[data-cropimg]", box);
    if (im) {
      var src = F.crop.src || (F.cover ? (F.type === "project" ? imgUrl(F.slug, F.cover) : st.blobUrls["content/" + F.cover] || "content/" + F.cover) : "");
      if (!src) { im.parentNode.innerHTML = '<span class="m-crop-empty">Choose an image</span>'; return; }
      if (!F.crop.src) { im.src = src; im.style.cssText = "width:100%;height:100%;object-fit:cover"; return; }
      loadImg(src).then(function (img) {
        var ratio = 0.74, W = img.naturalWidth, H = img.naturalHeight, ch = Math.min(H, W / ratio) / F.crop.zoom, cw = ch * ratio;
        var x0 = Math.min(Math.max(F.crop.fx * W - cw / 2, 0), W - cw), y0 = Math.min(Math.max(F.crop.fy * H - ch / 2, 0), H - ch);
        im.src = src;
        im.style.cssText = "position:absolute;max-width:none;width:" + (W / cw * 100) + "%;left:" + (-x0 / cw * 100) + "%;top:" + (-y0 / ch * 100) + "%";
      });
    }
  }

  function drawMeta() {
    var box = $("[data-meta]"); if (!box) return;
    box.innerHTML = F.meta.map(function (m, i) {
      return '<div class="m-pair">' + input("mk" + i, m[0], 'data-mk="' + i + '" placeholder="Label, e.g. Site" aria-label="Label"') +
        input("mv" + i, m[1], 'data-mv="' + i + '" placeholder="Value, e.g. Makoko, Lagos" aria-label="Value"') +
        '<button type="button" class="m-icon" data-mup="' + i + '" aria-label="Move up">&#8593;</button>' +
        '<button type="button" class="m-icon" data-mdel="' + i + '" aria-label="Remove">&#215;</button></div>';
    }).join("");
    $$("[data-mk]", box).forEach(function (x) { x.oninput = function () { F.meta[+x.dataset.mk][0] = x.value; }; });
    $$("[data-mv]", box).forEach(function (x) { x.oninput = function () { F.meta[+x.dataset.mv][1] = x.value; }; });
    $$("[data-mup]", box).forEach(function (x) { x.onclick = function () { if (moveIn(F.meta, +x.dataset.mup, -1)) drawMeta(); }; });
    $$("[data-mdel]", box).forEach(function (x) { x.onclick = function () { F.meta.splice(+x.dataset.mdel, 1); drawMeta(); }; });
  }

  function drawImages() {
    var box = $("[data-thumbs]"); if (!box || F.type !== "project") return;
    var names = Array.from(knownImages(F.slug) || []).sort();
    box.innerHTML = names.length ? names.map(function (n) {
      var path = "projects/" + F.slug + "/" + n, isNew = !!st.blobs[path];
      return '<figure class="m-thumb"><img src="' + attr(imgUrl(F.slug, n)) + '" alt="" loading="lazy"><figcaption><code>' + esc(n) + "</code>" + (isNew ? ' <span class="m-new">new</span>' : "") + "</figcaption>" +
        '<div class="m-thumb-btns"><button type="button" class="m-btn m-small" data-useimg="' + attr(n) + '">Add to page</button>' +
        (isNew ? '<button type="button" class="m-btn m-small m-ghost-bad" data-dropimg="' + attr(n) + '">Remove</button>' : "") + "</div></figure>";
    }).join("") : '<p class="m-hint">' + (F.slug ? "No images in this folder yet." : "Give the project a folder name first.") + "</p>";
    $$("[data-useimg]", box).forEach(function (b) { b.onclick = function () { F.blocks.push({ type: "image", src: b.dataset.useimg, alt: "" }); drawBlocks(); toast("Image block added"); }; });
    $$("[data-dropimg]", box).forEach(function (b) {
      b.onclick = function () {
        var path = "projects/" + F.slug + "/" + b.dataset.dropimg;
        URL.revokeObjectURL(st.blobUrls[path]); delete st.blobs[path]; delete st.blobUrls[path];
        knownImages(F.slug).delete(b.dataset.dropimg);
        F.blocks = F.blocks.filter(function (x) { return !(x.type === "image" && x.src === b.dataset.dropimg); });
        drawImages(); drawBlocks(); status();
      };
    });
    var dl = $("#m-imgs"); if (dl) dl.innerHTML = names.map(function (n) { return '<option value="' + attr(n) + '">'; }).join("");
  }

  function addFiles(list) {
    if (!F.slug) { $("[data-foot-msg]").textContent = "Give the project a folder name before adding images."; $('input[name="slug"]').focus(); return; }
    var files = [].slice.call(list).filter(function (f) { return /^image\//.test(f.type); });
    if (!files.length) { toast("Those files are not images. Export PSD files to JPG or PNG first.", true); return; }
    var set = knownImages(F.slug) || (st.known[F.slug] = new Set());
    var msg = $("[data-foot-msg]");
    var chain = Promise.resolve();
    files.forEach(function (f, k) {
      chain = chain.then(function () {
        msg.textContent = "Converting " + (k + 1) + " of " + files.length + "...";
        return toWeb(f, F.maxEdge, 0.82).then(function (r) {
          var ext = r.blob.type === "image/webp" ? ".webp" : ".jpg", base = slugify(f.name.replace(/\.[^.]+$/, "")) || "image", name = base + ext, n = 2;
          while (set.has(name) && !st.blobs["projects/" + F.slug + "/" + name]) name = base + "-" + (n++) + ext;
          addBlob("projects/" + F.slug + "/" + name, r.blob);
          set.add(name);
          if (F.autoBlocks) F.blocks.push({ type: "image", src: name, alt: "" });
        });
      });
    });
    chain.then(function () {
      msg.textContent = files.length + " image" + (files.length > 1 ? "s" : "") + " ready.";
      drawImages(); drawBlocks(); if (F.coverMode === "image") drawCoverOpts(); status();
    }).catch(function (err) { msg.textContent = "An image could not be read: " + err.message; });
  }

  function newBlock(type) {
    return ({ image: { type: "image", src: "", caption: "", alt: "", width: "full" }, gallery: { type: "gallery", columns: 2, items: [{ src: "", caption: "" }, { src: "", caption: "" }] },
      text: { type: "text", heading: "", body: "" }, quote: { type: "quote", text: "", by: "" }, video: { type: "video", src: "" },
      embed: { type: "embed", url: "", ratio: "16 / 10", caption: "" }, links: { type: "links", heading: "", items: [{ label: "", url: "" }] }, spacer: { type: "spacer" } })[type];
  }

  function drawBlocks() {
    var box = $("[data-blocks]"); if (!box) return;
    var imgOpts = '<datalist id="m-imgs">' + Array.from(knownImages(F.slug) || []).map(function (n) { return '<option value="' + attr(n) + '">'; }).join("") + "</datalist>";
    box.innerHTML = imgOpts + (F.blocks.length ? F.blocks.map(function (b, i) {
      return '<div class="m-block' + (b.hidden ? " is-hidden" : "") + '" data-b="' + i + '"><div class="m-block-head"><strong>' + S.pad(i) + " " + esc(BLOCK_TYPES[b.type] || b.type) + "</strong>" +
        '<span class="m-row-btns"><label class="m-check m-small-check"><input type="checkbox" data-bf="hidden"' + (b.hidden ? " checked" : "") + "> Hidden</label>" +
        '<button type="button" class="m-icon" data-bup aria-label="Move up">&#8593;</button><button type="button" class="m-icon" data-bdown aria-label="Move down">&#8595;</button>' +
        '<button type="button" class="m-icon" data-bdel aria-label="Remove">&#215;</button></span></div><div class="m-block-body">' + blockFields(b) + "</div></div>";
    }).join("") : '<p class="m-hint">No content blocks yet. Add images above, or use the buttons below.</p>');
    $$("[data-b]", box).forEach(function (el) {
      var i = +el.dataset.b, b = F.blocks[i];
      $("[data-bup]", el).onclick = function () { if (moveIn(F.blocks, i, -1)) drawBlocks(); };
      $("[data-bdown]", el).onclick = function () { if (moveIn(F.blocks, i, 1)) drawBlocks(); };
      $("[data-bdel]", el).onclick = function () { F.blocks.splice(i, 1); drawBlocks(); };
      $$("[data-bf]", el).forEach(function (inp) {
        inp.addEventListener(inp.type === "checkbox" || inp.tagName === "SELECT" ? "change" : "input", function () {
          var k = inp.dataset.bf, v = inp.type === "checkbox" ? inp.checked : inp.value;
          if (k === "columns") v = +v;
          if (k === "vsource") { delete b.src; delete b.youtube; delete b.vimeo; b[v] = ""; drawBlocks(); return; }
          if (k === "vvalue") { var srcKey = b.youtube != null ? "youtube" : b.vimeo != null ? "vimeo" : "src"; b[srcKey] = v.trim(); return; }
          b[k] = v;
          if (k === "hidden") el.classList.toggle("is-hidden", v);
        });
      });
      $$("[data-item]", el).forEach(function (inp) {
        inp.oninput = function () { b.items[+inp.dataset.item][inp.dataset.ik] = inp.value; };
      });
      $$("[data-itemdel]", el).forEach(function (x) { x.onclick = function () { b.items.splice(+x.dataset.itemdel, 1); drawBlocks(); }; });
      var ai = $("[data-additem]", el);
      if (ai) ai.onclick = function () { b.items.push(b.type === "links" ? { label: "", url: "" } : { src: "", caption: "" }); drawBlocks(); };
    });
  }

  function bf(label, k, v, extra, hint) { return field(label, input("b-" + k, v, 'data-bf="' + k + '" ' + (extra || "")), hint); }
  function blockFields(b) {
    var img = 'list="m-imgs" placeholder="01.webp" spellcheck="false"';
    switch (b.type) {
      case "image":
        return '<div class="m-grid2">' + bf("Image file", "src", b.src, img) + field("Width", select("b-width", [["full", "Full"], ["wide", "Wide"], ["text", "Text width"]], b.width || "full", 'data-bf="width"')) +
          bf("Caption", "caption", b.caption, "", "") + bf("Alt text", "alt", b.alt, 'placeholder="What the image shows"') + "</div>";
      case "gallery":
        b.items = (b.items || []).map(function (x) { return typeof x === "string" ? { src: x, caption: "" } : x; });
        return field("Columns", select("b-columns", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], b.columns || 2, 'data-bf="columns"')) +
          b.items.map(function (x, j) {
            return '<div class="m-pair">' + input("gi" + j, x.src, 'data-item="' + j + '" data-ik="src" ' + img + ' aria-label="Image file"') +
              input("gc" + j, x.caption, 'data-item="' + j + '" data-ik="caption" placeholder="Caption" aria-label="Caption"') +
              '<button type="button" class="m-icon" data-itemdel="' + j + '" aria-label="Remove">&#215;</button></div>';
          }).join("") + '<button type="button" class="m-btn m-small" data-additem>Add image</button>' + bf("Caption for the gallery", "caption", b.caption);
      case "text":
        return bf("Heading", "heading", b.heading) + field("Text", area("b-body", b.body, 5, 'data-bf="body" placeholder="A blank line starts a new paragraph."'));
      case "quote":
        return field("Quote", area("b-text", b.text, 2, 'data-bf="text"')) + bf("By", "by", b.by);
      case "video":
        var srcKey = b.youtube != null ? "youtube" : b.vimeo != null ? "vimeo" : "src";
        return '<div class="m-grid2">' + field("Source", select("b-vs", [["src", "Video file in the folder (mp4)"], ["youtube", "YouTube"], ["vimeo", "Vimeo"]], srcKey, 'data-bf="vsource"')) +
          field(srcKey === "src" ? "File name" : "Video id", input("b-vv", b[srcKey] || "", 'data-bf="vvalue" placeholder="' + (srcKey === "src" ? "walkthrough.mp4" : srcKey === "youtube" ? "dQw4w9WgXcQ" : "76979871") + '"'),
            srcKey === "src" ? "Upload the mp4 into the project folder on GitHub; videos are not converted here." : "The id at the end of the video address.") +
          (srcKey === "src" ? bf("Poster image", "poster", b.poster, img) + '<label class="m-check"><input type="checkbox" data-bf="autoplay"' + (b.autoplay ? " checked" : "") + "> Play silently on a loop</label>" : "") +
          bf("Caption", "caption", b.caption) + "</div>";
      case "embed":
        return bf("Page address", "url", b.url, 'placeholder="https://"') + '<div class="m-grid2">' + bf("Shape (width / height)", "ratio", b.ratio, 'placeholder="16 / 10"') + bf("Caption", "caption", b.caption) + "</div>";
      case "links":
        return bf("Heading", "heading", b.heading) + (b.items || []).map(function (x, j) {
          return '<div class="m-pair">' + input("li" + j, x.label, 'data-item="' + j + '" data-ik="label" placeholder="Label" aria-label="Label"') +
            input("lu" + j, x.url, 'data-item="' + j + '" data-ik="url" placeholder="https://" aria-label="Address"') +
            '<button type="button" class="m-icon" data-itemdel="' + j + '" aria-label="Remove">&#215;</button></div>';
        }).join("") + '<button type="button" class="m-btn m-small" data-additem>Add link</button>';
      default:
        return '<p class="m-hint">Adds extra space between blocks.</p>';
    }
  }

  function fillFromGitHub() {
    var m = (F.url || "").match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i), msg = $("[data-foot-msg]");
    if (!m) { msg.textContent = "Enter a GitHub address like https://github.com/ShafiArch/Grasshopper"; return; }
    msg.textContent = "Asking GitHub...";
    fetch("https://api.github.com/repos/" + m[1] + "/" + m[2].replace(/\.git$/, "")).then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? "not found, or private" : "GitHub said " + r.status); return r.json(); })
      .then(function (g) {
        if (!F.title) F.title = g.name.replace(/[_-]+/g, " ");
        if (!F.subtitle && g.description) F.subtitle = g.description;
        if (!F.year && g.created_at) F.year = g.created_at.slice(0, 4);
        F.category = F.category || "Repository";
        drawEditor();
        $("[data-foot-msg]").textContent = "Filled from GitHub" + (g.homepage ? ". It has a website: " + g.homepage + " (switch the type to Website to link that instead)." : ".");
      }).catch(function (err) { msg.textContent = "Could not read that repository: " + err.message; });
  }
  function checkRemote() {
    var msg = $("[data-remote-msg]");
    if (!isURL(F.remote)) { msg.textContent = "Enter the full address, starting with https://"; return; }
    msg.textContent = "Checking...";
    fetchRemote(F.remote).then(function (p) { msg.textContent = "Found: " + (p.title || "a project"); drawPreview(); })
      .catch(function () { msg.textContent = "No project.json found there. Check the address ends at the project folder."; });
  }

  /* Validate the form, then write it into the site and project files */
  function saveEditor() {
    var t = F.type, msg = $("[data-foot-msg]"), works = st.site.works;
    function fail(text, sel) { msg.textContent = text; msg.classList.add("is-bad"); var el = sel && $(sel); if (el) el.focus(); return false; }
    msg.classList.remove("is-bad");
    if (t !== "remote" && !F.title.trim()) return fail("Add a title.", 'input[name="title"]');
    var others = works.filter(function (e, i) { return i !== F.index; }).map(entryId);
    var id;
    if (t === "project") {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(F.slug)) return fail("The folder name needs lowercase letters, numbers or hyphens.", 'input[name="slug"]');
      if (others.indexOf(F.slug) > -1) return fail("Another work already uses the folder " + F.slug + ".", 'input[name="slug"]');
      id = F.slug;
    } else if (t === "remote") {
      if (!isURL(F.remote)) return fail("Add the address of the project folder.", 'input[name="remote"]');
      if (others.indexOf(F.remote) > -1) return fail("That project is already in the list.");
      id = F.remote;
    } else {
      if (!isURL(F.url)) return fail("Add a web address starting with https://", 'input[name="url"]');
      id = F.id || slugify(F.title) || "link";
      if (!F.id) { var base = id, n = 2; while (others.indexOf(id) > -1) id = base + "-" + (n++); }
    }
    if (F.coverMode === "image" && !F.crop.src && !F.cover) return fail("Choose an image for the cover, or pick another cover type.");

    var shelf = { tone: F.tone === "auto" ? "" : F.tone, spine: F.spine.trim(), coverText: F.coverText.trim(), coverNote: F.coverNote.trim() };
    if (F.coverMode === "art") shelf.art = F.art;
    var coverPath = null;
    if (F.coverMode === "image") {
      shelf.cover = F.crop.src && F.crop.dirty ? (t === "project" ? "cover.webp" : "covers/" + slugify(id) + ".webp") : F.cover;
      if (F.crop.src && F.crop.dirty) coverPath = t === "project" ? "projects/" + F.slug + "/cover.webp" : "content/covers/" + slugify(id) + ".webp";
    }

    var entry;
    if (t === "project") {
      var p = st.projects[F.slug] ? clone(st.projects[F.slug]) : {};
      var keep = p.shelf || {};
      delete keep.art; delete keep.cover; delete keep.tone; delete keep.spine; delete keep.coverText; delete keep.coverNote;
      p.title = F.title.trim(); p.subtitle = F.subtitle.trim(); p.year = String(F.year || "").trim(); p.category = F.category.trim();
      p.shelf = Object.assign({}, keep, shelf);
      p.meta = F.meta.filter(function (m) { return (m[0] || "").trim() && (m[1] || "").trim(); }).map(function (m) { return [m[0].trim(), m[1].trim()]; });
      p.intro = F.intro.trim();
      p.blocks = F.blocks.map(function (b) { return clean(clone(b)); }).filter(function (b) { return b.type; });
      var ordered = {};
      ["title", "subtitle", "year", "category", "shelf", "meta", "intro", "blocks"].forEach(function (k) { if (p[k] !== undefined) ordered[k] = p[k]; });
      Object.keys(p).forEach(function (k) { if (ordered[k] === undefined) ordered[k] = p[k]; });
      ["subtitle", "year", "category", "intro"].forEach(function (k) { if (ordered[k] === "") delete ordered[k]; });
      clean(ordered.shelf);
      st.projects[F.slug] = ordered;
      delete st.removed[F.slug];
      entry = { project: F.slug };
    } else if (t === "remote") {
      entry = clean({ project: F.remote, title: F.title.trim(), subtitle: F.subtitle.trim(), category: F.category.trim(), year: String(F.year || "").trim(), shelf: shelf });
    } else {
      entry = clean({ id: id, type: t, title: F.title.trim(), subtitle: F.subtitle.trim(), category: F.category.trim(), year: String(F.year || "").trim(), url: F.url.trim(), open: F.open, shelf: shelf });
      entry.id = id;
    }
    if (F.place === "hidden") entry.hidden = true;

    var finish = function () {
      var c = st.site.carousel;
      if (F.isNew) {
        if (F.position === "start") works.unshift(entry); else works.push(entry);
        if (F.place === "book") { if (F.position === "start") c.unshift(id); else c.push(id); }
      } else {
        var oldId = entryId(works[F.index]);
        works[F.index] = entry;
        var at = c.indexOf(oldId);
        if (F.place === "book") { if (at > -1) c[at] = id; else c.push(id); }
        else if (at > -1) c.splice(at, 1);
      }
      saveDraft();
      var title = F.title || id, wasNew = F.isNew;
      closeEditor(); render();
      toast((wasNew ? "Added " : "Saved ") + title);
    };
    if (coverPath) {
      msg.textContent = "Making the cover...";
      cropCover(F.crop.src, F.crop.fx, F.crop.fy, F.crop.zoom).then(function (b) { addBlob(coverPath, b); finish(); })
        .catch(function () { fail("The cover image could not be made from that file."); });
    } else finish();
    return true;
  }
  document.addEventListener("click", function (e) { if (e.target.closest("[data-save]")) saveEditor(); });

  /* ---------- top level ---------- */
  $("[data-reset]").onclick = function () {
    var b = this;
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sure? Discard all"; setTimeout(function () { b.dataset.sure = ""; b.textContent = "Discard changes"; }, 3000); return; }
    clearDraft();
    Object.keys(st.blobUrls).forEach(function (p) { URL.revokeObjectURL(st.blobUrls[p]); });
    st.blobs = {}; st.blobUrls = {}; st.removed = {}; st.known = {};
    st.site = clone(st.live); st.projects = {};
    Object.keys(st.liveProjects).forEach(function (k) { st.projects[k] = clone(st.liveProjects[k]); });
    b.dataset.sure = ""; b.textContent = "Discard changes";
    render(); toast("Back to the published site");
  };

  window.GH.button($("[data-gh]"));
  window.SiteManager = { state: st, changes: changes, check: check };
  load();
})();
