"use strict";

// ---------- Tab: Licencias ----------

var licenciaForm = rhEl("licencia-form");
var licenciaIdInput = rhEl("licencia-id");
var licenciaInicioInput = rhEl("licencia-inicio");
var licenciaFinInput = rhEl("licencia-fin");
var licenciaTipoSelect = rhEl("licencia-tipo");
var licenciaDetalleInput = rhEl("licencia-detalle");
var licenciaAjustaMetaInput = rhEl("licencia-ajusta-meta");
var licenciaSubmitBtn = rhEl("licencia-submit-btn");
var licenciaCancelBtn = rhEl("licencia-cancel-btn");
var licenciaFormTitle = rhEl("licencia-form-title");
var licenciaErrorMsg = rhEl("error-licencia");
var licenciasTableBody = rhEl("licencias-table-body");
var licenciasEmptyState = rhEl("licencias-empty-state");

RH_TIPOS_LICENCIA.forEach(function (t) {
  var opt = document.createElement("option");
  opt.value = t.id;
  opt.textContent = t.label;
  licenciaTipoSelect.appendChild(opt);
});

licenciaInicioInput.addEventListener("change", function () {
  if (!licenciaFinInput.value || rhCompareISO(licenciaFinInput.value, licenciaInicioInput.value) < 0) {
    licenciaFinInput.value = licenciaInicioInput.value;
  }
});

function rhLicenciaResetForm() {
  licenciaIdInput.value = "";
  licenciaCancelBtn.classList.add("hidden");
  licenciaSubmitBtn.textContent = "Guardar";
  licenciaFormTitle.textContent = "Registrar licencia / ausencia justificada";
  licenciaErrorMsg.textContent = "";
  var today = rhTodayISO();
  licenciaInicioInput.value = today;
  licenciaFinInput.value = today;
  licenciaTipoSelect.value = "medica";
  licenciaDetalleInput.value = "";
  licenciaAjustaMetaInput.checked = true;
}

// Prellena el formulario para registrar rápido el día seleccionado en
// Marcaje como feriado (usado por el botón "Marcar este día como feriado").
function rhLicenciaPrefillFeriado(fecha) {
  rhLicenciaResetForm();
  licenciaInicioInput.value = fecha;
  licenciaFinInput.value = fecha;
  licenciaTipoSelect.value = "feriado";
  licenciaDetalleInput.focus();
}

licenciaCancelBtn.addEventListener("click", rhLicenciaResetForm);

licenciaForm.addEventListener("submit", function (e) {
  e.preventDefault();
  licenciaErrorMsg.textContent = "";
  var inicio = licenciaInicioInput.value;
  var fin = licenciaFinInput.value;
  if (!inicio || !fin) {
    licenciaErrorMsg.textContent = "Ingresa fecha de inicio y de término.";
    return;
  }
  if (rhCompareISO(fin, inicio) < 0) {
    licenciaErrorMsg.textContent = "La fecha de término no puede ser anterior a la de inicio.";
    return;
  }
  var licencia = {
    id: licenciaIdInput.value || null,
    fechaInicio: inicio,
    fechaFin: fin,
    tipo: licenciaTipoSelect.value,
    detalle: licenciaDetalleInput.value.trim(),
    ajustaMeta: licenciaAjustaMetaInput.checked
  };
  rhUpsertLicencia(licencia);
  rhShowAlert("Licencia guardada.", "success");
  rhLicenciaResetForm();
  renderLicencias();
});

function renderLicencias() {
  var licencias = rhLoadLicencias().slice().sort(function (a, b) { return rhCompareISO(b.fechaInicio, a.fechaInicio); });
  rhClear(licenciasTableBody);
  licenciasEmptyState.classList.toggle("hidden", licencias.length > 0);

  licencias.forEach(function (l) {
    var tr = document.createElement("tr");

    var tdInicio = document.createElement("td");
    tdInicio.textContent = rhFormatDateDisplay(l.fechaInicio);
    tr.appendChild(tdInicio);

    var tdFin = document.createElement("td");
    tdFin.textContent = rhFormatDateDisplay(l.fechaFin);
    tr.appendChild(tdFin);

    var tdDias = document.createElement("td");
    tdDias.textContent = rhDaysBetweenInclusive(l.fechaInicio, l.fechaFin).length;
    tr.appendChild(tdDias);

    var tdTipo = document.createElement("td");
    tdTipo.textContent = rhTipoLicenciaLabel(l.tipo);
    tr.appendChild(tdTipo);

    var tdDetalle = document.createElement("td");
    tdDetalle.className = "note-cell";
    tdDetalle.textContent = l.detalle || "—";
    tr.appendChild(tdDetalle);

    var tdAjusta = document.createElement("td");
    tdAjusta.textContent = rhLicenciaAjustaMeta(l) ? "Sí" : "No";
    tr.appendChild(tdAjusta);

    var tdActions = document.createElement("td");
    tdActions.className = "col-actions";
    var actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-small btn-secondary";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", function () {
      licenciaIdInput.value = l.id;
      licenciaInicioInput.value = l.fechaInicio;
      licenciaFinInput.value = l.fechaFin;
      licenciaTipoSelect.value = l.tipo;
      licenciaDetalleInput.value = l.detalle || "";
      licenciaAjustaMetaInput.checked = rhLicenciaAjustaMeta(l);
      licenciaCancelBtn.classList.remove("hidden");
      licenciaSubmitBtn.textContent = "Guardar cambios";
      licenciaFormTitle.textContent = "Editar licencia";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-small btn-danger";
    delBtn.textContent = "Eliminar";
    delBtn.addEventListener("click", function () {
      if (!confirm("¿Eliminar esta licencia?")) return;
      rhDeleteLicencia(l.id);
      renderLicencias();
      rhShowAlert("Licencia eliminada.", "success");
    });

    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(delBtn);
    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    licenciasTableBody.appendChild(tr);
  });
}
