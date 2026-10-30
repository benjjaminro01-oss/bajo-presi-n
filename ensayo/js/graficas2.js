/* Bajo Presión CG · gráficas del hito 3 (v4)
   Placa de resultado (CORRECTO, INCORRECTO, ELIMINADO, +10 PUNTOS...), cuenta regresiva funcional, marcador funcional,
   transiciones animadas (barrido, flash, iris) y video con chroma (WebGL). Misma línea gráfica que el GC aprobado. */
(function () {
  "use strict";
  var BP = window.BP = window.BP || {};
  var NS = "http://www.w3.org/2000/svg";
  var BLUE = "#288CFF", ORA = "#FF8C1E", RED = "#DD1C16", ICE = "#BED7FF", SILVER = "#EDEDF4", CIAN = "#50C3FF", NAVY = "#06112B", GOLD = "#FDB919";
  var EASE = "cubic-bezier(.16,.84,.24,1)";

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag), k;
    for (k in attrs) { if (attrs.hasOwnProperty(k)) { e.setAttribute(k, attrs[k]); } }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function A(node, kf, o) { return node.animate(kf, Object.assign({ easing: EASE, fill: "both" }, o || {}, { duration: BP.dur((o && o.duration) || 400), delay: BP.dur((o && o.delay) || 0) })); }
  function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }
  function restart(e, cls) { e.classList.remove(cls); void e.getBoundingClientRect(); e.classList.add(cls); }

  // medidor de texto compartido
  var medSvg = null, medTxt = null;
  function medir(str, size, weight, ls) {
    if (!medSvg) { medSvg = el("svg", { width: 10, height: 10, style: "position:absolute;visibility:hidden;left:-9999px" }, document.body); medTxt = el("text", { x: 0, y: 0 }, medSvg); medTxt.style.fontFamily = '"Avenir Next","Avenir Next Heavy","Helvetica Neue","Arial Black",Impact,sans-serif'; medTxt.style.fontStyle = "italic"; }
    medTxt.setAttribute("font-size", size); medTxt.style.fontWeight = weight; medTxt.setAttribute("letter-spacing", ls || 0); medTxt.textContent = str;
    return medTxt.getComputedTextLength();
  }

  /* ====================================================================
     PLACA DE RESULTADO
     datos: { texto, icono: check|cross|none, color, duracion (ms; se retira sola) }
     ==================================================================== */
  function Placa(layer, datos) {
    this.svg = el("svg", { viewBox: "0 0 1920 1080", width: 1920, height: 1080 }, layer);
    this.svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
    this.root = el("g", {}, this.svg);
    var d = datos, txt = String(d.texto || "").toUpperCase(), col = d.color || CIAN, R = this.root;
    var tw = medir(txt, 86, 900, 2), h = 170, bw = d.icono === "none" ? 40 : 170, w = Math.max(720, tw + bw + 150), sk = 40, x0 = (1920 - w) / 2, y0 = 440 - h / 2;
    el("polygon", { points: pts([[x0, y0 + h], [x0 + w, y0 + h], [x0 + w + sk, y0], [x0 + sk, y0]]), fill: "#0A143E", "fill-opacity": .95, stroke: col, "stroke-width": 4 }, R);
    this.acc = el("polygon", { points: pts([[x0, y0 + h], [x0 + bw, y0 + h], [x0 + bw + sk, y0], [x0 + sk, y0]]), fill: col }, R);
    var cx = x0 + bw / 2 + sk / 2, cy = y0 + h / 2;
    if (d.icono === "check") { el("path", { d: "M" + (cx - 34) + " " + (cy + 4) + " L" + (cx - 12) + " " + (cy + 28) + " L" + (cx + 34) + " " + (cy - 26), fill: "none", stroke: NAVY, "stroke-width": 15, "stroke-linecap": "round", "stroke-linejoin": "round" }, R); }
    if (d.icono === "cross") { el("path", { d: "M" + (cx - 26) + " " + (cy - 26) + " L" + (cx + 26) + " " + (cy + 26) + " M" + (cx + 26) + " " + (cy - 26) + " L" + (cx - 26) + " " + (cy + 26), fill: "none", stroke: "#fff", "stroke-width": 15, "stroke-linecap": "round" }, R); }
    this.ring = el("circle", { cx: cx, cy: cy, r: 60, fill: "none", stroke: col, "stroke-width": 8, opacity: 0 }, R);
    var t = el("text", { x: x0 + bw + sk + 56, y: cy + 31, "font-size": 86, fill: "#fff", "letter-spacing": 2 }, R); t.textContent = txt;
    t.style.fontFamily = '"Avenir Next","Avenir Next Heavy","Helvetica Neue","Arial Black",Impact,sans-serif'; t.style.fontWeight = 900; t.style.fontStyle = "italic";
    this.txt = t; this.cx = cx; this.cy = cy; this.autoMs = +d.duracion || 0;
  }
  Placa.prototype.in = function () {
    this.root.style.transformOrigin = "960px 440px";
    A(this.root, [{ transform: "scale(.82)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 380 });
    A(this.txt, [{ transform: "translateX(-30px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 420, delay: 160 });
    A(this.acc, [{ opacity: .4 }, { opacity: 1 }], { duration: 500, delay: 100 });
    this.ring.style.transformOrigin = this.cx + "px " + this.cy + "px";
    A(this.ring, [{ transform: "scale(1)", opacity: .85 }, { transform: "scale(3.2)", opacity: 0 }], { duration: 800, delay: 150, easing: "ease-out" });
  };
  Placa.prototype.out = function () {
    var self = this;
    return new Promise(function (res) {
      var a = A(self.root, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.94)" }], { duration: 300, easing: "ease-in" });
      a.onfinish = function () { if (self.svg.parentNode) { self.svg.parentNode.removeChild(self.svg); } res(); };
    });
  };
  BP.Placa = Placa;

  /* ====================================================================
     CUENTA REGRESIVA (funcional). Estado compartido: state/cuenta/<canal>/<gid> = { id, status, duration, remaining }
     La salida calcula con su propio reloj; la salida AIRE marca "finished" al llegar a 0.
     ==================================================================== */
  var N = 60, CX = 300, CY = 340, RA = 198, CIRC = 2 * Math.PI * RA, RAD = 5;
  function pt(r, deg) { var a = deg * Math.PI / 180; return [CX + r * Math.sin(a), CY - r * Math.cos(a)]; }

  function Cuenta(layer, datos, ctx) {
    var self = this, sc = +datos.escala || 0.42, pos = datos.posicion || "br", w = 600 * sc, h = 660 * sc;
    this.ctx = ctx; this.datos = datos;
    this.wrap = document.createElement("div"); this.wrap.className = "cu-wrap"; this.wrap.style.width = w + "px"; this.wrap.style.height = h + "px";
    this.wrap.style.left = (pos.indexOf("l") >= 0 ? 60 : 1920 - 60 - w) + "px"; this.wrap.style.top = (pos.indexOf("t") >= 0 ? 55 : 1080 - 55 - h) + "px";
    var html = '<svg viewBox="0 0 600 660" width="600" height="660" style="transform:scale(' + sc + ');transform-origin:0 0">' +
      '<defs><filter id="cuBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter></defs>' +
      '<circle class="glow" cx="300" cy="340" r="290" fill="' + BLUE + '" opacity=".3" filter="url(#cuBlur)"/>' +
      '<circle class="hair" cx="300" cy="340" r="285" fill="none" stroke="' + BLUE + '" stroke-width="4" stroke-opacity=".6"/>' +
      '<circle class="disc" cx="300" cy="340" r="262" fill="#080E2C" fill-opacity=".95" stroke="' + BLUE + '" stroke-width="6" stroke-opacity=".85"/><g class="ticks">';
    var i, a, p1, p2, mj;
    for (i = 0; i < N; i++) { mj = i % 5 === 0; a = i * 6; p1 = pt(mj ? 210 : 224, a); p2 = pt(250, a); html += '<line class="tk' + (mj ? " mj" : "") + '" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '" stroke-width="' + (mj ? 8 : 5) + '"/>'; }
    html += '</g><circle cx="300" cy="340" r="198" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="12"/>' +
      '<circle class="arc" cx="300" cy="340" r="198" fill="none" stroke="' + BLUE + '" stroke-width="12"/>' +
      '<g class="head"><circle cx="300" cy="142" r="17" fill="' + ORA + '" fill-opacity=".4"/><circle cx="300" cy="142" r="8" fill="#fff"/></g>' +
      '<circle class="shock" cx="300" cy="340" r="285" fill="none" stroke="' + RED + '" stroke-width="8"/><circle class="flash" cx="300" cy="340" r="262" fill="#fff"/>' +
      '<text class="num" x="300" y="412" font-size="200" text-anchor="middle" fill="#EDEDF4">5</text>' +
      '<rect x="282" y="34" width="36" height="30" rx="6" fill="#141C50"/><rect x="238" y="4" width="124" height="38" rx="12" fill="#141C50" stroke="' + ICE + '" stroke-width="4" stroke-opacity=".85"/>' +
      '<circle cx="300" cy="625" r="27" fill="' + RED + '" stroke="#780810" stroke-width="5"/></svg>';
    this.wrap.innerHTML = html; layer.appendChild(this.wrap);
    var q = function (c) { return self.wrap.querySelector(c); };
    this.glow = q(".glow"); this.hair = q(".hair"); this.disc = q(".disc"); this.arc = q(".arc"); this.head = q(".head"); this.num = q(".num"); this.shock = q(".shock"); this.flash = q(".flash");
    this.ticks = Array.prototype.slice.call(this.wrap.querySelectorAll(".tk"));
    this.num.style.fontFamily = '"Avenir Next","Avenir Next Heavy","Helvetica Neue","Arial Black",Impact,sans-serif'; this.num.style.fontWeight = 900; this.num.style.fontStyle = "italic";
    this.status = "idle"; this.duration = +datos.duracion || 5; this.remaining = this.duration; this.t0 = 0; this.runId = null; this.phase = ""; this.curLit = -1; this.lastShown = null; this.forceT = true; this.dead = false;
    this.ac = null;
    this.tick = function () { if (self.dead) { return; } self.render(); requestAnimationFrame(self.tick); };
    requestAnimationFrame(this.tick);
  }
  Cuenta.prototype.path = function () { return "state/cuenta/" + this.ctx.canal + "/" + this.ctx.gid; };
  Cuenta.prototype.live = function (tree) {
    var run = BP.getPath(tree, this.path());
    if (!run) { if (this.runId !== null) { this.runId = null; this.status = "idle"; this.remaining = this.duration = +this.datos.duracion || 5; this.lastShown = null; this.forceT = true; } return; }
    if (run.id === this.runId) { return; }
    this.runId = run.id; this.duration = +run.duration || this.duration;
    if (run.status === "running") { this.status = "running"; this.remaining = +run.remaining; this.t0 = performance.now(); }
    else { this.status = run.status; this.remaining = run.status === "finished" ? 0 : +run.remaining; }
    this.lastShown = null; this.forceT = true; this.finishedFx = run.status === "finished";
  };
  Cuenta.prototype.rem = function () { if (this.status === "running") { return Math.max(0, this.remaining - (performance.now() - this.t0) / 1000); } if (this.status === "finished") { return 0; } return this.remaining; };
  Cuenta.prototype.beep = function (f, d, type, vol) {
    if (!this.ctx.sonido || this.datos.sonido === false) { return; }
    try { if (!this.ac) { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } if (this.ac.state === "suspended") { this.ac.resume(); }
      var o = this.ac.createOscillator(), g = this.ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, this.ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + d); o.connect(g); g.connect(this.ac.destination); o.start(); o.stop(this.ac.currentTime + d); } catch (e) {}
  };
  Cuenta.prototype.render = function () {
    var rem = this.rem(), dur = Math.max(0.001, this.duration), fin = this.status === "finished" || (this.status === "running" && rem <= 0);
    var frac = Math.min(1, Math.max(0, rem / dur)), el0 = (1 - frac) * 360;
    var ph = fin ? "red" : (rem <= Math.min(2, dur * 0.3) ? "red" : (frac > 0.5 ? "blue" : "ora"));
    if (ph !== this.phase) {
      this.phase = ph; this.forceT = true; var c = ph === "blue" ? BLUE : (ph === "ora" ? ORA : "#FF3B30");
      this.arc.setAttribute("stroke", c); this.disc.setAttribute("stroke", c); this.hair.setAttribute("stroke", c); this.glow.setAttribute("fill", c); this.num.setAttribute("fill", ph === "red" ? "#FFB3AD" : "#EDEDF4");
    }
    this.arc.setAttribute("stroke-dasharray", (frac * CIRC).toFixed(2) + " " + CIRC.toFixed(2)); this.arc.setAttribute("transform", "rotate(" + (el0 - 90).toFixed(2) + " 300 340)");
    this.head.setAttribute("transform", "rotate(" + el0.toFixed(2) + " 300 340)"); this.head.style.opacity = (frac <= 0.0005 && !fin) ? 0 : 1;
    var lit = fin ? 0 : Math.ceil((1 - frac) * N - 1e-6);
    if (lit !== this.curLit || this.forceT) {
      var c2 = ph === "blue" ? BLUE : (ph === "ora" ? ORA : "#FF3B30"), k, t;
      for (k = 0; k < N; k++) { t = this.ticks[k]; if (k >= lit) { t.setAttribute("stroke", t.classList.contains("mj") && !fin ? SILVER : c2); t.setAttribute("stroke-opacity", 1); } else { t.setAttribute("stroke", "#789AE6"); t.setAttribute("stroke-opacity", .22); } }
      this.curLit = lit; this.forceT = false;
    }
    var shown = Math.max(0, Math.ceil(rem - 1e-6));
    if (shown !== this.lastShown) {
      this.num.textContent = shown;
      if (this.lastShown !== null && this.status === "running" && shown > 0) { restart(this.num, "cu-pop"); if (shown <= 3) { this.beep(1100, 0.07, "square", 0.1); } }
      this.lastShown = shown;
    }
    if (this.status === "running" && rem <= 0) {                       // llegó a 0
      this.status = "finished"; this.finishFx();
      if (this.ctx.escribe) { var p = this.path(); if (this.ctx.store.get(p + "/id") === this.runId) { this.ctx.store.set(p + "/status", "finished"); } }
    } else if (this.finishedFx) { this.finishedFx = false; this.wrap.classList.add("fin"); }
    this.wrap.classList.toggle("paused", this.status === "paused"); if (this.status !== "finished") { this.wrap.classList.remove("fin"); }
  };
  Cuenta.prototype.finishFx = function () {
    this.wrap.classList.add("fin"); restart(this.shock, "cu-go"); restart(this.flash, "cu-go"); this.num.classList.remove("cu-pop"); restart(this.num, "cu-shake");
    this.beep(180, 0.75, "sawtooth", 0.28); this.beep(135, 0.75, "square", 0.18);
  };
  Cuenta.prototype.in = function () { this.wrap.animate([{ opacity: 0, transform: "scale(.85)" }, { opacity: 1, transform: "scale(1)" }], { duration: BP.dur(500), easing: EASE, fill: "both" }); };
  Cuenta.prototype.out = function () {
    var self = this; this.dead = true;
    return new Promise(function (res) {
      var a = self.wrap.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.9)" }], { duration: BP.dur(320), fill: "both" });
      a.onfinish = function () { if (self.wrap.parentNode) { self.wrap.parentNode.removeChild(self.wrap); } res(); };
    });
  };
  BP.Cuenta = Cuenta;

  /* ====================================================================
     MARCADOR (funcional). Estado compartido: state/marcador = { p1:{n,pts,out,color}, p2:{...} }
     ==================================================================== */
  var WP = 600, BH = 190, SK = 45, ROWS = [47, 143];
  function sx(y) { return SK * (1 - y / BH); }
  BP.MARCADOR_DEF = { p1: { n: "P1", pts: 0, out: false, color: CIAN }, p2: { n: "P2", pts: 0, out: false, color: ORA } };

  function Marcador(layer, datos) {
    this.svg = el("svg", { viewBox: "0 0 3840 2160", width: 1920, height: 1080 }, layer); this.svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
    var X0 = +datos.x || 240, Y0 = +datos.y || 150, R = this.root = el("g", { transform: "translate(" + X0 + " " + Y0 + ")" }, this.svg);
    this.g = el("g", {}, R); var g = this.g, i;
    this.panel = el("polygon", { points: pts([[0, BH], [WP, BH], [WP + SK, 0], [SK, 0]]), fill: "#0A143E", "fill-opacity": .94, stroke: BLUE, "stroke-width": 3, "stroke-opacity": .85 }, g);
    this.content = el("g", {}, g);
    var gy = BH - 9, gxa = 108 + sx(gy), gxb = WP - 22 + sx(gy), gmid = gxa + (gxb - gxa) * 0.88;
    this.gauge = el("g", {}, this.content);
    el("line", { x1: gxa, y1: gy, x2: gmid, y2: gy, stroke: BLUE, "stroke-width": 4, "stroke-dasharray": "10 7" }, this.gauge);
    el("line", { x1: gmid, y1: gy, x2: gxb, y2: gy, stroke: RED, "stroke-width": 4, "stroke-dasharray": "10 7" }, this.gauge);
    el("line", { x1: 108 + sx(BH / 2), y1: BH / 2, x2: WP - 20 + sx(BH / 2), y2: BH / 2, stroke: ICE, "stroke-opacity": .22, "stroke-width": 2 }, this.content);
    var wx = 48 + sx(BH / 2), wy = BH / 2, wg = el("g", { transform: "translate(" + wx + " " + wy + ")" }, this.content);
    el("circle", { r: 38, fill: "#080E2C", stroke: BLUE, "stroke-width": 4 }, wg); el("circle", { r: 29, fill: "none", stroke: ICE, "stroke-opacity": .55, "stroke-width": 8, "stroke-dasharray": "2 3.06" }, wg);
    el("rect", { x: -10, y: -47.5, width: 20, height: 9, rx: 3, fill: "#141C50" }, wg);
    var hand = el("g", {}, wg); el("line", { x1: 0, y1: 0, x2: 0, y2: -26, stroke: ORA, "stroke-width": 3.5, "stroke-linecap": "round" }, hand); el("circle", { r: 4.5, fill: "#fff" }, hand);
    var an = document.createElementNS(NS, "animateTransform"); an.setAttribute("attributeName", "transform"); an.setAttribute("type", "rotate"); an.setAttribute("from", "35"); an.setAttribute("to", "395"); an.setAttribute("dur", "30s"); an.setAttribute("repeatCount", "indefinite"); hand.appendChild(an);
    el("circle", { cx: 0, cy: 42, r: 7, fill: RED }, wg);
    this.rows = [];
    for (i = 0; i < 2; i++) {
      var yc = ROWS[i], s = sx(yc), xr = WP - 30 + s, rg = el("g", {}, this.content), r = { yc: yc };
      r.flash = el("polygon", { points: pts([[114 + sx(yc - 38), yc - 38], [585 + sx(yc - 38), yc - 38], [585 + sx(yc + 38), yc + 38], [114 + sx(yc + 38), yc + 38]]), fill: "#fff", opacity: 0 }, rg);
      r.bar = el("polygon", { points: pts([[102 + sx(yc + 32), yc + 32], [108 + sx(yc + 32), yc + 32], [108 + sx(yc - 32), yc - 32], [102 + sx(yc - 32), yc - 32]]), fill: "#fff" }, rg);
      r.rowc = el("g", {}, rg); r.dot = el("circle", { cx: 136 + s, cy: yc, r: 13, fill: "#fff" }, r.rowc);
      r.name = el("text", { x: 170 + s, y: yc + 16, "font-size": 44, fill: SILVER }, r.rowc);
      r.score = el("text", { x: xr, y: yc + 23, "font-size": 64, "text-anchor": "end", fill: SILVER }, r.rowc); r.score.setAttribute("class", "mk-score");
      r.delta = el("text", { x: xr - 135, y: yc + 12, "font-size": 34, "text-anchor": "end", fill: GOLD, opacity: 0 }, rg);
      [r.name, r.score, r.delta].forEach(function (t) { t.style.fontFamily = '"Avenir Next","Avenir Next Heavy","Helvetica Neue","Arial Black",Impact,sans-serif'; t.style.fontWeight = 900; t.style.fontStyle = "italic"; });
      r.shown = 0; r.target = null; r.raf = 0; this.rows.push(r);
    }
    this.cap = el("polygon", { points: pts([[WP, BH], [WP + 14, BH], [WP + 14 + SK, 0], [WP + SK, 0]]), fill: ORA }, g);
    this.first = true;
  }
  Marcador.prototype.live = function (tree) {
    var m = BP.getPath(tree, "state/marcador") || BP.MARCADOR_DEF, a = (m.p1 || BP.MARCADOR_DEF.p1).pts | 0, b = (m.p2 || BP.MARCADOR_DEF.p2).pts | 0, self = this;
    [m.p1 || BP.MARCADOR_DEF.p1, m.p2 || BP.MARCADOR_DEF.p2].forEach(function (p, i) {
      var r = self.rows[i], nm = String(p.n || "").toUpperCase(), pts0 = p.pts | 0;
      if (r.name.textContent !== nm) { r.name.textContent = nm; r.name.removeAttribute("textLength"); if (r.name.getComputedTextLength() > 230) { r.name.setAttribute("textLength", 230); r.name.setAttribute("lengthAdjust", "spacingAndGlyphs"); } }
      var col = p.color || (i ? ORA : CIAN); r.dot.setAttribute("fill", col); r.bar.setAttribute("fill", col); r.flash.setAttribute("fill", col);
      r.rowc.style.opacity = p.out ? 0.35 : 1;
      var lead = i === 0 ? a > b : b > a, tie = a === b; r.bar.style.opacity = (lead ? 1 : (tie ? 0.55 : 0.2)) * (p.out ? 0.35 : 1);
      if (r.target === null || self.first) { r.target = pts0; r.shown = pts0; r.score.textContent = pts0; }
      else if (pts0 !== r.target) {
        var d = pts0 - r.target, from = r.shown; r.target = pts0; cancelAnimationFrame(r.raf);
        var t0 = performance.now(); (function step(now) { var k = Math.min(1, (now - t0) / 550), e = 1 - Math.pow(1 - k, 3); r.shown = Math.round(from + (pts0 - from) * e); r.score.textContent = r.shown; if (k < 1) { r.raf = requestAnimationFrame(step); } })(t0);
        restart(r.score, "mk-pop"); r.flash.style.opacity = 0; r.flash.animate([{ opacity: .4 }, { opacity: 0 }], { duration: 700, easing: "ease-out" });
        r.delta.textContent = (d > 0 ? "+" : "") + d; r.delta.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, offset: .1, transform: "translateY(0)" }, { opacity: 1, offset: .62 }, { opacity: 0 }], { duration: 1600, easing: "ease-out" });
      }
    });
    this.first = false;
  };
  Marcador.prototype.in = function () {
    var self = this; this.panel.style.transformOrigin = "0 0";
    A(this.panel, [{ transform: "scaleX(0)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1 }], { duration: 550, delay: 0 });
    A(this.content, [{ opacity: 0, transform: "translateX(-40px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: 300 });
    this.cap.style.transformOrigin = (WP + SK) + "px 0"; A(this.cap, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 350, delay: 600 });
  };
  Marcador.prototype.out = function () {
    var self = this;
    return new Promise(function (res) {
      var a = A(self.g, [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(-60px)" }], { duration: 450, easing: "cubic-bezier(.5,0,.75,0)" });
      a.onfinish = function () { if (self.svg.parentNode) { self.svg.parentNode.removeChild(self.svg); } res(); };
    });
  };
  BP.Marcador = Marcador;

  /* ====================================================================
     TRANSICIONES ANIMADAS: barrido | flash | iris   (con texto opcional)
     t = { anim, color, color2, duracion (ms), corte (ms: momento en que la pantalla está tapada) }
     Devuelve una promesa que termina al final; llama a aplicar() en el corte.
     ==================================================================== */
  BP.playAnim = function (layer, t, texto, aplicar) {
    return new Promise(function (res) {
      var d = BP.dur(+t.duracion || 900), c = BP.dur(Math.min(+t.corte || (d * 0.45), +t.duracion || 900)), box = document.createElement("div"), done = false;
      box.className = "tr-box"; layer.appendChild(box);
      var c1 = t.color || "#1B2A49", c2 = t.color2 || ORA, f = Math.max(0.05, Math.min(0.9, c / d));
      if (t.anim === "flash") {
        var fl = document.createElement("div"); fl.className = "tr-flash"; fl.style.background = "radial-gradient(circle at 50% 50%, #fff 0%, " + c1 + " 55%, " + c1 + " 100%)"; box.appendChild(fl);
        fl.animate([{ opacity: 0 }, { opacity: 1, offset: f }, { opacity: 0 }], { duration: d, easing: "ease-in-out", fill: "both" });
      } else if (t.anim === "iris") {
        var ir = document.createElement("div"); ir.className = "tr-iris"; ir.style.background = c1; ir.style.borderColor = c2; box.appendChild(ir);
        ir.animate([{ clipPath: "circle(0% at 50% 50%)", opacity: 1 }, { clipPath: "circle(78% at 50% 50%)", opacity: 1, offset: f }, { clipPath: "circle(78% at 50% 50%)", opacity: 1, offset: Math.min(.97, f + .25) }, { clipPath: "circle(78% at 50% 50%)", opacity: 0 }], { duration: d, easing: "ease-in-out", fill: "both" });
      } else {
        [[c2, 0], [c1, 70]].forEach(function (b) {
          var bar = document.createElement("div"); bar.className = "tr-bar"; bar.style.background = b[0]; box.appendChild(bar);
          bar.animate([{ transform: "translateX(-125%) skewX(-12deg)" }, { transform: "translateX(0%) skewX(-12deg)", offset: f }, { transform: "translateX(0%) skewX(-12deg)", offset: Math.min(.95, f + .12) }, { transform: "translateX(125%) skewX(-12deg)" }], { duration: d, delay: b[1], easing: "cubic-bezier(.65,0,.35,1)", fill: "both" });
        });
      }
      if (texto) {
        var tx = document.createElement("div"); tx.className = "tr-text"; tx.textContent = String(texto).toUpperCase(); box.appendChild(tx);
        tx.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 0, offset: Math.max(0, f - .05), transform: "scale(.9)" }, { opacity: 1, offset: Math.min(.9, f + .08), transform: "scale(1)" }, { opacity: 1, offset: Math.min(.97, f + .3) }, { opacity: 0 }], { duration: d, fill: "both" });
      }
      setTimeout(function () { if (!done) { done = true; Promise.resolve(aplicar && aplicar()); } }, c);
      setTimeout(function () { if (!done) { done = true; Promise.resolve(aplicar && aplicar()); } if (box.parentNode) { box.parentNode.removeChild(box); } res(); }, d + 120);
    });
  };

  /* ====================================================================
     VIDEO CON CHROMA (WebGL). Si WebGL falla, se muestra el video tal cual.
     ==================================================================== */
  function hex2rgb(h) { h = String(h || "#00ff00").replace("#", ""); if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; } return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }
  BP.chromaCanvas = function (video, cfg) {
    var cv = document.createElement("canvas"); cv.width = 1920; cv.height = 1080; cv.className = "video-el";
    var gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true }) || cv.getContext("experimental-webgl", { premultipliedAlpha: true, alpha: true });
    if (!gl) { return null; }
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, "attribute vec2 p; varying vec2 v; void main(){ v=vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position=vec4(p,0.0,1.0);}");
    var fs = sh(gl.FRAGMENT_SHADER, "precision mediump float; varying vec2 v; uniform sampler2D t; uniform vec3 key; uniform float sim; uniform float smo;" +
      "vec2 cc(vec3 c){ return vec2(-0.169*c.r-0.331*c.g+0.5*c.b, 0.5*c.r-0.419*c.g-0.081*c.b); }" +
      "void main(){ vec4 c=texture2D(t,v); float d=distance(cc(c.rgb),cc(key)); float a=smoothstep(sim,sim+smo,d);" +
      " vec3 rgb=c.rgb; rgb.g=min(rgb.g, mix(rgb.g,(rgb.r+rgb.b)*0.5,1.0-a)); gl_FragColor=vec4(rgb*a,a); }");
    if (!vs || !fs) { return null; }
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { return null; } gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    var k = hex2rgb(cfg.color); gl.uniform3f(gl.getUniformLocation(pr, "key"), k[0], k[1], k[2]);
    gl.uniform1f(gl.getUniformLocation(pr, "sim"), +cfg.similitud || 0.32); gl.uniform1f(gl.getUniformLocation(pr, "smo"), +cfg.suavidad || 0.08);
    gl.viewport(0, 0, 1920, 1080); gl.clearColor(0, 0, 0, 0);
    var alive = true;
    function draw() {
      if (!alive) { return; }
      if (video.readyState >= 2) { gl.bindTexture(gl.TEXTURE_2D, tex); try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } catch (e) {} }
      if (video.requestVideoFrameCallback) { video.requestVideoFrameCallback(draw); } else { requestAnimationFrame(draw); }
    }
    cv.stopChroma = function () { alive = false; };
    draw();
    return cv;
  };
})();
