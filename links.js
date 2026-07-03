// Enlaces Zigbee entre dispositivos.
// lqi (Link Quality Indicator): más alto es mejor.
//   >= 200  verde   (excelente)
//   150-199 azul    (buena)
//   80-149  violeta (aceptable)
//   < 80    rojo    (débil)
const links = [
  { from: "coordinator", to: "switch_estar", lqi: 235 },
  { from: "switch_estar", to: "sensor_temp_estar", lqi: 180 },
  { from: "coordinator", to: "router_cocina", lqi: 150 },
  { from: "router_cocina", to: "sensor_dormitorio2", lqi: 95 },
  { from: "switch_estar", to: "sensor_dormitorio1", lqi: 60 },
];
