/* Front page: the bookshelf carousel and the project index. */
(function () {
  "use strict";
  var S = window.Site, esc = S.esc;
  var AUTO_TONES = ["light", "dark", "mid"];

  S.getJSON("content/site.json").then(function (site) {
    S.renderChrome(site);
    document.title = site.name + (site.tagline ? ", " + site.tagline : "");
    return S.loadShelf(site).then(function (items) { build(site, items); });
  }).catch(function (err) {
    console.error(err);
    document.querySelector("[data-shelf]").innerHTML =
      '<p class="load-error">The site content could not be loaded. If you opened this file directly, run a small local server (see GUIDE.md).</p>';
  });

  function tone(item, i) {
    var t = item.shelf.tone;
    return t && t !== "auto" ? t : AUTO_TONES[i % AUTO_TONES.length];
  }

  function bookHTML(item, i, site) {
    var sh = item.shelf, t = tone(item, i);
    var style = sh.spineColor ? ' style="--spine-bg:' + esc(sh.spineColor) + (sh.spineInk ? ";--spine-ink:" + esc(sh.spineInk) : "") + '"' : "";
    var face = item.cover
      ? '<img src="' + esc(item.cover) + '" alt="" draggable="false" ' + (i < 4 ? "" : 'loading="lazy" ') + 'decoding="async">'
      : S.typeCover(item, site);
    return '<a class="book tone-' + esc(t) + '" href="' + esc(item.href) + '"' + S.linkAttrs(item.kind === "link" && item.open === "tab" ? item.href : "") +
      ' data-i="' + i + '" aria-label="' + esc(item.title) + '" draggable="false"' + style + ">" +
      '<span class="book-3d">' +
      '<span class="face spine"><span class="spine-title">' + esc(sh.spine || item.title) + "</span>" +
      (item.year ? '<span class="spine-foot">' + esc(item.year) + "</span>" : "") + "</span>" +
      '<span class="face cover">' + face + "</span>" +
      "</span></a>";
  }

  function build(site, items) {
    var root = document.querySelector("[data-shelf]");
    if (!items.length) { root.innerHTML = '<p class="load-error">No projects on the shelf yet.</p>'; return; }

    root.innerHTML =
      '<div class="shelf-head"><span class="shelf-rule"></span><h1 class="shelf-title">' + esc(site.shelfTitle || "Selected Work") + '</h1><span class="shelf-rule"></span></div>' +
      '<div class="stage" tabindex="0" aria-roledescription="carousel" aria-label="' + esc(site.shelfTitle || "Selected Work") + '">' +
      '<div class="track">' + items.map(function (it, i) { return bookHTML(it, i, site); }).join("") + "</div></div>" +
      '<div class="caption" aria-live="polite"></div>' +
      '<div class="controls">' +
      '<button type="button" class="ctl" data-prev aria-label="Previous">&#8592;</button>' +
      '<span class="count" data-count></span>' +
      '<button type="button" class="ctl" data-next aria-label="Next">&#8594;</button>' +
      '<button type="button" class="ctl ctl-play" data-play aria-label="Pause"></button>' +
      '<span class="progress"><span data-progress></span></span>' +
      "</div>" +
      '<span class="probe" aria-hidden="true"></span>';

    var probe = root.querySelector(".probe");
    var stage = root.querySelector(".stage"), track = root.querySelector(".track");
    var books = [].slice.call(track.children), caption = root.querySelector(".caption");
    var count = root.querySelector("[data-count]"), playBtn = root.querySelector("[data-play]");
    var bar = root.querySelector("[data-progress]");
    var n = items.length, active = 0, playing = (site.autoplaySeconds || 0) > 0;
    var delay = (site.autoplaySeconds || 3.5) * 1000, timer = null, hold = false, started = 0;

    function metrics() {
      var h = probe.offsetHeight, s = probe.offsetWidth;
      var cs = getComputedStyle(root);
      var ratio = parseFloat(cs.getPropertyValue("--cover-ratio")) || 0.74;
      var ang = (parseFloat(cs.getPropertyValue("--open-angle")) || 70) * Math.PI / 180;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return { s: s, c: h * ratio, gap: gap, cos: Math.cos(ang), sin: Math.sin(ang) };
    }

    /* shrink a spine title that is too long for its spine */
    function fitSpines() {
      books.forEach(function (b) {
        var t = b.querySelector(".spine-title");
        t.style.fontSize = "";
        var size = parseFloat(getComputedStyle(t).fontSize), min = size * 0.62;
        while (t.scrollHeight > t.clientHeight + 1 && size > min) { size -= 0.5; t.style.fontSize = size + "px"; }
      });
    }

    function layout() {
      var m = metrics();
      var A = m.s * m.cos + m.c * m.sin;
      root.style.setProperty("--open-w", A + "px");
      root.style.setProperty("--open-shift", (m.s * (m.cos - 1)) + "px");
      var center = active * (m.s + m.gap) + A / 2;
      track.style.transform = "translate3d(" + (stage.clientWidth / 2 - center) + "px,0,0)";
    }

    function renderCaption() {
      var it = items[active];
      var meta = [it.category, it.year].filter(Boolean).map(esc).join(" · ");
      var label = it.kind === "link" ? (it.open === "embed" ? "Open" : "Visit site") : "Open project";
      caption.innerHTML =
        '<div class="cap-meta">' + meta + "</div>" +
        '<a class="cap-title" href="' + esc(it.href) + '"' + (it.kind === "link" && it.open === "tab" ? S.linkAttrs(it.href) : "") + ">" + esc(it.title) + "</a>" +
        (it.subtitle ? '<div class="cap-sub">' + esc(it.subtitle) + "</div>" : "") +
        '<a class="cap-open" href="' + esc(it.href) + '"' + (it.kind === "link" && it.open === "tab" ? S.linkAttrs(it.href) : "") + ">" + label + ' <span aria-hidden="true">&#8594;</span></a>';
      caption.classList.remove("in"); void caption.offsetWidth; caption.classList.add("in");
      count.textContent = S.pad(active) + " / " + S.pad(n - 1);
    }

    function go(i, user) {
      active = (i + n) % n;
      books.forEach(function (b, k) {
        b.classList.toggle("is-active", k === active);
        b.setAttribute("tabindex", k === active ? "0" : "-1");
      });
      layout();
      renderCaption();
      if (user) restart();
    }

    function tick() {
      if (!playing || hold || document.hidden) { started = 0; bar.style.transform = "scaleX(0)"; return; }
      var now = performance.now();
      if (!started) started = now;
      var p = (now - started) / delay;
      if (p >= 1) { started = now; p = 0; go(active + 1); }
      bar.style.transform = "scaleX(" + p + ")";
    }
    function loop() { tick(); timer = requestAnimationFrame(loop); }
    function restart() { started = 0; }
    function setPlaying(v) {
      playing = v; restart();
      playBtn.classList.toggle("is-paused", !v);
      playBtn.setAttribute("aria-label", v ? "Pause" : "Play");
    }

    track.addEventListener("click", function (e) {
      var b = e.target.closest(".book");
      if (!b) return;
      if (dragged) { e.preventDefault(); return; }
      var i = +b.dataset.i;
      if (i !== active) { e.preventDefault(); go(i, true); }
    });
    root.querySelector("[data-prev]").addEventListener("click", function () { go(active - 1, true); });
    root.querySelector("[data-next]").addEventListener("click", function () { go(active + 1, true); });
    playBtn.addEventListener("click", function () { setPlaying(!playing); });
    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(active + 1, true); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(active - 1, true); e.preventDefault(); }
    });
    stage.addEventListener("mouseenter", function () { hold = true; });
    stage.addEventListener("mouseleave", function () { hold = false; });

    // swipe or drag to move along the shelf
    var x0 = null, dragged = false;
    stage.addEventListener("pointerdown", function (e) { x0 = e.clientX; dragged = false; });
    stage.addEventListener("pointermove", function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0;
      if (Math.abs(dx) > 40) { dragged = true; go(active + (dx < 0 ? 1 : -1), true); x0 = e.clientX; }
    });
    window.addEventListener("pointerup", function () { x0 = null; setTimeout(function () { dragged = false; }, 0); });

    var rz;
    window.addEventListener("resize", function () {
      track.classList.add("no-anim");
      fitSpines();
      layout();
      clearTimeout(rz);
      rz = setTimeout(function () { track.classList.remove("no-anim"); }, 120);
    });

    track.classList.add("no-anim");
    go(0);
    setPlaying(playing);
    requestAnimationFrame(function () { requestAnimationFrame(function () { track.classList.remove("no-anim"); root.classList.add("ready"); }); });
    fitSpines();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitSpines(); layout(); });
    loop();

    if (site.showIndex !== false) buildIndex(items);
  }

  function buildIndex(items) {
    var box = document.querySelector("[data-index]");
    if (!box) return;
    box.innerHTML = '<h2 class="index-title">Index</h2><ol class="index-list">' + items.map(function (it, i) {
      var ext = it.kind === "link" && it.open === "tab" ? S.linkAttrs(it.href) : "";
      return '<li><a href="' + esc(it.href) + '"' + ext + ">" +
        '<span class="ix-n">' + S.pad(i) + "</span>" +
        '<span class="ix-t">' + esc(it.title) + "</span>" +
        '<span class="ix-s">' + esc(it.subtitle || "") + "</span>" +
        '<span class="ix-c">' + esc(it.category || "") + "</span>" +
        '<span class="ix-y">' + esc(it.year || "") + "</span></a></li>";
    }).join("") + "</ol>";
  }
})();
