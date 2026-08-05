"use strict";

// ---------- Datos de ejemplo (demo) ----------
//
// Sirven solo para previsualizar cómo se ven las estadísticas y el reporte
// con información real. Se marcan con `demo: true` para poder quitarlas
// limpiamente después sin tocar los datos reales del usuario, y nunca pisan
// un registro que ya exista para una fecha (rhGetRegistroByFecha se revisa
// antes de crear cada jornada de ejemplo).

var RH_MOCK_NOTAS = [
  "Trabajo en oficina",
  "Asistencia a colegio San Martín",
  "Elaboración de taller",
  "Reunión de equipo",
  "Visita terreno",
  "Redacción de informe"
];

var RH_MOCK_PROYECTOS = [
  { titulo: "Elaboración de taller de capacitación", descripcion: "Diseño de material y ejecución del taller para el equipo." },
  { titulo: "Informe mensual de actividades", descripcion: "Redacción y envío del informe a jefatura." },
  { titulo: "Coordinación con colegio San Martín", descripcion: "Seguimiento de casos derivados durante el mes." }
];

function rhSeedMockData() {
  var config = rhLoadConfig();
  var today = rhTodayISO();
  var registrosAgregados = 0;

  for (var i = 21; i >= 1; i--) {
    var fecha = rhAddDays(today, -i);
    var d = rhParseISO(fecha);
    var esLaboral = config.diasLaborales.indexOf(d.getDay()) !== -1;
    if (!esLaboral) continue;
    if (rhGetRegistroByFecha(fecha)) continue; // no pisa un marcaje real ya guardado

    var variacion = i % 5;
    if (variacion === 3) continue; // deja algunos días sin marcaje a propósito ("Sin registro")

    var entradaBase = config.horarioBase.bloque1.entrada || "09:00";
    var salidaBaseMin = rhTimeToMinutes(config.horarioBase.bloque1.salida || "13:00");
    var ajusteMin = variacion === 0 ? -30 : (variacion === 1 ? 20 : 0);

    rhUpsertRegistro({
      id: null,
      fecha: fecha,
      bloque1: { entrada: entradaBase, salida: rhMinutesToTimeStr(salidaBaseMin + ajusteMin) },
      bloque2: { entrada: "", salida: "" },
      nota: RH_MOCK_NOTAS[i % RH_MOCK_NOTAS.length],
      demo: true
    });
    registrosAgregados++;
  }

  rhUpsertLicencia({
    id: null,
    fechaInicio: rhAddDays(today, -10),
    fechaFin: rhAddDays(today, -10),
    tipo: "medica",
    detalle: "Reposo por gripe (ejemplo)",
    ajustaMeta: true,
    demo: true
  });

  rhUpsertLicencia({
    id: null,
    fechaInicio: rhAddDays(today, -15),
    fechaFin: rhAddDays(today, -15),
    tipo: "feriado",
    detalle: "Feriado de ejemplo",
    ajustaMeta: true,
    demo: true
  });

  RH_MOCK_PROYECTOS.forEach(function (p, idx) {
    rhUpsertProyecto({
      id: null,
      fecha: rhAddDays(today, -(4 + idx * 6)),
      titulo: p.titulo,
      descripcion: p.descripcion,
      demo: true
    });
  });

  renderMarcajeTable();
  renderEstadisticas();
  renderLicencias();
  renderProyectos();
  rhShowAlert("Datos de ejemplo cargados (" + registrosAgregados + " jornada(s), licencias, feriado y proyectos).", "success");
}

function rhRemoveMockData() {
  rhSaveRegistros(rhLoadRegistros().filter(function (r) { return !r.demo; }));
  rhSaveLicencias(rhLoadLicencias().filter(function (l) { return !l.demo; }));
  rhSaveProyectos(rhLoadProyectos().filter(function (p) { return !p.demo; }));

  renderMarcajeTable();
  renderEstadisticas();
  renderLicencias();
  renderProyectos();
  rhShowAlert("Datos de ejemplo eliminados. Tus datos reales no se vieron afectados.", "success");
}

rhEl("load-mock-data-btn").addEventListener("click", function () {
  if (confirm("Esto agregará jornadas, una licencia, un feriado y proyectos de ejemplo (marcados como demo) para que veas cómo se ven las estadísticas. No borra ni reemplaza tus datos reales. ¿Continuar?")) {
    rhSeedMockData();
  }
});

rhEl("remove-mock-data-btn").addEventListener("click", function () {
  if (confirm("¿Quitar todos los datos de ejemplo (marcados como demo)? Tus datos reales no se ven afectados.")) {
    rhRemoveMockData();
  }
});
