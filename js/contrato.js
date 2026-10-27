"use strict";

// ---------- Horas semanales del contrato ----------
//
// Ventana para cambiar las horas del contrato desde Arreglo de horas, el
// Informe o Configuración (botones .btn-cambiar-contrato). Por defecto el
// cambio rige para todo el período y se recalculan todos los meses; también
// puede regir solo desde una fecha, sin tocar los meses anteriores. Antes de
// guardar muestra cómo cambia el saldo.

var contratoModal = rhEl("contrato-modal");
var contratoHoras = rhEl("contrato-horas");
var contratoDesde = rhEl("contrato-desde");
var contratoGuardar = rhEl("contrato-guardar");

// "22 h semanales (4h 24m por día hábil)", con lo que rige hoy.
function rhContratoTextoHoy(config) {
  config = config || rhLoadConfig();
  var hoy = rhTodayISO();
  return rhHorasSemanalesEn(hoy, config) + " h semanales (" + rhMinutesToHM(rhMetaDiariaMinutos(config, hoy)) + " por día hábil)";
}

function rhContratoModo() {
  var marcado = contratoModal.querySelector('input[name="contrato-modo"]:checked');
  return marcado ? marcado.value : "todo";
}

function rhContratoHorasEscritas() {
  return Number(String(contratoHoras.value || "").replace(",", "."));
}

// Configuración que quedaría al guardar lo escrito (null si falta algo).
function rhContratoPropuesto() {
  var horas = rhContratoHorasEscritas();
  if (!(horas > 0 && horas <= 80)) return null;
  var config = rhLoadConfig();
  if (rhContratoModo() === "todo") {
    return Object.assign({}, config, { metaSemanal: horas, contratoCambios: [] });
  }
  var desde = contratoDesde.value;
  if (!desde) return null;
  // Rige desde esa fecha en adelante: se quitan los cambios posteriores.
  var cambios = (config.contratoCambios || []).filter(function (c) { return c && c.desde && rhCompareISO(c.desde, desde) < 0; });
  cambios.push({ desde: desde, horasSemanales: horas });
  return Object.assign({}, config, { contratoCambios: cambios });
}

function rhContratoSaldoTexto(min) {
  if (min > 1) return rhMinutesToHM(min) + " a favor";
  if (min < -1) return "debes " + rhMinutesToHM(-min);
  return "al día";
}

function rhContratoActualizarPrevia() {
  var previa = rhEl("contrato-previa");
  rhClear(previa);
  contratoDesde.classList.toggle("hidden", rhContratoModo() !== "desde");
  var propuesto = rhContratoPropuesto();
  contratoGuardar.disabled = !propuesto;
  function linea(texto, clase) {
    var p = document.createElement("p");
    if (clase) p.className = clase;
    p.textContent = texto;
    previa.appendChild(p);
  }
  if (!propuesto) {
    linea(rhContratoModo() === "desde" && !contratoDesde.value && rhContratoHorasEscritas() > 0
      ? "Elige desde qué fecha rige." : "Escribe las horas semanales de tu contrato.", "libre-alerta");
    return;
  }
  var horas = rhContratoHorasEscritas();
  var dias = propuesto.diasLaborales.length || 5;
  linea(horas + " h ÷ " + dias + " días hábiles = " + rhMinutesToHM(rhHoursToMinutes(horas) / dias) + " por día hábil.");
  var antes = rhCalcularBalance().balanceMin;
  var despues = rhCalcularBalance(propuesto).balanceMin;
  linea("Tu saldo total: " + rhContratoSaldoTexto(antes) + " → " + rhContratoSaldoTexto(despues) + ".",
    despues >= -1 ? "libre-ok" : "libre-alerta");
}

function rhAbrirContrato() {
  var config = rhLoadConfig();
  rhEl("contrato-actual").textContent = "Hoy la app calcula con: " + rhArregloTextoContrato(config) + ".";
  contratoHoras.value = String(rhHorasSemanalesEn(rhTodayISO(), config));
  contratoModal.querySelector('input[name="contrato-modo"][value="todo"]').checked = true;
  contratoDesde.value = rhTodayISO();
  rhContratoActualizarPrevia();
  contratoModal.classList.remove("hidden");
  contratoHoras.focus();
}

function rhCerrarContrato() {
  contratoModal.classList.add("hidden");
}

document.querySelectorAll(".btn-cambiar-contrato").forEach(function (b) {
  b.addEventListener("click", rhAbrirContrato);
});

contratoHoras.addEventListener("input", rhContratoActualizarPrevia);
contratoDesde.addEventListener("change", rhContratoActualizarPrevia);
contratoModal.querySelectorAll('input[name="contrato-modo"]').forEach(function (r) {
  r.addEventListener("change", rhContratoActualizarPrevia);
});
contratoModal.querySelectorAll(".contrato-atajos [data-horas]").forEach(function (b) {
  b.addEventListener("click", function () {
    contratoHoras.value = b.getAttribute("data-horas");
    rhContratoActualizarPrevia();
  });
});

rhEl("contrato-cancelar").addEventListener("click", rhCerrarContrato);
contratoModal.addEventListener("click", function (e) { if (e.target === contratoModal) rhCerrarContrato(); });
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !contratoModal.classList.contains("hidden")) rhCerrarContrato();
});

contratoGuardar.addEventListener("click", function () {
  var propuesto = rhContratoPropuesto();
  if (!propuesto) return;
  var todo = rhContratoModo() === "todo";
  rhSaveConfig(propuesto);
  rhCerrarContrato();
  rhShowAlert("Contrato: " + rhContratoTextoHoy() + (todo ? ". Se recalcularon todos los meses." :
    ", desde el " + rhFormatDateDisplay(contratoDesde.value) + "."), "success");
  rhRefrescarVistas();
});
