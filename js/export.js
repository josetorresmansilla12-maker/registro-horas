"use strict";

// ---------- Exportar a Excel (.xlsx) ----------

var exportModalOverlay = rhEl("export-modal-overlay");
var openExportBtn = rhEl("open-export-btn");
var exportCancelBtn = rhEl("export-cancel-btn");
var exportConfirmBtn = rhEl("export-confirm-btn");
var exportInicioInput = rhEl("export-inicio");
var exportFinInput = rhEl("export-fin");
var exportIncluirProyectosInput = rhEl("export-incluir-proyectos");

openExportBtn.addEventListener("click", function () {
  var range = rhMonthRange(rhTodayISO());
  exportInicioInput.value = range.start;
  exportFinInput.value = range.end;
  exportModalOverlay.classList.remove("hidden");
});

exportCancelBtn.addEventListener("click", function () {
  exportModalOverlay.classList.add("hidden");
});

exportModalOverlay.addEventListener("click", function (e) {
  if (e.target === exportModalOverlay) exportModalOverlay.classList.add("hidden");
});

function rhObservacionesParaFecha(iso) {
  var licencia = rhLicenciaForDate(iso);
  if (!licencia) return "";
  var texto = rhTipoLicenciaLabel(licencia.tipo);
  if (licencia.detalle) texto += ": " + licencia.detalle;
  return texto;
}

function rhBuildRegistroRows(start, end) {
  var header = [
    "Fecha", "Día de la semana", "Jornadas (horarios)",
    "Total Horas Trabajadas", "Ubicación / Resumen de Actividad",
    "Observaciones / Licencias"
  ];
  var rows = [header];
  var dias = rhDaysBetweenInclusive(start, end);
  var totalMin = 0;

  dias.forEach(function (iso) {
    var registro = rhGetRegistroByFecha(iso);
    var minutos = rhRegistroMinutes(registro);
    totalMin += minutos;
    var jornadas = registro ? rhFormatJornadasRegistro(registro) : "";
    if (jornadas === "—") jornadas = "";
    rows.push([
      rhFormatDateDisplay(iso),
      rhDayOfWeekLabel(iso, false),
      jornadas,
      rhMinutesToDecimal(minutos),
      registro ? (registro.nota || "") : "",
      rhObservacionesParaFecha(iso)
    ]);
  });

  rows.push(new Array(header.length).fill(""));
  var totalRow = new Array(header.length).fill("");
  totalRow[0] = "TOTAL DEL PERÍODO";
  totalRow[3] = rhMinutesToDecimal(totalMin);
  totalRow[4] = rhMinutesToHM(totalMin);
  rows.push(totalRow);

  return rows;
}

// Pestaña "Informe": tabla simple pensada para captura de pantalla al
// rendir cuentas (día abreviado, fecha, horas trabajadas, nota y total).
function rhBuildInformeRows(start, end) {
  var header = ["Día", "Fecha", "Horas trabajadas", "Nota"];
  var rows = [header];
  var dias = rhDaysBetweenInclusive(start, end);
  var totalMin = 0;

  dias.forEach(function (iso) {
    var registro = rhGetRegistroByFecha(iso);
    var minutos = rhRegistroMinutes(registro);
    totalMin += minutos;
    var nota = registro ? (registro.nota || "") : "";
    var estadoLabel = rhRegistroEstadoLabel(registro);
    if (estadoLabel) {
      nota = nota ? estadoLabel + " · " + nota : estadoLabel;
    }
    rows.push([
      rhDayOfWeekLabel(iso, true),
      rhFormatDateDisplay(iso),
      rhMinutesToDecimal(minutos),
      nota
    ]);
  });

  rows.push(["", "", "", ""]);
  rows.push(["", "TOTAL DEL PERÍODO", rhMinutesToDecimal(totalMin), rhMinutesToHM(totalMin)]);

  return rows;
}

function rhBuildProyectosRows(start, end) {
  var header = ["Fecha", "Función / Proyecto", "Descripción"];
  var rows = [header];
  rhLoadProyectos()
    .filter(function (p) { return rhIsDateInRange(p.fecha, start, end); })
    .sort(function (a, b) { return rhCompareISO(a.fecha, b.fecha); })
    .forEach(function (p) {
      rows.push([rhFormatDateDisplay(p.fecha), p.titulo, p.descripcion || ""]);
    });
  return rows;
}

exportConfirmBtn.addEventListener("click", function () {
  var start = exportInicioInput.value;
  var end = exportFinInput.value;
  if (!start || !end) {
    rhShowAlert("Selecciona ambas fechas para exportar.", "error");
    return;
  }
  if (rhCompareISO(end, start) < 0) {
    rhShowAlert("La fecha final no puede ser anterior a la inicial.", "error");
    return;
  }

  var wb = XLSX.utils.book_new();

  var registroRows = rhBuildRegistroRows(start, end);
  var wsRegistro = XLSX.utils.aoa_to_sheet(registroRows);
  wsRegistro["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 34 }, { wch: 14 }, { wch: 32 }, { wch: 32 }
  ];
  XLSX.utils.book_append_sheet(wb, wsRegistro, "Registro de Horas");

  var informeRows = rhBuildInformeRows(start, end);
  var wsInforme = XLSX.utils.aoa_to_sheet(informeRows);
  wsInforme["!cols"] = [{ wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsInforme, "Informe");

  if (exportIncluirProyectosInput.checked) {
    var proyectoRows = rhBuildProyectosRows(start, end);
    var wsProyectos = XLSX.utils.aoa_to_sheet(proyectoRows);
    wsProyectos["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsProyectos, "Funciones y Proyectos");
  }

  var filename = "Registro-Horas_" + start + "_a_" + end + ".xlsx";
  XLSX.writeFile(wb, filename);
  exportModalOverlay.classList.add("hidden");
  rhShowAlert("Reporte descargado: " + filename, "success");
});
