const SVG_NS = "http://www.w3.org/2000/svg";

const DEVICE_STYLE = {
  coordinator: { shape: "circle", r: 14, fill: "#f5c518", stroke: "#8a6d00" },
  router: { shape: "rect", size: 20, fill: "#4caf50", stroke: "#2e7031" },
  battery: { shape: "circle", r: 10, fill: "#2196f3", stroke: "#0d47a1" },
};

// Enlaces que tocan cada dispositivo, para reposicionarlos durante el drag
// sin tener que re-renderizar todo el SVG. Se llena en renderLinks().
let linkRefs = [];
// Elementos SVG (shape + label) de cada dispositivo, para reposicionarlos.
let deviceEls = {};
let dirty = false;

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

function polygonCentroid(polygon) {
  const x = polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length;
  const y = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length;
  return { x, y };
}

function renderRooms(svg, rooms) {
  const group = svgEl("g", { id: "layer-rooms" });
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
  }
  svg.appendChild(group);
}

function renderLinks(svg, devices, links) {
  const group = svgEl("g", { id: "layer-links" });
  linkRefs = [];
  for (const link of links) {
    const from = devices[link.from];
    const to = devices[link.to];
    if (!from || !to) continue;

    const line = svgEl("line", {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      stroke: lqiColor(link.lqi),
      "stroke-width": "3",
      "stroke-linecap": "round",
    });
    line.appendChild(svgEl("title", {})).textContent =
      `${link.from} -> ${link.to} (LQI ${link.lqi})`;
    group.appendChild(line);

    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const label = svgEl("text", {
      x: midX,
      y: midY - 6,
      "text-anchor": "middle",
      class: "lqi-label",
    });
    label.textContent = link.lqi;
    group.appendChild(label);

    linkRefs.push({ link, line, label });
  }
  svg.appendChild(group);
}

function renderDevices(svg, devices) {
  const group = svgEl("g", { id: "layer-devices" });
  deviceEls = {};
  for (const [id, device] of Object.entries(devices)) {
    const style = DEVICE_STYLE[device.type] || DEVICE_STYLE.router;
    const devGroup = svgEl("g", {
      class: `device device-${device.type}`,
      "data-id": id,
    });

    let shape;
    if (style.shape === "circle") {
      shape = svgEl("circle", {
        cx: device.x,
        cy: device.y,
        r: style.r,
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": "2",
      });
    } else {
      shape = svgEl("rect", {
        x: device.x - style.size / 2,
        y: device.y - style.size / 2,
        width: style.size,
        height: style.size,
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
      y: device.y + 26,
      "text-anchor": "middle",
      class: "device-label",
    });
    label.textContent = device.name;
    devGroup.appendChild(label);

    group.appendChild(devGroup);
    deviceEls[id] = { group: devGroup, shape, label, style };
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

  if (els.style.shape === "circle") {
    els.shape.setAttribute("cx", device.x);
    els.shape.setAttribute("cy", device.y);
  } else {
    els.shape.setAttribute("x", device.x - els.style.size / 2);
    els.shape.setAttribute("y", device.y - els.style.size / 2);
  }
  els.label.setAttribute("x", device.x);
  els.label.setAttribute("y", device.y + 26);

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

function markDirty() {
  if (dirty) return;
  dirty = true;
  const btn = document.getElementById("btn-export");
  if (btn) btn.classList.add("dirty");
}

function makeDraggable(devGroup, id) {
  let offset = { x: 0, y: 0 };

  devGroup.addEventListener("pointerdown", (evt) => {
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
    markDirty();
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

function renderMap() {
  const svg = document.getElementById("map");
  svg.innerHTML = "";

  const bounds = polygonBounds(rooms);
  const padding = 60;
  svg.setAttribute(
    "viewBox",
    `${bounds.minX - padding} ${bounds.minY - padding} ${
      bounds.maxX - bounds.minX + padding * 2
    } ${bounds.maxY - bounds.minY + padding * 2}`
  );

  renderRooms(svg, rooms);
  renderLinks(svg, devices, links);
  renderDevices(svg, devices);
}

function setupToggles() {
  const toggles = {
    "toggle-routers": ".device-router",
    "toggle-sensors": ".device-battery, .device-coordinator",
    "toggle-links": "#layer-links",
    "toggle-names": ".device-label, .room-label",
    "toggle-lqi": ".lqi-label",
  };

  for (const [checkboxId, selector] of Object.entries(toggles)) {
    const checkbox = document.getElementById(checkboxId);
    if (!checkbox) continue;
    checkbox.addEventListener("change", () => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.display = checkbox.checked ? "" : "none";
      });
    });
  }
}

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

function setupExport() {
  const btn = document.getElementById("btn-export");
  const output = document.getElementById("export-output");
  if (!btn || !output) return;

  btn.addEventListener("click", async () => {
    const source = exportDevicesSource();
    output.value = source;
    output.classList.remove("hidden");
    output.focus();
    output.select();

    try {
      await navigator.clipboard.writeText(source);
      btn.textContent = "Copiado ✓ (pegalo en devices.js)";
    } catch {
      btn.textContent = "Seleccionado abajo — Ctrl+C para copiar";
    }
    btn.classList.remove("dirty");
    dirty = false;
    setTimeout(() => {
      btn.textContent = "Guardar posiciones";
    }, 3000);
  });
}

renderMap();
setupToggles();
setupExport();
