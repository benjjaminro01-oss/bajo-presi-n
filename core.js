/* Bajo Presión CG · núcleo (v1)
   - Parámetros de URL (#sala=...&db=...&canal=aire|preview)
   - "Store": un árbol de datos compartido. Dos adaptadores con la misma interfaz:
       · local     -> localStorage + BroadcastChannel (un solo computador, sin internet)
       · firebase  -> Realtime Database por REST + SSE (varios equipos en tiempo real; sin SDK ni compilación)
   - Los arreglos se evitan en el árbol (Firebase los convierte en objetos): se usan objetos con "orden".
*/
(function () {
  "use strict";
  var BP = window.BP = window.BP || {};
  BP.VERSION = "1";

  // ---------- parámetros: #sala=ABC&db=https://xxx.firebaseio.com&canal=preview  (también ?query)
  BP.params = function () {
    var o = {}, s = (location.hash || "").replace(/^#/, "") + "&" + (location.search || "").replace(/^\?/, "");
    s.split("&").forEach(function (kv) {
      if (!kv) { return; }
      var i = kv.indexOf("="), k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i)), v = i < 0 ? "1" : decodeURIComponent(kv.slice(i + 1));
      if (!(k in o)) { o[k] = v; }
    });
    return o;
  };

  // ---------- utilidades de árbol
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function getPath(t, p) {
    var a = String(p || "").split("/").filter(Boolean), c = t, i;
    for (i = 0; i < a.length; i++) { if (c == null || typeof c !== "object") { return undefined; } c = c[a[i]]; }
    return c;
  }
  function setPath(t, p, v) {                       // v undefined/null = borrar
    var a = String(p || "").split("/").filter(Boolean), c = t, i;
    if (!a.length) { return (v && typeof v === "object") ? v : {}; }
    for (i = 0; i < a.length - 1; i++) {
      if (c[a[i]] == null || typeof c[a[i]] !== "object") { c[a[i]] = {}; }
      c = c[a[i]];
    }
    if (v === undefined || v === null) { delete c[a[a.length - 1]]; } else { c[a[a.length - 1]] = v; }
    return t;
  }
  BP.getPath = getPath; BP.clone = clone;
  BP.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  // ---------- adaptador LOCAL
  function localStore(sala) {
    var key = "bp:" + sala, tree = {}, cbs = [], ch = null;
    try { tree = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { tree = {}; }
    try { ch = new BroadcastChannel("bp-" + sala); ch.onmessage = function (e) { tree = setPath(tree, e.data.path, e.data.value); emit(); }; } catch (e) { ch = null; }
    addEventListener("storage", function (e) { if (e.key === key) { try { tree = JSON.parse(e.newValue || "{}"); emit(); } catch (x) {} } });
    function emit() { cbs.forEach(function (fn) { try { fn(tree); } catch (e) { console.error(e); } }); }
    function save() { try { localStorage.setItem(key, JSON.stringify(tree)); } catch (e) {} }
    return {
      mode: "local", sala: sala,
      get: function (p) { return getPath(tree, p); },
      set: function (p, v) { v = clone(v); tree = setPath(tree, p, v); save(); if (ch) { ch.postMessage({ path: p, value: v }); } emit(); },
      remove: function (p) { tree = setPath(tree, p, undefined); save(); if (ch) { ch.postMessage({ path: p, value: null }); } emit(); },
      onChange: function (cb) { cbs.push(cb); setTimeout(function () { cb(tree); }, 0); },
      onStatus: function (cb) { setTimeout(function () { cb({ ok: true, texto: "local" }); }, 0); },
      tree: function () { return tree; }
    };
  }

  // ---------- adaptador FIREBASE (Realtime Database, REST + SSE)
  function fbStore(db, sala) {
    var base = db.replace(/\/+$/, "") + "/bp/" + encodeURIComponent(sala), tree = {}, cbs = [], scbs = [], es = null, retry = 0;
    function emit() { cbs.forEach(function (fn) { try { fn(tree); } catch (e) { console.error(e); } }); }
    function status(ok, texto) { scbs.forEach(function (fn) { fn({ ok: ok, texto: texto }); }); }
    function norm(p) { return String(p || "").replace(/^\/+|\/+$/g, ""); }
    function connect() {
      try { es = new EventSource(base + ".json"); } catch (e) { status(false, "sin conexión"); return setTimeout(connect, 3000); }
      es.onopen = function () { retry = 0; status(true, "en línea"); };
      es.addEventListener("put", function (e) {
        var m = JSON.parse(e.data); var p = norm(m.path);
        tree = setPath(tree, p, m.data === null ? undefined : m.data); if (!p && !tree) { tree = {}; } emit();
      });
      es.addEventListener("patch", function (e) {
        var m = JSON.parse(e.data), p = norm(m.path);
        Object.keys(m.data || {}).forEach(function (k) { tree = setPath(tree, (p ? p + "/" : "") + k, m.data[k] === null ? undefined : m.data[k]); });
        emit();
      });
      es.onerror = function () { status(false, "reconectando…"); try { es.close(); } catch (x) {} setTimeout(connect, Math.min(8000, 1000 + 1000 * (++retry))); };
    }
    function send(method, p, v) {
      return fetch(base + "/" + norm(p) + ".json", { method: method, body: v === undefined ? undefined : JSON.stringify(v) })
        .then(function (r) { if (!r.ok) { status(false, "error " + r.status + " (¿reglas de la base de datos?)"); } })
        .catch(function () { status(false, "sin conexión"); });
    }
    connect();
    return {
      mode: "firebase", sala: sala,
      get: function (p) { return getPath(tree, p); },
      set: function (p, v) { v = clone(v); tree = setPath(tree, p, v); emit(); return send("PUT", p, v); },
      remove: function (p) { tree = setPath(tree, p, undefined); emit(); return send("DELETE", p); },
      onChange: function (cb) { cbs.push(cb); setTimeout(function () { cb(tree); }, 0); },
      onStatus: function (cb) { scbs.push(cb); },
      tree: function () { return tree; }
    };
  }

  // ---------- fábrica: usa Firebase si hay "db" en la URL (o guardada en este equipo); si no, modo local
  BP.createStore = function (params) {
    var sala = (params.sala || "local").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "local";
    var db = params.db || "";
    try { if (!db) { db = localStorage.getItem("bp:db") || ""; } } catch (e) {}
    if ((/^https:\/\/[A-Za-z0-9.-]+\.(firebaseio\.com|firebasedatabase\.app)\/?$/.test(db) || /^http:\/\/localhost:\d+\/?$/.test(db)) && sala !== "local") { return fbStore(db, sala); }
    return localStore(sala);
  };

  // ---------- velocidad global de animaciones (config.programa.velocidad: 1 = normal, 2 = el doble de rápido)
  BP.vel = 1;
  BP.dur = function (ms) { return Math.max(1, ms / (BP.vel || 1)); };
  BP.esPendiente = function (obj) {
    var hay = false;
    (function rec(o) {
      if (hay || o == null) { return; }
      if (typeof o === "string") { if (/PENDIENTE_/i.test(o)) { hay = true; } return; }
      if (typeof o === "object") { Object.keys(o).forEach(function (k) { rec(o[k]); }); }
    })(obj);
    return hay;
  };
})();
