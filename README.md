# Zigbee House Map

Visualizador de redes Zigbee (Zigbee2MQTT / Home Assistant) sobre el plano real de tu casa. Sin instalar nada: es HTML + CSS + JS puro, se abre con doble clic en `index.html`.

![status](https://img.shields.io/badge/version-0.7-blue)

## ¿Qué hace?

- Dibuja el plano de tu casa como habitaciones coloreadas (SVG).
- Ubica tus dispositivos Zigbee (coordinador, routers, sensores) en el plano.
- Dibuja los enlaces entre dispositivos, coloreados según la calidad de señal (LQI).
- Al pasar el mouse sobre un dispositivo o enlace, muestra su nombre y LQI.
- Panel lateral para mostrar/ocultar routers, sensores, enlaces, nombres de habitaciones y valores de LQI, con sliders para el tamaño de los iconos y el grosor de las líneas. El nombre de cada dispositivo aparece al pasar el mouse por encima.
- Arrastrá cualquier dispositivo con el mouse: las líneas se recalculan solas. Los cambios viven solo en memoria — usá el botón "Guardar posiciones" para copiar el `devices.js` actualizado y pegarlo en el archivo.
- **Editor de plano** integrado: dibujá habitaciones a click, cargá tu plano como imagen de fondo para calcar encima, borrá habitaciones y exportá el `rooms.js` actualizado (ver abajo).
- **Importá el mapa de red de Zigbee2MQTT** (JSON) y la app crea los dispositivos y enlaces sola, conservando las posiciones que ya definiste (ver abajo).
- Distingue **enlaces principales** (el árbol padre-hijo de la red) de los **secundarios** (vecinos/rutas de respaldo), que podés ocultar con un check para dejar el mapa legible.

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

En vez de escribirlos a mano, podés generarlos automáticamente importando el mapa de red de Zigbee2MQTT (ver abajo).

## Importar de Zigbee2MQTT

La app puede crear los dispositivos y los enlaces automáticamente a partir del **mapa de red** de Zigbee2MQTT.

### Cómo obtener el JSON

Publicá por MQTT (por ejemplo desde Home Assistant → Herramientas para desarrolladores → MQTT, o con MQTT Explorer):

- **Topic:** `zigbee2mqtt/bridge/request/networkmap`
- **Payload:** `{"type":"raw","routes":false}`

La respuesta llega al topic `zigbee2mqtt/bridge/response/networkmap`. Copiá todo ese JSON.

> Alternativa: la lista de `zigbee2mqtt/bridge/devices` también sirve, pero solo crea dispositivos (sin enlaces ni LQI).

### Importarlo

1. En el panel lateral, **Importar de Zigbee2MQTT**, pegá el JSON en el cuadro de texto (o cargá un archivo `.json`).
2. Clic en **Importar**. La app:
   - crea un dispositivo por cada nodo (mapeando el tipo: Coordinator → coordinador, Router → router, EndDevice → sensor a pila);
   - crea los enlaces con su LQI, quedándose con el mejor valor cuando el enlace aparece en ambos sentidos;
   - marca cada enlace como **principal** (relación padre-hijo del árbol Zigbee) o **secundario** (vecino/hermano), usando el campo `relationship` del mapa. Los secundarios se ocultan por defecto (check "Enlaces secundarios") para que el mapa quede legible;
   - **conserva la posición** de los dispositivos que ya tenías ubicados (los reconoce por el nombre), y coloca los nuevos en una zona de *staging* debajo del plano.
3. Arrastrá los dispositivos nuevos a su lugar en el plano.
4. Clic en **Guardar posiciones** (copia el `devices.js`) y **Exportar links.js** (copia el `links.js`), y pegá cada uno en su archivo.

> El id de cada dispositivo se deriva de su *friendly name* de Zigbee2MQTT. Mientras no cambies esos nombres, cada nueva importación va a reconocer los dispositivos y respetar dónde los pusiste — así podés reimportar cuando cambie tu red sin rehacer el plano.

## Editor de plano (dibujar habitaciones)

En vez de escribir las coordenadas a mano, podés dibujar el plano desde la propia app:

1. Clic en **✏️ Editar plano** para entrar en modo edición.
2. (Opcional pero recomendado) En **Imagen de fondo**, cargá una foto o captura de tu plano para calcarla. Ajustá la opacidad con el slider. **La imagen se guarda solo en tu navegador (localStorage), nunca se sube al repo.**
3. Hacé **click** en el mapa para ir marcando los vértices de una habitación.
   - **Enter** cierra la habitación (te pide un nombre).
   - **Backspace** deshace el último punto.
   - **Esc** cancela la habitación en curso.
4. Repetí para cada habitación. Podés borrar habitaciones existentes con la ✕ de la lista, o **Borrar todas** para redibujar el plano desde cero sobre tu imagen de fondo.
5. Clic en **Exportar rooms.js** para copiar el código actualizado y pegarlo en tu `rooms.js`.

## Roadmap

- [x] v0.1 — Plano + dispositivos + enlaces (estático)
- [x] v0.2 — Datos reales separados en `*.example.js` (público) vs `rooms.js`/`devices.js`/`links.js` (privado, gitignored)
- [x] v0.3 — Arrastrar dispositivos con el mouse + botón para copiar el `devices.js` actualizado
- [x] v0.4 — Editor de plano: dibujar habitaciones a click, imagen de fondo como guía, exportar `rooms.js`
- [x] v0.5 — Importar el JSON del mapa de red de Zigbee2MQTT para crear dispositivos y enlaces (conservando posiciones)
- [x] v0.6 — Sliders de tamaño de iconos y grosor de líneas; nombres de dispositivo al pasar el mouse
- [x] v0.7 — Enlaces principales (árbol padre-hijo) vs secundarios (vecinos), con check para ocultar los secundarios
- [ ] v0.8 — Zoom y pan
- [ ] v0.9 — Exportar a SVG / PNG
- [ ] v1.0 — Estadísticas de red, alertas de LQI bajo, sugerencias de ubicación de routers

## Contribuir

Ideas, issues y PRs son bienvenidos. El objetivo es que cualquiera con Home Assistant + Zigbee2MQTT pueda tener un mapa visual de su red Zigbee sobre el plano real de su vivienda, algo que hoy no existe de forma simple y editable.

## Licencia

MIT — ver [LICENSE](LICENSE).
