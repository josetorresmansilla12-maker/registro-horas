"use strict";

// ---------- Tab: Marcaje ----------

var rhMarcajeMesActual = rhMonthRange(rhTodayISO()).start;

var marcajeForm = rhEl("marcaje-form");
var marcajeIdInput = rhEl("marcaje-id");
var marcajeFechaInput = rhEl("marcaje-fecha");
var marcajeJornadasWrap = rhEl("marcaje-jornadas");
var marcajeNota = rhEl("marcaje-nota");
var marcajeTotalPreview = rhEl("marcaje-total-preview");
var marcajeSubmitBtn = rhEl("marcaje-submit-btn");
var marcajeCancelBtn = rhEl("marcaje-cancel-btn");
var marcajeFormTitle = rhEl("marcaje-form-title");
var marcajeLicenciaBanner = rhEl("marcaje-licencia-banner");
var marcajeLicenciaBannerText = rhEl("marcaje-licencia-banner-text");
var marcajeErrorBloques = rhEl("error-marcaje-bloques");

// La jornada del día es una lista de bloques entrada/salida (puede haber más
// de dos: reunión en la mañana, al mediodía y en la tarde, por ejemplo).
// Este arreglo es la fuente de la verdad mientras se edita el formulario.
var rhMarcajeJornadas = [];

function rhMarcajeBloqueVacio() {
  return { entrada: "", salida: "" };
}

function rhMarcajeUpdateTotalPreview() {
  var minutes = rhMarcajeJornadas.reduce(function (sum, b) {
    return sum + rhBlockMinutes(b);
  }, 0);
  marcajeTotalPreview.textContent = "Total del día: " + rhMinutesToHM(minutes);
}

function rhMarcajeBuildTimeField(labelText, bloque, key) {
  var field = document.createElement("div");
  field.className = "field";

  var label = document.createElement("label");
  label.textContent = labelText;
  field.appendChild(label);

  var input = document.createElement("input");
  input.type = "time";
  input.value = bloque[key] || "";
  function sync() {
    bloque[key] = input.value;
    rhMarcajeUpdateTotalPreview();
  }
  input.addEventListener("input", sync);
  input.addEventListener("change", sync);
  field.appendChild(input);

  return field;
}

function rhMarcajeBuildJornadaRow(bloque, idx) {
  var group = document.createElement("div");
  group.className = "block-group";

  var head = document.createElement("div");
  head.className = "block-group-header";

  var h3 = document.createElement("h3");
  h3.textContent = idx === 0 ? "Jornada" : "Jornada extra " + idx;
  head.appendChild(h3);

  // Se puede quitar cualquier jornada siempre que quede al menos una.
  if (rhMarcajeJornadas.length > 1) {
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-small btn-secondary";
    removeBtn.textContent = "Quitar";
    removeBtn.addEventListener("click", function () {
      rhMarcajeJornadas.splice(idx, 1);
      rhMarcajeRenderJornadas();
    });
    head.appendChild(removeBtn);
  }
  group.appendChild(head);

  var row = document.createElement("div");
  row.className = "field-row";
  row.appendChild(rhMarcajeBuildTimeField("Entrada", bloque, "entrada"));
  row.appendChild(rhMarcajeBuildTimeField("Salida", bloque, "salida"));
  group.appendChild(row);

  return group;
}

function rhMarcajeRenderJornadas() {
  rhClear(marcajeJornadasWrap);
  rhMarcajeJornadas.forEach(function (bloque, idx) {
    marcajeJornadasWrap.appendChild(rhMarcajeBuildJornadaRow(bloque, idx));
  });
  rhEnhanceTimeInputs(marcajeJornadasWrap);
  rhMarcajeUpdateTotalPreview();
}

function rhMarcajeSetJornadas(bloques) {
  var base = (bloques && bloques.length) ? bloques : [rhMarcajeBloqueVacio()];
  rhMarcajeJornadas = base.map(function (b) {
    return { entrada: b.entrada || "", salida: b.salida || "" };
  });
  rhMarcajeRenderJornadas();
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
  marcajeErrorBloques.textContent = "";
  var existente = rhGetRegistroByFecha(fecha);
  var config = rhLoadConfig();

  if (existente) {
    marcajeIdInput.value = existente.id;
    marcajeNota.value = existente.nota || "";
    var estadoLabel = rhRegistroEstadoLabel(existente);
    if (estadoLabel) {
      rhMarcajeSetJornadas([]);
      marcajeFormTitle.textContent = "Editar jornada — " + rhFormatDateDisplay(fecha) + " (" + estadoLabel + ")";
    } else {
      rhMarcajeSetJornadas(rhRegistroBloques(existente));
      marcajeFormTitle.textContent = "Editar jornada — " + rhFormatDateDisplay(fecha);
    }
  } else {
    marcajeIdInput.value = "";
    marcajeNota.value = "";
    var base = [config.horarioBase.bloque1];
    if (config.bloque2Activo) base.push(config.horarioBase.bloque2);
    rhMarcajeSetJornadas(base);
    marcajeFormTitle.textContent = "Registrar jornada — " + rhFormatDateDisplay(fecha);
  }
}

