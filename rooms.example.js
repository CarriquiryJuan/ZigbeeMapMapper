// Plano de la casa: cada habitación es un polígono en el plano SVG.
// Reemplazá estos valores por las coordenadas reales de tu plano.
const rooms = [
  {
    id: "estar",
    name: "Living / Estar",
    color: "#f4e2b8",
    polygon: [[40, 40], [520, 40], [520, 420], [40, 420]],
  },
  {
    id: "cocina",
    name: "Cocina",
    color: "#c8e6c9",
    polygon: [[520, 40], [880, 40], [880, 300], [520, 300]],
  },
  {
    id: "dormitorio1",
    name: "Dormitorio 1",
    color: "#bbdefb",
    polygon: [[40, 420], [400, 420], [400, 760], [40, 760]],
  },
  {
    id: "dormitorio2",
    name: "Dormitorio 2",
    color: "#d1c4e9",
    polygon: [[400, 420], [760, 420], [760, 760], [400, 760]],
  },
  {
    id: "bano",
    name: "Baño",
    color: "#ffe0b2",
    polygon: [[520, 300], [880, 300], [880, 420], [520, 420]],
  },
];
