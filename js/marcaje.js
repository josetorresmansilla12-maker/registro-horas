"use strict";

// ---------- Tab: Marcaje ----------

var rhMarcajeMesActual = rhMonthRange(rhTodayISO()).start;

var marcajeForm = rhEl("marcaje-form");
var marcajeIdInput = rhEl("marcaje-id");
var marcajeFechaInput = rhEl("marcaje-fecha");
var marcajeB1Entrada = rhEl("marcaje-b1-entrada");
var marcajeB1Salida = rhEl("marcaje-b1-salida");
var marcajeB2Activo = rhEl("marcaje-b2-activo");
var marcajeB2Fields = rhEl("marcaje-b2-fields");
var marcajeB2Entrada = rhEl("marcaje-b2-entrada");
var marcajeB2Salida = rhEl("marcaje-b2-salida");
var marcajeNota = rhEl("marcaje-nota");
var marcajeTotalPreview = rhEl("marcaje-total-preview");
var marcajeSubmitBtn = rhEl("marcaje-submit-btn");
var marcajeCancelBtn = rhEl("marcaje-cancel-btn");
var marcajeFormTitle = rhEl("marcaje-form-title");
var marcajeLicenciaBanner = rhEl("marcaje-licencia-banner");
var marcajeLicenciaBannerText = rhEl("marcaje-licencia-banner-text");

function rhMarcajeToggleB2Fields() {
  marcajeB2Fields.classList.toggle("hidden", !marcajeB2Activo.checked);
  if (!marcajeB2Activo.checked) {
    marcajeB2Entrada.value = "";
    marcajeB2Salida.value = "";
  }
  rhMarcajeUpdateTotalPreview();
}

function rhMarcajeUpdateTotalPreview() {
  var minutes = rhBlockMinutes({ entrada: marcajeB1Entrada.value, salida: marcajeB1Salida.value }) +
    (marcajeB2Activo.checked ? rhBlockMinutes({ entrada: marcajeB2Entrada.value, salida: marcajeB2Salida.value }) : 0);
  marcajeTotalPreview.textContent = "Total del día: " + rhMinutesToHM(minutes);
}

function rhMarcajeShowLicenciaBanner(fecha) {
  var licencia = rhLicenciaForDate(fecha);
  if (licencia) {
    marcajeLicenciaBannerText.textContent = "Este día está cubierto por una licencia (" + rhTipoLicenciaLabel(licencia.tipo) + ") del " +
      rhFormatDateDisplay(licencia.fechaInicio) + " al " + rhFormatDateDisplay(licencia.fechaFin) + ".";
    marcajeLicenciaBanner.classList.remove("hidden");
  } else {
    marcajeLicenciaBanner.classList.add("hidden");
  }
}

// Al elegir una fecha: si ya existe un registro se carga para editarlo; si no,
// se autocompleta con el horario base configurado.
function rhMarcajeLoadFecha(fecha) {
  rhMarcajeShowLicenciaBanner(fecha);
  var existente = rhGetRegistroByFecha(fecha);
  var config = rhLoadConfig();

  if (existente) {
    marcajeIdInput.value = existente.id;
    marcajeB1Entrada.value = existente.bloque1.entrada || "";
    marcajeB1Salida.value = existente.bloque1.salida || "";
    var tieneB2 = !!(existente.bloque2 && (existente.bloque2.entrada || existente.bloque2.salida));
    marcajeB2Activo.checked = tieneB2;
    marcajeB2Entrada.value = (existente.bloque2 && existente.bloque2.entrada) || "";
    marcajeB2Salida.value = (existente.bloque2 && existente.bloque2.salida) || "";
    marcajeNota.value = existente.nota || "";
    marcajeFormTitle.textContent = "Editar jornada — " + rhFormatDateDisplay(fecha);
  } else {
    marcajeIdInput.value = "";
    marcajeB1Entrada.value = config.horarioBase.bloque1.entrada || "";
    marcajeB1Salida.value = config.horarioBase.bloque1.salida || "";
    marcajeB2Activo.checked = config.bloque2Activo;
    marcajeB2Entrada.value = config.horarioBase.bloque2.entrada || "";
    marcajeB2Salida.value = config.horarioBase.bloque2.salida || "";
    marcajeNota.value = "";
    marcajeFormTitle.textContent = "Registrar jornada — " + rhFormatDateDisplay(fecha);
  }
  rhMarcajeToggleB2Fields();
}

marcajeFechaInput.addEventListener("change", function () {
  rhMarcajeLoadFecha(marcajeFechaInput.value || rhTodayISO());
});

