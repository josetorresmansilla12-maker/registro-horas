"use strict";

// ---------- Tab: Estadísticas ----------

var RH_GAUGE_COLOR = "#2854a6";
var RH_GAUGE_TRACK = "#e3e9f5";

function rhRenderGauge(containerEl, percent) {
  var clamped = Math.max(0, Math.min(100, percent || 0));
  var size = 120;
  var stroke = 12;
  var radius = (size - stroke) / 2;
  var circumference = 2 * Math.PI * radius;
  var offset = circumference * (1 - clamped / 100);
  var svgNS = "http://www.w3.org/2000/svg";

  var svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 " + size + " " + size);
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);

  var bg = document.createElementNS(svgNS, "circle");
  bg.setAttribute("cx", size / 2);
  bg.setAttribute("cy", size / 2);
  bg.setAttribute("r", radius);
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", RH_GAUGE_TRACK);
  bg.setAttribute("stroke-width", stroke);
  svg.appendChild(bg);

  var fg = document.createElementNS(svgNS, "circle");
  fg.setAttribute("cx", size / 2);
  fg.setAttribute("cy", size / 2);
  fg.setAttribute("r", radius);
  fg.setAttribute("fill", "none");
  fg.setAttribute("stroke", RH_GAUGE_COLOR);
  fg.setAttribute("stroke-width", stroke);
  fg.setAttribute("stroke-linecap", "round");
  fg.setAttribute("stroke-dasharray", circumference);
  fg.setAttribute("stroke-dashoffset", offset);
  fg.setAttribute("transform", "rotate(-90 " + size / 2 + " " + size / 2 + ")");
  svg.appendChild(fg);

  var text = document.createElementNS(svgNS, "text");
  text.setAttribute("x", "50%");
  text.setAttribute("y", "50%");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("font-size", "20");
  text.setAttribute("font-weight", "700");
  text.setAttribute("fill", RH_GAUGE_COLOR);
  text.textContent = Math.round(percent || 0) + "%";
  svg.appendChild(text);

  rhClear(containerEl);
  containerEl.appendChild(svg);
}

function renderEstadisticas() {
  var config = rhLoadConfig();
  var today = rhTodayISO();

  // ---- Semana actual ----
  var weekRange = rhWeekRange(today);
  var workedWeekMin = rhWorkedMinutesInRange(weekRange.start, weekRange.end);
  var metaSemanalMin = rhHoursToMinutes(config.metaSemanal);
  var pctSemana = metaSemanalMin > 0 ? (workedWeekMin / metaSemanalMin) * 100 : 0;
  rhRenderGauge(rhEl("stats-gauge-semana"), pctSemana);
  rhEl("stats-semana-value").textContent = rhMinutesToHM(workedWeekMin) + " / " + rhMinutesToHM(metaSemanalMin);
  rhEl("stats-semana-sub").textContent = "Semana del " + rhFormatDateDisplay(weekRange.start) + " al " + rhFormatDateDisplay(weekRange.end);

  // ---- Mes actual ----
  var monthRange = rhMonthRange(today);
  var workedMonthMin = rhWorkedMinutesInRange(monthRange.start, monthRange.end);
  var metaMensualAjustadaMin = rhMetaMensualAjustada(today);
  var pctMes = metaMensualAjustadaMin > 0 ? (workedMonthMin / metaMensualAjustadaMin) * 100 : 0;
  rhRenderGauge(rhEl("stats-gauge-mes"), pctMes);
  rhEl("stats-mes-value").textContent = rhMinutesToHM(workedMonthMin) + " / " + rhMinutesToHM(metaMensualAjustadaMin);

  var metaMensualConfigMin = rhHoursToMinutes(config.metaMensual);
  var subMes = RH_MESES[rhParseISO(today).getMonth()] + " " + rhParseISO(today).getFullYear();
  if (metaMensualAjustadaMin < metaMensualConfigMin - 1) {
    subMes += " · Meta ajustada por licencias (meta original: " + rhMinutesToHM(metaMensualConfigMin) + ")";
  }
  rhEl("stats-mes-sub").textContent = subMes;

  // ---- Balance acumulado ----
  var balance = rhCalcularBalance();
  var balTag = rhEl("stats-balance-tag");
  var balValue = rhEl("stats-balance-value");
  balValue.textContent = rhMinutesToHM(Math.abs(balance.balanceMin));
  balTag.classList.remove("favor", "contra", "neutro");
  if (balance.balanceMin > 1) {
    balTag.textContent = "Horas a favor (te deben)";
    balTag.classList.add("favor");
  } else if (balance.balanceMin < -1) {
    balTag.textContent = "Horas en contra (debes)";
    balTag.classList.add("contra");
  } else {
    balTag.textContent = "Al día";
    balTag.classList.add("neutro");
  }
  rhEl("stats-balance-sub").textContent = "Calculado desde el " + rhFormatDateDisplay(rhBalanceStartDate()) + " hasta hoy";

  // ---- Promedio de horas por día trabajado (mes actual) ----
  var registrosDelMes = rhLoadRegistros().filter(function (r) { return rhIsDateInRange(r.fecha, monthRange.start, monthRange.end); });
  var diasConHoras = registrosDelMes.filter(function (r) { return rhRegistroMinutes(r) > 0; });
  var promedioMin = diasConHoras.length > 0 ? workedMonthMin / diasConHoras.length : 0;
  rhEl("stats-promedio-value").textContent = rhMinutesToHM(promedioMin);
  rhEl("stats-promedio-sub").textContent = diasConHoras.length > 0
    ? "Sobre " + diasConHoras.length + " día(s) con marcaje"
    : "Sin jornadas registradas este mes";

  // ---- Horas extra vs. faltantes (mes actual, contra la meta ajustada) ----
  var extraMin = Math.max(0, workedMonthMin - metaMensualAjustadaMin);
  var faltanteMin = Math.max(0, metaMensualAjustadaMin - workedMonthMin);
  if (extraMin > 0) {
    rhEl("stats-extra-faltante-value").textContent = "+" + rhMinutesToHM(extraMin);
    rhEl("stats-extra-faltante-sub").textContent = "Horas extra sobre la meta del mes";
  } else if (faltanteMin > 0) {
    rhEl("stats-extra-faltante-value").textContent = "-" + rhMinutesToHM(faltanteMin);
    rhEl("stats-extra-faltante-sub").textContent = "Horas faltantes para la meta del mes";
  } else {
    rhEl("stats-extra-faltante-value").textContent = "0h 00m";
    rhEl("stats-extra-faltante-sub").textContent = "Meta del mes cumplida exacta";
  }

  // ---- Feriados y licencias del mes ----
  var especiales = rhContarDiasEspeciales(monthRange.start, monthRange.end);
  rhEl("stats-especiales-value").textContent = especiales.total;
  rhEl("stats-especiales-sub").textContent = especiales.feriados + " feriado(s) · " + especiales.licencias + " licencia(s)/permiso(s)";

  renderStatsWeekTable(weekRange, config, today);
}

