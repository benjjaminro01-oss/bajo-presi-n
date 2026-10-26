/* Bajo Presión CG · escaleta (v3)
   Pasos del libreto en orden. Cada paso: tiempo, título, "gráfica según libreto" (texto) y las gráficas ya construidas (ids).
   Las gráficas del libreto que todavía no están construidas se muestran como "pendiente de construir" (hito 3).
   Bloque 1: hasta la salida a comerciales (10:55–11:05). Bloque 2: desde el regreso de comerciales (11:05). */
(function () {
  "use strict";
  var BP = window.BP = window.BP || {};
  var out = [], sec = "", bloque = 1, n = 0;
  function S(nombre, b) { sec = nombre; if (b) { bloque = b; } }
  function R(tiempo, titulo, grafica, ids) {
    n++;
    out.push({ id: "p" + (n < 10 ? "00" : (n < 100 ? "0" : "")) + n, n: n, bloque: bloque, seccion: sec, tiempo: tiempo, titulo: titulo, grafica: grafica || "", ids: ids || [] });
  }

  S("APERTURA Y PRESENTACIÓN", 1);
  R("00:00–00:10", "Entrada de programa", "Cortina de entrada del logo (10 s)", ["cortina_programa"]);
  R("00:10–00:35", "Animador da la bienvenida", "GC: [NOMBRE DEL ANIMADOR]", ["gc_conductor", "logo_esquina"]);
  R("00:35–01:00", "Explica el programa y los 5 puntos por respuesta", "GC de conducción", ["gc_conductor"]);
  R("01:00–01:20", "Recorrido por el escenario; presenta a los participantes", "GC: Presentación de participantes");
  R("01:20–01:35", "Participante 1 se presenta", "GC: [NOMBRE PARTICIPANTE 1]", ["gc_participante1"]);
  R("01:35–02:00", "Presenta al participante 2", "GC: [NOMBRE PARTICIPANTE 2]", ["gc_participante2"]);
  R("02:00–02:15", "Participante 2 responde", "");
  R("02:15–02:30", "“Solo los mejores logran llegar hasta el final”", "GC: “Solo los mejores logran llegar hasta el final.”");
  R("02:30–02:40", "Cortina de Juego 1", "Cortina de Juego 1 — “PULSA Y RESPONDE” (10 s)", ["cortina_juego1"]);

  S("JUEGO 1 — PULSA Y RESPONDE");
  R("02:40–03:00", "Presenta el Juego 1", "GC: “PULSA Y RESPONDE”");
  R("03:00–03:30", "Explica las reglas", "GC con reglas");
  R("03:30–04:00", "Cinco segundos para responder", "GC: “5 segundos”");
  R("04:00–04:20", "Pregunta 1", "GC: Pregunta 1 + cronómetro 5 s");
  R("04:20–04:30", "Participante 1 presiona", "GC: Cuenta regresiva 5 s");
  R("04:30–04:35", "Respuesta correcta", "GC: CORRECTO");
  R("04:35–04:55", "Pregunta 2", "GC: Pregunta 2 + cronómetro 5 s");
  R("04:55–05:05", "Participante 2 responde", "GC: Cuenta regresiva 5 s");
  R("05:05–05:10", "Respuesta correcta", "GC: CORRECTO");

  S("TRANSICIÓN Y MINI ENTREVISTA");
  R("05:10–05:30", "Pregunta 3", "GC: Pregunta 3 + cronómetro 5 s");
  R("05:30–05:40", "Participante 1 presiona", "GC: Cuenta regresiva 5 s");
  R("05:40–05:45", "Respuesta correcta", "GC: CORRECTO");
  R("05:45–06:00", "“Ya tenemos nuestro primer ganador”", "");
  R("06:00–06:10", "Cortina logo del concurso", "Cortina logo concurso (10 s)", ["cortina_programa"]);
  R("06:10–06:25", "Mini entrevista al participante 1", "GC: MINI ENTREVISTA — [NOMBRE]");

  S("JUEGO 2 — ADIVINA LA IMAGEN");
  R("06:25–06:40", "Participante 1 responde", "");
  R("06:40–06:55", "Animador mira a cámara", "");
  R("06:55–07:05", "Participante 1 responde", "");
  R("07:05–07:20", "Se dirige al participante 2", "");
  R("07:20–07:45", "Mención comercial: Ópticas Visión Pro", "GC: 20% DE DESCUENTO (tótem publicitario)");
  R("07:45–07:55", "Cortina de Juego 2", "Cortina Juego 2: “ADIVINA LA IMAGEN” (10 s)", ["cortina_juego2"]);
  R("07:55–08:20", "Presenta el Juego 2", "GC: “ADIVINA LA IMAGEN”");
  R("08:20–08:35", "Diez segundos por imagen", "GC: 10 SEGUNDOS");
  R("08:35–08:45", "“¿Listos?” — “¡Sí!”", "");
  R("08:45–09:00", "Imagen 1", "GC: IMAGEN 1");
  R("09:00–09:10", "Cuenta regresiva 10 s", "GC: Cuenta regresiva 10 s");
  R("09:10–09:20", "Participante 2 responde", "");
  R("09:20–09:25", "Respuesta correcta", "GC: CORRECTO");
  R("09:25–09:45", "Imagen 2", "GC: IMAGEN 2");
  R("09:45–09:55", "Cuenta regresiva 10 s", "GC: Cuenta regresiva 10 s");
  R("09:55–10:00", "Respuesta correcta", "GC: CORRECTO");

  S("REGRESO DE COMERCIALES / VTR");
  R("10:00–10:15", "Imagen 3", "GC: IMAGEN 3");
  R("10:15–10:25", "Cuenta regresiva", "GC: Cuenta regresiva 10 s");
  R("10:25–10:35", "Participante 2 responde", "");
  R("10:35–10:40", "Respuesta correcta; 10 puntos extra", "GC: +10 PUNTOS");
  R("10:40–10:55", "Pausa comercial", "");
  R("10:55–11:05", "Cortina de salida a comerciales", "Cortina salida logo", ["cortina_programa"]);

  S("JUEGO 3 — MALETÍN SOSPECHOSO", 2);
  R("11:05–11:15", "Cortina de entrada (regreso de comerciales)", "Cortina entrada (10 s)", ["cortina_programa"]);
  R("11:15–11:45", "Presenta el VTR de las calles de Talca", "");
  R("11:45–12:15", "VTR calles de Talca", "GC/VTR: [POR DEFINIR]");
  R("12:15–12:30", "Retoma la conducción", "");
  R("12:30–12:45", "Presenta el Juego 3", "GC: Juego 3 — “MALETÍN SOSPECHOSO”", ["cortina_juego3"]);
  R("12:45–13:10", "Señala los maletines", "GC: MALETÍN SOSPECHOSO");
  R("13:10–13:25", "Explica las consecuencias", "GC: A SALVO / ELIMINADO");
  R("13:25–13:45", "Invita al participante 1", "GC: [PARTICIPANTE 1]", ["gc_participante1"]);
  R("13:45–14:00", "Participante 1 mira el maletín", "");

  S("INGRESO DEL TERCER PARTICIPANTE");
  R("14:00–14:15", "Participante 1 intenta convencer", "");
  R("14:15–14:30", "Pregunta al participante 2", "");
  R("14:30–14:40", "Participante 2 elige", "");
  R("14:40–14:50", "“¡Abran sus maletines!”", "");
  R("14:50–15:00", "Revelación", "GC: ELIMINADO");

  S("JUEGO 4 — RECONÓCELO");
  R("15:00–15:15", "Despedida del participante 1", "GC: ELIMINADO");
  R("15:15–15:25", "Participante 1 sale del estudio", "");
  R("15:25–15:40", "Animador vuelve al centro", "");
  R("15:40–16:00", "Expectativa por el tercer participante", "GC: NUEVO PARTICIPANTE");
  R("16:00–16:10", "Entra el participante 3", "GC: [NOMBRE PARTICIPANTE 3]", ["gc_participante3"]);
  R("16:10–16:20", "Participante 3 saluda", "GC: [NOMBRE PARTICIPANTE 3]", ["gc_participante3"]);
  R("16:20–16:40", "Bienvenida al participante 3", "");
  R("16:40–16:50", "Participante 3 agradece", "");
  R("16:50–17:10", "Conversa con el participante 3", "");
  R("17:10–17:25", "Participante 3 responde", "");
  R("17:25–17:55", "Consulta al participante 2", "");
  R("17:55–18:05", "Presenta el último juego", "GC: Juego 4 — “RECONÓCELO”", ["cortina_juego4"]);
  R("18:05–18:25", "Explica el Juego 4", "GC: “RECONÓCELO”");
  R("18:25–18:40", "Tres segundos de audio, cinco para responder", "GC: 3 SEGUNDOS / 5 SEGUNDOS");
  R("18:40–18:50", "Audio 1", "GC: AUDIO 1 — 3 s");
  R("18:50–18:55", "Responde quien presiona", "GC: CUENTA REGRESIVA 5 s");
  R("18:55–19:00", "Resultado", "GC: CORRECTO / INCORRECTO");
  R("19:00–19:10", "Audio 2", "GC: AUDIO 2 — 3 s");
  R("19:10–19:15", "Participante presiona", "GC: CUENTA REGRESIVA 5 s");
  R("19:15–19:20", "Respuesta correcta", "GC: CORRECTO");

  S("MENCIÓN COMERCIAL Y RESULTADOS");
  R("19:20–19:30", "Audio 3", "GC: AUDIO 3 — 3 s");
  R("19:30–19:35", "Participante 3 presiona", "GC: CUENTA REGRESIVA 5 s");
  R("19:35–19:40", "Respuesta correcta", "GC: CORRECTO");
  R("19:40–19:55", "Turno del participante 2", "GC: CUENTA REGRESIVA 5 s");
  R("19:55–20:05", "Respuesta incorrecta", "GC: INCORRECTO");
  R("20:05–20:15", "Participante 3 responde", "GC: CUENTA REGRESIVA 5 s");
  R("20:15–20:25", "Audio 2 (segunda ronda)", "GC: AUDIO 2");
  R("20:25–20:30", "Participante 2 responde", "GC: 5 s");
  R("20:30–20:35", "Respuesta incorrecta", "GC: INCORRECTO");
  R("20:35–20:45", "Participante 3 responde", "GC: 5 s");
  R("20:45–20:50", "Respuesta correcta", "GC: CORRECTO");
  R("20:50–21:05", "Prepara el cierre del juego", "GC: PUNTAJES [POR DEFINIR]");

  S("CIERRE");
  R("21:05–21:20", "Audio 3 (segunda ronda)", "GC: AUDIO 3");
  R("21:20–21:30", "Participante 3 responde", "GC: 5 s");
  R("21:30–21:40", "Respuesta correcta", "GC: CORRECTO");
  R("21:40–22:00", "Se acerca el final: falta anunciar al ganador", "");
  R("22:00–22:25", "Mención comercial: Spark Energy", "GC: “Nuevo Sabor Cítrico”");
  R("22:25–22:35", "Señala el producto", "GC: Spark Energy");
  R("22:35–22:40", "Cierra la mención", "GC: “Spark Energy: enciende tu mente, domina el juego.”");
  R("22:40–22:55", "Tarjeta con el puntaje total", "");
  R("22:55–23:00", "Todos: “¡Sí!”", "");
  R("23:00–23:15", "Anuncia el resultado", "GC: PUNTAJES [POR DEFINIR]");
  R("23:15–23:25", "Nombra al ganador", "GC: NOMBRE GANADOR + PUNTOS");
  R("23:25–23:45", "Felicita al ganador", "GC: GANADOR");
  R("23:45–24:05", "Agradece al otro participante y a la audiencia", "GC: “¡MUCHAS GRACIAS!”");
  R("24:05–24:20", "Despedida", "GC: ¡MUCHAS GRACIAS!");
  R("24:20–24:30", "Cortina de salida final y créditos", "GC: Créditos finales de producción", ["cortina_programa"]);
  R("24:30–30:00", "Tiempo restante por ajustar", "[TIEMPO RESTANTE POR AJUSTAR]");

  BP.ESCALETA = out;
})();
