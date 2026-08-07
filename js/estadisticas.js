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

// ---- Helpers de balance (a favor / en contra / al día) ----

function rhBalanceTagClass(balanceMin) {
  if (balanceMin > 1) return "favor";
  if (balanceMin < -1) return "contra";
  return "neutro";
}

function rhBalanceTagLabel(balanceMin, corto) {
  if (balanceMin > 1) return corto ? "A favor" : "Horas a favor (te deben)";
  if (balanceMin < -1) return corto ? "En contra" : "Horas en contra (debes)";
  return "Al día";
}

function rhRenderBalanceCard(prefix, balanceMin, subText) {
  rhEl(prefix + "-value").textContent = rhMinutesToHM(Math.abs(balanceMin));
  var tag = rhEl(prefix + "-tag");
  tag.className = "balance-tag " + rhBalanceTagClass(balanceMin);
  tag.textContent = rhBalanceTagLabel(balanceMin, false);
  rhEl(prefix + "-sub").textContent = subText;
}

function renderEstadisticas() {
  var config = rhLoadConfig();
  var today = rhTodayISO();

  // ---- Semana actual ----
  var weekRange = rhWeekRange(today);
  var workedWeekMin = rhWorkedMinutesInRange(weekRange.start, weekRange.end);
  var metaSemanalAjustadaMin = rhMetaSemanalAjustada(today);
  var pctSemana = metaSemanalAjustadaMin > 0 ? (workedWeekMin / metaSemanalAjustadaMin) * 100 : 0;
  rhRenderGauge(rhEl("stats-gauge-semana"), pctSemana);
  rhEl("stats-semana-value").textContent = rhMinutesToHM(workedWeekMin) + " / " + rhMinutesToHM(metaSemanalAjustadaMin);

  var metaSemanalConfigMin = rhHoursToMinutes(config.metaSemanal);
  var subSemana = "Semana del " + rhFormatDateDisplay(weekRange.start) + " al " + rhFormatDateDisplay(weekRange.end);
  if (metaSemanalAjustadaMin < metaSemanalConfigMin - 1) subSemana += " · meta ajustada por licencias";
  rhEl("stats-semana-sub").textContent = subSemana;

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

  // ---- Balance semanal (para cobrar/compensar dentro de la misma semana) ----
  var balanceSemanaMin = workedWeekMin - metaSemanalAjustadaMin;
  rhRenderBalanceCard("stats-balance-semana", balanceSemanaMin, subSemana);

  // ---- Balance mensual ----
  var balanceMesMin = workedMonthMin - metaMensualAjustadaMin;
  rhRenderBalanceCard("stats-balance-mes", balanceMesMin, subMes);

  // ---- Balance acumulado (general, desde el inicio del seguimiento) ----
  var balance = rhCalcularBalance();
  rhRenderBalanceCard("stats-balance", balance.balanceMin, "Calculado desde el " + rhFormatDateDisplay(rhBalanceStartDate()) + " hasta hoy");

  // ---- Promedio de horas por día trabajado (mes actual) ----
  var registrosDelMes = rhLoadRegistros().filter(function (r) { return rhIsDateInRange(r.fecha, monthRange.start, monthRange.end); });
  var diasConHoras = registrosDelMes.filter(function (r) { return rhRegistroMinutes(r) > 0; });
  var promedioMin = diasConHoras.length > 0 ? workedMonthMin / diasConHoras.length : 0;
  rhEl("stats-promedio-value").textContent = rhMinutesToHM(promedioMin);
  rhEl("stats-promedio-sub").textContent = diasConHoras.length > 0
    ? "Sobre " + diasConHoras.length + " día(s) con marcaje"
    : "Sin jornadas registradas este mes";

  // ---- Feriados y licencias del mes ----
  var especiales = rhContarDiasEspeciales(monthRange.start, monthRange.end);
  rhEl("stats-especiales-value").textContent = especiales.total;
  rhEl("stats-especiales-sub").textContent = especiales.feriados + " feriado(s) · " + especiales.licencias + " licencia(s)/permiso(s)";

  renderStatsMonthWeeks();
}

// ---- Asistencia mensual, semana por semana (acordeón plegable) ----

var rhStatsMesActual = rhMonthRange(rhTodayISO()).start;

function rhBuildStatsDayRow(iso, config, metaDiaria, today) {
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

  if (registro && registro.estado === RH_ESTADO_NO_CONTRATADO) {
    pill.textContent = "Aún no contratado";
    pill.classList.add("sin-contrato");
  } else if (!esLaboral) {
    pill.textContent = "No laboral";
    pill.classList.add("no-laboral");
  } else if (rhCompareISO(iso, today) > 0) {
    pill.textContent = "Futuro";
    pill.classList.add("futuro");
  } else if (licencia) {
    pill.textContent = rhTipoLicenciaLabel(licencia.tipo);
    pill.classList.add("licencia");
  } else if (rhRegistroEsNoConvocado(registro)) {
    pill.textContent = "No convocado";
    pill.classList.add("licencia");
  } else if (minutes >= metaDiaria - 1) {
    pill.textContent = "Cumplido";
    pill.classList.add("ok");
  } else if (minutes > 0) {
    // Trabajó menos que la meta, pero según las horas que le indicaron: se
    // considera cumplido, no un incumplimiento del trabajador.
    pill.textContent = "Cumplida";
    pill.classList.add("ok");
  } else {
    pill.textContent = "Sin registro";
    pill.classList.add("pendiente");
  }
  tdEstado.appendChild(pill);
  tr.appendChild(tdEstado);

  return tr;
}

