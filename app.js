const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const DEVICE_STYLE = {
  coordinator: { shape: "circle", r: 14, fill: "#f5c518", stroke: "#8a6d00" },
  router: { shape: "rect", size: 20, fill: "#4caf50", stroke: "#2e7031" },
  battery: { shape: "circle", r: 10, fill: "#2196f3", stroke: "#0d47a1" },
};

// Paleta para colorear habitaciones nuevas dibujadas en el editor.
const ROOM_PALETTE = [
  "#c9a227", "#6f8fc9", "#4fa8a0", "#d08b6b",
  "#7986cb", "#8d6e63", "#9575cd", "#4db6ac",
];

// Enlaces que tocan cada dispositivo, para reposicionarlos durante el drag
// sin tener que re-renderizar todo el SVG. Se llena en renderLinks().
let linkRefs = [];
// Elementos SVG (shape + label) de cada dispositivo, para reposicionarlos.
let deviceEls = {};
// Elementos SVG (polygon + label) de cada habitación, para reformarlas en vivo
// al arrastrar sus vértices. Índices paralelos al array `rooms`.
let roomEls = [];
// Se pone en true mientras se arrastra/toca un vértice, para que el click
// resultante no agregue un punto nuevo al polígono en construcción.
let vertexInteraction = false;
let devicesDirty = false;
let roomsDirty = false;
let linksDirty = false;

// Ajustes de visualización (no se exportan, son solo de la vista).
let iconScale = 0.7; // multiplicador del tamaño de los iconos
let linkWidth = 1.2; // grosor de las líneas de enlace
let connectIsolated = false; // conectar aislados a su mejor vecino (padre inferido)

// Recalculados en cada render por computeTreeInfo().
let primaryConnected = new Set(); // ids con al menos un enlace principal
let inferredKeys = new Set(); // pares "a|b" promovidos como padre inferido
let inferredConnected = new Set(); // ids conectados por padre inferido

// Checkbox -> selector de lo que muestra/oculta.
const TOGGLES = {
  "toggle-routers": ".device-router",
  "toggle-sensors": ".device-battery, .device-coordinator",
  "toggle-links": "#layer-links",
  "toggle-secondary": "#layer-links .secondary",
  "toggle-names": ".room-label",
  "toggle-lqi": ".lqi-label",
};

// --- Estado del editor de plano ---
let editMode = false;
let editPoints = []; // vértices [x, y] del polígono en construcción
let roomColorIndex = 0;
// Imagen de fondo (guía para calcar). Solo vive en el navegador (localStorage),
// nunca se sube al repo.
let bgImage = null; // { href, x, y, width, height }
let bgOpacity = 0.5;

function lqiColor(lqi) {
  if (lqi >= 200) return "#2e7d32"; // verde
  if (lqi >= 150) return "#1565c0"; // azul
  if (lqi >= 80) return "#6a1b9a"; // violeta
  return "#c62828"; // rojo
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

function slugify(s) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "room"
  );
}

