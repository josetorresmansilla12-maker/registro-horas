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
    rhInvalidarCache();
    if (typeof rhSyncAlGuardar === "function") rhSyncAlGuardar(key);
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

// ---------- Caché de lectura ----------
//
// Las estadísticas consultan cientos de días y cada consulta por fecha volvía
// a leer y parsear todo el localStorage. Se guarda una copia ya parseada que
// se invalida con cada escritura (o si otra pestaña cambia los datos). Solo
// la usan las consultas de lectura; rhLoadRegistros() etc. siguen devolviendo
// una lista nueva que se puede modificar sin riesgo.

var rhCacheVersion = 0;
var rhCache = {};

function rhInvalidarCache() {
  rhCacheVersion++;
}

window.addEventListener("storage", rhInvalidarCache);

function rhCachedList(key) {
  var c = rhCache[key];
  if (!c || c.version !== rhCacheVersion) {
    c = { version: rhCacheVersion, list: rhLoadList(key) };
    rhCache[key] = c;
  }
  return c;
}

// ---------- Registros diarios ----------

function rhLoadRegistros() {
  return rhLoadList(RH_REGISTROS_KEY);
}

function rhSaveRegistros(list) {
  return rhSaveList(RH_REGISTROS_KEY, list);
}

function rhGetRegistroByFecha(fecha) {
  var c = rhCachedList(RH_REGISTROS_KEY);
  if (!c.porFecha) {
    c.porFecha = {};
    c.list.forEach(function (r) {
      if (!c.porFecha[r.fecha]) c.porFecha[r.fecha] = r;
    });
  }
  return c.porFecha[fecha] || null;
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
  return rhCachedList(RH_LICENCIAS_KEY).list.find(function (l) {
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
  return rhRegistroExcluyeMeta(rhGetRegistroByFecha(iso));
}

// Etiqueta de "por qué este día no tiene horas": el estado del registro
// (ej. "Aún no contratado", o un "No convocado" antiguo de un solo día) si
// existe; si no, la licencia que cubre esa fecha (feriado, no convocado,
// licencia médica, etc.) — pero solo en días laborales, para que un fin de
// semana que quede dentro de un rango de licencia (por comodidad al elegir
// las fechas) no se muestre como "No convocado"/"Feriado" sin necesidad,
// ya que de por sí no era un día que tocara trabajar. "" si no aplica nada.
// Si ese día igual tiene horas trabajadas, no se rotula como "No convocado"
// o licencia (sería contradictorio en un informe); un feriado trabajado sí
// conserva su rótulo.
function rhEstadoOLicenciaLabel(iso) {
  var registro = rhGetRegistroByFecha(iso);
  var estadoLabel = rhRegistroEstadoLabel(registro);
  if (estadoLabel) return estadoLabel;
  var config = rhLoadConfig();
  var esLaboral = config.diasLaborales.indexOf(rhParseISO(iso).getDay()) !== -1;
  if (!esLaboral) return "";
  var licencia = rhLicenciaForDate(iso);
  if (!licencia) return "";
  if (rhRegistroMinutes(registro) > 0) return licencia.tipo === "feriado" ? "Feriado" : "";
  return rhTipoLicenciaLabel(licencia.tipo);
}

// Texto de las jornadas de un día para tablas/informes: los horarios si hubo
// horas trabajadas; si no, el motivo (feriado, "no convocado", licencia…) en
// vez de un simple "—".
function rhFormatJornadasDia(iso) {
  var registro = rhGetRegistroByFecha(iso);
  if (rhRegistroMinutes(registro) > 0) return rhFormatJornadasRegistro(registro);
  return rhEstadoOLicenciaLabel(iso) || rhFormatJornadasRegistro(registro);
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

// Devuelve la configuración (cacheada hasta la próxima escritura): tratarla
// como solo lectura; para cambiarla, armar un objeto nuevo y rhSaveConfig.
var rhConfigCache = null;

function rhLoadConfig() {
  if (rhConfigCache && rhConfigCache.version === rhCacheVersion) return rhConfigCache.config;
  var merged;
  try {
    var raw = localStorage.getItem(RH_CONFIG_KEY);
    var parsed = raw ? JSON.parse(raw) : {};
    merged = Object.assign({}, RH_CONFIG_DEFAULT, parsed);
    merged.horarioBase = Object.assign(
      {},
      RH_CONFIG_DEFAULT.horarioBase,
      parsed.horarioBase || {}
    );
    merged.horarioBase.bloque1 = Object.assign({}, RH_CONFIG_DEFAULT.horarioBase.bloque1, (parsed.horarioBase || {}).bloque1 || {});
    merged.horarioBase.bloque2 = Object.assign({}, RH_CONFIG_DEFAULT.horarioBase.bloque2, (parsed.horarioBase || {}).bloque2 || {});
    merged.diasLaborales = Array.isArray(parsed.diasLaborales) ? parsed.diasLaborales : RH_CONFIG_DEFAULT.diasLaborales.slice();
    merged.actividades = Array.isArray(parsed.actividades)
      ? rhNormalizarActividades(parsed.actividades)
      : RH_ACTIVIDADES_DEFAULT.slice();
  } catch (e) {
    console.error("No se pudo leer la configuración:", e);
    merged = Object.assign({}, RH_CONFIG_DEFAULT, { actividades: RH_ACTIVIDADES_DEFAULT.slice() });
  }
  rhConfigCache = { version: rhCacheVersion, config: merged };
  return merged;
}

function rhSaveConfig(config) {
  try {
    localStorage.setItem(RH_CONFIG_KEY, JSON.stringify(config));
    rhInvalidarCache();
    if (typeof rhSyncAlGuardar === "function") rhSyncAlGuardar(RH_CONFIG_KEY);
    return true;
  } catch (e) {
    console.error("Error al guardar configuración:", e);
    alert("Ocurrió un error al guardar la configuración.");
    return false;
  }
}

// Fecha desde la que se cuentan horas esperadas (inicio de tu contrato / del
// seguimiento): la configurada a mano, o si no existe, la del registro más
// antiguo, o si tampoco hay, hoy. Se busca el más antiguo en vez de tomar el
// primero de la lista porque una importación puede dejarla desordenada.
function rhBalanceStartDate() {
  var config = rhLoadConfig();
  if (config.fechaInicioBalance) return config.fechaInicioBalance;
  var c = rhCachedList(RH_REGISTROS_KEY);
  if (c.inicio === undefined) {
    c.inicio = c.list.reduce(function (min, r) {
      return !min || rhCompareISO(r.fecha, min) < 0 ? r.fecha : min;
    }, null);
  }
  return c.inicio || rhTodayISO();
}

// ---------- Cálculo de horas esperadas / trabajadas ----------
//
// Una sola regla, día por día, para todas las vistas (cuota del mes, balance,
// semanas, informe), así los números siempre coinciden entre sí:
//  - Cada día hábil "espera" la meta diaria = horas semanales ÷ días
//    laborales por semana (con tu contrato: 20 h ÷ 5 = 4 h).
//  - No se espera nada en días no laborales (sábado/domingo), en días
//    cubiertos por un feriado, "no convocado" o licencia que ajusta la meta,
//    en días "aún no contratado", ni antes del inicio del seguimiento.
//  - Toda hora trabajada suma, sin importar el día.
// La meta de un mes es la suma de lo esperado en sus días: un mes con 22 días
// hábiles pide 88 h y uno con 21 pide 84 h (antes era un 86,67 h fijo).

function rhMetaDiariaMinutos(config) {
  var diasPorSemana = config.diasLaborales.length || 5;
  return rhHoursToMinutes(config.metaSemanal) / diasPorSemana;
}

function rhEsDiaLaboral(iso, config) {
  return (config || rhLoadConfig()).diasLaborales.indexOf(rhParseISO(iso).getDay()) !== -1;
}

// Minutos que se esperaba trabajar en un día puntual (0 si no correspondía).
function rhMinutosEsperadosDia(iso, config) {
  config = config || rhLoadConfig();
  if (!rhEsDiaLaboral(iso, config)) return 0;
  if (rhCompareISO(iso, rhBalanceStartDate()) < 0) return 0;
  if (rhDiaAjustaMeta(iso)) return 0;
  return rhMetaDiariaMinutos(config);
}

// Meta (minutos esperados) de un rango completo, incluidos los días futuros.
function rhMetaEnRango(start, end) {
  var config = rhLoadConfig();
  return rhDaysBetweenInclusive(start, end).reduce(function (sum, iso) {
    return sum + rhMinutosEsperadosDia(iso, config);
  }, 0);
}

function rhMetaSemanalAjustada(fechaIso) {
  var range = rhWeekRange(fechaIso);
  return rhMetaEnRango(range.start, range.end);
}

function rhMetaMensualAjustada(mesIso) {
  var range = rhMonthRange(mesIso);
  return rhMetaEnRango(range.start, range.end);
}

// Minutos trabajados en un rango de fechas (según los registros existentes).
function rhWorkedMinutesInRange(start, end) {
  var total = 0;
  rhCachedList(RH_REGISTROS_KEY).list.forEach(function (r) {
    if (rhIsDateInRange(r.fecha, start, end)) total += rhRegistroMinutes(r);
  });
  return total;
}

// Balance de un período (horas trabajadas − horas esperadas) contado solo
// hasta hoy: lo que aún no pasa todavía no se debe. Hoy se cuenta como
// esperado solo si ya tiene horas registradas, para no figurar "debiendo" la
// jornada que está en curso.
function rhBalancePeriodo(start, end) {
  var config = rhLoadConfig();
  var today = rhTodayISO();
  var inicio = rhBalanceStartDate();
  var desde = rhCompareISO(start, inicio) < 0 ? inicio : start;
  var hasta = rhCompareISO(end, today) < 0 ? end : today;
  var res = { esperadoMin: 0, trabajadoMin: 0, balanceMin: 0, desde: desde, hasta: hasta };
  if (rhCompareISO(desde, hasta) > 0) return res;

  rhDaysBetweenInclusive(desde, hasta).forEach(function (iso) {
    var trabajado = rhRegistroMinutes(rhGetRegistroByFecha(iso));
    res.trabajadoMin += trabajado;
    if (iso === today && trabajado === 0) return;
    res.esperadoMin += rhMinutosEsperadosDia(iso, config);
  });
  res.balanceMin = res.trabajadoMin - res.esperadoMin;
  return res;
}

function rhBalanceMes(mesIso) {
  var range = rhMonthRange(mesIso);
  return rhBalancePeriodo(range.start, range.end);
}

// Balance acumulado: desde el inicio del seguimiento hasta hoy. Es igual a la
// suma de los balances de cada mes.
function rhCalcularBalance() {
  return rhBalancePeriodo(rhBalanceStartDate(), rhTodayISO());
}

// Cuenta los días hábiles (dentro de un rango) cubiertos por una licencia,
// feriado o "no convocado" (por licencia, o por un registro suelto de antes de
// que "no convocado" se pudiera marcar por rango de fechas).
function rhContarDiasEspeciales(start, end) {
  var config = rhLoadConfig();
  var feriados = 0;
  var noConvocados = 0;
  var licencias = 0;
  rhDaysBetweenInclusive(start, end).forEach(function (iso) {
    if (!rhEsDiaLaboral(iso, config)) return;
    var l = rhLicenciaForDate(iso);
    if (l) {
      if (l.tipo === "feriado") feriados++;
      else if (l.tipo === "no_convocado") noConvocados++;
      else licencias++;
      return;
    }
    if (rhRegistroEsNoConvocado(rhGetRegistroByFecha(iso))) noConvocados++;
  });
  return { feriados: feriados, noConvocados: noConvocados, licencias: licencias, total: feriados + noConvocados + licencias };
}

// ---------- Estado de cada día (tablas, calendario e informe) ----------
//
// `clave` agrupa el estado para colores y conteos; `rojo` marca los días que
// en un calendario irían en rojo (fines de semana y feriados).
function rhEstadoDia(iso, config, today) {
  config = config || rhLoadConfig();
  today = today || rhTodayISO();
  var registro = rhGetRegistroByFecha(iso);
  var minutos = rhRegistroMinutes(registro);
  var laboral = rhEsDiaLaboral(iso, config);
  var licencia = rhLicenciaForDate(iso);
  var esFeriado = !!(licencia && licencia.tipo === "feriado");
  var esNoConvocado = !!(licencia && licencia.tipo === "no_convocado") || rhRegistroEsNoConvocado(registro);
  var dow = rhParseISO(iso).getDay();

  var e = {
    iso: iso,
    registro: registro,
    minutos: minutos,
    laboral: laboral,
    licencia: licencia,
    rojo: !laboral || esFeriado,
    feriado: esFeriado,
    conflicto: false,
    clave: "",
    label: ""
  };

  if (registro && registro.estado === RH_ESTADO_NO_CONTRATADO) {
    e.clave = "sin_contrato"; e.label = "Aún no contratado";
  } else if (minutos > 0) {
    // Cualquier día trabajado cuenta como cumplido, sin importar las horas.
    e.clave = "cumplido"; e.label = "Cumplido";
    e.conflicto = !!(laboral && licencia && !esFeriado && rhLicenciaAjustaMeta(licencia));
  } else if (esFeriado) {
    e.clave = "feriado"; e.label = "Feriado";
  } else if (!laboral) {
    e.clave = "no_laboral"; e.label = dow === 0 || dow === 6 ? "Fin de semana" : "No laboral";
  } else if (esNoConvocado) {
    e.clave = "no_convocado"; e.label = "No convocado";
  } else if (licencia) {
    e.clave = "licencia"; e.label = rhTipoLicenciaLabel(licencia.tipo);
  } else if (rhCompareISO(iso, rhBalanceStartDate()) < 0) {
    e.clave = "fuera"; e.label = "—";
  } else if (rhCompareISO(iso, today) > 0) {
    e.clave = "futuro"; e.label = "Próximo";
  } else if (iso === today) {
    e.clave = "hoy"; e.label = "Hoy";
  } else {
    e.clave = "sin_registro"; e.label = "Sin registro";
  }
  return e;
}

// Clases CSS de la fila de un día en las tablas: fines de semana y feriados en
// rojo (como en un calendario) y "no convocado"/licencias en ámbar.
function rhClaseFilaDia(estado) {
  var clases = [];
  if (estado.rojo) clases.push("dia-rojo");
  if (estado.feriado) clases.push("fila-feriado");
  else if (estado.clave === "no_convocado") clases.push("fila-no-convocado");
  else if (estado.clave === "licencia") clases.push("fila-licencia");
  return clases.join(" ");
}

// Días de un rango que conviene revisar:
//  - feriados nacionales en día hábil que aún no están marcados,
//  - días con horas dentro de un período "no convocado"/licencia (ese día no
//    debería tener horas, o el período no debería incluirlo),
//  - días hábiles ya pasados sin ningún registro ni justificación.
function rhDiasPorRevisar(start, end) {
  var config = rhLoadConfig();
  var today = rhTodayISO();
  var inicio = rhBalanceStartDate();
  var items = [];
  rhDaysBetweenInclusive(start, end).forEach(function (iso) {
    if (rhCompareISO(iso, inicio) < 0) return;
    var e = rhEstadoDia(iso, config, today);
    var nombreFeriado = RH_FERIADOS_CHILE[iso];
    if (nombreFeriado && e.laboral && !rhDiaAjustaMeta(iso)) {
      items.push({ tipo: "feriado", iso: iso, nombre: nombreFeriado });
    } else if (e.conflicto) {
      items.push({ tipo: "conflicto", iso: iso, minutos: e.minutos, licencia: e.licencia });
    } else if (e.clave === "sin_registro" && !e.registro) {
      items.push({ tipo: "sin_registro", iso: iso });
    }
  });
  return items;
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
