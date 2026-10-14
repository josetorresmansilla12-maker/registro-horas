"use strict";

// ---------- Identificadores y fechas ----------

function rhUid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function rhTodayISO() {
  var d = new Date();
  return rhDateToISO(d);
}

function rhDateToISO(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

// Parsea "YYYY-MM-DD" como fecha local (evita el corrimiento de un día que
// causa `new Date("YYYY-MM-DD")` al interpretarlo como UTC).
function rhParseISO(iso) {
  var parts = iso.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function rhFormatDateDisplay(iso) {
  if (!iso) return "—";
  var d = rhParseISO(iso);
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}

// Formato orientativo corto: "09 ago" (sin año), usado al listar/filtrar
// semanas donde el año casi nunca aporta información nueva.
function rhFormatDateShort(iso) {
  if (!iso) return "—";
  var d = rhParseISO(iso);
  return String(d.getDate()).padStart(2, "0") + " " + RH_MESES_ABREV[d.getMonth()];
}

function rhDayOfWeekLabel(iso, corto) {
  var d = rhParseISO(iso);
  var entry = RH_DIAS_SEMANA[d.getDay()];
  return corto ? entry.corto : entry.label;
}

function rhAddDays(iso, n) {
  var d = rhParseISO(iso);
  d.setDate(d.getDate() + n);
  return rhDateToISO(d);
}

function rhCompareISO(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function rhIsDateInRange(iso, start, end) {
  return rhCompareISO(iso, start) >= 0 && rhCompareISO(iso, end) <= 0;
}

// Semana de lunes a domingo que contiene `iso`.
function rhWeekRange(iso) {
  var d = rhParseISO(iso);
  var dow = d.getDay(); // 0=domingo
  var diffToMonday = dow === 0 ? -6 : 1 - dow;
  var start = rhAddDays(iso, diffToMonday);
  var end = rhAddDays(start, 6);
  return { start: start, end: end };
}

function rhMonthRange(iso) {
  var d = rhParseISO(iso);
  var y = d.getFullYear();
  var m = d.getMonth();
  var start = y + "-" + String(m + 1).padStart(2, "0") + "-01";
  var lastDay = new Date(y, m + 1, 0).getDate();
  var end = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(lastDay).padStart(2, "0");
  return { start: start, end: end };
}

function rhDaysBetweenInclusive(start, end) {
  var days = [];
  var cur = start;
  var guard = 0;
  while (rhCompareISO(cur, end) <= 0 && guard < 3660) {
    days.push(cur);
    cur = rhAddDays(cur, 1);
    guard++;
  }
  return days;
}

// ---------- Horas y minutos ----------

function rhTimeToMinutes(hhmm) {
  if (!hhmm) return null;
  var parts = hhmm.split(":");
  if (parts.length !== 2) return null;
  var h = Number(parts[0]);
  var m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Minutos de un bloque (entrada -> salida). Devuelve 0 si el bloque está
// incompleto o la salida no es posterior a la entrada.
function rhBlockMinutes(block) {
  if (!block) return 0;
  var start = rhTimeToMinutes(block.entrada);
  var end = rhTimeToMinutes(block.salida);
  if (start === null || end === null) return 0;
  var diff = end - start;
  return diff > 0 ? diff : 0;
}

function rhBlockIsInvalid(block) {
  if (!block) return false;
  var start = rhTimeToMinutes(block.entrada);
  var end = rhTimeToMinutes(block.salida);
  if (start === null || end === null) return false;
  return end <= start;
}

// Devuelve las jornadas de un registro como arreglo, sin importar si se
// guardó con el formato nuevo (`bloques`) o el antiguo (`bloque1`/`bloque2`).
// Así los respaldos viejos siguen sumando bien sin migración manual.
function rhRegistroBloques(registro) {
  if (!registro) return [];
  if (Array.isArray(registro.bloques)) return registro.bloques;
  var arr = [];
  if (registro.bloque1 && (registro.bloque1.entrada || registro.bloque1.salida)) arr.push(registro.bloque1);
  if (registro.bloque2 && (registro.bloque2.entrada || registro.bloque2.salida)) arr.push(registro.bloque2);
  return arr;
}

function rhRegistroEsNoConvocado(registro) {
  return !!(registro && registro.estado === RH_ESTADO_NO_CONVOCADO);
}

// Etiqueta legible del estado especial de un día sin jornada trabajada
// (la oficina no lo convocó, o aún no estabas contratado). "" si es un día
// normal de trabajo.
function rhRegistroEstadoLabel(registro) {
  if (!registro) return "";
  if (registro.estado === RH_ESTADO_NO_CONVOCADO) return "No convocado";
  if (registro.estado === RH_ESTADO_NO_CONTRATADO) return "Aún no contratado";
  return "";
}

// Un día con estado especial no cuenta para la meta ni resta al balance.
function rhRegistroExcluyeMeta(registro) {
  return !!rhRegistroEstadoLabel(registro);
}

// Lista de actividades sin vacíos ni repetidos, con los nombres antiguos
// traducidos a su categoría actual.
function rhNormalizarActividades(lista) {
  var res = [];
  (lista || []).forEach(function (a) {
    if (typeof a !== "string" || !a.trim()) return;
    var nombre = RH_ACTIVIDADES_ALIAS[a.trim()] || a.trim();
    if (res.indexOf(nombre) === -1) res.push(nombre);
  });
  return res;
}

// Actividades marcadas en una jornada (categorías, incluidas las escritas en
// "Otro"). [] si el registro es antiguo o no tiene ninguna.
function rhRegistroActividades(registro) {
  if (!registro || !Array.isArray(registro.actividades)) return [];
  return rhNormalizarActividades(registro.actividades);
}

// Minutos de las jornadas que caen dentro de un horario (ej. la jornada de
// tarde 14:30–18:00), para saber cuánto se trabajó en cada franja.
function rhMinutosEnVentana(bloques, ventana) {
  var vi = rhTimeToMinutes(ventana && ventana.entrada);
  var vf = rhTimeToMinutes(ventana && ventana.salida);
  if (vi === null || vf === null || vf <= vi) return 0;
  return (bloques || []).reduce(function (sum, b) {
    var bi = rhTimeToMinutes(b.entrada);
    var bf = rhTimeToMinutes(b.salida);
    if (bi === null || bf === null || bf <= bi) return sum;
    return sum + Math.max(0, Math.min(bf, vf) - Math.max(bi, vi));
  }, 0);
}

function rhRegistroMinutes(registro) {
  if (!registro) return 0;
  return rhRegistroBloques(registro).reduce(function (sum, b) {
    return sum + rhBlockMinutes(b);
  }, 0);
}

// Hora en formato de 24 horas: "9:05" / "09:05" -> "09:05". Las horas se
// guardan siempre así ("HH:MM"); esto solo normaliza cómo se muestran.
// Cadena vacía si no es válida.
function rhFormatHora(hhmm) {
  var mins = rhTimeToMinutes(hhmm);
  if (mins === null) return "";
  return rhMinutesToTimeStr(mins);
}

// "09:00 – 13:00" para un bloque; "—" si está incompleto.
function rhFormatBloque(block) {
  if (!block || !block.entrada || !block.salida) return "—";
  return rhFormatHora(block.entrada) + " – " + rhFormatHora(block.salida);
}

// Texto de todas las jornadas de un día, pensado para tablas e informes:
// "No convocado" si la oficina pidió no asistir, la lista de horarios si hay
// jornadas, o "—" si el día no tiene marcaje.
function rhFormatJornadasRegistro(registro) {
  var estadoLabel = rhRegistroEstadoLabel(registro);
  if (estadoLabel) return estadoLabel;
  var bloques = rhRegistroBloques(registro).filter(function (b) {
    return b && b.entrada && b.salida;
  });
  if (bloques.length === 0) return "—";
  return bloques.map(rhFormatBloque).join(" · ");
}

function rhMinutesToHM(minutes) {
  var m = Math.round(minutes || 0);
  var sign = m < 0 ? "-" : "";
  m = Math.abs(m);
  var h = Math.floor(m / 60);
  var mm = m % 60;
  return sign + h + "h " + String(mm).padStart(2, "0") + "m";
}

function rhMinutesToTimeStr(minutes) {
  var m = ((minutes % 1440) + 1440) % 1440;
  var h = Math.floor(m / 60);
  var mm = m % 60;
  return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

function rhMinutesToDecimal(minutes) {
  return Math.round(((minutes || 0) / 60) * 100) / 100;
}

function rhHoursToMinutes(hours) {
  return Math.round((Number(hours) || 0) * 60);
}

// ---------- Ajuste rápido de horas (+/- 1h) ----------

function rhStepTimeInput(inputEl, deltaMinutes) {
  var current = rhTimeToMinutes(inputEl.value);
  if (current === null) current = 0;
  var next = ((current + deltaMinutes) % 1440 + 1440) % 1440;
  var h = Math.floor(next / 60);
  var m = next % 60;
  inputEl.value = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  inputEl.dispatchEvent(new Event("change", { bubbles: true }));
}

// ---------- Selector de hora en 24 horas ----------
//
// Los <input type="time"> del navegador muestran AM/PM si el teléfono está
// configurado en 12 horas, y eso no se puede cambiar desde la página. Por eso
// cada uno se reemplaza por dos listas (hora 00–23 y minutos 00–59), que
// siempre van en 24 horas y en el teléfono se eligen con la rueda.
// El input original queda oculto como "dueño" del valor ("HH:MM" o ""): el
// resto del código lo sigue leyendo y escribiendo igual, y recibe los mismos
// eventos input/change cuando se cambia la hora.
function rhConvertirHora24(input) {
  var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  var valorInicial = input.value;
  input.type = "hidden";

  var wrap = document.createElement("div");
  wrap.className = "hora24";
  input.parentNode.insertBefore(wrap, input);

  function crearLista(etiqueta, cantidad) {
    var sel = document.createElement("select");
    sel.setAttribute("aria-label", etiqueta);
    var vacio = document.createElement("option");
    vacio.value = "";
    vacio.textContent = "--";
    sel.appendChild(vacio);
    for (var i = 0; i < cantidad; i++) {
      var opt = document.createElement("option");
      opt.value = String(i).padStart(2, "0");
      opt.textContent = opt.value;
      sel.appendChild(opt);
    }
    return sel;
  }
  var selH = crearLista("Hora", 24);
  var selM = crearLista("Minutos", 60);
  selH.className = "hora24-h";
  selM.className = "hora24-m";
  var sep = document.createElement("span");
  sep.className = "hora24-sep";
  sep.textContent = ":";
  wrap.appendChild(selH);
  wrap.appendChild(sep);
  wrap.appendChild(selM);
  wrap.appendChild(input);

  function pintar(valor) {
    var mins = rhTimeToMinutes(valor);
    if (mins === null) {
      selH.value = "";
      selM.value = "";
      return;
    }
    selH.value = String(Math.floor(mins / 60) % 24).padStart(2, "0");
    selM.value = String(mins % 60).padStart(2, "0");
  }

  Object.defineProperty(input, "value", {
    configurable: true,
    get: function () { return desc.get.call(input); },
    set: function (v) {
      desc.set.call(input, v || "");
      pintar(v);
    }
  });

  function emitir() {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  selH.addEventListener("change", function () {
    if (!selH.value) {
      selM.value = "";
      desc.set.call(input, "");
    } else {
      if (!selM.value) selM.value = "00";
      desc.set.call(input, selH.value + ":" + selM.value);
    }
    emitir();
  });

  selM.addEventListener("change", function () {
    // Minutos sin hora todavía: se espera a que elijas la hora.
    desc.set.call(input, selH.value ? selH.value + ":" + (selM.value || "00") : "");
    emitir();
  });

  desc.set.call(input, valorInicial || "");
  pintar(valorInicial);
  return wrap;
}

// Agrega botones -/+ de una hora alrededor del selector, como atajo.
function rhWrapWithTimeStepper(input) {
  var hora = rhConvertirHora24(input);
  var wrapper = document.createElement("div");
  wrapper.className = "time-stepper";
  hora.parentNode.insertBefore(wrapper, hora);

  var minus = document.createElement("button");
  minus.type = "button";
  minus.className = "btn btn-icon stepper-btn";
  minus.textContent = "−";
  minus.setAttribute("aria-label", "Restar 1 hora");

  var plus = document.createElement("button");
  plus.type = "button";
  plus.className = "btn btn-icon stepper-btn";
  plus.textContent = "+";
  plus.setAttribute("aria-label", "Sumar 1 hora");

  wrapper.appendChild(minus);
  wrapper.appendChild(hora);
  wrapper.appendChild(plus);

  minus.addEventListener("click", function () { rhStepTimeInput(input, -60); });
  plus.addEventListener("click", function () { rhStepTimeInput(input, 60); });
}

function rhEnhanceTimeInputs(root) {
  var scope = root || document;
  scope.querySelectorAll('input[type="time"]').forEach(rhWrapWithTimeStepper);
}

// ---------- Descarga de archivos ----------

function rhDownloadFile(filename, content, mime) {
  var blob = new Blob([content], { type: mime || "application/octet-stream" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// ---------- DOM helpers ----------

function rhEl(id) {
  return document.getElementById(id);
}

function rhClear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function rhEscapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
