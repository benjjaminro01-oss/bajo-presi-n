/* Bajo Presión CG · motor de la SALIDA (v1)
   Lee el estado compartido (state/aire, o state/preview con ?canal=preview) y dibuja las gráficas.
   No depende de que el panel esté abierto: el estado vive en el Store (localStorage o Firebase).
   Reglas:
     - Una gráfica por "capa" (gc, logo, video...): la nueva reemplaza a la anterior.
     - Si la gráfica trae transición ("via"), primero entra la transición y el cambio ocurre en el punto de corte.
     - Si algún dato es PENDIENTE_..., la gráfica NO se muestra (se informa al panel en state/estado/<capa>).
*/
(function () {
  "use strict";
  var BP = window.BP;
  var P = BP.params(), canal = P.canal === "preview" ? "preview" : "aire", escribe = !P.monitor;   // los monitores del panel solo miran
  var store = BP.createStore(P);
  var cfg = BP.DEFAULT_CONFIG, want = {}, actual = {}, cola = Promise.resolve();
  var $ = function (id) { return document.getElementById(id); };
    var capas = { logo: $("capa-logo"), gc: $("capa-gc"), video: $("capa-video") }, capaTrans = $("capa-trans");

  // ---------- lienzo 1920x1080 escalado al tamaño de la fuente de navegador
  function fit() { $("stage").style.transform = "scale(" + Math.min(innerWidth / 1920, innerHeight / 1080) + ")"; }
  addEventListener("resize", fit); fit();
  if (P.fondo) { document.body.className = "fondo-" + P.fondo; }

  // ---------- gráfica: logo de esquina
  function Logo(layer, datos) {
    var img = document.createElement("img"), pos = datos.posicion || "tr", w = +datos.ancho || 210;
    img.src = (cfg.programa && cfg.programa.logo) || "assets/logo.png"; img.className = "logo-img"; img.style.width = w + "px";
    if (pos.indexOf("l") >= 0) { img.style.left = "60px"; } else { img.style.right = "60px"; }
    if (pos.indexOf("b") >= 0) { img.style.bottom = "50px"; } else { img.style.top = "45px"; }
    layer.appendChild(img); this.el = img;
  }
  Logo.prototype.in = function () { this.el.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "scale(1)" }], { duration: BP.dur(450), easing: "cubic-bezier(.16,.84,.24,1)", fill: "both" }); };
  Logo.prototype.out = function () {
    var self = this;
    return new Promise(function (res) {
      var a = self.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BP.dur(300), fill: "both" });
      a.onfinish = function () { if (self.el.parentNode) { self.el.parentNode.removeChild(self.el); } res(); };
    });
  };

  // ---------- gráfica: video (cortina, tótem...). Se reproduce una vez y se retira sola al terminar.
  function fuentesVideo(m) {
    var h = "";
    if (m.webm) { h += '<source src="' + m.webm + '" type="video/webm">'; }
    if (m.mp4) { h += '<source src="' + m.mp4 + '" type="video/mp4">'; }
    return h;
  }

