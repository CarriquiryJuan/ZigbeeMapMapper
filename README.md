# Zigbee House Map

Visualizador de redes Zigbee (Zigbee2MQTT / Home Assistant) sobre el plano real de tu casa. Sin instalar nada: es HTML + CSS + JS puro, se abre con doble clic en `index.html`.

![status](https://img.shields.io/badge/version-0.3-blue)

## ¿Qué hace?

- Dibuja el plano de tu casa como habitaciones coloreadas (SVG).
- Ubica tus dispositivos Zigbee (coordinador, routers, sensores) en el plano.
- Dibuja los enlaces entre dispositivos, coloreados según la calidad de señal (LQI).
- Al pasar el mouse sobre un dispositivo o enlace, muestra su nombre y LQI.
- Panel lateral para mostrar/ocultar routers, sensores, enlaces, nombres y valores de LQI.
- Arrastrá cualquier dispositivo con el mouse: las líneas se recalculan solas. Los cambios viven solo en memoria — usá el botón "Guardar posiciones" para copiar el `devices.js` actualizado y pegarlo en el archivo.

## Cómo usarlo

1. Cloná o descargá este repositorio.
2. Copiá los archivos de ejemplo a los archivos "reales" que usa la app:
   ```
   cp rooms.example.js rooms.js
   cp devices.example.js devices.js
   cp links.example.js links.js
   ```
3. Editá esos `rooms.js`, `devices.js` y `links.js` con los datos de tu propia casa (ver abajo).
4. Abrí `index.html` en el navegador (doble clic alcanza).

> **Privacidad:** `rooms.js`, `devices.js` y `links.js` están en `.gitignore` a propósito. El plano de tu casa y tus dispositivos son datos privados — si hacés fork o subís cambios, esos archivos nunca se van a versionar ni pushear por accidente. Solo los `*.example.js` (genéricos) quedan en el repo público.

## Cómo personalizarlo con tu propia casa

### `rooms.js`

Cada habitación es un polígono de puntos `[x, y]` en un plano cartesiano arbitrario (por ejemplo, calcado sobre un plano en escala, o simplemente estimado a ojo).

```js
{
  id: "cocina",
  name: "Cocina",
  color: "#c8e6c9",
  polygon: [[520, 40], [880, 40], [880, 300], [520, 300]],
}
```

### `devices.js`

Cada dispositivo tiene una posición `x`/`y` y un `type`: `"coordinator"`, `"router"` o `"battery"` (sensor a pila).

```js
switch_estar: {
  name: "Switch Estar",
  type: "router",
  room: "estar",
  x: 300,
  y: 320,
}
```

### `links.js`

Cada enlace conecta dos IDs de `devices.js` con su LQI (Link Quality Indicator).

```js
{ from: "coordinator", to: "switch_estar", lqi: 235 }
```

Podés obtener los enlaces y el LQI real desde el mapa de red de Zigbee2MQTT (Settings → Network map → JSON/Raw).

## Roadmap

- [x] v0.1 — Plano + dispositivos + enlaces (estático)
- [x] v0.2 — Datos reales separados en `*.example.js` (público) vs `rooms.js`/`devices.js`/`links.js` (privado, gitignored)
- [x] v0.3 — Arrastrar dispositivos con el mouse + botón para copiar el `devices.js` actualizado
- [ ] v0.4 — Zoom y pan
- [ ] v0.5 — Exportar a SVG / PNG
- [ ] v1.0 — Importar directamente el JSON del mapa de red de Zigbee2MQTT, estadísticas de red, alertas de LQI bajo, sugerencias de ubicación de routers

## Contribuir

Ideas, issues y PRs son bienvenidos. El objetivo es que cualquiera con Home Assistant + Zigbee2MQTT pueda tener un mapa visual de su red Zigbee sobre el plano real de su vivienda, algo que hoy no existe de forma simple y editable.

## Licencia

MIT — ver [LICENSE](LICENSE).
