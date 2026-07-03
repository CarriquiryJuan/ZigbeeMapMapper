# Zigbee House Map

![status](https://img.shields.io/badge/version-0.7-blue)

🇬🇧 **[English](#english)** · 🇪🇸 **[Español](#español)**

A visualizer for Zigbee networks (Zigbee2MQTT / Home Assistant) drawn over the real floor plan of your home. No install: it's plain HTML + CSS + JS, just open `index.html`.

Un visualizador de redes Zigbee (Zigbee2MQTT / Home Assistant) sobre el plano real de tu casa. Sin instalar nada: es HTML + CSS + JS puro, abrís `index.html`.

---

## English

### What it does

- Draws your floor plan as coloured rooms (SVG).
- Places your Zigbee devices (coordinator, routers, sensors) on the plan.
- Draws the links between devices, coloured by signal quality (LQI).
- Side panel to show/hide routers, sensors, links, room names and LQI values, with sliders for icon size and line width. A device's name appears when you hover over it.
- **Drag any device** with the mouse: the lines recalculate on the fly.
- Built-in **floor-plan editor**: draw rooms by clicking, load your plan as a background image to trace over, delete rooms.
- **Import the Zigbee2MQTT network map** (JSON) and it creates the devices and links automatically, keeping the positions you already set.
- Distinguishes **primary links** (the parent-child tree of the network) from **secondary** ones (neighbours / backup routes), which you can hide with a checkbox to keep the map readable.
- Highlights with an **orange ring** the devices left with no parent in the scan, and can optionally draw an **inferred parent** (their best neighbour) to complete the tree.
- **Saves changes straight to the file** (`devices.js` / `rooms.js` / `links.js`) — no copy-paste.

### How to use it

1. Clone or download this repository.
2. Copy the example files to the "real" files the app uses:
   ```
   cp rooms.example.js rooms.js
   cp devices.example.js devices.js
   cp links.example.js links.js
   ```
3. Edit those `rooms.js`, `devices.js` and `links.js` with your own home's data (see below), or generate them by importing from Zigbee2MQTT.
4. Open `index.html` in the browser.

> **Direct saving:** the "save" buttons write straight to the file using the File System Access API. This needs a **secure context** — serve the folder over `localhost` (e.g. `python -m http.server`) in Chrome/Edge. Over `file://` or unsupported browsers, the file is **downloaded** instead and you replace it manually.

> **Privacy:** `rooms.js`, `devices.js` and `links.js` are gitignored on purpose. Your floor plan and devices are private data — if you fork or push, those files are never versioned. Only the generic `*.example.js` files stay in the public repo.

### Customising it for your home

- **`rooms.js`** — each room is a polygon of `[x, y]` points.
  ```js
  { id: "kitchen", name: "Kitchen", color: "#c8e6c9", polygon: [[520, 40], [880, 40], [880, 300], [520, 300]] }
  ```
- **`devices.js`** — each device has an `x`/`y` position and a `type`: `"coordinator"`, `"router"` or `"battery"` (mains vs battery-powered).
  ```js
  switch_estar: { name: "Living Switch", type: "router", room: "estar", x: 300, y: 320 }
  ```
- **`links.js`** — each link joins two device IDs with its LQI (and `primary: false` for secondary links).
  ```js
  { from: "coordinator", to: "switch_estar", lqi: 235 }
  ```

### Importing from Zigbee2MQTT

The app can create devices and links automatically from the **network map**.

**Get the JSON** — publish over MQTT (from Home Assistant → Developer Tools, or MQTT Explorer):

- Topic: `zigbee2mqtt/bridge/request/networkmap`
- Payload: `{"type":"raw","routes":false}`

The response arrives on `zigbee2mqtt/bridge/response/networkmap`. Copy that whole JSON.

**Import it** — in the side panel, *Import from Zigbee2MQTT*, paste the JSON (or load a `.json` file) and click **Import**. It:

- creates a device per node (mapping Coordinator → coordinator, Router → router, EndDevice → battery);
- creates the links with their LQI, keeping the best value when a link appears in both directions;
- marks each link as **primary** (parent-child tree) or **secondary** (neighbour), using the `relationship` field; secondary links are hidden by default;
- **keeps the position** of devices you already placed (matched by name), and puts new ones in a staging area below the plan.

> Each device's ID comes from its Zigbee2MQTT *friendly name*. As long as you don't change those names, every re-import recognises the devices and respects where you put them.

### Roadmap

- [x] v0.1 — Plan + devices + links (static)
- [x] v0.2 — Real data split into public `*.example.js` vs private (gitignored) files
- [x] v0.3 — Drag devices with the mouse
- [x] v0.4 — Floor-plan editor: draw rooms, background image, export `rooms.js`
- [x] v0.5 — Import the Zigbee2MQTT network map to create devices and links
- [x] v0.6 — Icon-size and line-width sliders; device names on hover
- [x] v0.7 — Primary vs secondary links; isolated highlight and inferred parent; save straight to file; collapsible sidebar
- [ ] v0.8 — Zoom and pan
- [ ] v0.9 — Export to SVG / PNG
- [ ] v1.0 — Network stats, low-LQI alerts, router-placement suggestions

### Contributing

Ideas, issues and PRs welcome. The goal is that anyone with Home Assistant + Zigbee2MQTT can have a visual map of their Zigbee network over their real floor plan — something that doesn't exist today in a simple, editable form.

### License

MIT — see [LICENSE](LICENSE).

---

## Español

### ¿Qué hace?

- Dibuja el plano de tu casa como habitaciones coloreadas (SVG).
- Ubica tus dispositivos Zigbee (coordinador, routers, sensores) en el plano.
- Dibuja los enlaces entre dispositivos, coloreados según la calidad de señal (LQI).
- Panel lateral para mostrar/ocultar routers, sensores, enlaces, nombres de habitaciones y valores de LQI, con sliders para el tamaño de los iconos y el grosor de las líneas. El nombre de cada dispositivo aparece al pasar el mouse por encima.
- **Arrastrá cualquier dispositivo** con el mouse: las líneas se recalculan solas.
- **Editor de plano** integrado: dibujá habitaciones a click, cargá tu plano como imagen de fondo para calcar encima, borrá habitaciones.
- **Importá el mapa de red de Zigbee2MQTT** (JSON) y la app crea los dispositivos y enlaces sola, conservando las posiciones que ya definiste.
- Distingue **enlaces principales** (el árbol padre-hijo de la red) de los **secundarios** (vecinos/rutas de respaldo), que podés ocultar con un check para dejar el mapa legible.
- Resalta con un **aro naranja** los dispositivos que quedaron sin padre en el escaneo, y opcionalmente les dibuja un **padre inferido** (su mejor vecino) para completar el árbol.
- **Guarda los cambios directo en el archivo** (`devices.js` / `rooms.js` / `links.js`) — sin copiar y pegar.

### Cómo usarlo

1. Cloná o descargá este repositorio.
2. Copiá los archivos de ejemplo a los archivos "reales" que usa la app:
   ```
   cp rooms.example.js rooms.js
   cp devices.example.js devices.js
   cp links.example.js links.js
   ```
3. Editá esos `rooms.js`, `devices.js` y `links.js` con los datos de tu propia casa (ver abajo), o generalos importando desde Zigbee2MQTT.
4. Abrí `index.html` en el navegador.

> **Guardado directo:** los botones de "guardar" escriben directo en el archivo usando la File System Access API. Necesita un **contexto seguro** — serví la carpeta por `localhost` (por ej. `python -m http.server`) en Chrome/Edge. Sobre `file://` o navegadores sin soporte, el archivo se **descarga** y lo reemplazás a mano.

> **Privacidad:** `rooms.js`, `devices.js` y `links.js` están en `.gitignore` a propósito. El plano de tu casa y tus dispositivos son datos privados — si hacés fork o subís cambios, esos archivos nunca se versionan. Solo los `*.example.js` (genéricos) quedan en el repo público.

### Cómo personalizarlo con tu propia casa

- **`rooms.js`** — cada habitación es un polígono de puntos `[x, y]`.
  ```js
  { id: "cocina", name: "Cocina", color: "#c8e6c9", polygon: [[520, 40], [880, 40], [880, 300], [520, 300]] }
  ```
- **`devices.js`** — cada dispositivo tiene una posición `x`/`y` y un `type`: `"coordinator"`, `"router"` o `"battery"` (a corriente vs a pila).
  ```js
  switch_estar: { name: "Switch Estar", type: "router", room: "estar", x: 300, y: 320 }
  ```
- **`links.js`** — cada enlace conecta dos IDs de dispositivos con su LQI (y `primary: false` para los secundarios).
  ```js
  { from: "coordinator", to: "switch_estar", lqi: 235 }
  ```

### Importar de Zigbee2MQTT

La app puede crear los dispositivos y los enlaces automáticamente a partir del **mapa de red**.

**Obtener el JSON** — publicá por MQTT (desde Home Assistant → Herramientas para desarrolladores, o MQTT Explorer):

- Topic: `zigbee2mqtt/bridge/request/networkmap`
- Payload: `{"type":"raw","routes":false}`

La respuesta llega a `zigbee2mqtt/bridge/response/networkmap`. Copiá todo ese JSON.

**Importarlo** — en el panel lateral, *Importar de Zigbee2MQTT*, pegá el JSON (o cargá un archivo `.json`) y clic en **Importar**. La app:

- crea un dispositivo por nodo (mapeando Coordinator → coordinador, Router → router, EndDevice → sensor a pila);
- crea los enlaces con su LQI, quedándose con el mejor valor cuando el enlace aparece en ambos sentidos;
- marca cada enlace como **principal** (árbol padre-hijo) o **secundario** (vecino), usando el campo `relationship`; los secundarios se ocultan por defecto;
- **conserva la posición** de los dispositivos que ya ubicaste (los reconoce por el nombre), y coloca los nuevos en una zona de staging debajo del plano.

> El id de cada dispositivo se deriva de su *friendly name* de Zigbee2MQTT. Mientras no cambies esos nombres, cada nueva importación reconoce los dispositivos y respeta dónde los pusiste.

### Roadmap

- [x] v0.1 — Plano + dispositivos + enlaces (estático)
- [x] v0.2 — Datos reales separados en `*.example.js` (público) vs archivos privados (gitignored)
- [x] v0.3 — Arrastrar dispositivos con el mouse
- [x] v0.4 — Editor de plano: dibujar habitaciones, imagen de fondo, exportar `rooms.js`
- [x] v0.5 — Importar el mapa de red de Zigbee2MQTT para crear dispositivos y enlaces
- [x] v0.6 — Sliders de tamaño de iconos y grosor de líneas; nombres al pasar el mouse
- [x] v0.7 — Enlaces principales vs secundarios; resaltado de aislados y padre inferido; guardado directo al archivo; sidebar colapsable
- [ ] v0.8 — Zoom y pan
- [ ] v0.9 — Exportar a SVG / PNG
- [ ] v1.0 — Estadísticas de red, alertas de LQI bajo, sugerencias de ubicación de routers

### Contribuir

Ideas, issues y PRs son bienvenidos. El objetivo es que cualquiera con Home Assistant + Zigbee2MQTT pueda tener un mapa visual de su red Zigbee sobre el plano real de su vivienda, algo que hoy no existe de forma simple y editable.

### Licencia

MIT — ver [LICENSE](LICENSE).