rhEl("marcaje-marcar-feriado-btn").addEventListener("click", function () {
  var fecha = marcajeFechaInput.value || rhTodayISO();
  rhLicenciaPrefillFeriado(fecha);
  rhActivateTab("licencias");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
marcajeB2Activo.addEventListener("change", rhMarcajeToggleB2Fields);
[marcajeB1Entrada, marcajeB1Salida, marcajeB2Entrada, marcajeB2Salida].forEach(function (input) {
  input.addEventListener("input", rhMarcajeUpdateTotalPreview);
});

function rhMarcajeResetForm() {
  marcajeIdInput.value = "";
  marcajeCancelBtn.classList.add("hidden");
  marcajeSubmitBtn.textContent = "Guardar jornada";
  marcajeFechaInput.value = rhTodayISO();
  rhMarcajeLoadFecha(rhTodayISO());
}

marcajeCancelBtn.addEventListener("click", rhMarcajeResetForm);

marcajeForm.addEventListener("submit", function (e) {
  e.preventDefault();
  var fecha = marcajeFechaInput.value || rhTodayISO();
  var b1 = { entrada: marcajeB1Entrada.value, salida: marcajeB1Salida.value };
  var b2 = marcajeB2Activo.checked ? { entrada: marcajeB2Entrada.value, salida: marcajeB2Salida.value } : { entrada: "", salida: "" };
  var nota = marcajeNota.value.trim();

  var errorB1 = rhEl("error-marcaje-b1");
  var errorB2 = rhEl("error-marcaje-b2");
  errorB1.textContent = "";
  errorB2.textContent = "";

  var b1Partial = (!!b1.entrada) !== (!!b1.salida);
  var b2Partial = marcajeB2Activo.checked && ((!!b2.entrada) !== (!!b2.salida));
  if (b1Partial) errorB1.textContent = "Completa entrada y salida, o deja el bloque vacío.";
  if (b2Partial) errorB2.textContent = "Completa entrada y salida, o desactiva el bloque.";
  if (rhBlockIsInvalid(b1)) errorB1.textContent = "La salida debe ser posterior a la entrada.";
  if (marcajeB2Activo.checked && rhBlockIsInvalid(b2)) errorB2.textContent = "La salida debe ser posterior a la entrada.";
  if (errorB1.textContent || errorB2.textContent) return;

  if (!b1.entrada && !b2.entrada && !nota) {
    rhShowAlert("Ingresa al menos un bloque de horario o una nota antes de guardar.", "error");
    return;
  }

  var registro = {
    id: marcajeIdInput.value || null,
    fecha: fecha,
    bloque1: b1,
    bloque2: b2,
    nota: nota
  };
  rhUpsertRegistro(registro);
  rhShowAlert("Jornada del " + rhFormatDateDisplay(fecha) + " guardada.", "success");
  rhMarcajeMesActual = rhMonthRange(fecha).start;
  rhMarcajeResetForm();
  renderMarcajeTable();
});

// ---------- Historial mensual ----------

var marcajeMesPrevBtn = rhEl("marcaje-mes-prev");
var marcajeMesNextBtn = rhEl("marcaje-mes-next");
var marcajeMesLabel = rhEl("marcaje-mes-label");
var marcajeTableBody = rhEl("marcaje-table-body");
var marcajeEmptyState = rhEl("marcaje-empty-state");

marcajeMesPrevBtn.addEventListener("click", function () {
  var d = rhParseISO(rhMarcajeMesActual);
  d.setMonth(d.getMonth() - 1);
  rhMarcajeMesActual = rhMonthRange(rhDateToISO(d)).start;
  renderMarcajeTable();
});
marcajeMesNextBtn.addEventListener("click", function () {
  var d = rhParseISO(rhMarcajeMesActual);
  d.setMonth(d.getMonth() + 1);
  rhMarcajeMesActual = rhMonthRange(rhDateToISO(d)).start;
  renderMarcajeTable();
});

function rhBlockLabel(block) {
  if (!block || !block.entrada || !block.salida) return "—";
  return block.entrada + " - " + block.salida;
}

function renderMarcajeTable() {
  var range = rhMonthRange(rhMarcajeMesActual);
  var d = rhParseISO(rhMarcajeMesActual);
  marcajeMesLabel.textContent = RH_MESES[d.getMonth()] + " " + d.getFullYear();

  var registros = rhLoadRegistros()
    .filter(function (r) { return rhIsDateInRange(r.fecha, range.start, range.end); })
    .sort(function (a, b) { return rhCompareISO(b.fecha, a.fecha); });

  rhClear(marcajeTableBody);
  marcajeEmptyState.classList.toggle("hidden", registros.length > 0);

  registros.forEach(function (r) {
    var tr = document.createElement("tr");

    var tdFecha = document.createElement("td");
    tdFecha.textContent = rhFormatDateDisplay(r.fecha);
    tr.appendChild(tdFecha);

    var tdDia = document.createElement("td");
    tdDia.textContent = rhDayOfWeekLabel(r.fecha, true);
    tr.appendChild(tdDia);

    var tdB1 = document.createElement("td");
    tdB1.textContent = rhBlockLabel(r.bloque1);
    tr.appendChild(tdB1);

    var tdB2 = document.createElement("td");
    tdB2.textContent = rhBlockLabel(r.bloque2);
    tr.appendChild(tdB2);

    var tdTotal = document.createElement("td");
    tdTotal.textContent = rhMinutesToHM(rhRegistroMinutes(r));
    tr.appendChild(tdTotal);

    var tdNota = document.createElement("td");
    tdNota.className = "note-cell";
    tdNota.textContent = r.nota || "—";
    tr.appendChild(tdNota);

    var tdActions = document.createElement("td");
    tdActions.className = "col-actions";
    var actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-small btn-secondary";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", function () {
      marcajeFechaInput.value = r.fecha;
      rhMarcajeLoadFecha(r.fecha);
      marcajeCancelBtn.classList.remove("hidden");
      marcajeSubmitBtn.textContent = "Guardar cambios";
      rhActivateTab("marcaje");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-small btn-danger";
    delBtn.textContent = "Eliminar";
    delBtn.addEventListener("click", function () {
      if (!confirm("¿Eliminar el registro del " + rhFormatDateDisplay(r.fecha) + "?")) return;
      rhDeleteRegistro(r.id);
      renderMarcajeTable();
      rhShowAlert("Registro eliminado.", "success");
    });

    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(delBtn);
    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    marcajeTableBody.appendChild(tr);
  });
}
