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
    imagen: [{ k: "medio", t: "medio", l: "Imagen" }],
    logo: [
      { k: "posicion", t: "sel", l: "Posición", op: { tr: "Arriba derecha", tl: "Arriba izquierda", br: "Abajo derecha", bl: "Abajo izquierda" } },
      { k: "ancho", t: "num", l: "Ancho (px)", min: 80, max: 500 }
    ]
  };
  var RAPIDOS = { gc_persona: ["nombre", "tab"], video: ["medio"], imagen: ["medio"], logo: ["posicion"] };
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
    if (g.tipo === "video" || g.tipo === "imagen") { var m = medios()[g.datos.medio]; return m ? m.nombre : g.datos.medio; }
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

  // ---------- huincha "PREGUNTA Y RESPONDE" (tarjeta propia, visible en todas las vistas, también en la botonera del iPad)
  // Reutiliza mostrar()/ocultar(): el texto se guarda en config/graficas/huincha_pregunta/datos/texto y, al aire, en state/aire/huincha.
  var HU = "huincha_pregunta", huBuilt = false, huSucio = false;
  function huTexto() { return $("huTxt").value.replace(/\s+/g, " ").trim(); }
  function huGuardarBorrador() { if (seedOk && tree.config) { store.set("config/graficas/" + HU + "/datos/texto", huTexto()); huSucio = false; } }
  function huAccion(a) {
    if (!editable()) { return; }
    var txt = huTexto();
    if (a === "ocultar") { ocultar(HU); return; }
    if (a === "limpiar") { $("huTxt").value = ""; huSucio = false; store.set("config/graficas/" + HU + "/datos/texto", ""); ocultar(HU); return; }
    if (!txt) { aviso("Escribe la pregunta antes de mostrarla."); return; }
    if (a === "actualizar" && !alAire(HU)) { aviso("La huincha no está al aire: usa MOSTRAR."); return; }
    huGuardarBorrador(); mostrar(HU);
  }
  function construirHuincha() {
    var top = $("top"); if (!top || huBuilt) { return; }
    var c = document.createElement("section"); c.id = "huincha";
    c.innerHTML = '<div class="huh"><b>HUINCHA — PREGUNTA Y RESPONDE</b><span class="hustate" id="huState">Fuera del aire</span></div>' +
      '<textarea id="huTxt" rows="2" maxlength="400" placeholder="Escribe la pregunta…" autocomplete="off"></textarea>' +
      '<div class="acc"><button class="b-show" data-h="mostrar">MOSTRAR</button><button class="b-hide" data-h="ocultar">OCULTAR</button><button class="b-upd" data-h="actualizar">ACTUALIZAR</button><button class="b-clr" data-h="limpiar">LIMPIAR</button></div>';
    top.parentNode.insertBefore(c, top.nextSibling);
    c.addEventListener("click", function (e) { var a = e.target.getAttribute("data-h"); if (a) { huAccion(a); } });
    $("huTxt").addEventListener("input", function () { huSucio = true; pintar(); });
    $("huTxt").addEventListener("change", huGuardarBorrador);
    huBuilt = true;
  }
  function pintarHuincha() {
    if (!huBuilt) { construirHuincha(); } if (!huBuilt) { return; }
    var g = G(HU), t = $("huTxt"), s = $("huState"), e = st("aire", g.capa), on = !!(e && e.gid === HU), es = BP.getPath(tree, "state/estado/" + g.capa), txt = on ? "● AL AIRE" : "Fuera del aire", cls = "hustate" + (on ? " on" : "");
    if (!huSucio && document.activeElement !== t) { var v = (g.datos && g.datos.texto) || ""; if (t.value !== v) { t.value = v; } }   // sigue el borrador de otros equipos (antes de comparar)
    if (on && e.datos && e.datos.texto !== huTexto()) { txt += " · hay cambios sin actualizar"; cls += " chg"; }
    if (es && es.gid === HU && es.ok === false) { txt = "⚠ " + es.motivo; cls += " err"; }
    s.textContent = txt; s.className = cls;
  }

  // ---------- MEDIOS: adjuntar gráficas terminadas (video MP4/WebM o imagen PNG/WebP/JPG) y dejarlas como botones del control.
  // El archivo se sube a Firebase Storage (graficas/{sala}/{id}/{archivo}) con el SDK de Firebase; en la base de datos solo se guarda su
  // referencia (URL de descarga, ruta, nombre y configuración) en config/medios, config/graficas y config/botonera (estructuras que ya existían).
  // GitHub Pages queda únicamente para el código: aquí ya no se usa la API de GitHub ni tokens.
  var mdBuilt = false, mdBusy = false, mdKey = "", MD_MAX = 100 * 1024 * 1024;
  var FB_CFG = {                                                   // configuración PÚBLICA de la app web (no es un secreto); la seguridad la dan las reglas de Storage
    apiKey: "AIzaSyDuvBHZHRHY0KMaPVwaOdliO8fc9f5e4wc", authDomain: "bajo-presion-7e430.firebaseapp.com", projectId: "bajo-presion-7e430",
    storageBucket: "bajo-presion-7e430.firebasestorage.app", appId: "1:645121018866:web:40f67a4a67e754d78bf96b"
  };
  var MD_TIPOS = { mp4: "video/mp4", webm: "video/webm", png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg" };
  try { localStorage.removeItem("bp:gh"); } catch (e) {}           // limpieza: el token de GitHub de la versión anterior ya no se usa ni se conserva
  function slug(s) { return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "grafica"; }
  function mdEstado(txt, cls) { var e = $("mdEst"); if (e) { e.textContent = txt; e.className = "state" + (cls ? " " + cls : ""); } }
  function mdProg(pct) { var p = $("mdProg"); if (!p) { return; } if (pct == null) { p.hidden = true; p.value = 0; } else { p.hidden = false; p.value = pct; } }
  function mb(n) { return (Math.round(n / 1048576 * 10) / 10).toLocaleString("es-CL"); }
  function storage() {
    if (!window.firebase || !firebase.storage) { throw new Error("No se cargó el SDK de Firebase Storage (revisa la conexión a internet y recarga el panel)"); }
    if (!firebase.apps.length) { firebase.initializeApp(FB_CFG); }
    var sto = firebase.storage(); try { sto.setMaxUploadRetryTime(40000); sto.setMaxOperationRetryTime(20000); } catch (e) {}   // si Storage no responde, falla en ~40 s en vez de reintentar 10 min
    return sto;
  }
  function subirStorage(file, path, ctype, onProg) {               // sube con progreso real y devuelve la URL de descarga
    return new Promise(function (res, rej) {
      var ref, task;
      try { ref = storage().ref(path); task = ref.put(file, { contentType: ctype }); } catch (e) { rej(e); return; }
      task.on("state_changed", function (s) { onProg(s.bytesTransferred, s.totalBytes); }, rej, function () { ref.getDownloadURL().then(res, rej); });
    });
  }
  function borrarArchivo(path) {                                   // un archivo que ya no existe cuenta como borrado
    return new Promise(function (res, rej) {
      var ref; try { ref = storage().ref(path); } catch (e) { rej(e); return; }
      ref.delete().then(res, function (e) { if (e && e.code === "storage/object-not-found") { res(); } else { rej(e); } });
    });
  }
  function msgError(e) {
    var c = e && e.code || "";
    if (c === "storage/unauthorized") { return "Firebase rechazó la operación (revisa las reglas de Storage)"; }
    if (c === "storage/quota-exceeded") { return "Se superó la cuota de Firebase Storage"; }
    if (c === "storage/retry-limit-exceeded" || c === "storage/network-request-failed") { return "no hubo respuesta de Firebase Storage (¿Storage sin activar, reglas sin publicar, o un bloqueador de contenido/VPN bloquea firebasestorage.googleapis.com?)"; }
    if (c === "storage/canceled") { return "subida cancelada"; }
    if (c === "storage/bucket-not-found" || c === "storage/project-not-found") { return "Firebase Storage no está activado en el proyecto"; }
    return ((e && e.code) ? e.code + ": " : "") + ((e && e.message) || "error desconocido");
  }
  function refiere(o, val) {                                       // ¿algún valor del objeto es exactamente val?
    var hay = false;
    (function rec(x) { if (hay || x == null) { return; } if (typeof x === "string") { if (x === val) { hay = true; } return; } if (typeof x === "object") { Object.keys(x).forEach(function (k) { rec(x[k]); }); } })(o);
    return hay;
  }
  function usosDelMedio(gid, mid, path) {                          // otras configuraciones que dependen de este medio / archivo
    var gs = cfg().graficas || {}, ms = cfg().medios || {}, ts = cfg().transiciones || {}, out = [];
    Object.keys(gs).forEach(function (id) { if (id !== gid && gs[id] && refiere(gs[id].datos, mid)) { out.push(gs[id].nombre || id); } });
    Object.keys(ts).forEach(function (id) { if (refiere(ts[id], mid)) { out.push("transición " + id); } });
    Object.keys(ms).forEach(function (id) { if (id !== mid && path && ms[id] && ms[id].path === path) { out.push(ms[id].nombre || id); } });
    return out;
  }
  function registrarMedio(o) {                                    // o: { id, nombre, tipo, archivo, url, path, croma, repetir }
    var m = { id: o.id, nombre: o.nombre, path: o.path, archivo: o.archivo }, g, slotsL = slots(), max = 0, hay = false;
    if (o.tipo === "video") { m[/\.webm$/i.test(o.archivo) ? "webm" : "mp4"] = o.url; } else { m.img = o.url; }
    if (o.croma) { m.chroma = { color: "#34FE00", similitud: 0.32, suavidad: 0.08 }; }
    g = { id: o.id, nombre: o.nombre, tipo: o.tipo, capa: "video", orden: 100, tecla: "", boton: true, adjunta: true, archivo: o.archivo, datos: { medio: o.id, repetir: !!o.repetir }, entra: { tipo: "directo" }, sale: { tipo: "directo" } };
    store.set("config/medios/" + o.id, m); store.set("config/graficas/" + o.id, g);
    slotsL.forEach(function (s) { max = Math.max(max, s.orden || 0); if (s.gid === o.id) { hay = true; } });
    if (!hay) { store.set("config/botonera/b" + Date.now().toString(36), { gid: o.id, orden: max + 1, tecla: "" }); }
  }
  function mdAdjuntar() {
    if (!editable() || mdBusy) { return; }
    var f = $("mdFile").files[0], ext, tipo, base, nombre, o, previo, antes, t0 = Date.now();
    if (!f) { aviso("Elige primero el archivo terminado."); return; }
    ext = (f.name.split(".").pop() || "").toLowerCase();
    tipo = [ "mp4", "webm" ].indexOf(ext) >= 0 ? "video" : ([ "png", "webp", "jpg", "jpeg" ].indexOf(ext) >= 0 ? "imagen" : "");
    if (!tipo) { aviso("Formato no compatible. Exporta a MP4 (H.264) o WebM; imágenes en PNG, WebP o JPG."); return; }
    if (f.size > MD_MAX) { aviso("El archivo pesa " + mb(f.size) + " MB y el máximo es " + mb(MD_MAX) + " MB. Comprímelo antes de adjuntarlo."); return; }
    if (f.size === 0) { aviso("El archivo está vacío."); return; }
    ext = ext === "jpeg" ? "jpg" : ext;
    base = slug(f.name.replace(/\.[^.]+$/, "")); nombre = $("mdNom").value.trim() || f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    o = { id: "adj_" + base, nombre: nombre, tipo: tipo, archivo: base + "_" + t0.toString(36) + "." + ext, croma: $("mdFondo").value === "verde", repetir: tipo === "video" && $("mdRep").checked };
    o.path = "graficas/" + store.sala + "/" + o.id + "/" + o.archivo;
    previo = medios()[o.id]; antes = previo && previo.path;        // si se re-adjunta el mismo nombre, el archivo anterior se reemplaza
    var ultimo = Date.now(), vigia = setInterval(function () { if (Date.now() - ultimo > 15000) { mdEstado("⏳ Sin avance en 15 s: Firebase Storage no responde. Si no avanza, se cortará solo en unos segundos con el motivo. Revisa que Storage esté activado y sus reglas publicadas.", "err"); } }, 5000);
    mdBusy = true; $("mdAdd").disabled = true; mdProg(0); mdEstado("Subiendo «" + nombre + "» a Firebase Storage… 0 % (0 de " + mb(f.size) + " MB)");
    subirStorage(f, o.path, MD_TIPOS[ext], function (a, b) { var p = b ? Math.round(a / b * 100) : 0; if (a > 0) { ultimo = Date.now(); } mdProg(p); mdEstado("Subiendo «" + nombre + "» a Firebase Storage… " + p + " % (" + mb(a) + " de " + mb(b) + " MB)"); })
      .then(function (url) {
        clearInterval(vigia); o.url = url; registrarMedio(o);
        if (antes && antes !== o.path && !usosDelMedio(o.id, o.id, antes).length) { borrarArchivo(antes).catch(function () {}); }   // sin archivos huérfanos
        mdBusy = false; $("mdAdd").disabled = false; mdProg(null);
        mdEstado("✔ «" + nombre + "» ya está disponible y quedó en la Botonera.");
        $("mdFile").value = ""; $("mdNom").value = "";
      })
      .catch(function (e) { clearInterval(vigia); mdBusy = false; $("mdAdd").disabled = false; mdProg(null); mdEstado("⚠ No se pudo subir «" + nombre + "»: " + msgError(e), "err"); });
  }
  function mdQuitar(gid) {
    if (!editable()) { return; }
    var g = G(gid), mid, m, path, uso, borrar, txt, quitar;
    if (!g || !g.adjunta) { return; }
    mid = g.datos && g.datos.medio; m = medios()[mid] || {}; path = m.path || ""; uso = usosDelMedio(gid, mid, path); borrar = !!path && !uso.length;
    txt = "¿Quitar «" + g.nombre + "» del control?";
    if (!path) { txt += "\n(El archivo queda en la carpeta media/ del repositorio.)"; }
    else if (borrar) { txt += "\nTambién se borrará su archivo de Firebase Storage."; }
    else { txt += "\nEl archivo NO se borrará porque lo usa: " + uso.join(", ") + "."; }
    if (!confirm(txt)) { return; }
    quitar = function () {
      if (alAire(gid)) { ocultar(gid); }
      slots().forEach(function (s) { if (s.gid === gid) { store.remove("config/botonera/" + s.id); } });
      store.remove("config/graficas/" + gid); if (!uso.length) { store.remove("config/medios/" + mid); }
      mdEstado(borrar ? "«" + g.nombre + "» quitada y su archivo borrado de Storage." : "«" + g.nombre + "» quitada del control.");
    };
    if (!borrar) { quitar(); return; }
    mdEstado("Borrando «" + g.nombre + "» de Storage…");
    borrarArchivo(path).then(quitar, function (e) {
      if (confirm("No se pudo borrar el archivo de Storage (" + msgError(e) + ").\n¿Quitar la gráfica del control igualmente? El archivo quedaría en Storage.")) { quitar(); } else { mdEstado("No se quitó «" + g.nombre + "».", "err"); }
    });
  }
  function mdProbar(gid) {                                          // diagnostica el archivo en ESTE navegador (OBS usa el suyo)
    var g = G(gid), m = g && medios()[g.datos.medio], path = m && (m.mp4 || m.webm || m.img), url, fin, abs, bust;
    if (!path) { mdEstado("Esta gráfica no tiene archivo registrado.", "err"); return; }
    abs = /^https?:\/\//i.test(path); bust = function () { return abs ? path : path + "?v=" + Date.now(); };
    url = new URL(path, location.href).href; mdEstado("Probando «" + g.nombre + "»…");
    fin = function (txt, bad) { mdEstado(txt, bad ? "err" : ""); };
    (abs ? Promise.resolve({ ok: true }) : fetch(path + "?v=" + Date.now(), { method: "HEAD", cache: "no-store" })).then(function (r) {
      if (!r.ok) { fin("⚠ No se encuentra «" + path + "» (error " + r.status + "). Abre " + url + " para comprobarlo. El archivo debe estar en la carpeta media/ con ese nombre exacto (minúsculas, sin tildes ni espacios); si lo subiste hace poco, GitHub Pages tarda 1–2 min.", true); return; }
      var done = false, el, tm, dim = function (w, h) { return (w === 1920 && h === 1080) ? "" : " ⚠ Mide " + w + "×" + h + " y la salida es 1920×1080: se estirará (exporta a 1920×1080)."; };
      if (g.tipo === "imagen") {
        el = new Image(); el.onload = function () { fin("✔ La imagen carga bien." + dim(el.naturalWidth, el.naturalHeight)); }; el.onerror = function () { fin(abs ? "⚠ No se pudo cargar la imagen desde Firebase Storage (¿archivo borrado, sin conexión o reglas?)." : "⚠ El archivo existe pero no es una imagen válida.", true); }; el.src = bust(); return;
      }
      el = document.createElement("video"); el.preload = "metadata"; el.muted = true;
      tm = setTimeout(function () { if (!done) { done = true; fin("⚠ El navegador no pudo leer el video en 20 s (¿códec no compatible, archivo corrupto o sin conexión?).", true); } }, 20000);
      el.onloadedmetadata = function () { if (done) { return; } done = true; clearTimeout(tm); fin("✔ El video se puede reproducir: " + Math.round(el.duration * 10) / 10 + " s, " + el.videoWidth + "×" + el.videoHeight + "." + dim(el.videoWidth, el.videoHeight)); };
      el.onerror = function () { if (done) { return; } done = true; clearTimeout(tm); fin("⚠ No se pudo reproducir el video (códec no compatible, archivo dañado o ya no está en Storage). Expórtalo de nuevo como MP4 H.264 de 8 bits 4:2:0 con audio AAC (o WebM).", true); };
      el.src = bust();
    }, function () { fin("⚠ Sin conexión: no se pudo comprobar el archivo.", true); });
  }
  function construirMedios() {
    var ref = $("huincha") || $("top"); if (!ref || mdBuilt) { return; }
    var c = document.createElement("section"); c.id = "medios";
    c.innerHTML = '<details><summary><b>MEDIOS — ADJUNTAR GRÁFICAS</b><span class="hint"> video MP4/WebM o imagen PNG/WebP/JPG</span></summary>' +
      '<div class="f"><label>Archivo terminado</label><input type="file" id="mdFile" accept=".mp4,.webm,.png,.webp,.jpg,.jpeg"></div>' +
      '<div class="f"><label>Nombre en el control</label><input type="text" id="mdNom" placeholder="Ej.: Tótem Spark Energy" autocomplete="off"></div>' +
      '<div class="f"><label>Fondo del archivo</label><select id="mdFondo"><option value="">Normal (opaco o con transparencia propia)</option><option value="verde">Fondo verde croma #34FE00 → quitarlo</option></select></div>' +
      '<label class="chk"><input type="checkbox" id="mdRep"> Repetir en bucle (solo video)</label>' +
      '<div class="acc"><button class="b-show" id="mdAdd">ADJUNTAR</button></div>' +
      '<progress id="mdProg" max="100" value="0" hidden></progress>' +
      '<div class="state" id="mdEst">Elige un archivo y pulsa ADJUNTAR. Se sube a Firebase Storage y queda como botón en la Botonera.</div><div id="mdList"></div></details>';
    ref.parentNode.insertBefore(c, ref.nextSibling);
    $("mdAdd").addEventListener("click", mdAdjuntar);
    $("mdFile").addEventListener("change", function () { var f = this.files[0]; if (f && !$("mdNom").value) { $("mdNom").value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "); } });
    $("mdList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-md]"); if (!b) { return; }
      if (b.dataset.md === "alt") { if (editable()) { sel = b.dataset.g; alternar(b.dataset.g); } } else if (b.dataset.md === "test") { mdProbar(b.dataset.g); } else { mdQuitar(b.dataset.g); }
    });
    mdBuilt = true;
  }
  function pintarMedios() {
    if (!mdBuilt) { construirMedios(); } if (!mdBuilt) { return; }
    var ids = Object.keys(cfg().graficas || {}).filter(function (id) { return G(id) && G(id).adjunta; }), es = BP.getPath(tree, "state/estado/video") || {};
    function falla(id) { return es.gid === id && es.ok === false ? es.motivo : ""; }
    var key = ids.map(function (id) { return id + (alAire(id) ? "*" : "") + G(id).nombre + (G(id).archivo || "") + falla(id); }).join("|");
    if (key === mdKey) { return; } mdKey = key;
    $("mdList").innerHTML = ids.length ? '<div class="hint" style="margin:10px 0 4px">Gráficas adjuntas (también están en la Botonera):</div>' + ids.map(function (id) {
      var g = G(id), on = alAire(id);
      return '<div class="mdrow' + (on ? " on" : "") + '"><div><b>' + esc(g.nombre) + '</b><small>' + esc(g.tipo + " · " + ((medios()[g.datos.medio] || {}).path ? "Storage · " : "media/") + (g.archivo || "")) + '</small>' + (falla(id) ? '<small class="mdw">⚠ ' + esc(falla(id)) + ' — pulsa Probar</small>' : "") + '</div><button data-md="alt" data-g="' + esc(id) + '">' + (on ? "OCULTAR" : "MOSTRAR") + '</button><button data-md="test" data-g="' + esc(id) + '">Probar</button><button data-md="del" data-g="' + esc(id) + '">Quitar</button></div>';
    }).join("") : "";
  }

  // ---------- pintado general
  function pintar() { cancelAnimationFrame(raf); raf = requestAnimationFrame(pintarTodo); }
  function pintarTodo() {
    var pill = $("pill"); pill.textContent = (store.mode === "firebase" ? "● " : "") + estadoCon.texto + (store.mode === "firebase" ? " · sala " + String(store.sala).slice(0, 6) + "…" : "");
    pill.className = "pill " + (estadoCon.ok ? "ok" : "bad");
    var np = todosPendientes().length, bp = $("bPend"); bp.hidden = !np; bp.textContent = "⚠ " + np + " pendiente" + (np === 1 ? "" : "s");
    if (vista !== "botonera") { pintarEscaleta(); pintarEditor(); } else { pintarBotonera(); }
    pintarHuincha(); pintarMedios();
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
