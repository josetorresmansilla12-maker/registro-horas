"use strict";

// ---------- Tab: Informe ----------
//
// Vista pensada para compartir con la jefatura: solo muestra horas
// trabajadas (mañana/tarde/total) y meta vs. trabajado del mes, sin
// balance a favor/en contra — eso es información interna, no para reportar.

var informeInicioInput = rhEl("informe-inicio");
var informeFinInput = rhEl("informe-fin");
var informeAnioSelect = rhEl("informe-anio");

function rhInformeSetRango(inicio, fin) {
  informeInicioInput.value = inicio;
  informeFinInput.value = fin;
  renderInforme();
}

// Rango por defecto: el mes en curso completo (ej. 1 al 31 de agosto), para
// generar un informe rápido sin tener que elegir las fechas cada vez.
function rhInformeMesActual() {
  var r = rhMonthRange(rhTodayISO());
  rhInformeSetRango(r.start, r.end);
}

// Presets por cantidad de días hacia atrás, contando hoy (últimos N días).
function rhInformeAplicarDias(n) {
  var hoy = rhTodayISO();
  var d = rhParseISO(hoy);
  d.setDate(d.getDate() - (n - 1));
  rhInformeSetRango(rhDateToISO(d), hoy);
}

rhEl("informe-preset-mes").addEventListener("click", rhInformeMesActual);
rhEl("informe-preset-30d").addEventListener("click", function () { rhInformeAplicarDias(30); });
rhEl("informe-preset-60d").addEventListener("click", function () { rhInformeAplicarDias(60); });
rhEl("informe-preset-90d").addEventListener("click", function () { rhInformeAplicarDias(90); });

function rhInformePoblarAnios() {
  var hoy = rhTodayISO();
  var anioActual = rhParseISO(hoy).getFullYear();
  var anios = {};
  anios[anioActual] = true;
  rhLoadRegistros().forEach(function (r) { anios[rhParseISO(r.fecha).getFullYear()] = true; });

  var lista = Object.keys(anios).map(Number).sort(function (a, b) { return b - a; });
  rhClear(informeAnioSelect);

  var placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Ver año…";
  informeAnioSelect.appendChild(placeholder);

  lista.forEach(function (anio) {
    var opt = document.createElement("option");
    opt.value = String(anio);
    opt.textContent = String(anio);
    informeAnioSelect.appendChild(opt);
  });
}

informeAnioSelect.addEventListener("change", function () {
  var anio = Number(informeAnioSelect.value);
  if (!anio) return;
  var hoy = rhTodayISO();
  var inicio = anio + "-01-01";
  var fin = anio + "-12-31";
  if (anio === rhParseISO(hoy).getFullYear()) fin = hoy;
  rhInformeSetRango(inicio, fin);
  informeAnioSelect.value = "";
});

[informeInicioInput, informeFinInput].forEach(function (input) {
  input.addEventListener("change", renderInforme);
});

rhEl("informe-print-btn").addEventListener("click", function () {
  window.print();
});

function rhInformeBlockLabel(minutes) {
  return minutes > 0 ? rhMinutesToHM(minutes) : "—";
}

function renderInforme() {
  var inicio = informeInicioInput.value;
  var fin = informeFinInput.value;

  // ---- Resumen del mes actual (mismo cálculo que Estadísticas, sin balance) ----
  var hoy = rhTodayISO();
  var monthRange = rhMonthRange(hoy);
  var metaMesMin = rhMetaMensualAjustada(hoy);
  var trabajadoMesMin = rhWorkedMinutesInRange(monthRange.start, monthRange.end);
  rhEl("informe-meta-mes-value").textContent = rhMinutesToHM(metaMesMin);
  rhEl("informe-meta-mes-sub").textContent = RH_MESES[rhParseISO(hoy).getMonth()] + " " + rhParseISO(hoy).getFullYear() +
    " · meta ajustada por licencias/feriados";
  rhEl("informe-trabajado-mes-value").textContent = rhMinutesToHM(trabajadoMesMin);
  rhEl("informe-trabajado-mes-sub").textContent = "Al " + rhFormatDateDisplay(hoy);

  // ---- Detalle del período seleccionado ----
  var tbody = rhEl("informe-table-body");
  rhClear(tbody);

  var rangoValido = inicio && fin && rhCompareISO(fin, inicio) >= 0;
  rhEl("informe-empty-state").classList.toggle("hidden", rangoValido);
  rhEl("informe-table-wrap").classList.toggle("hidden", !rangoValido);
  if (!rangoValido) return;

  var dias = rhDaysBetweenInclusive(inicio, fin);
  var totalMin = 0;

  dias.forEach(function (iso) {
    var registro = rhGetRegistroByFecha(iso);
    var minTotal = rhRegistroMinutes(registro);
    totalMin += minTotal;

    var tr = document.createElement("tr");

    var tdDia = document.createElement("td");
    tdDia.textContent = rhDayOfWeekLabel(iso, true);
    tr.appendChild(tdDia);

    var tdFecha = document.createElement("td");
    tdFecha.textContent = rhFormatDateDisplay(iso);
    tr.appendChild(tdFecha);

    var tdJornadas = document.createElement("td");
    tdJornadas.className = "jornadas-cell";
    tdJornadas.textContent = rhFormatJornadasRegistro(registro);
    tr.appendChild(tdJornadas);

    var tdTotal = document.createElement("td");
    tdTotal.textContent = rhInformeBlockLabel(minTotal);
    tr.appendChild(tdTotal);

    tbody.appendChild(tr);
  });

  rhEl("informe-total-periodo").textContent = rhMinutesToHM(totalMin);
}

rhInformePoblarAnios();
rhInformeMesActual();
