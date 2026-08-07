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
  var list = rhLoadRegistros();
  var item = list.find(function (r) { return r.id === id; });
  if (item) rhPapeleraAgregar("registro", item);
  rhSaveRegistros(list.filter(function (r) { return r.id !== id; }));
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
  var list = rhLoadLicencias();
  var item = list.find(function (l) { return l.id === id; });
  if (item) rhPapeleraAgregar("licencia", item);
  rhSaveLicencias(list.filter(function (l) { return l.id !== id; }));
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

// Un día laboral queda excluido de la meta (no suma ni resta al balance)
// cuando lo cubre una licencia/feriado que ajusta meta, o cuando se registró
// como "no convocado" (la oficina pidió no asistir). Centraliza esa decisión
// para que balance, meta ajustada y estadísticas coincidan siempre.
function rhDiaAjustaMeta(iso) {
  var licencia = rhLicenciaForDate(iso);
  if (licencia && rhLicenciaAjustaMeta(licencia)) return true;
  return rhRegistroEsNoConvocado(rhGetRegistroByFecha(iso));
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
  var list = rhLoadProyectos();
  var item = list.find(function (p) { return p.id === id; });
  if (item) rhPapeleraAgregar("proyecto", item);
  rhSaveProyectos(list.filter(function (p) { return p.id !== id; }));
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

    if (rhDiaAjustaMeta(iso)) return; // día justificado / no convocado: no afecta el balance

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

// Meta ajustada para un rango cualquiera: descuenta la meta diaria por cada
// día laboral con licencia/feriado (que ajusta meta) dentro del rango, para
// que esos días no cuenten como incumplimiento. `metaBaseHoras` es la meta
// completa del período (ej. config.metaSemanal o config.metaMensual).
function rhMetaAjustadaEnRango(start, end, metaBaseHoras) {
  var config = rhLoadConfig();
  var metaDiaria = rhMetaDiariaMinutos(config);
  var dias = rhDaysBetweenInclusive(start, end);
  var diasLicenciaLaborales = 0;
  dias.forEach(function (iso) {
    var d = rhParseISO(iso);
    var esLaboral = config.diasLaborales.indexOf(d.getDay()) !== -1;
    if (esLaboral && rhDiaAjustaMeta(iso)) diasLicenciaLaborales++;
  });
  var metaBaseMin = rhHoursToMinutes(metaBaseHoras);
  var descuentoMin = diasLicenciaLaborales * metaDiaria;
  return Math.max(0, metaBaseMin - descuentoMin);
}

// Meta semanal ajustada para la semana que contiene `fechaIso`.
function rhMetaSemanalAjustada(fechaIso) {
  var config = rhLoadConfig();
  var range = rhWeekRange(fechaIso);
  return rhMetaAjustadaEnRango(range.start, range.end, config.metaSemanal);
}

// Meta mensual ajustada: descuenta la meta diaria por cada día laboral con
// licencia dentro del mes, para que esos días no cuenten como incumplimiento.
function rhMetaMensualAjustada(mesIso) {
  var config = rhLoadConfig();
  var range = rhMonthRange(mesIso);
  return rhMetaAjustadaEnRango(range.start, range.end, config.metaMensual);
}

// ---------- Papelera (registros/licencias/proyectos eliminados) ----------
//
// Nada se borra directo: rhDeleteRegistro/Licencia/Proyecto guardan una copia
// acá antes de eliminar, para poder deshacer un borrado por error. Se
// purgan solas pasados RH_PAPELERA_DIAS días.

function rhLoadPapelera() {
  return rhLoadList(RH_PAPELERA_KEY);
}

function rhSavePapelera(list) {
  return rhSaveList(RH_PAPELERA_KEY, list);
}

function rhPapeleraAgregar(tipo, item) {
  var list = rhLoadPapelera();
  list.unshift({ id: rhUid(), tipo: tipo, item: item, eliminadoEn: Date.now() });
  rhSavePapelera(list);
}

function rhPapeleraAgregarMuchos(tipo, items) {
  if (!items || items.length === 0) return;
  var list = rhLoadPapelera();
  var nuevos = items.map(function (item) {
    return { id: rhUid(), tipo: tipo, item: item, eliminadoEn: Date.now() };
  });
  rhSavePapelera(nuevos.concat(list));
}

// Elimina de la papelera lo que ya pasó su fecha de vencimiento. Se llama al
// iniciar la app; devuelve cuántos se purgaron.
function rhPapeleraPurgarVencidos() {
  var limite = Date.now() - RH_PAPELERA_DIAS * 24 * 60 * 60 * 1000;
  var list = rhLoadPapelera();
  var vigentes = list.filter(function (e) { return e.eliminadoEn >= limite; });
  if (vigentes.length !== list.length) rhSavePapelera(vigentes);
  return list.length - vigentes.length;
}

function rhPapeleraVenceEn(entry) {
  var vencePor = entry.eliminadoEn + RH_PAPELERA_DIAS * 24 * 60 * 60 * 1000;
  var diasRestantes = Math.ceil((vencePor - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diasRestantes);
}

// Un registro (jornada) es único por fecha: si ya existe uno para la fecha
// del que se quiere restaurar, restaurar lo reemplazaría en silencio.
function rhPapeleraTieneConflicto(entry) {
  if (entry.tipo !== "registro") return false;
  return !!rhGetRegistroByFecha(entry.item.fecha);
}

function rhPapeleraRestaurar(papelId) {
  var list = rhLoadPapelera();
  var entry = list.find(function (e) { return e.id === papelId; });
  if (!entry) return false;

  if (entry.tipo === "registro") {
    var restaurado = Object.assign({}, entry.item);
    delete restaurado.id; // rhUpsertRegistro asigna uno nuevo si hace falta
    rhUpsertRegistro(restaurado);
  } else if (entry.tipo === "licencia") {
    rhUpsertLicencia(Object.assign({}, entry.item));
  } else if (entry.tipo === "proyecto") {
    rhUpsertProyecto(Object.assign({}, entry.item));
  }

  rhSavePapelera(list.filter(function (e) { return e.id !== papelId; }));
  return true;
}

function rhPapeleraEliminarDefinitivo(papelId) {
  rhSavePapelera(rhLoadPapelera().filter(function (e) { return e.id !== papelId; }));
}

function rhPapeleraVaciar() {
  rhSavePapelera([]);
}
