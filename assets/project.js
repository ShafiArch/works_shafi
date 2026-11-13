/* Project page: reads projects/<id>/project.json and draws its blocks.
   project.html?p=<folder name or address>   a project
   project.html?e=<id>                        a shelf link shown inside the site */
(function () {
  "use strict";
  var S = window.Site, esc = S.esc;
  var q = new URLSearchParams(location.search);
  var main = document.querySelector("[data-project]");

  /* Preview mode, used by the layout editor (layout.html): the editor sends the
     project as a message and this page draws it with the real styles. */
  var PREVIEW = q.get("preview") === "1" && window.parent !== window, selected = null;
  function markSelected() {
    [].forEach.call(document.querySelectorAll("[data-block]"), function (el) { el.classList.toggle("is-selected", el.dataset.block === String(selected)); });
  }

  S.getJSON("content/site.json").then(function (site) {
    S.renderChrome(site);
    return S.loadShelf(site).then(function (items) {
      if (PREVIEW) return startPreview(site, items);
      if (q.get("e")) return showEmbed(site, items, q.get("e"));
      var id = q.get("p");
      if (!id) { location.replace("index.html"); return; }
      var pos = items.findIndex(function (it) { return it.kind === "project" && it.id === id; });
      var base = S.projectBase(id);
      return S.getJSON(base + "project.json").then(function (p) {
        render(site, p, base, items, pos);
      });
    });
  }).catch(function (err) {
    console.error(err);
    main.innerHTML = '<p class="load-error">This project could not be found. <a href="index.html">Back to the shelf</a>.</p>';
  });

  function src(s, base) { return S.abs(s, base); }

  /* image shape and focus come from the block layout (see LAYOUT below) */
  var RATIOS = { "16/9": "16 / 9", "4/3": "4 / 3", "3/2": "3 / 2", "1/1": "1 / 1", "3/4": "3 / 4" };
  var FOCUS = { center: "50% 50%", top: "50% 0%", bottom: "50% 100%", left: "0% 50%", right: "100% 50%" };
  function imgStyle(l) {
    l = l || {};
    var r = RATIOS[l.ratio];
    return r ? ' style="aspect-ratio:' + r + ";object-fit:cover;object-position:" + (FOCUS[l.focus] || FOCUS.center) + '"' : "";
  }
  function figure(item, base, cls, l) {
    var u = src(item.src, base);
    return '<figure class="' + (cls || "") + '">' +
      '<a class="zoom" href="' + esc(u) + '" data-zoom><img src="' + esc(u) + '" alt="' + esc(item.alt || item.caption || "") + '" loading="lazy" decoding="async"' + imgStyle(l) + "></a>" +
      (item.caption ? "<figcaption>" + S.inline(item.caption) + "</figcaption>" : "") + "</figure>";
  }

  function videoHTML(b, base) {
    var y = b.youtube, v = b.vimeo;
    var ratio = esc(b.ratio || "16 / 9");
    if (y) return '<div class="frame" style="aspect-ratio:' + ratio + '"><iframe src="https://www.youtube-nocookie.com/embed/' + esc(y) + '" title="' + esc(b.caption || "Video") + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>';
    if (v) return '<div class="frame" style="aspect-ratio:' + ratio + '"><iframe src="https://player.vimeo.com/video/' + esc(v) + '" title="' + esc(b.caption || "Video") + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
    var auto = b.autoplay ? " autoplay muted loop playsinline" : " controls playsinline";
    return '<video src="' + esc(src(b.src, base)) + '"' + auto + (b.poster ? ' poster="' + esc(src(b.poster, base)) + '"' : "") + ' preload="metadata"></video>';
  }

  /* Each block type. Add a new one here and it can be used in any project.json. */
  var BLOCKS = {
    image: function (b, base) { return figure(b, base, "blk-image", b.layout); },
    gallery: function (b, base) {
      var cols = Math.max(1, Math.min(4, b.columns || 2));
      return '<div class="blk-gallery w-' + esc(b.width || "full") + '" style="--cols:' + cols + '">' +
        (b.items || []).map(function (it) { return figure(typeof it === "string" ? { src: it } : it, base, "", b.layout); }).join("") + "</div>" +
        (b.caption ? '<p class="blk-caption">' + S.inline(b.caption) + "</p>" : "");
    },
    text: function (b) {
      var l = b.layout || {};
      var cls = (l.text === "stacked" ? " is-stacked" : "") + (l.size && l.size !== "normal" ? " size-" + l.size : "") + (/^(center|right|justify)$/.test(l.textAlign || "") ? " align-" + l.textAlign : "");
      return '<section class="blk-text' + cls + '">' +
        (b.heading ? "<h2>" + esc(b.heading) + "</h2>" : "<span></span>") +
        '<div class="prose">' + S.md(b.body) + "</div></section>";
    },
    quote: function (b) {
      return '<blockquote class="blk-quote"><p>' + S.inline(b.text) + "</p>" + (b.by ? "<cite>" + esc(b.by) + "</cite>" : "") + "</blockquote>";
    },
    video: function (b, base) {
      return '<figure class="blk-video w-' + esc(b.width || "full") + '">' + videoHTML(b, base) +
        (b.caption ? "<figcaption>" + S.inline(b.caption) + "</figcaption>" : "") + "</figure>";
    },
    embed: function (b) {
      return '<figure class="blk-embed w-' + esc(b.width || "full") + '"><div class="frame" style="aspect-ratio:' + esc(b.ratio || "16 / 10") + '">' +
        '<iframe src="' + esc(b.url) + '" title="' + esc(b.caption || b.url) + '" loading="lazy" allowfullscreen></iframe></div>' +
        '<figcaption>' + (b.caption ? S.inline(b.caption) + " · " : "") + '<a href="' + esc(b.url) + '" target="_blank" rel="noopener">Open in a new tab</a></figcaption></figure>';
    },
    links: function (b) {
      return '<section class="blk-links">' + (b.heading ? "<h2>" + esc(b.heading) + "</h2>" : "<span></span>") + "<ul>" +
        (b.items || []).map(function (l) {
          return '<li><a href="' + esc(l.url) + '"' + S.linkAttrs(l.url) + ">" + esc(l.label || l.url) + ' <span aria-hidden="true">&#8599;</span></a></li>';
        }).join("") + "</ul></section>";
    },
    spacer: function () { return '<div class="blk-spacer"></div>'; }
  };

  /* ---------- layout ----------
     Blocks sit on a 12 column grid. A block's "layout" picks from fixed options,
     so a page cannot break on another screen size:
       width   full | wide | twothirds | half | third      (12, 10, 8, 6, 4 columns)
       align   start | center | end                        (where a row sits)
       beside  true to sit next to the block before, when it fits
       valign  start | center | end                        (inside a row)
       space   none | small | normal | large               (space above)
     Half screen and tablet: narrow blocks widen to half or full. Phone: everything
     stacks at full width. Those rules live in site.css, not in the content. */
  var SPANS = { full: 12, wide: 10, twothirds: 8, half: 6, third: 4 };
  var MID = { 12: 12, 10: 12, 8: 12, 6: 6, 4: 6 };
  var SPACE = { none: "14px", small: "32px", large: "clamp(96px, 15vh, 176px)" };
  function layoutOf(b) {
    var l = b.layout || {}, media = /^(image|gallery|video|embed)$/.test(b.type);
    var w = l.width || (media && b.width === "wide" ? "wide" : media && b.width === "text" ? "twothirds" : "full");
    return { span: SPANS[w] || 12, align: l.align || "start", beside: !!l.beside, valign: l.valign || "start", space: l.space || "normal" };
  }
  function startCol(align, total) { return total > 12 ? "auto" : align === "center" ? Math.floor((12 - total) / 2) + 1 : align === "end" ? 13 - total : 1; }
  function blocksHTML(p, base) {
    var rows = [], cur = null;
    (p.blocks || []).forEach(function (b, i) {
      if (!b || b.hidden || !BLOCKS[b.type]) { if (b && !BLOCKS[b.type]) console.warn("Unknown block type:", b.type); return; }
      var L = layoutOf(b);
      if (L.beside && cur && cur.total + L.span <= 12) { cur.cells.push({ b: b, i: i, L: L }); cur.total += L.span; }
      else { cur = { cells: [{ b: b, i: i, L: L }], total: L.span }; rows.push(cur); }
    });
    return rows.map(function (r) {
      var first = r.cells[0].L, totalM = r.cells.reduce(function (n, c) { return n + MID[c.L.span]; }, 0);
      var rowStyle = SPACE[first.space] ? ' style="--space:' + SPACE[first.space] + '"' : "";
      return '<div class="p-row"' + rowStyle + ">" + r.cells.map(function (c, k) {
        var st = "--sp:" + c.L.span + ";--sp-m:" + MID[c.L.span] + ";--va:" + c.L.valign;
        if (k === 0) st += ";--cs:" + startCol(first.align, r.total) + ";--cs-m:" + startCol(first.align, totalM);
        return '<div class="p-cell" data-block="' + c.i + '" style="' + st + '">' + BLOCKS[c.b.type](c.b, base) + "</div>";
      }).join("") + "</div>";
    }).join("");
  }

  /* buttons under the title: "actions": [{ "label": "Open the web app", "url": "https://..." }], the first one filled */
  function actionsHTML(list) {
    list = (list || []).filter(function (a) { return a && a.label && a.url; });
    if (!list.length) return "";
    return '<p class="p-actions">' + list.map(function (a, i) {
      return '<a class="p-action' + (i ? "" : " is-main") + '" href="' + esc(a.url) + '"' + S.linkAttrs(a.url) + ">" + esc(a.label) + ' <span aria-hidden="true">&#8599;</span></a>';
    }).join("") + "</p>";
  }

  function render(site, p, base, items, pos) {
    document.title = p.title + " · " + site.name;
    var meta = (p.meta || []).filter(function (m) { return m && m[1]; });
    var kicker = [p.category, p.year].filter(Boolean).map(esc).join(" · ");
    var pl = p.layout || {};

    var html =
      '<header class="p-head' + (pl.header === "center" ? " is-center" : "") + '" data-block="header">' +
      '<a class="p-back" href="index.html"><span aria-hidden="true">&#8592;</span> ' + (site.front === "contents" ? "Contents" : "Shelf") + "</a>" +
      (kicker ? '<div class="p-kicker">' + kicker + "</div>" : "") +
      '<h1 class="p-title">' + esc(p.title) + "</h1>" +
      (p.subtitle ? '<p class="p-sub">' + esc(p.subtitle) + "</p>" : "") +
      actionsHTML(p.actions) +
      "</header>" +
      '<div class="p-lede' + (pl.facts === "below" ? " facts-below" : "") + (pl.intro && pl.intro !== "normal" ? " intro-" + pl.intro : "") + (/^(center|right|justify)$/.test(pl.introAlign || "") ? " align-" + pl.introAlign : "") + '" data-block="intro">' +
      '<div class="prose p-intro">' + S.md(p.intro) + "</div>" +
      (meta.length ? '<dl class="p-meta">' + meta.map(function (m) { return "<div><dt>" + esc(m[0]) + "</dt><dd>" + S.inline(m[1]) + "</dd></div>"; }).join("") + "</dl>" : "") +
      "</div>" +
      '<div class="p-blocks">' + blocksHTML(p, base) + "</div>";

    if (pos > -1 && items.length > 1) {
      var next = items[(pos + 1) % items.length], prev = items[(pos - 1 + items.length) % items.length];
      html += '<nav class="p-next">' + pager(prev, "Previous") + pager(next, "Next") + "</nav>";
    }
    var y = window.scrollY;
    main.innerHTML = html;
    if (PREVIEW) { window.scrollTo(0, y); markSelected(); } else lightbox();
  }

  function startPreview(site, items) {
    document.body.classList.add("is-preview");
    var id = q.get("p"), pos = items.findIndex(function (it) { return it.kind === "project" && it.id === id; });
    window.addEventListener("message", function (e) {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === "works-layout") render(site, e.data.project, S.projectBase(id), items, pos);
      if (e.data.type === "works-layout-select") {
        selected = e.data.index; markSelected();
        var el = document.querySelector('[data-block="' + selected + '"]');
        if (el && e.data.scroll) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (a) e.preventDefault();
      var el = e.target.closest("[data-block]");
      if (el) { e.stopPropagation(); window.parent.postMessage({ type: "works-layout-pick", index: el.dataset.block }, location.origin); }
    }, true);
    window.parent.postMessage({ type: "works-layout-ready" }, location.origin);
  }

  function pager(it, label) {
    var ext = it.kind === "link" && it.open === "tab" ? S.linkAttrs(it.href) : "";
    return '<a class="pager pager-' + label.toLowerCase() + '" href="' + esc(it.href) + '"' + ext + ">" +
      '<span class="pager-label">' + label + "</span>" +
      '<span class="pager-title">' + esc(it.title) + "</span></a>";
  }

  function showEmbed(site, items, id) {
    var it = items.find(function (x) { return x.id === id; });
    if (!it) throw new Error("No shelf entry " + id);
    document.title = it.title + " · " + site.name;
    document.body.classList.add("is-embed");
    main.innerHTML =
      '<header class="p-head p-head-embed">' +
      '<a class="p-back" href="index.html"><span aria-hidden="true">&#8592;</span> ' + (site.front === "contents" ? "Contents" : "Shelf") + "</a>" +
      '<h1 class="p-title p-title-sm">' + esc(it.title) + "</h1>" +
      '<a class="p-out" href="' + esc(it.url) + '" target="_blank" rel="noopener">Open in a new tab <span aria-hidden="true">&#8599;</span></a></header>' +
      '<iframe class="embed-full" src="' + esc(it.url) + '" title="' + esc(it.title) + '"></iframe>';
  }

  /* Click any image for a full screen view; click again for full resolution. */
  function lightbox() {
    var links = [].slice.call(document.querySelectorAll("[data-zoom]"));
    if (!links.length) return;
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.hidden = true;
    box.innerHTML = '<div class="lb-scroll"><img alt=""></div>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Close">&#215;</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Previous image">&#8592;</button>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Next image">&#8594;</button>' +
      '<div class="lb-hint">Click the image to see it at full size</div>';
    document.body.appendChild(box);
    var img = box.querySelector("img"), scroller = box.querySelector(".lb-scroll"), at = 0, last = null;

    function show(i) {
      at = (i + links.length) % links.length;
      box.classList.remove("is-full");
      img.src = links[at].href;
      img.alt = links[at].querySelector("img").alt;
    }
    function open(i) { last = document.activeElement; show(i); box.hidden = false; document.body.classList.add("lb-open"); box.querySelector(".lb-close").focus(); }
    function close() { box.hidden = true; document.body.classList.remove("lb-open"); img.removeAttribute("src"); if (last) last.focus(); }

    links.forEach(function (a, i) { a.addEventListener("click", function (e) { e.preventDefault(); open(i); }); });
    box.querySelector(".lb-close").addEventListener("click", close);
    box.querySelector(".lb-prev").addEventListener("click", function () { show(at - 1); });
    box.querySelector(".lb-next").addEventListener("click", function () { show(at + 1); });
    box.querySelector(".lb-prev").hidden = box.querySelector(".lb-next").hidden = links.length < 2;
    img.addEventListener("click", function (e) {
      var full = !box.classList.contains("is-full");
      var r = img.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      box.classList.toggle("is-full", full);
      if (full) requestAnimationFrame(function () {
        scroller.scrollLeft = fx * scroller.scrollWidth - scroller.clientWidth / 2;
        scroller.scrollTop = fy * scroller.scrollHeight - scroller.clientHeight / 2;
      });
    });
    scroller.addEventListener("click", function (e) { if (e.target === scroller) close(); });
    document.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(at + 1);
      if (e.key === "ArrowLeft") show(at - 1);
    });
  }
})();
