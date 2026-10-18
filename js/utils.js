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

// ---------- Selector de hora en 24 horas (ruleta) ----------
//
// La ruleta nativa del iPhone sigue la configuración del teléfono: si está en
// 12 horas muestra AM/PM y la página no lo puede cambiar. Por eso cada campo
// de hora es un botón que, con un solo toque, abre una ruleta propia con
// las horas (00–23) y los minutos (00–59) lado a lado, igual a la del iPhone
// pero siempre en 24 horas.
// El input original queda oculto como "dueño" del valor ("HH:MM" o ""): el
// resto del código lo sigue leyendo y escribiendo igual, y recibe los mismos
// eventos input/change cuando se elige una hora.

var RH_RUEDA_ALTO = 44; // alto de cada número de la ruleta (px)
var rhRueda = null;

function rhPad2(n) {
  return String(n).padStart(2, "0");
}

function rhRuedaCrearColumna(cantidad, etiqueta) {
  var col = document.createElement("div");
  col.className = "rueda-col";
  col.setAttribute("aria-label", etiqueta);
  col.appendChild(Object.assign(document.createElement("div"), { className: "rueda-relleno" }));
  for (var i = 0; i < cantidad; i++) {
    var item = document.createElement("div");
    item.className = "rueda-item";
    item.textContent = rhPad2(i);
    item.dataset.indice = String(i);
    col.appendChild(item);
  }
  col.appendChild(Object.assign(document.createElement("div"), { className: "rueda-relleno" }));
  col.cantidad = cantidad;

  // Tocar un número lo lleva al centro (útil también con el mouse).
  col.addEventListener("click", function (e) {
    var item = e.target.closest(".rueda-item");
    if (item) rhRuedaIr(col, Number(item.dataset.indice), true);
  });
  var pendiente = false;
  col.addEventListener("scroll", function () {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(function () {
      pendiente = false;
      rhRuedaMarcar(col);
    });
  });
  return col;
}

function rhRuedaIndice(col) {
  return Math.max(0, Math.min(col.cantidad - 1, Math.round(col.scrollTop / RH_RUEDA_ALTO)));
}

function rhRuedaIr(col, indice, suave) {
  col.scrollTo({ top: indice * RH_RUEDA_ALTO, behavior: suave ? "smooth" : "auto" });
  if (!suave) rhRuedaMarcar(col);
}

function rhRuedaMarcar(col) {
  var indice = rhRuedaIndice(col);
  var previo = col.querySelector(".rueda-item.sel");
  if (previo && Number(previo.dataset.indice) === indice) return;
  if (previo) previo.classList.remove("sel");
  var item = col.querySelector('.rueda-item[data-indice="' + indice + '"]');
  if (item) item.classList.add("sel");
}

function rhRuedaCrear() {
  var overlay = document.createElement("div");
  overlay.className = "rueda-overlay hidden";
  var hoja = document.createElement("div");
  hoja.className = "rueda-hoja";
  hoja.setAttribute("role", "dialog");
  hoja.setAttribute("aria-modal", "true");

  var barra = document.createElement("div");
  barra.className = "rueda-barra";
  var cancelar = Object.assign(document.createElement("button"), { type: "button", className: "rueda-accion", textContent: "Cancelar" });
  var titulo = Object.assign(document.createElement("span"), { className: "rueda-titulo", textContent: "Hora" });
  var listo = Object.assign(document.createElement("button"), { type: "button", className: "rueda-accion rueda-listo", textContent: "Listo" });
  barra.appendChild(cancelar);
  barra.appendChild(titulo);
  barra.appendChild(listo);

  var cuerpo = document.createElement("div");
  cuerpo.className = "rueda-cuerpo";
  var banda = Object.assign(document.createElement("div"), { className: "rueda-banda" });
  var colH = rhRuedaCrearColumna(24, "Hora");
  var colM = rhRuedaCrearColumna(60, "Minutos");
  var sep = Object.assign(document.createElement("span"), { className: "rueda-sep", textContent: ":" });
  cuerpo.appendChild(banda);
  cuerpo.appendChild(colH);
  cuerpo.appendChild(sep);
  cuerpo.appendChild(colM);

  var borrar = Object.assign(document.createElement("button"), { type: "button", className: "rueda-borrar btn-link", textContent: "Dejar sin hora" });

  hoja.appendChild(barra);
  hoja.appendChild(cuerpo);
  hoja.appendChild(borrar);
  overlay.appendChild(hoja);
  document.body.appendChild(overlay);

  var r = { overlay: overlay, titulo: titulo, colH: colH, colM: colM, alElegir: null };
  function cerrar() {
    overlay.classList.add("hidden");
    document.body.classList.remove("rueda-abierta");
    r.alElegir = null;
  }
  cancelar.addEventListener("click", cerrar);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) cerrar(); });
  listo.addEventListener("click", function () {
    var fn = r.alElegir;
    var valor = rhPad2(rhRuedaIndice(colH)) + ":" + rhPad2(rhRuedaIndice(colM));
    cerrar();
    if (fn) fn(valor);
  });
  borrar.addEventListener("click", function () {
    var fn = r.alElegir;
    cerrar();
    if (fn) fn("");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) cerrar();
  });
  return r;
}

// Abre la ruleta en `valor` (o, si está vacío, en la hora actual redondeada a
// 5 minutos) y llama a `alElegir("HH:MM")` al tocar Listo ("" si se borra).
function rhAbrirRuedaHora(valor, titulo, alElegir) {
  if (!rhRueda) rhRueda = rhRuedaCrear();
  var mins = rhTimeToMinutes(valor);
  if (mins === null) {
    var ahora = new Date();
    mins = ahora.getHours() * 60 + Math.round(ahora.getMinutes() / 5) * 5;
    if (mins >= 1440) mins = 1435;
  }
  rhRueda.titulo.textContent = titulo || "Hora";
  rhRueda.alElegir = alElegir;
  rhRueda.overlay.classList.remove("hidden");
  document.body.classList.add("rueda-abierta");
  rhRuedaIr(rhRueda.colH, Math.floor(mins / 60), false);
  rhRuedaIr(rhRueda.colM, mins % 60, false);
}

function rhConvertirHora24(input) {
  var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  var valorInicial = input.value;
  input.type = "hidden";

  var wrap = document.createElement("div");
  wrap.className = "hora24";
  input.parentNode.insertBefore(wrap, input);

  var boton = document.createElement("button");
  boton.type = "button";
  boton.className = "hora24-boton";
  if (input.id) {
    boton.id = input.id + "-boton";
    // La etiqueta ("Entrada", "Salida") también abre la ruleta.
    var etiquetaFor = document.querySelector('label[for="' + input.id + '"]');
    if (etiquetaFor) etiquetaFor.htmlFor = boton.id;
  }
  wrap.appendChild(boton);
  wrap.appendChild(input);

  function pintar(valor) {
    var mins = rhTimeToMinutes(valor);
    boton.textContent = mins === null ? "--:--" : rhMinutesToTimeStr(mins);
    boton.classList.toggle("vacia", mins === null);
  }

  Object.defineProperty(input, "value", {
    configurable: true,
    get: function () { return desc.get.call(input); },
    set: function (v) {
      desc.set.call(input, v || "");
      pintar(v);
    }
  });

  boton.addEventListener("click", function () {
    var field = wrap.closest(".field");
    var etiqueta = field && field.querySelector("label");
    var titulo = etiqueta ? etiqueta.textContent.trim() : "Hora";
    rhAbrirRuedaHora(desc.get.call(input), titulo, function (nuevo) {
      desc.set.call(input, nuevo);
      pintar(nuevo);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
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
