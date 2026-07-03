// Dispositivos Zigbee ubicados sobre el plano.
// type puede ser: "coordinator", "router" o "battery" (sensor a pila).
// Reemplazá estos valores por tus dispositivos reales (ver README).
const devices = {
  coordinator: {
    name: "Coordinador",
    type: "coordinator",
    room: "estar",
    x: 200,
    y: 200,
  },
  switch_estar: {
    name: "Switch Estar",
    type: "router",
    room: "estar",
    x: 300,
    y: 320,
  },
  sensor_temp_estar: {
    name: "Sensor Temp. Estar",
    type: "battery",
    room: "estar",
    x: 100,
    y: 100,
  },
  router_cocina: {
    name: "Enchufe Cocina",
    type: "router",
    room: "cocina",
    x: 700,
    y: 150,
  },
  sensor_dormitorio1: {
    name: "Sensor Dormitorio 1",
    type: "battery",
    room: "dormitorio1",
    x: 200,
    y: 600,
  },
  sensor_dormitorio2: {
    name: "Sensor Dormitorio 2",
    type: "battery",
    room: "dormitorio2",
    x: 580,
    y: 600,
  },
};