function polygonBounds(rooms) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const room of rooms) {
    for (const [x, y] of room.polygon) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function computeBounds() {
  const b = polygonBounds(rooms);
  if (bgImage) {
    b.minX = Math.min(b.minX, bgImage.x);
    b.minY = Math.min(b.minY, bgImage.y);
    b.maxX = Math.max(b.maxX, bgImage.x + bgImage.width);
    b.maxY = Math.max(b.maxY, bgImage.y + bgImage.height);
  }
  if (!isFinite(b.minX)) return { minX: 0, minY: 0, maxX: 1000, maxY: 600 };
  return b;
}

function polygonCentroid(polygon) {
  const x = polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length;
  const y = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length;
  return { x, y };
}

function renderBackground(svg) {
  if (!bgImage) return;
  const im = svgEl("image", {
    x: bgImage.x,
    y: bgImage.y,
    width: bgImage.width,
    height: bgImage.height,
    opacity: bgOpacity,
    preserveAspectRatio: "none",
  });
  im.setAttributeNS(XLINK_NS, "href", bgImage.href);
  im.setAttribute("href", bgImage.href);
  svg.appendChild(im);
}

function renderRooms(svg, rooms) {
  const group = svgEl("g", { id: "layer-rooms" });
  roomEls = [];
  for (const room of rooms) {
    const points = room.polygon.map((p) => p.join(",")).join(" ");
    const poly = svgEl("polygon", {
      points,
      fill: room.color,
      stroke: "#555",
      "stroke-width": "2",
      "fill-opacity": "0.6",
    });
    poly.appendChild(svgEl("title", {})).textContent = room.name;
    group.appendChild(poly);

    const { x, y } = polygonCentroid(room.polygon);
    const label = svgEl("text", {
      x,
      y,
      "text-anchor": "middle",
      class: "room-label",
    });
    label.textContent = room.name;
    group.appendChild(label);

    roomEls.push({ poly, label });
  }
  svg.appendChild(group);
}

function updateRoomGeometry(ri) {
  const room = rooms[ri];
  const els = roomEls[ri];
  if (!room || !els) return;
  els.poly.setAttribute("points", room.polygon.map((p) => p.join(",")).join(" "));
  const { x, y } = polygonCentroid(room.polygon);
  els.label.setAttribute("x", x);
  els.label.setAttribute("y", y);
}

function renderLinks(svg, devices, links) {
  const group = svgEl("g", { id: "layer-links" });
  linkRefs = [];
  for (const link of links) {
    const from = devices[link.from];
    const to = devices[link.to];
    if (!from || !to) continue;

    // Un enlace es secundario solo si primary === false (los datos viejos sin
    // el campo se tratan como principales para no ocultarlos por sorpresa).
    // Si "conectar aislados" promovió este par, se muestra como padre inferido.
    const key = [link.from, link.to].sort().join("|");
    const inferred = link.primary === false && inferredKeys.has(key);
    const secondary = link.primary === false && !inferred;
    const edge = svgEl("g", {
      class: inferred
        ? "link-edge inferred"
        : secondary
        ? "link-edge secondary"
        : "link-edge",
    });

    const line = svgEl("line", {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      stroke: lqiColor(link.lqi),
      "stroke-width": linkWidth,
      "stroke-linecap": "round",
    });
    const kind = inferred ? " · padre inferido" : secondary ? " · secundario" : "";
    line.appendChild(svgEl("title", {})).textContent =
      `${link.from} -> ${link.to} (LQI ${link.lqi})${kind}`;
    edge.appendChild(line);

    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const label = svgEl("text", {
      x: midX,
      y: midY - 6,
      "text-anchor": "middle",
      class: "lqi-label",
    });
    label.textContent = link.lqi;
    edge.appendChild(label);

    group.appendChild(edge);
    linkRefs.push({ link, line, label });
  }
  svg.appendChild(group);
}

function renderDevices(svg, devices) {
  const group = svgEl("g", { id: "layer-devices" });
  deviceEls = {};
  for (const [id, device] of Object.entries(devices)) {
    const style = DEVICE_STYLE[device.type] || DEVICE_STYLE.router;
    // Aislado = no es coordinador, no tiene enlace principal y tampoco quedó
    // conectado por un padre inferido.
    const isolated =
      device.type !== "coordinator" &&
      !primaryConnected.has(id) &&
      !inferredConnected.has(id);
    const devGroup = svgEl("g", {
      class: `device device-${device.type}${isolated ? " isolated" : ""}`,
      "data-id": id,
    });

    const isCircle = style.shape === "circle";
    const r = isCircle ? style.r * iconScale : 0;
    const size = isCircle ? 0 : style.size * iconScale;
    const half = isCircle ? r : size / 2;
    const labelDy = half + 12;

    let shape;
    if (isCircle) {
      shape = svgEl("circle", {
        cx: device.x,
        cy: device.y,
        r,
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": "2",
      });
    } else {
      shape = svgEl("rect", {
        x: device.x - half,
        y: device.y - half,
        width: size,
        height: size,
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": "2",
      });
    }
    shape.appendChild(svgEl("title", {})).textContent =
      `${device.name} (${device.type})`;
    devGroup.appendChild(shape);

    const label = svgEl("text", {
      x: device.x,
      y: device.y + labelDy,
      "text-anchor": "middle",
      class: "device-label",
    });
    label.textContent = device.name;
    devGroup.appendChild(label);

    group.appendChild(devGroup);
    deviceEls[id] = { group: devGroup, shape, label, style, isCircle, half, labelDy };
    makeDraggable(devGroup, id);
  }
  svg.appendChild(group);
}

function toSvgPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function updateDevicePosition(id) {
  const device = devices[id];
  const els = deviceEls[id];
  if (!device || !els) return;

  if (els.isCircle) {
    els.shape.setAttribute("cx", device.x);
    els.shape.setAttribute("cy", device.y);
  } else {
    els.shape.setAttribute("x", device.x - els.half);
    els.shape.setAttribute("y", device.y - els.half);
  }
  els.label.setAttribute("x", device.x);
  els.label.setAttribute("y", device.y + els.labelDy);

  for (const ref of linkRefs) {
    if (ref.link.from !== id && ref.link.to !== id) continue;
    const from = devices[ref.link.from];
    const to = devices[ref.link.to];
    ref.line.setAttribute("x1", from.x);
    ref.line.setAttribute("y1", from.y);
    ref.line.setAttribute("x2", to.x);
    ref.line.setAttribute("y2", to.y);
    ref.label.setAttribute("x", (from.x + to.x) / 2);
    ref.label.setAttribute("y", (from.y + to.y) / 2 - 6);
  }
}

function markDevicesDirty() {
  if (devicesDirty) return;
  devicesDirty = true;
  const btn = document.getElementById("btn-export");
  if (btn) btn.classList.add("dirty");
}

function markRoomsDirty() {
  roomsDirty = true;
  const btn = document.getElementById("btn-export-rooms");
  if (btn) btn.classList.add("dirty");
}

function markLinksDirty() {
  linksDirty = true;
  const btn = document.getElementById("btn-export-links");
  if (btn) btn.classList.add("dirty");
}

function makeDraggable(devGroup, id) {
  let offset = { x: 0, y: 0 };

  devGroup.addEventListener("pointerdown", (evt) => {
    if (editMode) return; // en modo edición no se arrastran dispositivos
    evt.preventDefault();
    devGroup.setPointerCapture(evt.pointerId);
    const svg = document.getElementById("map");
    const pt = toSvgPoint(svg, evt);
    offset.x = pt.x - devices[id].x;
    offset.y = pt.y - devices[id].y;
    devGroup.classList.add("dragging");
  });

  devGroup.addEventListener("pointermove", (evt) => {
    if (!devGroup.hasPointerCapture(evt.pointerId)) return;
    const svg = document.getElementById("map");
    const pt = toSvgPoint(svg, evt);
    devices[id].x = Math.round(pt.x - offset.x);
    devices[id].y = Math.round(pt.y - offset.y);
    updateDevicePosition(id);
    markDevicesDirty();
  });

  const endDrag = (evt) => {
    if (devGroup.hasPointerCapture(evt.pointerId)) {
      devGroup.releasePointerCapture(evt.pointerId);
    }
    devGroup.classList.remove("dragging");
  };
  devGroup.addEventListener("pointerup", endDrag);
  devGroup.addEventListener("pointercancel", endDrag);
}

// ---------- Editor de plano ----------

function updateEditorLayer(cursor) {
  const layer = document.getElementById("editor-layer");
  if (!layer) return;
  layer.innerHTML = "";
  if (!editMode || editPoints.length === 0) return;

  const pts = editPoints.map((p) => p.join(",")).join(" ");
  layer.appendChild(
    svgEl("polyline", {
      points: pts,
      fill: "rgba(245,197,24,0.15)",
      stroke: "#f5c518",
      "stroke-width": "2",
      "stroke-dasharray": "5 3",
    })
  );

  if (cursor) {
    const last = editPoints[editPoints.length - 1];
    layer.appendChild(
      svgEl("line", {
        x1: last[0],
        y1: last[1],
        x2: cursor.x,
        y2: cursor.y,
        stroke: "#f5c518",
        "stroke-width": "1.5",
        "stroke-dasharray": "3 3",
        opacity: "0.7",
      })
    );
  }

  for (const [x, y] of editPoints) {
    layer.appendChild(
      svgEl("circle", { cx: x, cy: y, r: 5, fill: "#f5c518", stroke: "#000", "stroke-width": "1" })
    );
  }
}

function renderVertexHandles() {
  const layer = document.getElementById("vertex-handles");
  if (!layer) return;
  layer.innerHTML = "";
  if (!editMode) return;
  rooms.forEach((room, ri) => {
    room.polygon.forEach((pt, pi) => {
      const handle = svgEl("circle", {
        cx: pt[0],
        cy: pt[1],
        r: 5,
        class: "vertex-handle",
      });
      const title = svgEl("title", {});
      title.textContent = `${room.name} · vértice ${pi + 1} (arrastrar para mover, click derecho para borrar)`;
      handle.appendChild(title);
      makeVertexDraggable(handle, ri, pi);
      layer.appendChild(handle);
    });
  });
}

function makeVertexDraggable(handle, ri, pi) {
  handle.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    vertexInteraction = true;
    handle.setPointerCapture(evt.pointerId);
    handle.classList.add("dragging");
  });

  handle.addEventListener("pointermove", (evt) => {
    if (!handle.hasPointerCapture(evt.pointerId)) return;
    const svg = document.getElementById("map");
    const p = toSvgPoint(svg, evt);
    rooms[ri].polygon[pi] = [Math.round(p.x), Math.round(p.y)];
    handle.setAttribute("cx", rooms[ri].polygon[pi][0]);
    handle.setAttribute("cy", rooms[ri].polygon[pi][1]);
    updateRoomGeometry(ri);
    markRoomsDirty();
  });

  const endDrag = (evt) => {
    if (handle.hasPointerCapture(evt.pointerId)) {
      handle.releasePointerCapture(evt.pointerId);
    }
    handle.classList.remove("dragging");
    // Se resetea tras el click que dispara el pointerup, para no agregar punto.
    setTimeout(() => {
      vertexInteraction = false;
    }, 0);
  };
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  handle.addEventListener("contextmenu", (evt) => {
    evt.preventDefault();
    if (rooms[ri].polygon.length <= 3) {
      alert("Una habitación necesita al menos 3 vértices.");
      return;
    }
    rooms[ri].polygon.splice(pi, 1);
    renderMap();
    markRoomsDirty();
  });
}