function renderStatsWeekTable(weekRange, config, today) {
  var tbody = rhEl("stats-week-table-body");
  rhClear(tbody);
  var metaDiaria = rhMetaDiariaMinutos(config);
  var dias = rhDaysBetweenInclusive(weekRange.start, weekRange.end);

  dias.forEach(function (iso) {
    var tr = document.createElement("tr");

    var tdDia = document.createElement("td");
    tdDia.textContent = rhDayOfWeekLabel(iso, false);
    tr.appendChild(tdDia);

    var tdFecha = document.createElement("td");
    tdFecha.textContent = rhFormatDateDisplay(iso);
    tr.appendChild(tdFecha);

    var registro = rhGetRegistroByFecha(iso);
    var minutes = registro ? rhRegistroMinutes(registro) : 0;
    var tdTrabajado = document.createElement("td");
    tdTrabajado.textContent = rhMinutesToHM(minutes);
    tr.appendChild(tdTrabajado);

    var tdEstado = document.createElement("td");
    var pill = document.createElement("span");
    pill.className = "status-pill";

    var d = rhParseISO(iso);
    var esLaboral = config.diasLaborales.indexOf(d.getDay()) !== -1;
    var licencia = rhLicenciaForDate(iso);

    if (!esLaboral) {
      pill.textContent = "No laboral";
      pill.classList.add("futuro");
    } else if (rhCompareISO(iso, today) > 0) {
      pill.textContent = "Futuro";
      pill.classList.add("futuro");
    } else if (licencia) {
      pill.textContent = rhTipoLicenciaLabel(licencia.tipo);
      pill.classList.add("licencia");
    } else if (minutes >= metaDiaria - 1) {
      pill.textContent = "Cumplido";
      pill.classList.add("ok");
    } else if (minutes > 0) {
      pill.textContent = "Parcial";
      pill.classList.add("pendiente");
    } else {
      pill.textContent = "Sin registro";
      pill.classList.add("pendiente");
    }
    tdEstado.appendChild(pill);
    tr.appendChild(tdEstado);

    tbody.appendChild(tr);
  });
}
