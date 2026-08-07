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

function rhRegistroMinutes(registro) {
  if (!registro) return 0;
  return rhRegistroBloques(registro).reduce(function (sum, b) {
    return sum + rhBlockMinutes(b);
  }, 0);
}

// "09:00" -> "9:00 AM" / "14:30" -> "2:30 PM". Cadena vacía si no es válida.
function rhFormatHora12(hhmm) {
  var mins = rhTimeToMinutes(hhmm);
  if (mins === null) return "";
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  var ampm = h < 12 ? "AM" : "PM";
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ":" + String(m).padStart(2, "0") + " " + ampm;
}

// "9:00 AM – 1:00 PM" para un bloque; "—" si está incompleto.
function rhFormatBloque12(block) {
  if (!block || !block.entrada || !block.salida) return "—";
  return rhFormatHora12(block.entrada) + " – " + rhFormatHora12(block.salida);
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
  return bloques.map(rhFormatBloque12).join(" · ");
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

// Envuelve cada <input type="time"> con botones -/+ de una hora. El picker
// nativo (rueda estilo iOS en Safari) sigue funcionando igual al tocar el
// campo; esto solo agrega un atajo para no tener que girarla varias veces.
function rhWrapWithTimeStepper(input) {
  var wrapper = document.createElement("div");
  wrapper.className = "time-stepper";
  input.parentNode.insertBefore(wrapper, input);

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
  wrapper.appendChild(input);
  wrapper.appendChild(plus);

  minus.addEventListener("click", function () { rhStepTimeInput(input, -60); });
  plus.addEventListener("click", function () { rhStepTimeInput(input, 60); });
}

function rhEnhanceTimeInputs(root) {
  var scope = root || document;
  scope.querySelectorAll('input[type="time"]').forEach(function (input) {
    if (input.closest(".time-stepper")) return;
    rhWrapWithTimeStepper(input);
  });
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