function onEditClick(evt) {
  if (!editMode) return;
  if (vertexInteraction) {
    // El click viene de soltar un vértice: no agregar punto nuevo.
    vertexInteraction = false;
    return;
  }
  const svg = document.getElementById("map");
  const pt = toSvgPoint(svg, evt);
  editPoints.push([Math.round(pt.x), Math.round(pt.y)]);
  updateEditorLayer();
}

function onEditMove(evt) {
  if (!editMode || editPoints.length === 0) return;
  const svg = document.getElementById("map");
  const pt = toSvgPoint(svg, evt);
  updateEditorLayer({ x: pt.x, y: pt.y });
}

function finishRoom() {
  if (!editMode) return;
  if (editPoints.length < 3) {
    alert("Necesitás al menos 3 puntos para cerrar una habitación.");
    return;
  }
  const name = prompt("Nombre de la habitación:", "Nueva");
  if (name === null) return; // cancelado: conserva los puntos
  let id = slugify(name);
  const base = id;
  let n = 2;
  while (rooms.some((r) => r.id === id)) id = `${base}_${n++}`;
  const color = ROOM_PALETTE[roomColorIndex++ % ROOM_PALETTE.length];
  rooms.push({ id, name, color, polygon: editPoints.slice() });
  editPoints = [];
  renderMap();
  refreshRoomList();
  markRoomsDirty();
}