marcajeFechaInput.addEventListener("change", function () {
  rhMarcajeLoadFecha(marcajeFechaInput.value || rhTodayISO());
});

rhEl("marcaje-add-jornada-btn").addEventListener("click", function () {
  rhMarcajeJornadas.push(rhMarcajeBloqueVacio());
  rhMarcajeRenderJornadas();
});

rhEl("marcaje-marcar-feriado-btn").addEventListener("click", function () {
  var fecha = marcajeFechaInput.value || rhTodayISO();
  rhLicenciaPrefillFeriado(fecha);
  rhActivateTab("licencias");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Marca el día seleccionado con un estado especial (sin horas trabajadas) que
// no cuenta como incumplimiento ni afecta el cálculo: "No convocado" o
// "Aún no contratado".
function rhMarcajeMarcarEstado(estado, label, descripcion) {
  var fecha = marcajeFechaInput.value || rhTodayISO();
  var existente = rhGetRegistroByFecha(fecha);

  var aviso = "¿Marcar el " + rhFormatDateDisplay(fecha) + ' como "' + label + '"?\n\n' + descripcion;
  if (existente && rhRegistroMinutes(existente) > 0) {
    aviso += "\n\nOJO: este día ya tiene horas registradas y quedarán reemplazadas.";
  }
  if (!confirm(aviso)) return;

  rhUpsertRegistro({
    id: null,
    fecha: fecha,
    bloques: [],
    nota: marcajeNota.value.trim(),
    estado: estado
  });
  rhShowAlert("El " + rhFormatDateDisplay(fecha) + " quedó marcado como " + label + ".", "success");
  rhMarcajeMesActual = rhMonthRange(fecha).start;
  rhMarcajeResetForm();
  renderMarcajeTable();
}

// "No me convocaron": la oficina pidió no asistir ese día.
rhEl("marcaje-no-convocado-btn").addEventListener("click", function () {
  rhMarcajeMarcarEstado(RH_ESTADO_NO_CONVOCADO, "No convocado",
    "Se usa cuando la oficina te pide no asistir: ese día no cuenta como " +
    "incumplimiento (no resta horas) y aparecerá como \"No convocado\" en el historial y en el informe.");
});

// "Aún no contratado": días previos al inicio del contrato o períodos sin él.
rhEl("marcaje-no-contratado-btn").addEventListener("click", function () {
  rhMarcajeMarcarEstado(RH_ESTADO_NO_CONTRATADO, "Aún no contratado",
    "Se usa para los días previos al inicio de tu contrato (o un período sin " +
    "contrato): no cuentan como falta ni afectan el cálculo de horas.");
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
  var nota = marcajeNota.value.trim();
  marcajeErrorBloques.textContent = "";

  var bloques = [];
  for (var i = 0; i < rhMarcajeJornadas.length; i++) {
    var b = rhMarcajeJornadas[i];
    var tieneEntrada = !!b.entrada;
    var tieneSalida = !!b.salida;
    if (!tieneEntrada && !tieneSalida) continue; // jornada vacía: se ignora
    if (tieneEntrada !== tieneSalida) {
      marcajeErrorBloques.textContent = "Completa entrada y salida en cada jornada, o deja la jornada vacía.";
      return;
    }
    if (rhBlockIsInvalid(b)) {
      marcajeErrorBloques.textContent = "En cada jornada, la salida debe ser posterior a la entrada.";
      return;
    }
    bloques.push({ entrada: b.entrada, salida: b.salida });
  }

  if (bloques.length === 0 && !nota) {
    rhShowAlert("Ingresa al menos una jornada con horario o una nota antes de guardar.", "error");
    return;
  }

  rhUpsertRegistro({
    id: marcajeIdInput.value || null,
    fecha: fecha,
    bloques: bloques,
    nota: nota
  });
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

    var tdJornadas = document.createElement("td");
    tdJornadas.className = "jornadas-cell";
    tdJornadas.textContent = rhFormatJornadasRegistro(r);
    tr.appendChild(tdJornadas);

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
