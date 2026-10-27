/* Bajo Presión CG · panel (v3)
   Vistas: Control (escaleta + editor), Control + Visual (previa y al aire) y Botonera (táctil, con teclas).
   Todo el estado vive en el Store (Firebase o local): varios equipos controlan la misma sala. */
(function () {
  "use strict";
  var BP = window.BP, P = BP.params(), store = BP.createStore(P), DEF = BP.DEFAULT_CONFIG, ESC = BP.ESCALETA;
  var $ = function (id) { return document.getElementById(id); };
  var tree = {}, sel = null, vista = "control", editMode = false, capturando = null, drag = null, escBuilt = false, edKey = "", estadoCon = { ok: false, texto: "conectando…" }, seedOk = false, raf = 0;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function cfg() { return tree.config || DEF; }
  function G(id) { return (cfg().graficas || {})[id] || DEF.graficas[id]; }
  function medios() { return cfg().medios || DEF.medios; }
  function st(canal, capa) { return BP.getPath(tree, "state/" + canal + "/" + capa); }

  // ---------- campos editables por tipo de gráfica
  var CAMPOS = {
    gc_persona: [
      { k: "nombre", t: "texto", l: "Nombre" }, { k: "etiqueta", t: "texto", l: "Etiqueta (pestaña)" },
      { k: "tab", t: "color", l: "Color de la pestaña" }, { k: "tabText", t: "color", l: "Color del texto de la pestaña" }, { k: "cap", t: "color", l: "Color del remate" }
    ],
    video: [{ k: "medio", t: "medio", l: "Video" }, { k: "repetir", t: "check", l: "Repetir en bucle" }],
    logo: [
      { k: "posicion", t: "sel", l: "Posición", op: { tr: "Arriba derecha", tl: "Arriba izquierda", br: "Abajo derecha", bl: "Abajo izquierda" } },
      { k: "ancho", t: "num", l: "Ancho (px)", min: 80, max: 500 }
    ]
  };
  var RAPIDOS = { gc_persona: ["nombre", "tab"], video: ["medio"], logo: ["posicion"] };
  function campoDef(tipo, k) { var a = CAMPOS[tipo] || [], i; for (i = 0; i < a.length; i++) { if (a[i].k === k) { return a[i]; } } return { k: k, t: "texto", l: k }; }

  // ---------- pendientes (PENDIENTE_...)
  function pendCampos(g) {
    var out = [];
    Object.keys((g && g.datos) || {}).forEach(function (k) { var v = g.datos[k]; if (typeof v === "string" && /PENDIENTE_/i.test(v)) { out.push({ k: k, v: v }); } });
    return out;
  }
  function todosPendientes() {
    var out = [];
    Object.keys(cfg().graficas || {}).forEach(function (id) { var g = G(id); pendCampos(g).forEach(function (p) { out.push({ gid: id, g: g, k: p.k, v: p.v }); }); });
    return out;
  }

  // ---------- avisos
  var toastT = 0;
  function aviso(txt, ok) { var t = $("toast"); t.textContent = txt; t.className = ok ? "ok" : ""; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 4200); }

  // ---------- configuración compartida (se siembra una sola vez; nunca se pisa lo ya guardado)
  function ensureConfig() {
    var c = store.get("config");
    if (!c || !c.graficas) { store.set("config", BP.clone(DEF)); }
    else {
      Object.keys(DEF.graficas).forEach(function (id) { if (!c.graficas[id]) { store.set("config/graficas/" + id, DEF.graficas[id]); } });
      Object.keys(DEF.medios).forEach(function (id) { if (!(c.medios && c.medios[id])) { store.set("config/medios/" + id, DEF.medios[id]); } });
      if (!c.botonera) { store.set("config/botonera", DEF.botonera); }
    }
    seedOk = true;
  }
  function editable() { if (!seedOk || !tree.config) { aviso("Conectando con la sala… espera un segundo."); return false; } return true; }

  // ---------- acciones sobre la salida
  function mostrar(gid, canal) {
    canal = canal || "aire";
    var g = G(gid); if (!g) { return false; }
    var p = pendCampos(g);
    if (p.length) { aviso("Faltan datos en «" + g.nombre + "»: " + p.map(function (x) { return campoDef(g.tipo, x.k).l; }).join(", ") + ". Complétalos antes de mostrar."); return false; }
    store.set("state/" + canal + "/" + g.capa, { gid: gid, ts: Date.now(), datos: BP.clone(g.datos) });
    return true;
  }
  function ocultar(gid, canal) {
    canal = canal || "aire"; var g = G(gid); if (!g) { return; }
    var e = st(canal, g.capa); if (e && e.gid === gid) { store.remove("state/" + canal + "/" + g.capa); }
  }
  function alAire(gid) { var g = G(gid), e = g && st("aire", g.capa); return !!(e && e.gid === gid); }
  function alternar(gid) { if (alAire(gid)) { ocultar(gid); } else { mostrar(gid); } }
  function actualizar(gid) { if (alAire(gid)) { mostrar(gid); } else { aviso("«" + G(gid).nombre + "» no está al aire: usa MOSTRAR.", false); } }
  function limpiar() { if (confirm("¿Limpiar toda la salida? Se ocultan todas las gráficas al aire.")) { store.remove("state/aire"); } }

  // ---------- dispositivo y vista
  function esTactil() {
    var ua = navigator.userAgent || "", t = navigator.maxTouchPoints || 0;
    return /iPad|iPhone|Android|Mobile/.test(ua) || (/Macintosh/.test(ua) && t > 1);   // iPadOS en modo escritorio se anuncia como Mac con pantalla táctil
  }
  function dispositivo() {
    var m = P.dispositivo || localStorage.getItem("bp:dispositivo") || "auto";
    if (m === "auto") { return esTactil() ? "botonera" : "completo"; }
    return m;
  }
  function setVista(v) {
    if (dispositivo() === "botonera") { v = "botonera"; }
    vista = v; try { localStorage.setItem("bp:vista", v); } catch (e) {}
    $("v-control").hidden = v === "botonera"; $("v-botonera").hidden = v !== "botonera"; $("monitores").hidden = v !== "visual";
    Array.prototype.forEach.call(document.querySelectorAll("#tabs .tab"), function (b) { b.classList.toggle("sel", b.dataset.v === v); });
    if (v === "visual") { montarMonitores(); }
    pintar();
  }

  // ---------- monitores (iframes de la salida: previa y al aire)
  function hashBase() { var h = []; if (P.sala) { h.push("sala=" + encodeURIComponent(P.sala)); } if (P.db) { h.push("db=" + encodeURIComponent(P.db)); } return h.join("&"); }
  function urlDe(pagina, extra) { var u = new URL(pagina, location.href).href.split("#")[0], h = hashBase(); return u + "#" + h + (extra ? (h ? "&" : "") + extra : ""); }
  var monOk = false;
  function montarMonitores() {
    if (monOk) { return; } monOk = true;
    [["monP", "canal=preview"], ["monA", "canal=aire"]].forEach(function (m) {
      var box = $(m[0]), f = document.createElement("iframe");
      f.src = urlDe("salida.html", m[1] + "&fondo=cuadros&monitor=1&silencio=1"); f.setAttribute("title", m[1]); box.appendChild(f);
      var fit = function () { f.style.transform = "scale(" + (box.clientWidth / 1920) + ")"; };
      if (window.ResizeObserver) { new ResizeObserver(fit).observe(box); } fit();
    });
  }

  // ---------- escaleta
  function chipsHTML(ids) {
    return ids.map(function (id) { var g = G(id); return g ? '<span class="chip" data-gid="' + id + '"><button class="cn">' + esc(g.nombre) + '</button><button class="ct" aria-label="Mostrar u ocultar">▶</button></span>' : ""; }).join("");
  }
  function construirEscaleta() {
    var h = "", lastB = 0, lastS = "";
    ESC.forEach(function (r) {
      if (r.bloque !== lastB) { lastB = r.bloque; h += '<div class="blq">BLOQUE ' + r.bloque + "</div>"; }
      if (r.seccion !== lastS) { lastS = r.seccion; h += '<div class="sec">' + esc(r.seccion) + "</div>"; }
      h += '<div class="paso" data-id="' + r.id + '"><div class="pt">' + r.tiempo + '</div><div class="pb"><b>' + esc(r.titulo) + "</b>" +
           (r.grafica ? "<small>" + esc(r.grafica) + "</small>" : "") +
           ((r.ids.length || (r.grafica && !r.ids.length)) ? '<div class="chips">' + chipsHTML(r.ids) + (r.grafica && !r.ids.length ? '<span class="fut">gráfica pendiente de construir (hito 3)</span>' : "") + "</div>" : "") + "</div></div>";
    });
    $("escList").innerHTML = h; escBuilt = true;
  }
  function pasoIdx() { var id = BP.getPath(tree, "state/paso"), i; for (i = 0; i < ESC.length; i++) { if (ESC[i].id === id) { return i; } } return 0; }
  function irPaso(d) {
    var i = Math.max(0, Math.min(ESC.length - 1, pasoIdx() + d));
    store.set("state/paso", ESC[i].id);
    if (ESC[i].ids.length) { sel = ESC[i].ids[0]; }
  }
  function pintarEscaleta() {
    if (!escBuilt) { construirEscaleta(); }
    var cur = pasoIdx(), curId = ESC[cur].id;
    Array.prototype.forEach.call($("escList").querySelectorAll(".paso"), function (p) {
      var on = p.dataset.id === curId; if (p.classList.contains("cur") !== on) { p.classList.toggle("cur", on); if (on && vista !== "botonera") { var L = $("escList"); L.scrollTop = Math.max(0, p.offsetTop - L.clientHeight / 3); } }
    });
    Array.prototype.forEach.call($("escList").querySelectorAll(".chip"), function (c) {
      var id = c.dataset.gid, g = G(id);
      c.classList.toggle("on", alAire(id)); c.classList.toggle("sel", sel === id); c.classList.toggle("pend", !!(g && pendCampos(g).length));
      c.querySelector(".ct").textContent = alAire(id) ? "■" : "▶";
    });
    $("pInfo").textContent = "Paso " + ESC[cur].n + " de " + ESC.length + " · " + ESC[cur].tiempo;
  }

  // ---------- editor de la gráfica seleccionada
  function setDato(k, v) { if (!sel || !editable()) { return; } store.set("config/graficas/" + sel + "/datos/" + k, v); }
  function campoHTML(c, g, pre) {
    var v = g.datos[c.k], pend = typeof v === "string" && /PENDIENTE_/i.test(v), id = (pre || "f_") + c.k, h = '<div class="f' + (pend ? " pend" : "") + '" data-k="' + c.k + '">';
    if (c.t === "check") { return h + '<label class="chk"><input type="checkbox" id="' + id + '"> ' + esc(c.l) + "</label></div>"; }
    h += '<label for="' + id + '">' + esc(c.l) + "</label>";
    if (c.t === "color") { h += '<input type="color" id="' + id + '">'; }
    else if (c.t === "num") { h += '<input type="number" id="' + id + '" min="' + c.min + '" max="' + c.max + '">'; }
    else if (c.t === "sel") { h += '<select id="' + id + '">' + Object.keys(c.op).map(function (o) { return '<option value="' + o + '">' + esc(c.op[o]) + "</option>"; }).join("") + "</select>"; }
    else if (c.t === "medio") {
      var m = medios(); h += '<select id="' + id + '">' + (pend ? '<option value="' + esc(v) + '">' + esc(v) + "</option>" : "") + Object.keys(m).map(function (o) { return '<option value="' + o + '">' + esc(m[o].nombre) + "</option>"; }).join("") + "</select>";
    } else { h += '<input type="text" id="' + id + '" autocomplete="off">'; }
    return h + '<div class="warn" hidden>PENDIENTE: no saldrá en pantalla hasta que lo completes.</div></div>';
  }
  function construirEditor() {
    var g = sel && G(sel), box = $("editor");
    if (!g) { box.innerHTML = '<h3>Elige una gráfica</h3><div class="sub">Toca el nombre de una gráfica en la escaleta (o un paso) para editarla.</div>'; edKey = ""; return; }
    var campos = CAMPOS[g.tipo] || [];
    box.innerHTML = "<h3>" + esc(g.nombre) + '</h3><div class="sub">Capa «' + esc(g.capa) + "» · tecla " + esc(g.tecla || "—") + "</div>" +
      campos.map(function (c) { return campoHTML(c, g); }).join("") +
      '<div class="acc"><button class="b-prev" data-a="previa">PREVIA</button><button class="b-show" data-a="mostrar">MOSTRAR</button>' +
      '<button class="b-hide" data-a="ocultar">OCULTAR</button><button class="b-upd" data-a="actualizar">ACTUALIZAR</button></div><div class="state" id="edState"></div>';
    campos.forEach(function (c) {
      var el = $("f_" + c.k); if (!el) { return; }
      var ev = c.t === "color" ? "input" : "change";
      el.addEventListener(ev, function () { setDato(c.k, c.t === "check" ? el.checked : (c.t === "num" ? +el.value : el.value)); });
    });
    box.querySelector(".acc").addEventListener("click", function (e) {
      var a = e.target.getAttribute("data-a"); if (!a) { return; }
      if (a === "previa") { mostrar(sel, "preview"); if (vista === "control") { aviso("Enviada a la vista previa (cambia a «Control + Visual» para verla).", true); } }
      else if (a === "mostrar") { mostrar(sel); } else if (a === "ocultar") { ocultar(sel); ocultar(sel, "preview"); } else if (a === "actualizar") { actualizar(sel); }
    });
    edKey = sel;
  }
  function pintarEditor() {
    if (edKey !== sel || !$("editor").firstChild) { construirEditor(); }
    var g = sel && G(sel); if (!g) { return; }
    (CAMPOS[g.tipo] || []).forEach(function (c) {
      var el = $("f_" + c.k); if (!el) { return; }
      var v = g.datos[c.k], pend = typeof v === "string" && /PENDIENTE_/i.test(v), wrap = el.closest(".f");
      wrap.classList.toggle("pend", pend); var w = wrap.querySelector(".warn"); if (w) { w.hidden = !pend; }
      if (document.activeElement === el) { return; }
      if (c.t === "check") { el.checked = !!v; } else if (c.t === "texto" && pend) { el.value = ""; el.placeholder = v; } else { el.value = v == null ? "" : v; if (c.t === "texto") { el.placeholder = ""; } }
    });
    var s = $("edState"), e = st("aire", g.capa), pr = st("preview", g.capa), es = BP.getPath(tree, "state/estado/" + g.capa), txt = "Fuera del aire", cls = "state";
    if (e && e.gid === sel) { txt = "● AL AIRE"; cls += " on"; } else if (pr && pr.gid === sel) { txt = "En vista previa"; }
    else if (e) { txt = "Fuera del aire (la capa «" + g.capa + "» está ocupada por «" + (G(e.gid) ? G(e.gid).nombre : e.gid) + "»)"; }
    if (es && es.gid === sel && es.ok === false) { txt = "⚠ " + es.motivo; cls += " err"; }
    s.textContent = txt; s.className = cls;
  }

  // ---------- botonera
  function slots() {
    var b = cfg().botonera || {};
    return Object.keys(b).map(function (k) { var o = BP.clone(b[k]); o.id = k; return o; }).sort(function (a, c) { return (a.orden || 0) - (c.orden || 0); });
  }
  function textoBoton(g) {
    if (g.tipo === "gc_persona") { return g.datos.nombre; }
    if (g.tipo === "video") { var m = medios()[g.datos.medio]; return m ? m.nombre : g.datos.medio; }
    if (g.tipo === "logo") { return "Esquina"; }
    return "";
  }
  function pintarBotonera() {
    if (drag) { return; }
    var grid = $("grid"), h = "";
    grid.classList.toggle("edit", editMode); $("bAdd").hidden = !editMode; $("bEdit").textContent = editMode ? "✔ Listo" : "✎ Editar botonera";
    $("bHint").textContent = editMode ? "Toca un botón para editarlo. Arrastra ⠿ para ordenar." : "Toca un botón para mostrar; toca otra vez para ocultar. Rojo = al aire.";
    slots().forEach(function (s) {
      var g = G(s.gid); if (!g) { return; }
      var pend = pendCampos(g).length > 0, on = alAire(s.gid), t = textoBoton(g) || "";
      h += '<div class="bt' + (on ? " on" : "") + (pend ? " pend" : "") + '" data-slot="' + s.id + '" role="button"><span class="bk">' + esc(s.tecla || "sin tecla") + '</span><span class="hd" data-hd="1">⠿</span><b>' + esc(g.nombre) + "</b><small>" + esc(t) + "</small></div>";
    });
    grid.innerHTML = h;
  }
  function tocaBoton(slotId) {
    var s = (cfg().botonera || {})[slotId]; if (!s) { return; }
    if (editMode) { abrirSlot(slotId); return; }
    var g = G(s.gid); if (!g) { return; }
    sel = s.gid; alternar(s.gid);
  }
  function addSlot() {
    if (!editable()) { return; }
    var usados = {}, list = slots(), max = 0; list.forEach(function (s) { usados[s.gid] = 1; max = Math.max(max, s.orden || 0); });
    var libre = Object.keys(cfg().graficas).filter(function (id) { return !usados[id]; })[0] || Object.keys(cfg().graficas)[0];
    var id = "b" + Date.now().toString(36);
    store.set("config/botonera/" + id, { gid: libre, orden: max + 1, tecla: "" }); abrirSlot(id);
  }

  // ---------- hoja (ventana) y editor de botón
  function abrirSheet(html, bind) { $("sheet").innerHTML = html; $("sheetBg").hidden = false; if (bind) { bind($("sheet")); } }
  function cerrarSheet() { $("sheetBg").hidden = true; $("sheet").innerHTML = ""; capturando = null; }
  $("sheetBg").addEventListener("click", function (e) { if (e.target === $("sheetBg")) { cerrarSheet(); } });

  function abrirSlot(slotId) {
    var s = (cfg().botonera || {})[slotId]; if (!s) { return; }
    var g = G(s.gid), rap = RAPIDOS[g.tipo] || [];
    var h = "<h3>Editar botón</h3>" +
      '<div class="f"><label>Gráfica</label><select id="sg">' + Object.keys(cfg().graficas).map(function (id) { return '<option value="' + id + '"' + (id === s.gid ? " selected" : "") + ">" + esc(G(id).nombre) + "</option>"; }).join("") + "</select></div>" +
      rap.map(function (k) { return campoHTML(campoDef(g.tipo, k), g, "s_"); }).join("") +
      '<div class="f"><label>Tecla</label><div class="row"><button id="sk" class="btn">' + esc(s.tecla || "sin tecla") + '</button><button id="skx" class="btn">Quitar tecla</button></div><div class="hint" id="skh">Toca «' + esc(s.tecla || "sin tecla") + "» y luego pulsa la tecla que quieras (F13–F24 o cualquiera).</div></div>" +
      '<div class="row"><button id="sdel" style="background:#5a1020">Quitar botón</button><button id="sok" class="btn" style="background:#0d6b3a">Listo</button></div>';
    abrirSheet(h, function (box) {
      $("sg").addEventListener("change", function () { store.set("config/botonera/" + slotId + "/gid", this.value); abrirSlot(slotId); });
      rap.forEach(function (k) {
        var c = campoDef(g.tipo, k), el = $("s_" + k), v = g.datos[k]; if (!el) { return; }
        if (typeof v === "string" && /PENDIENTE_/i.test(v) && c.t === "texto") { el.placeholder = v; } else { el.value = v == null ? "" : v; }
        el.addEventListener(c.t === "color" ? "input" : "change", function () { if (editable()) { store.set("config/graficas/" + s.gid + "/datos/" + k, el.value); } });
      });
      $("sk").addEventListener("click", function () { capturando = slotId; $("sk").textContent = "Pulsa una tecla…"; });
      $("skx").addEventListener("click", function () { store.set("config/botonera/" + slotId + "/tecla", ""); abrirSlot(slotId); });
      $("sdel").addEventListener("click", function () { store.remove("config/botonera/" + slotId); cerrarSheet(); });
      $("sok").addEventListener("click", cerrarSheet);
    });
  }

  // ---------- teclas
  function norm(e) { if (e.key === " ") { return "Espacio"; } return e.key.length === 1 ? e.key.toUpperCase() : e.key; }
  var RESERVADAS = { Escape: 1, PageUp: 1, PageDown: 1, Tab: 1, Enter: 1, Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1 };
  function slotPorTecla(k) { var l = slots(), i; for (i = 0; i < l.length; i++) { if (l[i].tecla && l[i].tecla === k) { return l[i]; } } return null; }
  addEventListener("keydown", function (e) {
    var k = norm(e), tag = (e.target.tagName || "").toLowerCase(), escribiendo = tag === "input" || tag === "textarea" || tag === "select";
    if (capturando) {
      e.preventDefault();
      if (RESERVADAS[k]) { if (k === "Escape") { cerrarSheet(); } else { aviso("Esa tecla está reservada. Elige otra."); } return; }
      var otro = slotPorTecla(k); if (otro && otro.id !== capturando) { aviso("«" + k + "» ya la usa el botón «" + (G(otro.gid) ? G(otro.gid).nombre : "") + "». Elige otra."); return; }
      var id = capturando; capturando = null; store.set("config/botonera/" + id + "/tecla", k); abrirSlot(id); return;
    }
    if (k === "Escape") { cerrarSheet(); return; }
    if ((k === "PageDown" || k === "PageUp") && !escribiendo) { e.preventDefault(); irPaso(k === "PageDown" ? 1 : -1); return; }
    if (escribiendo && !/^F\d+$/.test(k)) { return; }
    if (!$("sheetBg").hidden) { return; }
    var s = slotPorTecla(k);
    if (s) { e.preventDefault(); sel = s.gid; alternar(s.gid); }
  });

  // ---------- pendientes y menú
  function abrirPendientes() {
    var l = todosPendientes();
    if (!l.length) { abrirSheet('<h3>Pendientes</h3><p>No hay datos pendientes. 🎉</p><div class="row"><button class="btn" id="px">Cerrar</button></div>', function () { $("px").onclick = cerrarSheet; }); return; }
    var h = '<h3>Pendientes (' + l.length + ')</h3><div class="hint">Mientras un dato diga PENDIENTE_ la gráfica no sale en pantalla. Escribe el dato real para liberarla.</div><div class="plist">';
    l.forEach(function (p, i) { h += '<div class="it"><label>' + esc(p.g.nombre) + " · " + esc(campoDef(p.g.tipo, p.k).l) + '</label><input type="text" data-i="' + i + '" placeholder="' + esc(p.v) + '" autocomplete="off"></div>'; });
    abrirSheet(h + '</div><div class="row"><button class="btn" id="px">Cerrar</button></div>', function (box) {
      $("px").onclick = cerrarSheet;
      Array.prototype.forEach.call(box.querySelectorAll("input[data-i]"), function (inp) {
        inp.addEventListener("change", function () { var p = l[+inp.dataset.i]; if (inp.value.trim() && editable()) { store.set("config/graficas/" + p.gid + "/datos/" + p.k, inp.value.trim()); aviso("Guardado: " + p.g.nombre, true); } });
      });
    });
  }
  function abrirMenu() {
    var dev = localStorage.getItem("bp:dispositivo") || "auto";
    var h = "<h3>Menú</h3>" +
      '<div class="f"><label>Dispositivo</label><select id="mDev"><option value="auto">Automático (celular y tablet: solo botonera)</option><option value="botonera">Solo botonera</option><option value="completo">Panel completo</option></select></div>' +
      '<div class="f"><label>Enlace de la SALIDA para OBS (fuente de navegador)</label><input type="text" id="mOut" readonly></div><div class="row"><button class="btn" id="cOut">Copiar enlace de la salida</button></div>' +
      '<div class="f"><label>Enlace del PANEL (para el iPad)</label><input type="text" id="mPan" readonly></div><div class="row"><button class="btn" id="cPan">Copiar enlace del panel</button></div>' +
      '<div class="hint" style="margin-top:12px">Modo: ' + esc(store.mode) + " · sala: " + esc(store.sala) + " · versión " + esc(BP.VERSION) + '</div><div class="row"><button class="btn" id="mOk" style="background:#0d6b3a">Cerrar</button></div>';
    abrirSheet(h, function () {
      $("mDev").value = dev; $("mOut").value = urlDe("salida.html"); $("mPan").value = urlDe("panel.html");
      $("mDev").addEventListener("change", function () { localStorage.setItem("bp:dispositivo", this.value); location.reload(); });
      var copiar = function (id) { var el = $(id); el.select(); try { navigator.clipboard.writeText(el.value).then(function () { aviso("Enlace copiado.", true); }, function () { document.execCommand("copy"); aviso("Enlace copiado.", true); }); } catch (e) { document.execCommand("copy"); aviso("Enlace copiado.", true); } };
      $("cOut").onclick = function () { copiar("mOut"); }; $("cPan").onclick = function () { copiar("mPan"); }; $("mOk").onclick = cerrarSheet;
    });
  }

  // ---------- eventos de la interfaz
  Array.prototype.forEach.call(document.querySelectorAll("#tabs .tab"), function (b) { b.addEventListener("click", function () { setVista(b.dataset.v); }); });
  $("bClear").addEventListener("click", limpiar); $("bGear").addEventListener("click", abrirMenu); $("bPend").addEventListener("click", abrirPendientes);
  $("pPrev").addEventListener("click", function () { irPaso(-1); }); $("pNext").addEventListener("click", function () { irPaso(1); });
  $("bEdit").addEventListener("click", function () { editMode = !editMode; pintar(); }); $("bAdd").addEventListener("click", addSlot);
  $("escList").addEventListener("click", function (e) {
    var row = e.target.closest(".paso"); if (!row) { return; }
    var chip = e.target.closest(".chip");
    store.set("state/paso", row.dataset.id);
    if (chip) { sel = chip.dataset.gid; if (e.target.classList.contains("ct")) { alternar(sel); } }
    else { var r = ESC.filter(function (x) { return x.id === row.dataset.id; })[0]; if (r && r.ids.length) { sel = r.ids[0]; } }
    pintar();
  });
  $("grid").addEventListener("click", function (e) { if (e.target.closest(".hd")) { return; } var b = e.target.closest(".bt"); if (b) { tocaBoton(b.dataset.slot); } });

  // arrastrar para ordenar (con el asa ⠿; funciona con el dedo en el iPad)
  $("grid").addEventListener("pointerdown", function (e) {
    var hd = e.target.closest(".hd"); if (!hd || !editMode) { return; }
    var el = hd.closest(".bt"); drag = { el: el }; el.classList.add("drag"); try { hd.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  });
  $("grid").addEventListener("pointermove", function (e) {
    if (!drag) { return; }
    var under = document.elementFromPoint(e.clientX, e.clientY), t = under && under.closest && under.closest(".bt");
    if (t && t !== drag.el) {
      var r = t.getBoundingClientRect(), after = (e.clientY > r.top + r.height / 2 && e.clientX > r.left) || e.clientY > r.bottom - 10;
      var before = (e.clientY < r.top + r.height / 2) || e.clientX < r.left + r.width / 2 && e.clientY < r.bottom;
      if (e.clientX > r.left + r.width / 2 || e.clientY > r.top + r.height * 0.6) { t.parentNode.insertBefore(drag.el, t.nextSibling); } else { t.parentNode.insertBefore(drag.el, t); }
    }
  });
  function finArrastre() {
    if (!drag) { return; }
    var kids = Array.prototype.slice.call($("grid").children), el = drag.el; drag = null; el.classList.remove("drag");
    kids.forEach(function (k, i) { store.set("config/botonera/" + k.dataset.slot + "/orden", i + 1); });
  }
  $("grid").addEventListener("pointerup", finArrastre); $("grid").addEventListener("pointercancel", finArrastre);

  // ---------- pintado general
  function pintar() { cancelAnimationFrame(raf); raf = requestAnimationFrame(pintarTodo); }
  function pintarTodo() {
    var pill = $("pill"); pill.textContent = (store.mode === "firebase" ? "● " : "") + estadoCon.texto + (store.mode === "firebase" ? " · sala " + String(store.sala).slice(0, 6) + "…" : "");
    pill.className = "pill " + (estadoCon.ok ? "ok" : "bad");
    var np = todosPendientes().length, bp = $("bPend"); bp.hidden = !np; bp.textContent = "⚠ " + np + " pendiente" + (np === 1 ? "" : "s");
    if (vista !== "botonera") { pintarEscaleta(); pintarEditor(); } else { pintarBotonera(); }
  }

  store.onStatus(function (s) { estadoCon = s; pintar(); });
  store.onChange(function (t) { tree = t; pintar(); });
  store.onReady(function () { ensureConfig(); pintar(); });
  setTimeout(function () { if (!seedOk) { aviso("Sin conexión con la sala. Revisa internet y el código de sala del enlace."); } }, 8000);

  // ---------- arranque
  var v0 = P.vista || localStorage.getItem("bp:vista") || "control";
  if (["control", "visual", "botonera"].indexOf(v0) < 0) { v0 = "control"; }
  if (dispositivo() === "botonera") { $("tabs").hidden = true; }
  setVista(v0);
  window.BP.panel = { store: store, mostrar: mostrar, ocultar: ocultar, irPaso: irPaso };
})();
