/* Book effect editor: sliders from a flat block to a full book, previewed on
   the real front page. Saves site.json "book". Changes stay in this browser
   until downloaded. */
(function () {
  "use strict";

  var S = window.Site, esc = S.esc, B = S.BOOK;
  var DRAFT_KEY = "works-book-draft-v1";
  var DEVICES = [
    { id: "desktop", label: "Desktop", w: 1440, h: 900 },
    { id: "laptop", label: "Laptop", w: 1280, h: 800 },
    { id: "tablet", label: "Tablet", w: 820, h: 1180 },
    { id: "phone", label: "Phone", w: 390, h: 844 }
  ];
  var GROUPS = [
    { title: "Opening", fields: [
      ["angle", "Turn of the open book", "°", "90 shows the cover flat, like a card; lower turns it more, showing more spine."],
      ["depth", "Perspective", "", "0 is flat and drawn straight on; 100 is deep, near perspective."]] },
    { title: "Surface", fields: [
      ["edge", "Spine edge fillet", "", "Thin darker strips at the spine edges."],
      ["curve", "Rounded spine", "", "Light across the spine, as on a round-backed book."],
      ["crease", "Cover crease", "", "Shading where the cover meets the spine."],
      ["shadow", "Floor shadow", "", "Soft shadow under the open book."],
      ["radius", "Corner rounding", " px", "Rounds the outer corners of spine and cover."]] },
    { title: "Proportion and motion", fields: [
      ["spine", "Spine width", "%", "Percent of the normal width."],
      ["cover", "Cover width", "%", "Cover width as percent of its height. 74 is a typical book."],
      ["gap", "Space between books", "", "Percent of the book height."],
      ["lift", "Lift on hover", " px", "How far a spine rises under the pointer."],
      ["speed", "Turning time", " s", "Seconds for a book to open."]] }
  ];
  var STEP = { speed: 0.05 };
  var PRESETS = [["Block", 0], ["Soft", 35], ["Book", 65], ["Full book", 100]];

  var st = { site: null, live: {}, book: {}, effect: 65, hist: [], future: [], device: "desktop", ready: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function pretty(x) { return JSON.stringify(x, null, 2) + "\n"; }

  /* the master slider: 0 flat block, 65 the designed default, 100 full book */
  function fromEffect(m) {
    var hi = Math.max(0, (m - 65) / 35);
    return {
      angle: Math.round(90 - 0.4 * m), depth: Math.round(Math.min(100, m * 1.46)), edge: Math.round(Math.min(100, m * 1.54)),
      curve: Math.round(hi * 70), crease: Math.round(Math.min(100, m * 1.54)), shadow: Math.round(Math.min(100, m * 1.54)),
      lift: Math.round(m * 0.123), radius: Math.round(hi * 3 * 10) / 10
    };
  }
  /* keep only values that differ from the defaults */
  function tidy(b) {
    var v = S.bookValues(b), out = {};
    Object.keys(B).forEach(function (k) { if (Math.abs(v[k] - B[k].def) > 1e-9) out[k] = v[k]; });
    return out;
  }
  function siteWith(b) { var s = JSON.parse(JSON.stringify(st.site)), t = tidy(b); if (Object.keys(t).length) s.book = t; else delete s.book; return s; }
  function changed() { return pretty(siteWith(st.book)) !== pretty(siteWith(st.live)); }

  window.GH.read("content/site.json").then(function (t) { if (t == null) throw new Error("content/site.json not found"); return JSON.parse(t); }).then(function (site) {
    if (site.repo) window.GH.setFallbackRepo(site.repo);
    st.site = site; st.live = tidy(site.book || {}); st.book = JSON.parse(JSON.stringify(st.live));
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d && d.book) { st.book = d.book; st.device = d.device || st.device; if (changed()) toast("Restored your unsaved book effect changes"); }
    } catch (e) {}
    st.effect = guessEffect();
    buildTop(); drawSide(); status();
    $("[data-preview]").src = "index.html?bookpreview=1";
    fitFrame();
  }).catch(function (err) {
    $("[data-side]").innerHTML = '<p class="m-error">Could not load the site (' + esc(err.message) + ").</p>";
  });

  function guessEffect() {
    // the master position whose values are closest to the current ones
    var v = S.bookValues(st.book), best = 65, err = Infinity;
    for (var m = 0; m <= 100; m++) {
      var f = fromEffect(m), e = 0;
      Object.keys(f).forEach(function (k) { e += Math.abs(f[k] - v[k]) / (B[k].max - B[k].min); });
      if (e < err) { err = e; best = m; }
    }
    return best;
  }

  function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ book: tidy(st.book), device: st.device })); } catch (e) {} status(); }
  function status() {
    var c = changed(), el = $("[data-status]");
    el.textContent = c ? "Unsaved changes" : "No changes"; el.classList.toggle("has-changes", c);
    $("[data-undo]").disabled = !st.hist.length; $("[data-redo]").disabled = !st.future.length;
  }
  function snapshot() { st.hist.push(JSON.stringify(st.book)); if (st.hist.length > 200) st.hist.shift(); st.future = []; }
  function send() {
    var w = $("[data-preview]").contentWindow;
    if (w && st.ready) w.postMessage({ type: "works-book", book: S.bookValues(st.book) }, location.origin);
  }
  window.addEventListener("message", function (e) {
    if (e.origin === location.origin && e.data && e.data.type === "works-book-ready") { st.ready = true; send(); }
  });

  function buildTop() {
    var T = window.SITE_THEMES;
    $("[data-devices]").innerHTML = DEVICES.map(function (d) { return '<button type="button" data-device="' + d.id + '">' + d.label + "</button>"; }).join("");
    $$("[data-device]").forEach(function (b) { b.onclick = function () { st.device = b.dataset.device; saveDraft(); fitFrame(); }; });
    $("[data-themes]").innerHTML = Object.keys(T.THEMES).map(function (k) { return '<button type="button" data-theme="' + k + '" aria-pressed="' + (k === T.current) + '">' + esc(T.THEMES[k]) + "</button>"; }).join("");
    $$("[data-theme]").forEach(function (b) {
      b.onclick = function () {
        T.set(b.dataset.theme);
        var w = $("[data-preview]").contentWindow;
        if (w && w.SITE_THEMES) w.SITE_THEMES.set(b.dataset.theme);
      };
    });
    window.addEventListener("site-theme", function (e) { $$("[data-theme]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.theme === e.detail)); }); });
    $("[data-undo]").onclick = function () { if (!st.hist.length) return; st.future.push(JSON.stringify(st.book)); st.book = JSON.parse(st.hist.pop()); st.effect = guessEffect(); drawSide(); saveDraft(); send(); };
    $("[data-redo]").onclick = function () { if (!st.future.length) return; st.hist.push(JSON.stringify(st.book)); st.book = JSON.parse(st.future.pop()); st.effect = guessEffect(); drawSide(); saveDraft(); send(); };
    $("[data-revert]").onclick = function () { snapshot(); st.book = JSON.parse(JSON.stringify(st.live)); st.effect = guessEffect(); drawSide(); saveDraft(); send(); toast("Back to the published book effect"); };
    $("[data-download]").onclick = download;
    $("[data-publish]").onclick = publishNow;
    window.GH.button($("[data-gh]"));
    document.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (document.activeElement.tagName === "INPUT" && document.activeElement.type === "number") return;
      e.preventDefault(); $(e.shiftKey ? "[data-redo]" : "[data-undo]").click();
    });
    window.addEventListener("resize", fitFrame);
  }

  function fitFrame() {
    var d = DEVICES.filter(function (x) { return x.id === st.device; })[0] || DEVICES[0];
    $$("[data-device]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.device === d.id)); });
    var stage = $("[data-stage]"), frame = $("[data-frame]"), iframe = $("[data-preview]");
    var k = Math.min(1, (stage.clientWidth - 48) / d.w, (stage.clientHeight - 70) / d.h);
    iframe.style.width = d.w + "px"; iframe.style.height = d.h + "px"; iframe.style.transform = "scale(" + k + ")";
    frame.style.width = d.w * k + "px"; frame.style.height = d.h * k + "px";
    $("[data-device-label]").textContent = d.label + " · " + d.w + " px wide" + (k < 1 ? " · shown at " + Math.round(k * 100) + "%" : "") + " · click books to turn them";
  }

  function slider(key, label, unit, hint) {
    var d = B[key], v = S.bookValues(st.book)[key], step = STEP[key] || (key === "radius" ? 0.5 : 1);
    var own = Math.abs(v - d.def) > 1e-9;
    return '<div class="c-field' + (own ? " is-own" : "") + '"><span class="m-label"><span>' + esc(label) + "</span></span>" +
      '<div class="c-slider"><input type="range" min="' + d.min + '" max="' + d.max + '" step="' + step + '" value="' + v + '" data-k="' + key + '" aria-label="' + esc(label) + '">' +
      '<input type="number" min="' + d.min + '" max="' + d.max + '" step="' + step + '" value="' + v + '" data-n="' + key + '" aria-label="' + esc(label) + ' value">' +
      '<button type="button" class="c-reset" data-reset="' + key + '" title="Back to the designed value (' + d.def + unit.trim() + ')"' + (own ? "" : " disabled") + ">&#8634;</button></div>" +
      '<span class="m-hint">' + esc(hint) + "</span></div>";
  }

  function drawSide() {
    var side = $("[data-side]"), keep = side.scrollTop;
    side.innerHTML =
      '<div class="l-sec"><div class="l-sec-head"><h2>Book effect</h2></div>' +
      '<p class="m-hint">From a flat block to a full book. The master slider moves every surface setting together; the sliders below fine tune each one. 65 is the look the site was designed with.</p>' +
      '<div class="c-field b-master"><span class="m-label"><span>Block</span><span>Book</span></span>' +
      '<div class="c-slider"><input type="range" min="0" max="100" step="1" value="' + st.effect + '" data-master aria-label="Book effect">' +
      '<input type="number" min="0" max="100" step="1" value="' + st.effect + '" data-mastern aria-label="Book effect value"><span></span></div></div>' +
      '<div class="l-seg b-presets">' + PRESETS.map(function (p) { return '<label><input type="radio" name="preset" value="' + p[1] + '"' + (st.effect === p[1] ? " checked" : "") + "><span>" + p[0] + "</span></label>"; }).join("") + "</div></div>" +
      GROUPS.map(function (g) {
        return '<div class="l-sec"><h3 class="l-h3">' + esc(g.title) + "</h3>" + g.fields.map(function (f) { return slider(f[0], f[1], f[2], f[3]); }).join("") + "</div>";
      }).join("");
    side.scrollTop = keep;

    var dragging = {};
    function master(m, commit) {
      m = Math.max(0, Math.min(100, Math.round(+m)));
      if (!dragging.master || commit) { snapshot(); dragging.master = true; }
      st.effect = m;
      var f = fromEffect(m); Object.keys(f).forEach(function (k) { st.book[k] = f[k]; });
      $("[data-master]").value = m; $("[data-mastern]").value = m;
      $$("[data-k]", side).forEach(function (r) { var v = S.bookValues(st.book)[r.dataset.k]; r.value = v; $('[data-n="' + r.dataset.k + '"]', side).value = v; });
      saveDraft(); send();
    }
    $("[data-master]").addEventListener("input", function () { master(this.value); });
    $("[data-master]").addEventListener("change", function () { dragging.master = false; drawSide(); });
    $("[data-mastern]").addEventListener("change", function () { master(this.value, true); dragging.master = false; drawSide(); });
    $$('input[name="preset"]', side).forEach(function (r) { r.onchange = function () { master(r.value, true); dragging.master = false; drawSide(); }; });

    function put(k, val) {
      var d = B[k], n = Math.max(d.min, Math.min(d.max, parseFloat(val)));
      if (isNaN(n)) return;
      st.book[k] = n;
      $('[data-k="' + k + '"]', side).value = n; $('[data-n="' + k + '"]', side).value = n;
      var own = Math.abs(n - d.def) > 1e-9;
      $('[data-k="' + k + '"]', side).closest(".c-field").classList.toggle("is-own", own);
      $('[data-reset="' + k + '"]', side).disabled = !own;
      saveDraft(); send();
    }
    $$("[data-k]", side).forEach(function (r) {
      r.addEventListener("input", function () { if (!dragging[r.dataset.k]) { snapshot(); dragging[r.dataset.k] = true; } put(r.dataset.k, r.value); });
      r.addEventListener("change", function () { dragging[r.dataset.k] = false; });
    });
    $$("[data-n]", side).forEach(function (n) { n.addEventListener("change", function () { snapshot(); put(n.dataset.n, n.value); }); });
    $$("[data-reset]", side).forEach(function (b) { b.onclick = function () { snapshot(); delete st.book[b.dataset.reset]; drawSide(); saveDraft(); send(); }; });
  }

  function download() {
    if (!changed()) { toast("Nothing has changed yet"); return; }
    var entries = [
      { name: "content/site.json", data: new TextEncoder().encode(pretty(siteWith(st.book))) },
      { name: "UPLOAD-NOTES.txt", data: new TextEncoder().encode("Upload the content folder in this zip to the root of the repository (Add file, Upload files), then commit.\nIt replaces content/site.json; only the \"book\" settings changed.\nIf another tool has unsaved changes to site.json, upload those first, then reopen this tool.\n") }
    ];
    var d = new Date(), stamp = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(window.Zip.make(entries)); a.download = "works-book-" + stamp + ".zip";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Downloaded. Upload the content folder on GitHub, then commit.");
  }
  function toast(msg) {
    var t = document.createElement("div"); t.className = "m-toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 3400); setTimeout(function () { t.remove(); }, 4000);
  }
  /* this tool owns only "book" in site.json */
  function publishNow() {
    if (!changed()) { toast("Nothing has changed yet"); return; }
    var mine = tidy(st.book), merged = null;
    window.GH.publish({
      title: "Publish the book effect",
      message: "Book effect settings",
      build: function () {
        return window.GH.read("content/site.json").then(function (t) {
          var remote = JSON.parse(t), plan = { files: [], conflicts: [], notes: [] };
          if (pretty(tidy(remote.book || {})) !== pretty(tidy(st.live))) plan.conflicts.push("The book effect in content/site.json was changed on GitHub");
          merged = remote;
          if (Object.keys(mine).length) merged.book = mine; else delete merged.book;
          if (pretty(merged) !== t) plan.files.push({ path: "content/site.json", text: pretty(merged), why: "Book effect only" });
          return plan;
        });
      },
      done: function () { st.site = merged; st.live = JSON.parse(JSON.stringify(mine)); saveDraft(); }
    });
  }

  window.BookEditor = { state: st, fromEffect: fromEffect };
})();
