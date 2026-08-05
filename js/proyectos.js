"use strict";

// ---------- Tab: Funciones y Proyectos ----------

var proyectoForm = rhEl("proyecto-form");
var proyectoIdInput = rhEl("proyecto-id");
var proyectoFechaInput = rhEl("proyecto-fecha");
var proyectoTituloInput = rhEl("proyecto-titulo");
var proyectoDescripcionInput = rhEl("proyecto-descripcion");
var proyectoSubmitBtn = rhEl("proyecto-submit-btn");
var proyectoCancelBtn = rhEl("proyecto-cancel-btn");
var proyectoFormTitle = rhEl("proyecto-form-title");
var proyectoErrorMsg = rhEl("error-proyecto");
var proyectosTableBody = rhEl("proyectos-table-body");
var proyectosEmptyState = rhEl("proyectos-empty-state");

function rhProyectoResetForm() {
  proyectoIdInput.value = "";
  proyectoCancelBtn.classList.add("hidden");
  proyectoSubmitBtn.textContent = "Guardar";
  proyectoFormTitle.textContent = "Registrar función / proyecto";
  proyectoErrorMsg.textContent = "";
  proyectoFechaInput.value = rhTodayISO();
  proyectoTituloInput.value = "";
  proyectoDescripcionInput.value = "";
}

proyectoCancelBtn.addEventListener("click", rhProyectoResetForm);

proyectoForm.addEventListener("submit", function (e) {
  e.preventDefault();
  proyectoErrorMsg.textContent = "";
  var titulo = proyectoTituloInput.value.trim();
  if (!titulo) {
    proyectoErrorMsg.textContent = "Ingresa un nombre para la función o proyecto.";
    return;
  }
  var proyecto = {
    id: proyectoIdInput.value || null,
    fecha: proyectoFechaInput.value || rhTodayISO(),
    titulo: titulo,
    descripcion: proyectoDescripcionInput.value.trim()
  };
  rhUpsertProyecto(proyecto);
  rhShowAlert("Función / proyecto guardado.", "success");
  rhProyectoResetForm();
  renderProyectos();
});

function renderProyectos() {
  var proyectos = rhLoadProyectos();
  rhClear(proyectosTableBody);
  proyectosEmptyState.classList.toggle("hidden", proyectos.length > 0);

  proyectos.forEach(function (p) {
    var tr = document.createElement("tr");

    var tdFecha = document.createElement("td");
    tdFecha.textContent = rhFormatDateDisplay(p.fecha);
    tr.appendChild(tdFecha);

    var tdTitulo = document.createElement("td");
    tdTitulo.textContent = p.titulo;
    tr.appendChild(tdTitulo);

    var tdDescripcion = document.createElement("td");
    tdDescripcion.className = "note-cell";
    tdDescripcion.textContent = p.descripcion || "—";
    tr.appendChild(tdDescripcion);

    var tdActions = document.createElement("td");
    tdActions.className = "col-actions";
    var actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-small btn-secondary";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", function () {
      proyectoIdInput.value = p.id;
      proyectoFechaInput.value = p.fecha;
      proyectoTituloInput.value = p.titulo;
      proyectoDescripcionInput.value = p.descripcion || "";
      proyectoCancelBtn.classList.remove("hidden");
      proyectoSubmitBtn.textContent = "Guardar cambios";
      proyectoFormTitle.textContent = "Editar función / proyecto";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-small btn-danger";
    delBtn.textContent = "Eliminar";
    delBtn.addEventListener("click", function () {
      if (!confirm("¿Eliminar \"" + p.titulo + "\"?")) return;
      rhDeleteProyecto(p.id);
      renderProyectos();
      rhShowAlert("Registro eliminado.", "success");
    });

    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(delBtn);
    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    proyectosTableBody.appendChild(tr);
  });
}
