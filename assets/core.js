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
    typeCover: typeCover, linkAttrs: linkAttrs, isURL: isURL
  };
})();
