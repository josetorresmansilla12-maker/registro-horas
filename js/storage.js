"use strict";

// ---------- Storage genérico ----------

function rhLoadList(key) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("No se pudieron leer los datos guardados:", e);
    return [];
  }
}

function rhSaveList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error("Error al guardar:", e);
    if (e && e.name === "QuotaExceededError") {
      alert('El almacenamiento del navegador está lleno. Usa "Exportar a Excel" para respaldar tus datos.');
    } else {
      alert("Ocurrió un error al guardar los datos.");
    }
    return false;
  }
}

// ---------- Registros diarios ----------

function rhLoadRegistros() {
  return rhLoadList(RH_REGISTROS_KEY);
}

function rhSaveRegistros(list) {
  return rhSaveList(RH_REGISTROS_KEY, list);
}

function rhGetRegistroByFecha(fecha) {
  return rhLoadRegistros().find(function (r) { return r.fecha === fecha; }) || null;
}

// Crea o reemplaza el registro de una fecha (una sola entrada por día).
function rhUpsertRegistro(registro) {
  var list = rhLoadRegistros();
  var idx = list.findIndex(function (r) { return r.fecha === registro.fecha; });
  if (idx === -1) {
    registro.id = registro.id || rhUid();
    list.push(registro);
  } else {
    registro.id = list[idx].id;
    list[idx] = registro;
  }
  list.sort(function (a, b) { return rhCompareISO(a.fecha, b.fecha); });
  rhSaveRegistros(list);
  return registro;
}

function rhDeleteRegistro(id) {
  var list = rhLoadRegistros().filter(function (r) { return r.id !== id; });
  rhSaveRegistros(list);
}

// ---------- Licencias / ausencias justificadas ----------

function rhLoadLicencias() {
  return rhLoadList(RH_LICENCIAS_KEY);
}

function rhSaveLicencias(list) {
  return rhSaveList(RH_LICENCIAS_KEY, list);
}

function rhUpsertLicencia(licencia) {
  var list = rhLoadLicencias();
  var idx = list.findIndex(function (l) { return l.id === licencia.id; });
  if (idx === -1) {
    licencia.id = licencia.id || rhUid();
    list.push(licencia);
  } else {
    list[idx] = licencia;
  }
  list.sort(function (a, b) { return rhCompareISO(a.fechaInicio, b.fechaInicio); });
  rhSaveLicencias(list);
  return licencia;
}

function rhDeleteLicencia(id) {
  rhSaveLicencias(rhLoadLicencias().filter(function (l) { return l.id !== id; }));
}

function rhLicenciaForDate(iso) {
  return rhLoadLicencias().find(function (l) {
    return rhIsDateInRange(iso, l.fechaInicio, l.fechaFin);
  }) || null;
}

function rhTipoLicenciaLabel(tipo) {
  var t = RH_TIPOS_LICENCIA.find(function (x) { return x.id === tipo; });
  return t ? t.label : "Otro";
}

// Por defecto una licencia/feriado ajusta la meta (no cuenta como
// incumplimiento). El campo es explícitamente `false` solo cuando la
// jefatura decide que ese día sí debe cumplirse igual.
function rhLicenciaAjustaMeta(licencia) {
  return !!licencia && licencia.ajustaMeta !== false;
}

// ---------- Proyectos / funciones asignadas ----------

function rhLoadProyectos() {
  return rhLoadList(RH_PROYECTOS_KEY);
}

function rhSaveProyectos(list) {
  return rhSaveList(RH_PROYECTOS_KEY, list);
}

function rhUpsertProyecto(proyecto) {
  var list = rhLoadProyectos();
  var idx = list.findIndex(function (p) { return p.id === proyecto.id; });
  if (idx === -1) {
    proyecto.id = proyecto.id || rhUid();
    list.push(proyecto);
  } else {
    list[idx] = proyecto;
  }
  list.sort(function (a, b) { return rhCompareISO(b.fecha, a.fecha); });
  rhSaveProyectos(list);
  return proyecto;
}

function rhDeleteProyecto(id) {
  rhSaveProyectos(rhLoadProyectos().filter(function (p) { return p.id !== id; }));
}

// ---------- Configuración ----------

function rhLoadConfig() {
  try {
    var raw = localStorage.getItem(RH_CONFIG_KEY);
    var parsed = raw ? JSON.parse(raw) : {};
    var merged = Object.assign({}, RH_CONFIG_DEFAULT, parsed);
    merged.horarioBase = Object.assign(
      {},
      RH_CONFIG_DEFAULT.horarioBase,
      parsed.horarioBase || {}
    );
    merged.horarioBase.bloque1 = Object.assign({}, RH_CONFIG_DEFAULT.horarioBase.bloque1, (parsed.horarioBase || {}).bloque1 || {});
    merged.horarioBase.bloque2 = Object.assign({}, RH_CONFIG_DEFAULT.horarioBase.bloque2, (parsed.horarioBase || {}).bloque2 || {});
    merged.diasLaborales = Array.isArray(parsed.diasLaborales) ? parsed.diasLaborales : RH_CONFIG_DEFAULT.diasLaborales.slice();
    return merged;
  } catch (e) {
    console.error("No se pudo leer la configuración:", e);
    return Object.assign({}, RH_CONFIG_DEFAULT);
  }
}