function undoPoint() {
  editPoints.pop();
  updateEditorLayer();
}

function cancelRoom() {
  editPoints = [];
  updateEditorLayer();
}

function deleteRoom(id) {
  const room = rooms.find((r) => r.id === id);
  if (!room) return;
  if (!confirm(`¿Borrar la habitación "${room.name}"?`)) return;
  const idx = rooms.indexOf(room);
  rooms.splice(idx, 1);
  renderMap();
  refreshRoomList();
  markRoomsDirty();
}

function clearAllRooms() {
  if (!confirm("¿Borrar TODAS las habitaciones? (útil para redibujar el plano desde cero sobre la imagen de fondo)")) return;
  rooms.splice(0, rooms.length);
  renderMap();
  refreshRoomList();
  markRoomsDirty();
}

function toggleEditMode() {
  editMode = !editMode;
  const svg = document.getElementById("map");
  svg.classList.toggle("edit-mode", editMode);
  const panel = document.getElementById("editor-panel");
  if (panel) panel.classList.toggle("hidden", !editMode);
  const btn = document.getElementById("btn-edit-plan");
  if (btn) {
    btn.classList.toggle("active", editMode);
    btn.textContent = editMode ? "✏️ Editando plano — salir" : "✏️ Editar plano";
  }
  if (!editMode) editPoints = [];
  renderMap();
  refreshRoomList();
}

