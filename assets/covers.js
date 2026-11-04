/* Drawn book covers: small line animations in the manner of the Grasshopper
   Workflow Collection cards. Black ink, one orange live element, a slow orbit.
   A project picks its drawing with "art" in the shelf part of project.json:
     lego, flyover, healing, homestead, interior, graph
   Add a new drawing by adding an entry to ART below. */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function frac(x) { return x - Math.floor(x); }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* drawing items: lines and dots in 3D, z up */
  function L(pts, o) { var it = { kind: "line", pts: pts }; for (var k in o) it[k] = o[k]; return it; }
  function D(p, o) { var it = { kind: "dot", p: p }; for (var k in o) it[k] = o[k]; return it; }
  function box(c, s, o) {
    var x0 = c[0] - s[0] / 2, x1 = c[0] + s[0] / 2, y0 = c[1] - s[1] / 2, y1 = c[1] + s[1] / 2, z0 = c[2], z1 = c[2] + s[2];
    var oc = Object.assign({ closed: true }, o);
    return [
      L([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], oc),
      L([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], oc),
      L([[x0, y0, z0], [x0, y0, z1]], o), L([[x1, y0, z0], [x1, y0, z1]], o),
      L([[x1, y1, z0], [x1, y1, z1]], o), L([[x0, y1, z0], [x0, y1, z1]], o)
    ];
  }
  function circle(c, r, n) {
    var pts = [];
    for (var k = 0; k < n; k++) { var a = k / n * TAU; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]]); }
    return pts;
  }

  var ART = {};

  /* Lego City: modules stack on stilts over moving water, the newest one live */
  ART.lego = {
    view: { el: 0.5, spin: 0.08, zoom: 0.42, yc: 0.66 },
    init: function (s) {
      var R = rng(7), cells = [];
      for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
        var h = 1 + Math.floor(R() * 3);
        for (var k = 0; k < h; k++) cells.push([i, j, k, R()]);
      }
      cells.sort(function (a, b) { return a[2] - b[2] || a[3] - b[3]; });
      s.cells = cells;
    },
    step: function (t, s) {
      var out = [], m = 0.36, base = 0.16, cyc = 9, n = s.cells.length;
      var shown = Math.floor(smooth(frac(t / cyc) * 1.25) * n);
      for (var i = -2; i <= 2; i++) {                      // water
        var pts = [];
        for (var x = -1.3; x <= 1.3; x += 0.05) pts.push([x, i * 0.28, 0.015 * Math.sin(x * 9 + t * 1.6 + i)]);
        out.push(L(pts, { a: 0.28 }));
      }
      [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].forEach(function (p) {   // stilts
        out.push(L([[p[0] * m * 1.5, p[1] * m * 1.5, 0], [p[0] * m * 1.5, p[1] * m * 1.5, base]], { a: 0.6 }));
      });
      out.push.apply(out, box([0, 0, base - 0.01], [m * 3.2, m * 3.2, 0.01], { a: 0.5 }));   // deck
      for (var c = 0; c < shown; c++) {
        var q = s.cells[c], live = c === shown - 1;
        var drop = live ? (1 - smooth(frac(frac(t / cyc) * 1.25 * n))) * 0.25 : 0;
        out.push.apply(out, box([q[0] * m, q[1] * m, base + q[2] * m * 0.8 + drop], [m * 0.92, m * 0.92, m * 0.78],
          live ? { c: "accent", w: 1.4 } : { w: 1 }));
      }
      return out;
    }
  };

  /* Space Under Flyover: an elevated deck on piers; people walk the route beneath */
  ART.flyover = {
    view: { el: 0.42, spin: 0.07, zoom: 0.44, yc: 0.62 },
    step: function (t) {
      var out = [], z = 0.62, w = 0.24, len = 1.35;
      out.push(L([[-len, -w, z], [len, -w, z]], { w: 1.4 })); out.push(L([[-len, w, z], [len, w, z]], { w: 1.4 }));
      out.push(L([[-len, -w, z + 0.07], [len, -w, z + 0.07]], { a: 0.5 })); out.push(L([[-len, w, z + 0.07], [len, w, z + 0.07]], { a: 0.5 }));
      for (var x = -1.2; x <= 1.21; x += 0.4) {
        out.push(L([[x, 0, 0], [x, 0, z]], { w: 1.2 }));
        out.push(L([[x, -w, z], [x, w, z]], { a: 0.6 }));
      }
      for (var g = -1; g <= 1; g += 2) out.push(L([[-len, g * 0.5, 0], [len, g * 0.5, 0]], { a: 0.25 }));
      out.push(L([[-len, 0.12, 0], [len, 0.12, 0]], { a: 0.4, dash: [0.03, 0.03] }));
      out.push(L([[-len, -0.12, 0], [len, -0.12, 0]], { a: 0.4, dash: [0.03, 0.03] }));
      for (var p = -1; p <= 1.01; p += 0.8) out.push.apply(out, box([p, -0.36, 0], [0.22, 0.1, 0.07], { a: 0.55 }));  // planters
      for (var i = 0; i < 9; i++) {                                                             // people
        var u = frac(i / 9 + t * (i % 2 ? 0.035 : -0.03)), xx = lerp(-1.25, 1.25, u), yy = i % 2 ? 0.06 : -0.06;
        out.push(D([xx, yy, 0.0], { c: "accent", r: 2.2 }));
        out.push(L([[xx, yy, 0], [xx, yy, 0.09]], { c: "accent", w: 1.2 }));
      }
      return out;
    }
  };

  /* Natural Healing: a steel frame with planted walls; creepers grow and sway */
  ART.healing = {
    view: { el: 0.32, spin: 0.09, zoom: 0.34, yc: 0.86 },
    step: function (t) {
      var out = [], s = 0.42, H = 1.5;
      out.push.apply(out, box([0, 0, 0], [s * 2, s * 2, H], { w: 1.2 }));
      [0.55, 1.05].forEach(function (z) { out.push.apply(out, box([0, 0, z], [s * 2, s * 2, 0.001], { a: 0.5 })); });
      for (var i = 1; i < 8; i++) {                                     // vertical plantation trays
        var zz = i * H / 8;
        out.push(L([[-s, s, zz], [s, s, zz]], { a: 0.55 }));
      }
      for (var k = -3; k <= 3; k++) out.push(L([[k * s / 3.5, s, 0], [k * s / 3.5, s, H]], { a: 0.18 }));
      for (var c = 0; c < 9; c++) {                                     // creepers from the roof mesh
        var x = lerp(-s * 0.85, s * 0.85, c / 8), grow = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.5 + c * 1.3));
        var pts = [];
        for (var j = 0; j <= 12; j++) {
          var f = j / 12, zj = H - f * grow * H;
          pts.push([x + 0.03 * Math.sin(f * 6 + t * 1.2 + c), -s + 0.02 + 0.02 * f, zj]);
        }
        out.push(L(pts, { c: "accent", w: 1.1, a: 0.85 }));
        out.push(D(pts[pts.length - 1], { c: "accent", r: 1.8 }));
      }
      out.push(L([[-s * 1.6, -s * 1.6, 0], [s * 1.6, -s * 1.6, 0], [s * 1.6, s * 1.6, 0], [-s * 1.6, s * 1.6, 0]], { closed: true, a: 0.15 }));
      return out;
    }
  };

  /* Sundar Bari: round thatched huts on a mound; a cyclone wind sweeps past */
  ART.homestead = {
    view: { el: 0.4, spin: 0.06, zoom: 0.4, yc: 0.64 },
    step: function (t) {
      var out = [];
      [[-0.62, -0.25, 0.28], [0.42, -0.5, 0.32], [0.3, 0.55, 0.24]].forEach(function (h) {
        var c = [h[0], h[1], 0], r = h[2], wall = r * 0.75, eave = r * 1.3, apex = r * 2.0;
        out.push(L(circle(c, r, 40), { closed: true, w: 1.1 }));
        out.push(L(circle([c[0], c[1], wall], r, 40), { closed: true, a: 0.6 }));
        out.push(L(circle([c[0], c[1], wall], eave, 48), { closed: true, w: 1.2 }));
        for (var k = 0; k < 16; k++) {
          var a = k / 16 * TAU;
          out.push(L([[c[0] + Math.cos(a) * eave, c[1] + Math.sin(a) * eave, wall], [c[0], c[1], apex]], { a: 0.75 }));
          if (k % 2 === 0) out.push(L([[c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, 0], [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, wall]], { a: 0.35 }));
        }
      });
      var px = -0.55, py = 0.62, trunk = [];                                 // palm
      for (var i = 0; i <= 10; i++) { var f = i / 10; trunk.push([px + 0.12 * f * f, py, f * 1.15]); }
      out.push(L(trunk, { w: 1.2 }));
      var top = trunk[10];
      for (var fr = 0; fr < 7; fr++) {
        var ang = fr / 7 * TAU + 0.15 * Math.sin(t * 1.4 + fr), pts = [];
        for (var j = 0; j <= 8; j++) { var g = j / 8; pts.push([top[0] + Math.cos(ang) * 0.38 * g, top[1] + Math.sin(ang) * 0.38 * g, top[2] + 0.12 * g - 0.3 * g * g]); }
        out.push(L(pts, { a: 0.85 }));
      }
      for (var wv = 0; wv < 4; wv++) {                                       // wind
        var ph = frac(t * 0.12 + wv / 4), pts2 = [], rad = 1.1 - wv * 0.12;
        for (var q = 0; q <= 22; q++) { var u = q / 22, an = (ph * TAU) + u * 1.6; pts2.push([Math.cos(an) * rad, Math.sin(an) * rad, 0.5 + 0.25 * wv / 4 + 0.05 * Math.sin(u * 6)]); }
        out.push(L(pts2, { c: "accent", w: 1.2, a: 0.25 + 0.6 * Math.sin(Math.PI * ph) }));
      }
      out.push(L(circle([0, 0, 0], 1.2, 64), { closed: true, a: 0.15 }));
      return out;
    }
  };

  /* IDA Interior: a double height room; the sun patch moves across the floor */
  ART.interior = {
    view: { el: 0.34, spin: 0, zoom: 0.38, yc: 0.8, az: -0.55 },
    step: function (t) {
      var out = [], W = 1.1, Dp = 0.9, H = 1.5, az = -0.55 + 0.25 * Math.sin(t * 0.25);
      out.push(L([[-W, Dp, 0], [-W, -Dp, 0], [W, -Dp, 0]], { w: 1.2 }));            // floor edges
      out.push(L([[-W, Dp, 0], [-W, Dp, H]], { w: 1.2 })); out.push(L([[-W, -Dp, 0], [-W, -Dp, H]], { w: 1.2 }));
      out.push(L([[W, -Dp, 0], [W, -Dp, H]], { w: 1.2 }));
      out.push(L([[-W, Dp, H], [-W, -Dp, H], [W, -Dp, H]], { a: 0.5 }));
      out.push.apply(out, box([0.35, -Dp + 0.18, 0.78], [1.5, 0.36, 0.0001], { a: 0.6 })); // mezzanine
      var wx0 = -0.55, wx1 = 0.45;                                                       // tall window
      out.push(L([[wx0, -Dp, 0.05], [wx1, -Dp, 0.05], [wx1, -Dp, H - 0.08], [wx0, -Dp, H - 0.08]], { closed: true, w: 1.2 }));
      for (var m = 1; m < 4; m++) { var x = lerp(wx0, wx1, m / 4); out.push(L([[x, -Dp, 0.05], [x, -Dp, H - 0.08]], { a: 0.5 })); }
      for (var r = 1; r < 5; r++) { var z = lerp(0.05, H - 0.08, r / 5); out.push(L([[wx0, -Dp, z], [wx1, -Dp, z]], { a: 0.35 })); }
      out.push.apply(out, box([0.25, 0.15, 0], [0.6, 0.35, 0.36], { a: 0.55 }));            // table
      var sx = 0.25 * Math.sin(t * 0.35), dy = 0.55;                                    // sun patch
      var patch = [[wx0 + sx, -Dp + 0.05, 0.002], [wx1 + sx, -Dp + 0.05, 0.002], [wx1 + sx + 0.35, -Dp + dy + 0.6, 0.002], [wx0 + sx + 0.35, -Dp + dy + 0.6, 0.002]];
      out.push(L(patch, { closed: true, c: "accent", w: 1.3 }));
      for (var k = 0; k < 4; k++) {
        var u = (k + 0.5) / 4, a = [lerp(wx0, wx1, u), -Dp, H - 0.08], b = [lerp(patch[3][0], patch[2][0], u), patch[3][1], 0];
        out.push(L([a, b], { c: "accent", a: 0.35, dash: [0.03, 0.04], dashOff: -t * 0.06 }));
      }
      return { items: out, az: az - (-0.55) };
    }
  };

  /* Grasshopper Collection: components and wires in plan; data pulses along */
  ART.graph = {
    view: { el: Math.PI / 2, spin: 0, zoom: 0.4, yc: 0.5, az: 0 },
    init: function (s) {
      s.nodes = [[-0.95, 0.55], [-0.95, 0], [-0.95, -0.55], [-0.2, 0.3], [-0.2, -0.4], [0.5, 0.05], [0.5, -0.65], [1.05, -0.2]];
      s.wires = [[0, 3], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5], [4, 6], [5, 7], [6, 7]];
    },
    step: function (t, s) {
      var out = [], nw = 0.34, nh = 0.2;
      function port(i, side) { var n = s.nodes[i]; return [n[0] + side * nw / 2, n[1]]; }
      function curve(a, b) {
        var pts = [], dx = Math.max(0.15, (b[0] - a[0]) * 0.5);
        for (var k = 0; k <= 24; k++) {
          var u = k / 24, mt = 1 - u;
          var x = mt * mt * mt * a[0] + 3 * mt * mt * u * (a[0] + dx) + 3 * mt * u * u * (b[0] - dx) + u * u * u * b[0];
          var y = mt * mt * mt * a[1] + 3 * mt * mt * u * a[1] + 3 * mt * u * u * b[1] + u * u * u * b[1];
          pts.push([x, y, 0]);
        }
        return pts;
      }
      s.nodes.forEach(function (n, i) {
        var hot = Math.floor(t * 0.6) % s.nodes.length === i;
        out.push(L([[n[0] - nw / 2, n[1] - nh / 2, 0], [n[0] + nw / 2, n[1] - nh / 2, 0], [n[0] + nw / 2, n[1] + nh / 2, 0], [n[0] - nw / 2, n[1] + nh / 2, 0]],
          { closed: true, w: hot ? 1.4 : 1.1, c: hot ? "accent" : undefined }));
        out.push(L([[n[0] - nw / 2 + 0.06, n[1] - nh / 2, 0], [n[0] - nw / 2 + 0.06, n[1] + nh / 2, 0]], { a: 0.35 }));
        out.push(L([[n[0] + nw / 2 - 0.06, n[1] - nh / 2, 0], [n[0] + nw / 2 - 0.06, n[1] + nh / 2, 0]], { a: 0.35 }));
      });
      s.wires.forEach(function (w, i) {
        var pts = curve(port(w[0], 1), port(w[1], -1));
        out.push(L(pts, { a: 0.7 }));
        var u = frac(t * 0.35 + i * 0.23), p = pts[Math.round(u * 24)];
        out.push(D(p, { c: "accent", r: 2.1 }));
      });
      return out;
    }
  };

  var DEF = { az: -0.65, el: 0.5, spin: 0.08, zoom: 0.4, yc: 0.55 };
  var sketches = [], raf = null;

  function Sketch(canvas, type, i) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.gen = ART[type] || ART.graph; this.state = {};
    if (this.gen.init) this.gen.init(this.state);
    this.phase = i * 1.7; this.t0 = performance.now(); this.active = false;
    this.readColors(); this.resize();
  }
  Sketch.prototype.readColors = function () {
    var cs = getComputedStyle(this.canvas);
    this.ink = cs.getPropertyValue("--cover-ink").trim() || "#111";
    this.accent = cs.getPropertyValue("--cover-accent").trim() || "#c4512f";
    this.size = parseFloat(cs.getPropertyValue("--cover-art-scale")) || 0.5;
  };
  Sketch.prototype.resize = function () {
    // offset sizes ignore the 3D turn of the book, so a closed book still measures true
    var w = this.canvas.offsetWidth || 1, h = this.canvas.offsetHeight || 1, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
  };
  Sketch.prototype.draw = function (now) {
    var t = (now - this.t0) / 1000 + this.phase, v = Object.assign({}, DEF, this.gen.view);
    var res = this.gen.step(t, this.state), items = res, extra = 0;
    if (res && !Array.isArray(res)) { items = res.items; extra = res.az || 0; }
    var w = this.w, h = this.h, ctx = this.ctx, zoom = Math.min(w, h) * v.zoom * this.size;
    var az = v.az + v.spin * t + extra, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(v.el), se = Math.sin(v.el), cx = w / 2, cy = h * (0.5 + (v.yc - 0.5) * this.size);
    function pr(p) { var x1 = p[0] * ca - p[1] * sa, y1 = p[0] * sa + p[1] * ca; return [cx + x1 * zoom, cy - (p[2] * ce + y1 * se) * zoom]; }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var scale = clamp(w / 260, 0.8, 1.6);
    for (var i = 0; i < items.length; i++) {
      var it = items[i], col = it.c === "accent" ? this.accent : this.ink;
      ctx.globalAlpha = it.a === undefined ? 0.92 : it.a;
      if (it.kind === "dot") {
        var q = pr(it.p); ctx.beginPath(); ctx.arc(q[0], q[1], (it.r || 2) * scale, 0, TAU); ctx.fillStyle = col; ctx.fill(); continue;
      }
      var pts = it.pts; if (!pts || pts.length < 2) continue;
      ctx.beginPath(); var p0 = pr(pts[0]); ctx.moveTo(p0[0], p0[1]);
      for (var k = 1; k < pts.length; k++) { var pk = pr(pts[k]); ctx.lineTo(pk[0], pk[1]); }
      if (it.closed) ctx.closePath();
      ctx.strokeStyle = col; ctx.lineWidth = (it.w || 1) * scale;
      if (it.dash) { ctx.setLineDash(it.dash.map(function (d) { return d * zoom; })); ctx.lineDashOffset = (it.dashOff || 0) * zoom; } else ctx.setLineDash([]);
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  };

  function loop(now) {
    raf = null;
    if (document.hidden) return;
    var any = false;
    sketches.forEach(function (s) { if (s.active) { any = true; s.draw(now); } });
    if (any) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  window.Covers = {
    has: function (type) { return !!ART[type]; },
    mount: function (canvas, type, i) {
      var s = new Sketch(canvas, type, i || 0);
      sketches.push(s); s.draw(performance.now());
      return s;
    },
    /* only the open book animates; the rest keep their last frame */
    setActive: function (canvas) {
      sketches.forEach(function (s) { s.active = s.canvas === canvas; });
      kick();
    },
    refresh: function () {
      var now = performance.now();
      sketches.forEach(function (s) { s.readColors(); s.resize(); s.draw(now); });
      kick();
    },
    ART: ART
  };
  document.addEventListener("visibilitychange", kick);
})();