function rhSaveConfig(config) {
  try {
    localStorage.setItem(RH_CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error("Error al guardar configuración:", e);
    alert("Ocurrió un error al guardar la configuración.");
    return false;
  }
}

// Fecha desde la que se calcula el balance acumulado: la configurada a mano,
// o si no existe, la del primer registro guardado, o si tampoco hay, hoy.
function rhBalanceStartDate() {
  var config = rhLoadConfig();
  if (config.fechaInicioBalance) return config.fechaInicioBalance;
  var registros = rhLoadRegistros();
  if (registros.length > 0) return registros[0].fecha;
  return rhTodayISO();
}

// ---------- Cálculo de horas esperadas / trabajadas ----------

function rhMetaDiariaMinutos(config) {
  var diasPorSemana = config.diasLaborales.length || 5;
  return rhHoursToMinutes(config.metaSemanal) / diasPorSemana;
}

// Minutos trabajados en un rango de fechas (según los registros existentes).
function rhWorkedMinutesInRange(start, end) {
  var registros = rhLoadRegistros();
  var total = 0;
  registros.forEach(function (r) {
    if (rhIsDateInRange(r.fecha, start, end)) total += rhRegistroMinutes(r);
  });
  return total;
}

// Balance acumulado: horas trabajadas vs. horas esperadas, día laboral por
// día laboral, desde la fecha de inicio hasta hoy. Los días con licencia se
// consideran cumplidos (no restan ni suman al balance).
function rhCalcularBalance() {
  var config = rhLoadConfig();
  var metaDiaria = rhMetaDiariaMinutos(config);
  var start = rhBalanceStartDate();
  var today = rhTodayISO();
  if (rhCompareISO(start, today) > 0) return { esperadoMin: 0, trabajadoMin: 0, balanceMin: 0 };

  var dias = rhDaysBetweenInclusive(start, today);
  var esperadoMin = 0;
  var trabajadoMin = 0;

  dias.forEach(function (iso) {
    var d = rhParseISO(iso);
    var esLaboral = config.diasLaborales.indexOf(d.getDay()) !== -1;
    if (!esLaboral) return;

    var licencia = rhLicenciaForDate(iso);
    if (licencia && rhLicenciaAjustaMeta(licencia)) return; // día justificado: no afecta el balance

    esperadoMin += metaDiaria;
    var registro = rhGetRegistroByFecha(iso);
    trabajadoMin += registro ? rhRegistroMinutes(registro) : 0;
  });

  return {
    esperadoMin: esperadoMin,
    trabajadoMin: trabajadoMin,
    balanceMin: trabajadoMin - esperadoMin
  };
}

// Cuenta los días (dentro de un rango) cubiertos por una licencia o feriado,
// separados por si ese tipo es un feriado o una ausencia personal.
function rhContarDiasEspeciales(start, end) {
  var dias = rhDaysBetweenInclusive(start, end);
  var feriados = 0;
  var licencias = 0;
  dias.forEach(function (iso) {
    var l = rhLicenciaForDate(iso);
    if (!l) return;
    if (l.tipo === "feriado") feriados++;
    else licencias++;
  });
  return { feriados: feriados, licencias: licencias, total: feriados + licencias };
}

// Meta mensual ajustada: descuenta la meta diaria por cada día laboral con
// licencia dentro del mes, para que esos días no cuenten como incumplimiento.
function rhMetaMensualAjustada(mesIso) {
  var config = rhLoadConfig();
  var metaDiaria = rhMetaDiariaMinutos(config);
  var range = rhMonthRange(mesIso);
  var dias = rhDaysBetweenInclusive(range.start, range.end);
  var diasLicenciaLaborales = 0;
  dias.forEach(function (iso) {
    var d = rhParseISO(iso);
    var esLaboral = config.diasLaborales.indexOf(d.getDay()) !== -1;
    var licencia = rhLicenciaForDate(iso);
    if (esLaboral && licencia && rhLicenciaAjustaMeta(licencia)) diasLicenciaLaborales++;
  });
  var metaMensualMin = rhHoursToMinutes(config.metaMensual);
  var descuentoMin = diasLicenciaLaborales * metaDiaria;
  return Math.max(0, metaMensualMin - descuentoMin);
}
