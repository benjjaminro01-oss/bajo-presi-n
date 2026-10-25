# Bajo Presión · Sistema de gráficas (CG) — HITO 1

Estado: **salida para OBS + 3 gráficas clave** (GC conductor/participantes, cortina de programa) y logo de esquina.
Falta (hitos siguientes): panel, botonera, configuración, transiciones, cuenta regresiva, marcador, escaleta y el resto de las gráficas.

## Qué hay en la carpeta
- `salida.html` — fuente de navegador para OBS (1920×1080, fondo transparente). No depende de que el panel esté abierto.
- `prueba.html` — consola provisoria para probar la salida (se reemplaza por el panel en el hito 2).
- `js/` y `css/` — con número de versión (`?v=1`) para que el navegador no mezcle archivos viejos.
- `media/` — tus cortinas y el tótem en 1080p (MP4 y WebM). `assets/logo.png` — logo recortado.

## Reglas que ya cumple
- Una gráfica por capa: la nueva **reemplaza** a la anterior (dos GC de nombre nunca se superponen).
- Todo dato `PENDIENTE_...` **nunca sale en pantalla**: la salida lo bloquea y avisa al panel. Hoy están pendientes
  `PENDIENTE_NOMBRE_CONDUCTOR`, `PENDIENTE_NOMBRE_PARTICIPANTE_1` y `PENDIENTE_NOMBRE_PARTICIPANTE_2`.
- La cortina se reproduce una vez y se retira sola al terminar.

## Sincronización entre equipos (iPad sin cables)
GitHub Pages solo entrega archivos, no puede pasar mensajes entre equipos. Por eso se usa una base de datos gratuita de Firebase
(Realtime Database), sin instalar nada y sin claves secretas en el código. Se crea **una sola vez** (3 minutos):
1. Entra a https://console.firebase.google.com con tu cuenta de Google > **Agregar proyecto** (puedes desactivar Analytics).
2. **Compilación > Realtime Database > Crear base de datos** (elige "modo bloqueado").
3. Pestaña **Reglas**, pega esto y presiona **Publicar**:
```
{ "rules": { "bp": { "$sala": { ".read": true, ".write": true } } } }
```
4. Copia la dirección que aparece arriba en la pestaña **Datos** (termina en `firebasedatabase.app` o `firebaseio.com`).
Esa dirección **no es un secreto**. El "código de sala" que tú inventes (ej. `BP-7K2Q9X`) funciona como contraseña: usa uno largo y no lo compartas.

## Publicar en GitHub Pages
1. Crea un repositorio en GitHub (público) y sube **el contenido** de esta carpeta.
2. **Settings > Pages > Deploy from a branch > main / (root)**. En un minuto queda en `https://TU_USUARIO.github.io/TU_REPO/`.

## Enlaces (cuando esté el panel)
- Salida para OBS: `https://TU_USUARIO.github.io/TU_REPO/salida.html#sala=TU_SALA&db=TU_DIRECCION_FIREBASE`
- Panel (iPad / Mac): `https://TU_USUARIO.github.io/TU_REPO/panel.html#sala=TU_SALA&db=TU_DIRECCION_FIREBASE`
En OBS: Fuente > Navegador > pega la URL de la salida > ancho 1920, alto 1080. Para que el iPad la abra de un toque, mándate el enlace por AirDrop o mensaje.

## Probar ahora en tu Mac (sin publicar)
Terminal: `python3 -m http.server 8000` dentro de esta carpeta, y abre `http://localhost:8000/salida.html#sala=prueba&fondo=cuadros` junto a
`http://localhost:8000/prueba.html#sala=prueba` **en el mismo navegador** (modo local). Entre OBS y Safari el modo local no se comparte: ahí hace falta Firebase.
