/* Front page, "contents" layout: a row of numbered cards on a faint grid, each
   with a light grey block and a live line drawing, a title and up to three short
   lines. Chosen with "front": "contents" in content/site.json (the other choice is
   "shelf", the bookshelf). ?front=shelf or ?front=contents in the address previews
   either one without changing anything.

   site.json "contents": {
     "title": "Contents",
     "cards": [{ "id", "title", "art", "lines": ["...", "..."], "works": ["work id", ...], "url": "" }]
   }
   A card with one work opens it; with several it opens index.html?group=<id>,
   which shows those works as cards; with a url it opens that address; with
   nothing it shows as in preparation. */
(function () {
  "use strict";
  var S = window.Site, esc = S.esc;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function external(it) { return it.kind === "link" && it.open === "tab" ? S.linkAttrs(it.href) : ""; }

  /* card data -> { title, art, lines, href, ext } */
  function fromCard(card, byId) {
    var ws = (card.works || []).map(function (id) { return byId[id]; }).filter(Boolean);
    var href = "", ext = "";
    if (card.url) { href = card.url; ext = S.linkAttrs(card.url); }
    else if (ws.length === 1) { href = ws[0].href; ext = external(ws[0]); }
    else if (ws.length > 1) href = "index.html?group=" + encodeURIComponent(card.id);
    var lines = (card.lines || []).filter(function (l) { return l && String(l).trim(); });
    if (!href && !lines.length) lines = ["In preparation"];
    return { id: card.id, title: card.title || "", art: card.art || "web", lines: lines, href: href, ext: ext, count: ws.length };
  }
  function fromWork(it) {
    var lines = [it.category, it.year].filter(Boolean);
    return { id: it.id, title: it.title, art: (it.shelf && it.shelf.art) || "web", lines: lines, href: it.href, ext: external(it) };
  }

  function cardHTML(c, i) {
    var tag = c.href ? "a" : "div";
    return "<" + tag + ' class="ct-card' + (c.href ? "" : " is-soon") + (i % 2 ? " is-even" : "") + '"' +
      (c.href ? ' href="' + esc(c.href) + '"' + c.ext : "") + ' data-i="' + i + '">' +
      '<span class="ct-fig"><span class="ct-block"></span><span class="ct-num">' + (i + 1) + ".</span>" +
      '<canvas class="ct-canvas" data-art="' + esc(c.art) + '" aria-hidden="true"></canvas></span>' +
      '<span class="ct-title">' + esc(c.title) + "</span>" +
      '<span class="ct-lines">' + c.lines.map(function (l) { return "<span>" + esc(l) + "</span>"; }).join("") + "</span>" +
      "</" + tag + ">";
  }

  function build(site, works, groupId) {
    var root = document.querySelector("[data-contents]");
    var shelf = document.querySelector("[data-shelf]");
    if (shelf) shelf.hidden = true;
    root.hidden = false;
    document.body.classList.add("front-contents");
    var conf = site.contents || {}, byId = {};
    works.forEach(function (w) { byId[w.id] = w; });
    var cards, heading, group = null;
    if (groupId) group = (conf.cards || []).filter(function (c) { return c.id === groupId; })[0];
    if (group) {
      cards = (group.works || []).map(function (id) { return byId[id]; }).filter(Boolean).map(fromWork);
      heading = '<a class="ct-back" href="index.html"><span aria-hidden="true">&#8592;</span> ' + esc(conf.title || "Contents") + "</a>" +
        '<h1 class="ct-head">' + esc(group.title) + "</h1>";
      document.title = group.title + " · " + site.name;
    } else {
      cards = (conf.cards || []).map(function (c) { return fromCard(c, byId); });
      heading = '<h1 class="ct-head">' + esc(conf.title || "Contents") + "</h1>";
    }
    if (!cards.length) { root.innerHTML = heading + '<p class="load-error">No cards yet. Add them in the site manager, Front page.</p>'; return; }
    root.innerHTML = '<div class="ct-wrap">' + heading + '<div class="ct-grid">' + cards.map(cardHTML).join("") + "</div></div>";

    if (!window.Covers) return;
    var canvases = [].slice.call(root.querySelectorAll(".ct-canvas"));
    canvases.forEach(function (c, i) {
      var cs = S.coverStyle(site, cards[i].id);
      window.Covers.mount(c, window.Covers.has(c.dataset.art) ? c.dataset.art : "web", i, cs);
      if (!reduced) window.Covers.activate(c);
    });
    var rz;
    window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { window.Covers.refresh(); }, 80); });
    window.addEventListener("site-theme", function () { window.Covers.refresh(); });
  }

  /* which front page to show: ?front= overrides site.json "front"; a group link always uses contents */
  function choose(site) {
    var q = new URLSearchParams(location.search);
    if (q.get("group")) return "contents";
    var f = q.get("front") || site.front || "shelf";
    return f === "contents" ? "contents" : "shelf";
  }

  window.Contents = { build: build, choose: choose };
})();