function refreshRoomList() {
  const list = document.getElementById("room-list");
  if (!list) return;
  list.innerHTML = "";
  for (const r of rooms) {
    const li = document.createElement("li");

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = r.color;

    const span = document.createElement("span");
    span.className = "room-name";
    span.textContent = r.name;

    const del = document.createElement("button");
    del.className = "room-del";
    del.textContent = "✕";
    del.title = "Borrar habitación";
    del.addEventListener("click", () => deleteRoom(r.id));

    li.appendChild(swatch);
    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);
  }
}

// ---------- Imagen de fondo ----------

function loadBackground(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      bgImage = {
        href: reader.result,
        x: 0,
        y: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      try {
        localStorage.setItem("zbmap_bg", JSON.stringify(bgImage));
      } catch (e) {
        /* imagen demasiado grande para localStorage: se usa solo esta sesión */
      }
      renderMap();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function removeBackground() {
  bgImage = null;
  try {
    localStorage.removeItem("zbmap_bg");
  } catch (e) {}
  renderMap();
}

function restoreBackground() {
  try {
    const s = localStorage.getItem("zbmap_bg");
    if (s) bgImage = JSON.parse(s);
  } catch (e) {}
}

// ---------- Render principal ----------

// Calcula qué dispositivos tienen padre (enlace principal) y, si está activo
// "conectar aislados", qué enlace de mayor LQI se promueve como padre inferido.
function computeTreeInfo() {
  primaryConnected = new Set();
  for (const l of links) {
    if (l.primary !== false) {
      primaryConnected.add(l.from);
      primaryConnected.add(l.to);
    }
  }
  inferredKeys = new Set();
  inferredConnected = new Set();
  if (!connectIsolated) return;
  for (const id of Object.keys(devices)) {
    if (devices[id].type === "coordinator" || primaryConnected.has(id)) continue;
    let best = null;
    for (const l of links) {
      if (l.from !== id && l.to !== id) continue;
      if (best === null || l.lqi > best.lqi) best = l;
    }
    if (best) {
      inferredKeys.add([best.from, best.to].sort().join("|"));
      inferredConnected.add(id);
    }
  }
}

function renderMap() {
  const svg = document.getElementById("map");
  svg.innerHTML = "";

  computeTreeInfo();
  const bounds = computeBounds();
  const padding = 60;
  svg.setAttribute(
    "viewBox",
    `${bounds.minX - padding} ${bounds.minY - padding} ${
      bounds.maxX - bounds.minX + padding * 2
    } ${bounds.maxY - bounds.minY + padding * 2}`
  );

  renderBackground(svg);
  renderRooms(svg, rooms);
  renderLinks(svg, devices, links);
  renderDevices(svg, devices);
  svg.appendChild(svgEl("g", { id: "vertex-handles" }));
  svg.appendChild(svgEl("g", { id: "editor-layer" }));
  renderVertexHandles();
  updateEditorLayer();
  applyAllToggles();
}

// ---------- Exportar código fuente ----------

function exportDevicesSource() {
  const lines = ["const devices = {"];
  for (const [id, d] of Object.entries(devices)) {
    lines.push(
      `  ${id}: { name: ${JSON.stringify(d.name)}, type: ${JSON.stringify(
        d.type
      )}, room: ${JSON.stringify(d.room)}, x: ${Math.round(
        d.x
      )}, y: ${Math.round(d.y)} },`
    );
  }
  lines.push("};");
  return lines.join("\n");
}

function exportRoomsSource() {
  const lines = ["const rooms = ["];
  for (const r of rooms) {
    const poly = r.polygon.map((p) => `[${p[0]}, ${p[1]}]`).join(", ");
    lines.push(
      `  { id: ${JSON.stringify(r.id)}, name: ${JSON.stringify(
        r.name
      )}, color: ${JSON.stringify(r.color)}, polygon: [${poly}] },`
    );
  }
  lines.push("];");
  return lines.join("\n");
}

function exportLinksSource() {
  const lines = ["const links = ["];
  for (const l of links) {
    const primary = l.primary === false ? ", primary: false" : "";
    lines.push(
      `  { from: ${JSON.stringify(l.from)}, to: ${JSON.stringify(
        l.to
      )}, lqi: ${l.lqi}${primary} },`
    );
  }
  lines.push("];");
  return lines.join("\n");
}

// ---------- Importar de Zigbee2MQTT ----------

// Encuentra los arrays nodes/links dentro del JSON, sin importar cómo venga
// envuelto (respuesta cruda del networkmap, {data:{value:{...}}}, etc.).
function extractNodesLinks(json) {
  const candidates = [
    json,
    json && json.value,
    json && json.data,
    json && json.data && json.data.value,
    json && json.networkmap,
  ];
  for (const c of candidates) {
    if (c && Array.isArray(c.nodes)) {
      return { nodes: c.nodes, links: Array.isArray(c.links) ? c.links : [] };
    }
  }
  // Fallback: lista de dispositivos (bridge/devices), sin enlaces.
  if (Array.isArray(json)) return { nodes: json, links: [] };
  if (json && Array.isArray(json.devices)) return { nodes: json.devices, links: [] };
  return { nodes: null, links: null };
}

function mapZ2MType(type) {
  const s = String(type || "").toLowerCase();
  if (s.includes("coordinator")) return "coordinator";
  if (s.includes("router")) return "router";
  return "battery"; // EndDevice / desconocido
}

function importZ2M(json) {
  const { nodes, links: rawLinks } = extractNodesLinks(json);
  if (!nodes || nodes.length === 0) {
    alert(
      "No encontré 'nodes' en el JSON. Pegá la respuesta del networkmap de Zigbee2MQTT (type: raw) o la lista de bridge/devices."
    );
    return;
  }

  // Zona de "staging" para dispositivos nuevos: debajo del plano actual.
  const bounds = computeBounds();
  const stagingX = Math.round(bounds.minX);
  const stagingY = Math.round(bounds.maxY + 60);
  const COLS = 12;
  const STEP = 55;
  let placed = 0;

  const newDevices = {};
  const idByIeee = {};
  let coordinatorSkipped = 0;

  for (const node of nodes) {
    const fname =
      node.friendlyName ||
      node.friendly_name ||
      node.ieeeAddr ||
      node.ieee_address ||
      "device";
    const ieee = node.ieeeAddr || node.ieee_address || fname;
    const id = slugify(fname);
    if (newDevices[id]) continue; // nombre duplicado
    idByIeee[ieee] = id;

    const type = mapZ2MType(node.type);
    const existing = devices[id];
    let x, y, room;
    if (existing) {
      x = existing.x;
      y = existing.y;
      room = existing.room;
    } else {
      x = stagingX + (placed % COLS) * STEP;
      y = stagingY + Math.floor(placed / COLS) * STEP;
      room = "";
      placed++;
    }
    newDevices[id] = { name: fname, type, room, x, y };
  }

  // Enlaces: dedupe por par no ordenado, quedándose con el mayor LQI.
  const pairMap = new Map();
  for (const l of rawLinks || []) {
    const s = l.sourceIeeeAddr || (l.source && l.source.ieeeAddr) || l.source;
    const t = l.targetIeeeAddr || (l.target && l.target.ieeeAddr) || l.target;
    const lqi = l.lqi != null ? l.lqi : l.linkquality != null ? l.linkquality : l.depth;
    const from = idByIeee[s];
    const to = idByIeee[t];
    // lqi 0 = vecino sin medición válida; se descarta para no ensuciar el mapa.
    if (!from || !to || from === to || lqi == null || lqi <= 0) continue;
    // relationship: 0 = el vecino es padre, 1 = hijo (ambos = árbol/principal),
    // 2 = hermano (vecino/secundario). Un par es principal si en algún sentido
    // se ve como padre-hijo.
    const isTree = l.relationship === 0 || l.relationship === 1;
    const key = [from, to].sort().join("|");
    const prev = pairMap.get(key);
    if (!prev) {
      pairMap.set(key, { from, to, lqi, primary: isTree });
    } else {
      if (lqi > prev.lqi) prev.lqi = lqi;
      if (isTree) prev.primary = true;
    }
  }

  // Aplicar: mutamos los objetos const existentes (devices/links).
  for (const k of Object.keys(devices)) delete devices[k];
  Object.assign(devices, newDevices);
  links.length = 0;
  for (const v of pairMap.values()) links.push(v);

  renderMap();
  refreshRoomList();
  markDevicesDirty();
  markLinksDirty();

  const nNew = placed;
  const nKept = Object.keys(newDevices).length - nNew;
  alert(
    `Importado: ${Object.keys(newDevices).length} dispositivos ` +
      `(${nKept} ya ubicados, ${nNew} nuevos en la zona de staging debajo del plano) ` +
      `y ${links.length} enlaces.\n\n` +
      `Arrastrá los dispositivos nuevos a su lugar y después usá ` +
      `"Guardar posiciones" y "Exportar links.js".`
  );
}

async function copyToOutput(outputId, btn, source, okLabel, resetLabel) {
  const output = document.getElementById(outputId);
  output.value = source;
  output.classList.remove("hidden");
  output.focus();
  output.select();
  try {
    await navigator.clipboard.writeText(source);
    btn.textContent = okLabel;
  } catch {
    btn.textContent = "Seleccionado abajo — Ctrl+C para copiar";
  }
  btn.classList.remove("dirty");
  setTimeout(() => {
    btn.textContent = resetLabel;
  }, 3000);
}

function setupExport() {
  const btnDev = document.getElementById("btn-export");
  if (btnDev) {
    btnDev.addEventListener("click", () => {
      devicesDirty = false;
      copyToOutput(
        "export-output",
        btnDev,
        exportDevicesSource(),
        "Copiado ✓ (pegalo en devices.js)",
        "Guardar posiciones"
      );
    });
  }

  const btnRooms = document.getElementById("btn-export-rooms");
  if (btnRooms) {
    btnRooms.addEventListener("click", () => {
      roomsDirty = false;
      copyToOutput(
        "rooms-output",
        btnRooms,
        exportRoomsSource(),
        "Copiado ✓ (pegalo en rooms.js)",
        "Exportar rooms.js"
      );
    });
  }

  const btnLinks = document.getElementById("btn-export-links");
  if (btnLinks) {
    btnLinks.addEventListener("click", () => {
      linksDirty = false;
      copyToOutput(
        "links-output",
        btnLinks,
        exportLinksSource(),
        "Copiado ✓ (pegalo en links.js)",
        "Exportar links.js"
      );
    });
  }
}

function parseAndImport(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    alert("El texto no es un JSON válido:\n" + e.message);
    return;
  }
  importZ2M(json);
}

function setupImport() {
  const btn = document.getElementById("btn-import");
  const text = document.getElementById("import-text");
  if (btn && text) {
    btn.addEventListener("click", () => {
      const raw = text.value.trim();
      if (!raw) {
        alert("Pegá el JSON del networkmap de Zigbee2MQTT en el cuadro de texto (o cargá un archivo).");
        return;
      }
      parseAndImport(raw);
    });
  }

  const fileInput = document.getElementById("import-input");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (text) text.value = reader.result;
        parseAndImport(String(reader.result).trim());
      };
      reader.readAsText(file);
    });
  }

  const helpToggle = document.getElementById("import-help-toggle");
  const help = document.getElementById("import-help");
  if (helpToggle && help) {
    helpToggle.addEventListener("click", (e) => {
      e.preventDefault();
      help.classList.toggle("hidden");
    });
  }
}

