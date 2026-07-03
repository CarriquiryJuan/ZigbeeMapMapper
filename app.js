const SVG_NS = "http://www.w3.org/2000/svg";

const DEVICE_STYLE = {
  coordinator: { shape: "circle", r: 14, fill: "#f5c518", stroke: "#8a6d00" },
  router: { shape: "rect", size: 20, fill: "#4caf50", stroke: "#2e7031" },
  battery: { shape: "circle", r: 10, fill: "#2196f3", stroke: "#0d47a1" },
};

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
  }
  svg.appendChild(group);
}

function renderDevices(svg, devices) {
  const group = svgEl("g", { id: "layer-devices" });
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
  }
  svg.appendChild(group);
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

renderMap();
setupToggles();
