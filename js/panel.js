

/* Bajo Presión CG · panel de control
   v1: escaleta, gráficas existentes, botonera y conexión Firebase.
*/
(function () {
  "use strict";

  var BP = window.BP;
  if (!BP || !BP.createStore || !BP.DEFAULT_CONFIG || !BP.ESCALETA) {
    document.getElementById("pill").textContent = "Error: faltan archivos base";
    console.error("BAJO PRESIÓN: revisa core.js, defaults.js y escaleta.js.");
    return;
  }

  var P = BP.params();
  var store = BP.createStore(P);
  var cfg = BP.DEFAULT_CONFIG;
  var pasoActual = 0;
  var vistaActual = "control";
  var graficaActual = null;
  var $ = function (id) { return document.getElementById(id); };

  var pill = $("pill");
  var escList = $("escList");
  var editor = $("editor");
  var grid = $("grid");
  var toast = $("toast");

  function aviso(mensaje, ok) {
    toast.textContent = mensaje;
    toast.className = ok ? "ok" : "";
    toast.hidden = false;
    clearTimeout(aviso.t);
    aviso.t = setTimeout(function () {
      toast.hidden = true;
    }, 3000);
  }

  function escapar(valor) {
    return String(valor == null ? "" : valor).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
      }[c];
    });
  }

  function clonar(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

  function graficas() {
    return cfg.graficas || {};
  }

  function obtenerGrafica(id) {
    return graficas()[id] || null;
  }

  function estaAlAire(id) {
    var g = obtenerGrafica(id);
    if (!g) return false;
    var estado = store.get("state/aire/" + g.capa);
    return !!(estado && estado.gid === id);
  }

  function publicar(id, datosExtra) {
    var g = obtenerGrafica(id);

    if (!g) {
      aviso("Gráfica pendiente de construir: " + id, false);
      return;
    }

    var datos = clonar(g.datos);
    Object.keys(datosExtra || {}).forEach(function (k) {
      datos[k] = datosExtra[k];
    });

    if (BP.esPendiente(datos)) {
      aviso("Faltan datos por completar antes de salir al aire.", false);
      return;
    }

    var entrada = {
      gid: id,
      ts: Date.now(),
      datos: datos
    };

    store.set("state/aire/" + g.capa, entrada);
    aviso("Orden enviada: " + (g.nombre || id), true);
    renderEscaleta();
    renderEditor();
    renderBotonera();
  }

  function ocultar(id) {
    var g = obtenerGrafica(id);
    if (!g) return;

    var estado = store.get("state/aire/" + g.capa);
    if (estado && estado.gid === id) {
      store.remove("state/aire/" + g.capa);
      aviso("Orden de salida enviada.", true);
    } else {
      aviso("Esta gráfica no está al aire.", false);
    }

    renderEscaleta();
    renderEditor();
    renderBotonera();
  }

  function alternar(id, datos) {
    if (estaAlAire(id)) ocultar(id);
    else publicar(id, datos);
  }

  function idsDelPaso(paso) {
    return paso.ids || [];
  }

  function pasoTieneGraficaActiva(paso) {
    return idsDelPaso(paso).some(estaAlAire);
  }

  function renderEscaleta() {
    var pasos = BP.ESCALETA;
    var html = "";
    var bloqueAnterior = null;
    var seccionAnterior = null;

    pasos.forEach(function (p, i) {
      if (p.bloque !== bloqueAnterior) {
        bloqueAnterior = p.bloque;
        html += '<div class="blq">BLOQUE ' + escapar(p.bloque) + '</div>';
      }

      if (p.seccion !== seccionAnterior) {
        seccionAnterior = p.seccion;
        html += '<div class="sec">' + escapar(p.seccion) + '</div>';
      }

      var estado = pasoTieneGraficaActiva(p);
      var clases = "paso" + (i === pasoActual ? " cur" : "");

      html += '<div class="' + clases + '" data-paso="' + i + '" tabindex="0">';
      html += '<div class="pt">' + escapar(p.tiempo) + '</div>';
      html += '<div class="pb"><b>' + escapar(p.titulo) + '</b>';
      if (p.grafica) {
        html += '<small>' + escapar(p.grafica) + '</small>';
      }

      if (idsDelPaso(p).length) {
        html += '<div class="chips">';
        idsDelPaso(p).forEach(function (id) {
          var disponible = !!obtenerGrafica(id);
          var activa = estaAlAire(id);
          html += '<span class="chip' + (activa ? ' on' : '') +
            (!disponible ? ' pend' : '') + '">';
          html += '<button type="button" data-accion="grafica" data-id="' +
            escapar(id) + '">' + escapar(id) + '</button>';
          html += '<button type="button" class="ct" data-accion="toggle" data-id="' +
            escapar(id) + '">' + (activa ? '−' : '+') + '</button>';
          html += '</span>';
        });
        html += '</div>';
      } else if (p.grafica && /GC:|cortina|cronómetro|cuenta regresiva/i.test(p.grafica)) {
        html += '<span class="fut">Por implementar o configurar</span>';
      }

      html += '</div></div>';
    });

    escList.innerHTML = html;
    $("pInfo").textContent =
      "Paso " + (pasoActual + 1) + " de " + pasos.length;
    $("pPrev").disabled = pasoActual <= 0;
    $("pNext").disabled = pasoActual >= pasos.length - 1;
  }

  function campoNombre(id, datos) {
    var etiqueta = datos.etiqueta || id;
    var nombre = String(datos.nombre || "").indexOf("PENDIENTE_") === 0
      ? ""
      : (datos.nombre || "");

    return '<div class="f"><label for="nombreGC">' +
      escapar(etiqueta) + ' · Nombre</label>' +
      '<input id="nombreGC" type="text" maxlength="70" ' +
      'placeholder="Escribe el nombre" value="' + escapar(nombre) + '">' +
      '</div>';
  }

  function renderEditor() {
    var p = BP.ESCALETA[pasoActual];
    if (!p) return;

    var html = '<h3>' + escapar(p.titulo) + '</h3>';
    html += '<div class="sub">' + escapar(p.tiempo) +
      ' · Bloque ' + escapar(p.bloque) + '</div>';

    if (p.grafica) {
      html += '<div class="state">' + escapar(p.grafica) + '</div>';
    }

    var disponibles = idsDelPaso(p).filter(function (id) {
      return !!obtenerGrafica(id);
    });

    if (!disponibles.length) {
      html += '<div class="state err">Este paso no tiene una gráfica configurada para activación directa.</div>';
      editor.innerHTML = html;
      return;
    }

    var id = graficaActual && disponibles.indexOf(graficaActual) >= 0
      ? graficaActual : disponibles[0];

    graficaActual = id;
    var g = obtenerGrafica(id);
    var datos = clonar(g.datos);

    html += '<div class="f"><label>Gráfica disponible</label><select id="selGrafica">';
    disponibles.forEach(function (gid) {
      var item = obtenerGrafica(gid);
      html += '<option value="' + escapar(gid) + '"' +
        (gid === id ? ' selected' : '') + '>' +
        escapar(item.nombre || gid) + '</option>';
    });
    html += '</select></div>';

    if (g.tipo === "gc_persona") {
      html += campoNombre(id, datos);
    }

    html += '<div class="state' + (estaAlAire(id) ? ' on' : '') + '">';
    html += estaAlAire(id) ? 'ESTADO: AL AIRE' : 'ESTADO: FUERA DEL AIRE';
    html += '</div>';

    html += '<div class="acc">';
    html += '<button type="button" class="b-show" id="mostrarGC">▶ Mostrar</button>';
    html += '<button type="button" class="b-hide" id="ocultarGC">■ Ocultar</button>';
    html += '</div>';

    editor.innerHTML = html;

    $("selGrafica").addEventListener("change", function () {
      graficaActual = this.value;
      renderEditor();
    });

    $("mostrarGC").addEventListener("click", function () {
      var extra = {};
      var campo = $("nombreGC");

      if (campo && g.tipo === "gc_persona") {
        var nombre = campo.value.trim();
        if (!nombre) {
          aviso("Escribe el nombre antes de mostrar el GC.", false);
          campo.focus();
          return;
        }
        extra.nombre = nombre;
      }

      publicar(id, extra);
    });

    $("ocultarGC").addEventListener("click", function () {
      ocultar(id);
    });
  }

  function renderBotonera() {
    var ids = Object.keys(graficas()).sort(function (a, b) {
      return (+graficas()[a].orden || 0) - (+graficas()[b].orden || 0);
    });

    grid.innerHTML = ids.map(function (id) {
      var g = obtenerGrafica(id);
      var activa = estaAlAire(id);
      return '<button type="button" class="bt' + (activa ? ' on' : '') +
        '" data-boton-id="' + escapar(id) + '">' +
        '<span class="bk">' + escapar(g.tecla || '') + '</span>' +
        '<b>' + escapar(g.nombre || id) + '</b>' +
        '<small>' + (activa ? 'AL AIRE · toca para ocultar' : 'FUERA DEL AIRE · toca para mostrar') +
        '</small></button>';
    }).join("");
  }

  function seleccionarPaso(indice) {
    pasoActual = Math.max(0, Math.min(BP.ESCALETA.length - 1, indice));
    graficaActual = null;
    renderEscaleta();
    renderEditor();

    var nodo = escList.querySelector('[data-paso="' + pasoActual + '"]');
    if (nodo) nodo.scrollIntoView({ block: "nearest" });
  }

  
  function cambiarVista(nombre) {
    vistaActual = nombre;

    document.querySelectorAll("#tabs .tab").forEach(function (b) {
      b.classList.toggle("sel", b.dataset.v === nombre);
    });

    $("v-control").hidden = nombre !== "control" && nombre !== "visual";
    $("v-botonera").hidden = nombre !== "botonera";
    $("v-marcador").hidden = nombre !== "marcador";

    if (nombre === "visual") {
      $("monitores").hidden = false;
      configurarMonitores();
    } else {
      $("monitores").hidden = true;
    }

    if (nombre === "marcador") {
      mostrarMarcador();
    }
  }


  function configurarMonitores() {
    var params = BP.params();
    var sala = params.sala || "prueba";
    var db = params.db || "";
    var hash = "#sala=" + encodeURIComponent(sala) +
      (db ? "&db=" + encodeURIComponent(db) : "");

    [["monP", "preview"], ["monA", "aire"]].forEach(function (item) {
      var contenedor = $(item[0]);
      var iframe = contenedor.querySelector("iframe");

      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.title = item[1] === "preview" ? "Vista previa" : "Salida al aire";
        iframe.src = "salida.html" + hash +
          (item[1] === "preview" ? "&canal=preview" : "");
        contenedor.appendChild(iframe);
      }

      function ajustar() {
        var escala = contenedor.clientWidth / 1920;
        iframe.style.transform = "scale(" + escala + ")";
        iframe.style.transformOrigin = "top left";
        iframe.style.width = "1920px";
        iframe.style.height = "1080px";
        contenedor.style.height = (1080 * escala) + "px";
      }

      ajustar();
      if (!iframe.dataset.resize) {
        iframe.dataset.resize = "1";
        window.addEventListener("resize", ajustar);
      }
    });
  }

  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-v]");
    if (b) cambiarVista(b.dataset.v);
  });

  escList.addEventListener("click", function (e) {
    var accion = e.target.closest("[data-accion]");
    if (accion) {
      e.stopPropagation();
      var id = accion.dataset.id;

      if (accion.dataset.accion === "grafica") {
        var paso = BP.ESCALETA[pasoActual];
        if (idsDelPaso(paso).indexOf(id) < 0) return;
        graficaActual = id;
        renderEditor();
      } else if (accion.dataset.accion === "toggle") {
        alternar(id);
      }
      return;
    }

    var fila = e.target.closest("[data-paso]");
    if (fila) seleccionarPaso(+fila.dataset.paso);
  });

  escList.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") &&
        e.target.matches("[data-paso]")) {
      e.preventDefault();
      seleccionarPaso(+e.target.dataset.paso);
    }
  });

  $("pPrev").addEventListener("click", function () {
    seleccionarPaso(pasoActual - 1);
  });

  $("pNext").addEventListener("click", function () {
    seleccionarPaso(pasoActual + 1);
  });

  grid.addEventListener("click", function (e) {
    var b = e.target.closest("[data-boton-id]");
    if (b) alternar(b.dataset.botonId);
  });

  $("bClear").addEventListener("click", function () {
    if (!confirm("¿Ocultar todas las gráficas de la salida al aire?")) return;
    store.remove("state/aire");
    aviso("Orden de limpieza enviada.", true);
  });

  $("bGear").addEventListener("click", function () {
    $("sheet").innerHTML =
      "<h3>BAJO PRESIÓN · Ajustes</h3>" +
      "<p>Sala: " + escapar(store.sala) + "</p>" +
      "<p>Conexión: " + escapar(store.mode) + "</p>" +
      "<p>Este panel utiliza la configuración de gráficas existente.</p>" +
      '<div class="row"><button id="cerrarAjustes">Cerrar</button></div>';

    $("sheetBg").hidden = false;
    $("cerrarAjustes").addEventListener("click", function () {
      $("sheetBg").hidden = true;
    });
  });

  $("sheetBg").addEventListener("click", function (e) {
    if (e.target === $("sheetBg")) $("sheetBg").hidden = true;
  });

  $("bEdit").addEventListener("click", function () {
    grid.classList.toggle("edit");
    $("bEdit").textContent = grid.classList.contains("edit")
      ? "✓ Terminar edición" : "✎ Editar botonera";
    aviso("La edición de distribución personalizada se implementará en otra etapa.", false);
  });

  // ---------- MARCADOR EN VIVO
  var marcadorEstado = $("marcadorEstado");
  var marcadorListo = false;

  function leerJugador(indice) {
    var jugador = store.get("marcador/players/" + indice);
    return jugador && typeof jugador === "object" ? jugador : null;
  }

  function mostrarMarcador() {
    var jugadores1 = leerJugador(0);
    var jugadores2 = leerJugador(1);
    var marcador = store.get("marcador");

    if (!marcador || !jugadores1 || !jugadores2) {
      marcadorListo = false;
      if (marcadorEstado) {
        marcadorEstado.textContent = "Marcador sin inicializar";
        marcadorEstado.classList.remove("ok");
        marcadorEstado.classList.add("bad");
      }
      return;
    }

    marcadorListo = true;

    $("nombreJugador1").value = jugadores1.name || "PARTICIPANTE 1";
    $("nombreJugador2").value = jugadores2.name || "PARTICIPANTE 2";
    $("puntosJugador1").textContent = Number(jugadores1.score) || 0;
    $("puntosJugador2").textContent = Number(jugadores2.score) || 0;

    if (marcadorEstado) {
      marcadorEstado.textContent = "Sincronizado · " + store.sala;
      marcadorEstado.classList.add("ok");
      marcadorEstado.classList.remove("bad");
    }
  }

  function cambiarPuntos(indice, cambio) {
    if (!marcadorListo) {
      aviso("El marcador aún no está inicializado en esta sala.", false);
      return;
    }

    var jugador = leerJugador(indice);
    if (!jugador) {
      aviso("No se encontró al participante.", false);
      return;
    }

    var puntosActuales = Number(jugador.score) || 0;
    var nuevosPuntos = Math.max(0, puntosActuales + cambio);

    store.set("marcador/players/" + indice + "/score", nuevosPuntos);
  }

  $("sumarJugador1").addEventListener("click", function () {
    cambiarPuntos(0, 1);
  });

  $("restarJugador1").addEventListener("click", function () {
    cambiarPuntos(0, -1);
  });

  $("sumarJugador2").addEventListener("click", function () {
    cambiarPuntos(1, 1);
  });

  $("restarJugador2").addEventListener("click", function () {
    cambiarPuntos(1, -1);
  });

  function guardarNombre(indice, campo) {
    var nombre = campo.value.trim();
    if (!nombre) {
      aviso("Escribe un nombre para el participante.", false);
      mostrarMarcador();
      return;
    }

    if (!marcadorListo) {
      aviso("El marcador aún no está inicializado en esta sala.", false);
      mostrarMarcador();
      return;
    }

    store.set("marcador/players/" + indice + "/name", nombre);
  }

  $("nombreJugador1").addEventListener("change", function () {
    guardarNombre(0, this);
  });

  $("nombreJugador2").addEventListener("change", function () {
    guardarNombre(1, this);
  });

  store.onStatus(function (s) {
    pill.textContent = s.texto || (s.ok ? "en línea" : "sin conexión");
    pill.classList.toggle("ok", !!s.ok);
    pill.classList.toggle("bad", !s.ok);
  });


store.onChange(function (tree) {
    if (tree && tree.config && tree.config.graficas) {
      cfg = tree.config;
    }
    renderEscaleta();
    renderEditor();
    renderBotonera();
    mostrarMarcador();
  });


  cambiarVista("control");
  renderEscaleta();
  renderEditor();
  renderBotonera();
    mostrarMarcador();
  window.BP.panel = {
    store: store,
    publicar: publicar,
    ocultar: ocultar,
    seleccionarPaso: seleccionarPaso
  };
})();