// Agrupa los días del mes mostrado por semana (lunes a domingo), en orden.
function rhGroupMonthByWeek(monthRange) {
  var dias = rhDaysBetweenInclusive(monthRange.start, monthRange.end);
  var groups = [];
  var groupByStart = {};
  dias.forEach(function (iso) {
    var wr = rhWeekRange(iso);
    if (!groupByStart[wr.start]) {
      var g = { weekStart: wr.start, weekEnd: wr.end, dias: [] };
      groupByStart[wr.start] = g;
      groups.push(g);
    }
    groupByStart[wr.start].dias.push(iso);
  });
  return groups;
}

function renderStatsMonthWeeks() {
  var monthRange = rhMonthRange(rhStatsMesActual);
  var d = rhParseISO(rhStatsMesActual);
  rhEl("stats-mes-label").textContent = RH_MESES[d.getMonth()] + " " + d.getFullYear();

  var config = rhLoadConfig();
  var metaDiaria = rhMetaDiariaMinutos(config);
  var today = rhTodayISO();
  var currentWeekStart = rhWeekRange(today).start;

  var groups = rhGroupMonthByWeek(monthRange);
  var container = rhEl("stats-weeks-container");
  rhClear(container);

  if (groups.length === 0) return;

  var containsCurrentWeek = groups.some(function (g) { return g.weekStart === currentWeekStart; });

  groups.forEach(function (g, idx) {
    var details = document.createElement("details");
    details.className = "week-group";
    var isLast = idx === groups.length - 1;
    // Se abre por defecto la semana que contiene hoy; si el mes mostrado no
    // incluye la semana actual (mes pasado/futuro), se abre la última.
    if (g.weekStart === currentWeekStart || (!containsCurrentWeek && isLast)) {
      details.open = true;
    }

    var workedMin = 0;
    var metaGrupoMin = 0;
    g.dias.forEach(function (iso) {
      var registro = rhGetRegistroByFecha(iso);
      if (registro) workedMin += rhRegistroMinutes(registro);

      var dt = rhParseISO(iso);
      var esLaboral = config.diasLaborales.indexOf(dt.getDay()) !== -1;
      if (!esLaboral) return;
      if (rhDiaAjustaMeta(iso)) return;
      metaGrupoMin += metaDiaria;
    });
    var balanceGrupoMin = workedMin - metaGrupoMin;

    var summary = document.createElement("summary");

    var titleSpan = document.createElement("span");
    titleSpan.className = "week-group-title";
    var ordinal = RH_ORDINALES[idx] || (idx + 1) + "ª";
    titleSpan.textContent = rhFormatDateShort(g.weekStart) + " al " + rhFormatDateShort(g.weekEnd) +
      " (" + ordinal + " semana)";
    summary.appendChild(titleSpan);

    var metaSpan = document.createElement("span");
    metaSpan.className = "week-group-meta";
    metaSpan.textContent = rhMinutesToHM(workedMin) + " / " + rhMinutesToHM(metaGrupoMin);
    summary.appendChild(metaSpan);

    var tagSpan = document.createElement("span");
    tagSpan.className = "balance-tag " + rhBalanceTagClass(balanceGrupoMin);
    tagSpan.textContent = rhBalanceTagLabel(balanceGrupoMin, true);
    summary.appendChild(tagSpan);

    details.appendChild(summary);

    var tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap";
    var table = document.createElement("table");
    table.className = "data-table";

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    ["Día", "Fecha", "Trabajado", "Estado"].forEach(function (label) {
      var th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    g.dias.forEach(function (iso) {
      tbody.appendChild(rhBuildStatsDayRow(iso, config, metaDiaria, today));
    });
    table.appendChild(tbody);

    tableWrap.appendChild(table);
    details.appendChild(tableWrap);

    container.appendChild(details);
  });
}

rhEl("stats-mes-prev").addEventListener("click", function () {
  var d = rhParseISO(rhStatsMesActual);
  d.setMonth(d.getMonth() - 1);
  rhStatsMesActual = rhMonthRange(rhDateToISO(d)).start;
  renderStatsMonthWeeks();
});

rhEl("stats-mes-next").addEventListener("click", function () {
  var d = rhParseISO(rhStatsMesActual);
  d.setMonth(d.getMonth() + 1);
  rhStatsMesActual = rhMonthRange(rhDateToISO(d)).start;
  renderStatsMonthWeeks();
});
