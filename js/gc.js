/* Bajo Presión CG · GC de persona (v1)
   Diseño aprobado (mismo de After Effects): mini cronómetro, panel azul inclinado con canto,
   pestaña de rol, nombre en plata con extrusión violeta, línea de presión (azul > naranja > rojo) y remate de acento.
   Se dibuja en coordenadas 4K (3840x2160) dentro de un lienzo de 1920x1080. */
(function () {
  "use strict";
  var BP = window.BP = window.BP || {};
  var NS = "http://www.w3.org/2000/svg";
  var PX = 480, PY = 1790, PH = 170, SK = 42, NAME_X = 560, SWX = 390, GX0 = 500, GSEG = 26, GN = 42, GY = 1907;
  var BLUE = "#288CFF", ORA = "#FF8C1E", RED = "#DD1C16", ICE = "#BED7FF", SILVER = "#EDEDF4";
  var EASE = "cubic-bezier(.16,.84,.24,1)";

  function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag), k;
    for (k in attrs) { if (attrs.hasOwnProperty(k)) { e.setAttribute(k, attrs[k]); } }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function A(node, kf, o) { return node.animate(kf, Object.assign({ duration: 400, easing: EASE, fill: "both" }, o || {}, { duration: BP.dur((o && o.duration) || 400), delay: BP.dur((o && o.delay) || 0) })); }

  function GCPersona(layerEl) {
    this.svg = el("svg", { viewBox: "0 0 3840 2160", width: 1920, height: 1080 }, layerEl);
    this.svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
    this.root = el("g", {}, this.svg);
  }

  GCPersona.prototype.render = function (d) {
    var R = this.root, i, T = { tab: d.tab || BLUE, tabText: d.tabText || "#FFFFFF", cap: d.cap || ORA };
    // medir el nombre para ajustar el ancho del panel
    var nm = String(d.nombre || "").toUpperCase(), ro = String(d.etiqueta || "").toUpperCase();
    var nameG = el("g", {}, R);
    var n3 = el("text", { x: NAME_X + 6, y: PY + 52, "font-size": 124, fill: "#290B83" }, nameG); n3.textContent = nm;
    var n2 = el("text", { x: NAME_X + 3, y: PY + 49, "font-size": 124, fill: "#290B83" }, nameG); n2.textContent = nm;
    var n1 = el("text", { x: NAME_X, y: PY + 46, "font-size": 124, fill: SILVER }, nameG); n1.textContent = nm;
    var rol = el("text", { x: 560, y: 1691, "font-size": 46, "letter-spacing": 7, fill: T.tabText }, R); rol.textContent = ro;
    [n1, n2, n3, rol].forEach(function (t) { t.setAttribute("class", "gc-txt"); });
    var nw = n1.getComputedTextLength(), rw = rol.getComputedTextLength();
    var w = Math.max(1000, nw + 240), top = PY - PH / 2, bot = PY + PH / 2, tw = rw + 110, cx = PX + w;

    // orden de dibujo: línea de presión, panel, remate, pestaña, cronómetro, textos
    var gauge = el("g", {}, R), gt = [], gl = [], gred2 = null;
    R.insertBefore(gauge, nameG);
    for (i = 0; i < GN; i++) { gt.push(el("rect", { x: GX0 + i * GSEG, y: GY, width: 16, height: 10, fill: "#3C64C8", "fill-opacity": .3 }, gauge)); }
    var gA = el("g", {}, gauge); gred2 = el("g", {}, gauge);
    for (i = 0; i < GN; i++) { gl.push(el("rect", { x: GX0 + i * GSEG, y: GY, width: 16, height: 10, fill: i < 26 ? BLUE : (i < 36 ? ORA : RED) }, i >= 36 ? gred2 : gA)); }

    var panel = el("polygon", { points: pts([[PX, bot], [PX + w, bot], [PX + w + SK, top], [PX + SK, top]]), fill: "#0A143E", "fill-opacity": .94, stroke: BLUE, "stroke-width": 4, "stroke-opacity": .9 }, R);
    var cap = el("polygon", { points: pts([[cx, bot], [cx + 26, bot], [cx + 26 + SK, top], [cx + SK, top]]), fill: T.cap }, R);
    var tab = el("polygon", { points: pts([[500, 1705], [500 + tw, 1705], [500 + tw + 15, 1643], [515, 1643]]), fill: T.tab }, R);
    R.insertBefore(panel, nameG); R.insertBefore(cap, nameG); R.insertBefore(tab, nameG);

    // mini cronómetro
    var sw = el("g", {}, R); sw.style.transform = "translate(" + SWX + "px," + PY + "px)";
    el("circle", { r: 105, fill: "#080E2C", stroke: BLUE, "stroke-width": 6 }, sw);
    el("circle", { r: 84, fill: "none", stroke: ICE, "stroke-opacity": .35, "stroke-width": 14, "stroke-dasharray": "3 5.8" }, sw);
    var tks = [];
    for (i = 0; i < 60; i++) {
      var a = i * 6 * Math.PI / 180;
      tks.push(el("line", { x1: (77 * Math.sin(a)).toFixed(1), y1: (-77 * Math.cos(a)).toFixed(1), x2: (91 * Math.sin(a)).toFixed(1), y2: (-91 * Math.cos(a)).toFixed(1), stroke: BLUE, "stroke-width": 3.5 }, sw));
    }
    el("rect", { x: -27, y: -133, width: 54, height: 22, rx: 6, fill: "#141C50", stroke: ICE, "stroke-width": 3, "stroke-opacity": .85 }, sw);
    el("rect", { x: -11, y: -116, width: 22, height: 16, rx: 3, fill: "#141C50" }, sw);
    var needle = el("g", {}, sw);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -72, stroke: ORA, "stroke-width": 7, "stroke-linecap": "round" }, needle);
    el("circle", { r: 10, fill: "#fff" }, needle);
    var btn = el("g", {}, sw); el("circle", { cx: 0, cy: 112, r: 17, fill: RED, stroke: "#780810", "stroke-width": 4 }, btn);
    R.appendChild(sw); R.appendChild(nameG); R.appendChild(rol);

    this.parts = { panel: panel, cap: cap, tab: tab, sw: sw, tks: tks, needle: needle, btn: btn, gt: gt, gl: gl, gred2: gred2, nameG: nameG, rol: rol, capX: cx };
  };

  GCPersona.prototype.in = function () {
    var p = this.parts, swT = "translate(" + SWX + "px," + PY + "px) ";
    A(p.sw, [{ opacity: 0, transform: swT + "scale(.85)" }, { opacity: 1, transform: swT + "scale(1)" }], { duration: 450 });
    p.tks.forEach(function (t, i) { A(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: 50 + i / 60 * 800, easing: "linear" }); });
    p.needle.style.transformOrigin = "0 0";
    A(p.needle, [{ transform: "rotate(0deg)" }, { transform: "rotate(395deg)" }], { duration: 850, delay: 50 });
    p.gt.forEach(function (r, i) { A(r, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: 100 + i / GN * 500, easing: "linear" }); });
    p.gl.forEach(function (r, i) { A(r, [{ opacity: 0 }, { opacity: 1 }], { duration: 140, delay: 150 + i / GN * 700, easing: "linear" }); });
    A(p.gred2, [{ opacity: 1 }, { opacity: .55 }, { opacity: 1 }], { duration: 2400, delay: 1800, iterations: Infinity, easing: "ease-in-out" });
    p.panel.style.transformOrigin = PX + "px " + PY + "px";
    A(p.panel, [{ transform: "scaleX(0)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1 }], { duration: 500, delay: 120 });
    A(p.tab, [{ transform: "translateY(40px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 400, delay: 450 });
    A(p.rol, [{ transform: "translateY(40px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 400, delay: 500 });
    A(p.nameG, [{ transform: "translateX(-70px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 550, delay: 350 });
    p.cap.style.transformOrigin = p.capX + "px " + PY + "px";
    A(p.cap, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 330, delay: 620 });
    p.btn.style.transformOrigin = "0 112px";
    A(p.btn, [{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], { duration: 2400, delay: 1500, iterations: Infinity, easing: "ease-in-out" });
  };

  GCPersona.prototype.out = function () {
    var self = this;
    return new Promise(function (res) {
      var a = A(self.root, [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(-60px)" }], { duration: 450, easing: "cubic-bezier(.5,0,.75,0)" });
      a.onfinish = function () { self.destroy(); res(); };
    });
  };
  GCPersona.prototype.destroy = function () { if (this.svg && this.svg.parentNode) { this.svg.parentNode.removeChild(this.svg); } };

  BP.GCPersona = GCPersona;
})();
