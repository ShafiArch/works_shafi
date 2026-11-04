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
    e.id = entry.id || slugify(entry.title);
    e.open = entry.open || "tab";
    e.href = e.open === "embed" ? "project.html?e=" + encodeURIComponent(e.id) : entry.url;
    e.cover = e.shelf.cover ? abs(e.shelf.cover, "content/") : "";
    e.index = index;
    return Promise.resolve(e);
  }

  function loadShelf(site) {
    var list = (site.shelf || []).filter(function (e) { return e && !e.hidden; });
    return Promise.all(list.map(resolveEntry)).then(function (items) {
      return items.filter(Boolean).map(function (it, i) { it.n = i; return it; });
    });
  }

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
    }
    var foot = document.querySelector("[data-foot]");
    if (foot) {
      foot.innerHTML =
        '<div class="foot-about">' + md(site.about) + "</div>" +
        '<div class="foot-meta">' + esc(site.footer || site.name) + " · " + new Date().getFullYear() + "</div>";
    }
    themePicker();
  }

  function themePicker() {
    var T = window.SITE_THEMES;
    if (!T) return;
    var q = new URLSearchParams(location.search);
    if (!q.has("themes") && !T.previewing) return;
    var box = document.createElement("div");
    box.className = "theme-picker";
    box.innerHTML = "<span>" + (T.previewing ? "Previewing" : "Theme") + "</span>" +
      '<select aria-label="Theme">' + Object.keys(T.THEMES).map(function (k) {
        return '<option value="' + k + '"' + (k === T.current ? " selected" : "") + ">" +
          esc(T.THEMES[k]) + (k === T.DEFAULT ? " (live)" : "") + "</option>";
      }).join("") + "</select>" +
      '<button type="button" data-reset>Reset</button>';
    box.querySelector("select").addEventListener("change", function () {
      var u = new URL(location.href);
      u.searchParams.set("theme", this.value);
      location.href = u.href;
    });
    box.querySelector("[data-reset]").addEventListener("click", function () {
      var u = new URL(location.href);
      u.searchParams.set("theme", "default");
      u.searchParams.delete("themes");
      location.href = u.href;
    });
    document.body.appendChild(box);
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
    getJSON: getJSON, loadShelf: loadShelf, resolveEntry: resolveEntry, projectBase: projectBase,
    abs: abs, esc: esc, md: md, inline: inline, pad: pad, renderChrome: renderChrome,
    typeCover: typeCover, linkAttrs: linkAttrs, isURL: isURL
  };
})();
