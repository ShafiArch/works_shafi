/* Shared helpers: loading content, resolving shelf entries, small text formatting,
   header, footer and the theme picker. No build step, no framework. */
(function () {
  "use strict";

  var cache = {};
  function getJSON(url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(r.status + " " + url);
        return r.json();
      });
    }
    return cache[url];
  }

  function isURL(s) { return /^https?:\/\//i.test(s || ""); }

  /* A project id is either a folder name inside projects/ or a full address of a
     folder that holds a project.json (another repository on GitHub Pages, say). */
  function projectBase(id) {
    if (isURL(id)) return id.replace(/project\.json$/i, "").replace(/\/?$/, "/");
    return "projects/" + id + "/";
  }

  function abs(src, base) {
    if (!src) return "";
    try { return new URL(src, new URL(base, location.href)).href; } catch (e) { return src; }
  }

  function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /* Turns one entry of site.json "shelf" into everything the pages need. */
  function resolveEntry(entry, index) {
    if (entry.project) {
      var base = projectBase(entry.project);
      return getJSON(base + "project.json").then(function (p) {
        var merged = Object.assign({}, p, entry);
        merged.shelf = Object.assign({}, p.shelf || {}, entry.shelf || {});
        merged.kind = "project";
        merged.id = entry.project;
        merged.base = base;
        merged.href = "project.html?p=" + encodeURIComponent(entry.project);
        merged.cover = abs(merged.shelf.cover, base);
        merged.index = index;
        return merged;
      }).catch(function (err) {
        console.warn("Skipping shelf entry, project not found:", entry.project, err);
        return null;
      });
    }
    var e = Object.assign({}, entry);
    e.shelf = Object.assign({}, entry.shelf || {});
    e.kind = "link";
    e.id = entryId(entry);
    e.open = entry.open || "tab";
    e.href = e.open === "embed" ? "project.html?e=" + encodeURIComponent(e.id) : entry.url;
    e.cover = e.shelf.cover ? abs(e.shelf.cover, "content/") : "";
    e.index = index;
    return Promise.resolve(e);
  }

  /* site.json lists every entry in "works" (the work list order). "carousel" is
     the order of the books on the shelf, by id; an entry left out of it shows in
     the work list only. Without "carousel", every entry is a book, in works order.
     (Older files used "shelf" for "works"; it still works.) */
  function entryId(e) { return e.project || e.id || slugify(e.title); }

  function loadSite(site) {
    var list = (site.works || site.shelf || []).filter(function (e) { return e && !e.hidden; });
    return Promise.all(list.map(resolveEntry)).then(function (items) {
      var works = items.filter(Boolean).map(function (it, i) { it.n = i; return it; });
      var byId = {};
      works.forEach(function (it) { byId[it.id] = it; });
      var books = Array.isArray(site.carousel)
        ? site.carousel.map(function (id) { return byId[id]; }).filter(Boolean)
        : works.filter(function (it) { return it.book !== false; });
      return { works: works, books: books };
    });
  }
  function loadShelf(site) { return loadSite(site).then(function (r) { return r.works; }); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Text formatting for body copy: blank line = new paragraph,
     **bold**, *italic*, [label](https://link). */
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
        var ext = /^https?:/i.test(u);
        return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
      });
  }
  function md(s) {
    if (Array.isArray(s)) s = s.join("\n\n");
    return String(s || "").split(/\n\s*\n/).map(function (p) {
      p = p.trim();
      return p ? "<p>" + inline(p).replace(/\n/g, "<br>") + "</p>" : "";
    }).join("");
  }

  function pad(n) { return (n < 9 ? "0" : "") + (n + 1); }

  function linkAttrs(href) {
    return isURL(href) && href.indexOf(location.origin) !== 0 ? ' target="_blank" rel="noopener"' : "";
  }

  function renderChrome(site) {
    var top = document.querySelector("[data-top]");
    if (top) {
      top.innerHTML =
        '<a class="top-name" href="index.html">' + esc(site.name) + "</a>" +
        '<nav class="top-nav">' + (site.nav || []).map(function (n) {
          return '<a href="' + esc(n.href) + '"' + linkAttrs(n.href) + ">" + esc(n.label) + "</a>";
        }).join("") + "</nav>";
      themeSwitch(top);
    }
    var foot = document.querySelector("[data-foot]");
    if (foot) {
      foot.innerHTML =
        '<div class="foot-about">' + md(site.about) + "</div>" +
        '<div class="foot-meta">' + esc(site.footer || site.name) + " · " + new Date().getFullYear() + "</div>";
    }
  }

  /* Trace / Night / Clay switch in the header. */
  function themeSwitch(top) {
    var T = window.SITE_THEMES;
    if (!T || !top) return;
    var box = document.createElement("div");
    box.className = "theme-switch";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Theme");
    box.innerHTML = Object.keys(T.THEMES).map(function (k) {
      return '<button type="button" data-set-theme="' + k + '" aria-pressed="' + (k === T.current) + '">' + esc(T.THEMES[k]) + "</button>";
    }).join("");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-set-theme]");
      if (b) T.set(b.dataset.setTheme);
    });
    window.addEventListener("site-theme", function (e) {
      [].forEach.call(box.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.setTheme === e.detail)); });
    });
    top.appendChild(box);
  }

  /* Cover animation settings live in site.json "covers": { "default": {...},
     "books": { "<id>": {...} } }. A book's own values override the default.
     Values: size (1 = normal box), x and y (offset, % of cover width),
     speed, ink { weight, opacity }, accent { weight, opacity }. */
  function coverStyle(site, id) {
    var c = site.covers || {}, d = c["default"] || {}, b = (c.books || {})[id] || {};
    return {
      size: pick(b.size, d.size), x: pick(b.x, d.x), y: pick(b.y, d.y), speed: pick(b.speed, d.speed),
      ink: Object.assign({}, d.ink || {}, b.ink || {}), accent: Object.assign({}, d.accent || {}, b.accent || {})
    };
  }
  function pick(a, b) { return a !== undefined ? a : b; }
  function applyCoverBox(canvas, cs) {
    function lim(v, lo, hi, dflt) { v = parseFloat(v); return isNaN(v) ? dflt : Math.min(hi, Math.max(lo, v)); }
    canvas.style.setProperty("--art-size", lim(cs.size, 0.4, 2, 1));
    canvas.style.setProperty("--art-x", lim(cs.x, -45, 45, 0));
    canvas.style.setProperty("--art-y", lim(cs.y, -60, 20, 0));
  }

  /* Book effect: site.json "book". Plain numbers in the units the editor shows.
     Defaults are the look the site was designed with. */
  var BOOK = {
    angle:  { def: 64,  min: 30, max: 90 },    // how far the open book turns toward you, degrees (90 = flat)
    depth:  { def: 95,  min: 0,  max: 100 },   // perspective strength
    edge:   { def: 100, min: 0,  max: 100 },   // thin dark strips at the spine edges (the fillet)
    curve:  { def: 0,   min: 0,  max: 100 },   // rounded spine, light across a cylinder
    crease: { def: 100, min: 0,  max: 100 },   // shading where the cover meets the spine
    shadow: { def: 100, min: 0,  max: 100 },   // floor shadow under the open book
    lift:   { def: 8,   min: 0,  max: 20 },    // px a spine rises on hover
    radius: { def: 0,   min: 0,  max: 8 },     // px corner rounding at the fore edge
    spine:  { def: 100, min: 60, max: 160 },   // spine width, percent of normal
    cover:  { def: 74,  min: 60, max: 90 },    // cover width as percent of its height
    gap:    { def: 4,   min: 0,  max: 12 },    // space between books, percent of book height
    speed:  { def: 0.9, min: 0.3, max: 2 }     // seconds for a book to turn
  };
  function bookValues(b) {
    var out = {};
    Object.keys(BOOK).forEach(function (k) {
      var d = BOOK[k], v = parseFloat((b || {})[k]);
      out[k] = isNaN(v) ? d.def : Math.min(d.max, Math.max(d.min, v));
    });
    return out;
  }
  function applyBook(el, b) {
    var v = bookValues(b), st = el.style;
    st.setProperty("--open-angle", v.angle);
    st.setProperty("--persp-k", (30 - 27.2 * v.depth / 100).toFixed(3));
    st.setProperty("--edge", v.edge / 100);
    st.setProperty("--curve", v.curve / 100);
    st.setProperty("--crease", v.crease / 100);
    st.setProperty("--shadow", v.shadow / 100);
    st.setProperty("--lift", v.lift);
    st.setProperty("--radius", v.radius);
    st.setProperty("--spine-k", v.spine / 100);
    st.setProperty("--cover-ratio", v.cover / 100);
    st.setProperty("--gap-k", v.gap / 100);
    st.setProperty("--dur", v.speed + "s");
    return v;
  }

  /* Typographic cover for entries without an image. */
  function typeCover(item, site) {
    var s = item.shelf || {};
    return '<div class="type-cover">' +
      '<div class="type-cover-title">' + esc(s.coverText || item.title) + "</div>" +
      (s.coverNote ? '<div class="type-cover-note">' + esc(s.coverNote) + "</div>" : "") +
      '<div class="type-cover-author">' + esc(site.name) + "</div></div>";
  }

  window.Site = {
    getJSON: getJSON, loadShelf: loadShelf, loadSite: loadSite, entryId: entryId, slugify: slugify, resolveEntry: resolveEntry, projectBase: projectBase,
    abs: abs, esc: esc, md: md, inline: inline, pad: pad, renderChrome: renderChrome,
    typeCover: typeCover, BOOK: BOOK, bookValues: bookValues, applyBook: applyBook, coverStyle: coverStyle, applyCoverBox: applyCoverBox, linkAttrs: linkAttrs, isURL: isURL
  };
})();