function setupEditor() {
  const svg = document.getElementById("map");
  svg.addEventListener("click", onEditClick);
  svg.addEventListener("mousemove", onEditMove);

  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  };
  bind("btn-edit-plan", toggleEditMode);
  bind("btn-finish-room", finishRoom);
  bind("btn-undo-point", undoPoint);
  bind("btn-cancel-room", cancelRoom);
  bind("btn-clear-rooms", clearAllRooms);
  bind("btn-remove-bg", removeBackground);

  const bgInput = document.getElementById("bg-input");
  if (bgInput) {
    bgInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) loadBackground(e.target.files[0]);
    });
  }

  const opacity = document.getElementById("bg-opacity");
  if (opacity) {
    opacity.addEventListener("input", (e) => {
      bgOpacity = Number(e.target.value);
      renderMap();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!editMode) return;
    const tag = (e.target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "Enter") {
      e.preventDefault();
      finishRoom();
    } else if (e.key === "Escape") {
      cancelRoom();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      undoPoint();
    }
  });
}

restoreBackground();
renderMap();
setupToggles();
setupExport();
setupEditor();
setupImport();
setupViewControls();

function setupViewControls() {
  const iconSlider = document.getElementById("icon-size");
  if (iconSlider) {
    iconSlider.addEventListener("input", (e) => {
      iconScale = Number(e.target.value);
      renderMap();
    });
  }
  const linkSlider = document.getElementById("link-width");
  if (linkSlider) {
    linkSlider.addEventListener("input", (e) => {
      linkWidth = Number(e.target.value);
      renderMap();
    });
  }
  const connectCb = document.getElementById("toggle-connect-isolated");
  if (connectCb) {
    connectCb.addEventListener("change", (e) => {
      connectIsolated = e.target.checked;
      renderMap();
    });
  }
}

function applyToggle(id) {
  const checkbox = document.getElementById(id);
  const selector = TOGGLES[id];
  if (!checkbox || !selector) return;
  document.querySelectorAll(selector).forEach((el) => {
    el.style.display = checkbox.checked ? "" : "none";
  });
}

// Re-aplica el estado de todos los checkboxes. Se llama al final de renderMap()
// para que los toggles sigan valiendo después de re-renderizar (import, etc.).
function applyAllToggles() {
  Object.keys(TOGGLES).forEach(applyToggle);
}

function setupToggles() {
  Object.keys(TOGGLES).forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) checkbox.addEventListener("change", () => applyToggle(id));
  });
}