function Video(layer, datos, onend, opts) {
  var m = (cfg.medios || {})[datos.medio] || {};
  var v = document.createElement("video");
  var self = this;

  v.className = "video-el";
  v.playsInline = true;
  v.preload = "auto";
  v.muted = canal === "preview" || P.silencio === "1" || !!(opts && opts.mudo);
  v.loop = !!datos.repetir;
  v.innerHTML = fuentesVideo(m);

  layer.appendChild(v);

  this.el = v;
  this.onend = onend;
  this.corte = null;
  this.canvas = null;

  // Aplicar chroma solamente a los medios que lo tengan configurado.
  if (m.chroma && typeof BP.chromaCanvas === "function") {
    this.canvas = BP.chromaCanvas(v, m.chroma);

    if (this.canvas) {
      layer.appendChild(this.canvas);
    } else {
      console.error("No se pudo iniciar WebGL para el chroma:", datos.medio);
    }
  }

  v.addEventListener("ended", function () {
    if (self.onend) { self.onend(); }
  });

  v.addEventListener("error", function () {
    console.warn("video no disponible", datos.medio);
    if (self.onend) { self.onend(); }
  }, true);
}

  Video.prototype.in = function () {
    var v = this.el, p = v.play();
    if (p && p.catch) { p.catch(function () { v.muted = true; v.play().catch(function () {}); }); }
  };
  Video.prototype.out = function () { var v = this.el; try { v.pause(); } catch (e) {} if (v.parentNode) { v.parentNode.removeChild(v); } return Promise.resolve(); };

  // ---------- fábrica por tipo
  function crear(g, datos, capa, e) {
    if (g.tipo === "gc_persona") { var gc = new BP.GCPersona(capas.gc); gc.render(datos); return gc; }
    if (g.tipo === "logo") { return new Logo(capas.logo, datos); }
    if (g.tipo === "video") {
      return new Video(capas.video, datos, function () {         // al terminar: se limpia la capa y el estado (solo en AIRE)
        var cur = actual[capa];
        if (cur && cur.ts === e.ts && !datos.repetir) {
          if (escribe) { var s = store.get("state/" + canal + "/" + capa); if (s && s.ts === e.ts) { store.remove("state/" + canal + "/" + capa); } }
        }
      });
    }
    return null;
  }

  // ---------- transiciones (video con punto de corte)
  function transicion(via, aplicar) {
    return new Promise(function (res) {
      var corte = false;
      function hacerCorte() { if (!corte) { corte = true; Promise.resolve(aplicar()).then(function () {}); } }
      if (via.tipo === "video" && via.medio) {
        var t = new Video(capaTrans, { medio: via.medio, repetir: false }, function () { hacerCorte(); t.out(); res(); }, {});
        t.in();
        setTimeout(hacerCorte, Math.max(0, +via.corte || 0));
      } else { hacerCorte(); res(); }
    });
  }

  // ---------- estado de cada capa hacia el panel
  function informar(capa, e, ok, motivo) {
    if (canal !== "aire" || !escribe) { return; }
    store.set("state/estado/" + capa, { ts: e.ts, gid: e.gid, ok: ok, motivo: motivo || "" });
  }

  // ---------- mostrar / ocultar (siempre en cola: nunca se pisan las animaciones)
  function mostrar(capa, e) {
    var g = (cfg.graficas || {})[e.gid];
    if (!g) { informar(capa, e, false, "gráfica inexistente"); return Promise.resolve(); }
    var datos = e.datos || g.datos || {};
    if (BP.esPendiente(datos)) {                       // nunca se muestra un PENDIENTE_: se avisa al panel y se deja todo como estaba
      informar(capa, e, false, "PENDIENTE: faltan datos, no se muestra");
      if (canal === "aire" && escribe) {
        var prev0 = actual[capa];
        if (prev0) { want[capa] = prev0.ts; store.set("state/aire/" + capa, prev0.entry); } else { store.remove("state/aire/" + capa); }
      }
      return Promise.resolve();
    }
    informar(capa, e, true);
    var via = e.via && (cfg.transiciones || {})[e.via];
    function aplicar() {
      var cur = actual[capa], prev = cur ? cur.inst.out() : Promise.resolve();
      return prev.then(function () {
        var inst = crear(g, datos, capa, e);
        if (!inst) { return; }
        actual[capa] = { ts: e.ts, gid: e.gid, inst: inst, entry: e };
        inst.in();
      });
    }
    return via ? transicion(via, aplicar) : aplicar();
  }
  function ocultar(capa) {
    var cur = actual[capa]; actual[capa] = null;
    return cur ? cur.inst.out() : Promise.resolve();
  }
  function encolar(fn) { cola = cola.then(fn).catch(function (err) { console.error(err); }); }

  function reconciliar(air) {
    Object.keys(air).forEach(function (capa) {
      var e = air[capa];
      if (!e || !e.gid || !capas[capa]) { return; }
      if (want[capa] !== e.ts) { want[capa] = e.ts; encolar(function () { return mostrar(capa, e); }); }
    });
    Object.keys(want).forEach(function (capa) {
      if (!air[capa]) { delete want[capa]; encolar(function () { return ocultar(capa); }); }
    });
  }

  store.onChange(function (t) {
    if (t.config && t.config.programa) { cfg = t.config; BP.vel = +cfg.programa.velocidad || 1; }
    reconciliar(BP.getPath(t, "state/" + canal) || {});
  });
  window.BP.salida = { store: store, canal: canal };
})();
