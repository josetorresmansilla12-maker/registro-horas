"use strict";

// ---------- Tab: Configuración → Papelera ----------

function rhPapeleraTipoLabel(entry) {
  if (entry.tipo === "registro") return "Jornada";
  if (entry.tipo === "licencia") return rhTipoLicenciaLabel(entry.item.tipo);
  if (entry.tipo === "proyecto") return "Función / Proyecto";
  return entry.tipo;
}

function rhPapeleraDetalleLabel(entry) {
  if (entry.tipo === "registro") {
    return rhFormatDateDisplay(entry.item.fecha) + " · " + rhMinutesToHM(rhRegistroMinutes(entry.item));
  }
  if (entry.tipo === "licencia") {
    return rhFormatDateDisplay(entry.item.fechaInicio) + " al " + rhFormatDateDisplay(entry.item.fechaFin) +
      (entry.item.detalle ? " · " + entry.item.detalle : "");
  }
  if (entry.tipo === "proyecto") {
    return entry.item.titulo + " · " + rhFormatDateDisplay(entry.item.fecha);
  }
  return "";
}

function rhFormatTimestampDisplay(ts) {
  var d = new Date(ts);
  return rhDateToISO(d).split("-").reverse().join("/") + " " +
    String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function renderPapelera() {
  var papelera = rhLoadPapelera().slice().sort(function (a, b) { return b.eliminadoEn - a.eliminadoEn; });
  var tbody = rhEl("papelera-table-body");
  rhClear(tbody);

  rhEl("papelera-empty-state").classList.toggle("hidden", papelera.length > 0);
  rhEl("papelera-table-wrap").classList.toggle("hidden", papelera.length === 0);
  rhEl("papelera-vaciar-btn").classList.toggle("hidden", papelera.length === 0);
  rhEl("papelera-count-hint").textContent = papelera.length > 0 ? "(" + papelera.length + ")" : "";

  papelera.forEach(function (entry) {
    var tr = document.createElement("tr");

    var tdTipo = document.createElement("td");
    tdTipo.textContent = rhPapeleraTipoLabel(entry);
    tr.appendChild(tdTipo);

    var tdDetalle = document.createElement("td");
    tdDetalle.className = "note-cell";
    tdDetalle.textContent = rhPapeleraDetalleLabel(entry);
    tr.appendChild(tdDetalle);

    var tdEliminado = document.createElement("td");
    tdEliminado.textContent = rhFormatTimestampDisplay(entry.eliminadoEn);
    tr.appendChild(tdEliminado);

    var tdVence = document.createElement("td");
    var diasRestantes = rhPapeleraVenceEn(entry);
    tdVence.textContent = diasRestantes + (diasRestantes === 1 ? " día" : " días");
    tr.appendChild(tdVence);

    var tdActions = document.createElement("td");
    tdActions.className = "col-actions";
    var actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";

    var restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "btn btn-small btn-secondary";
    restoreBtn.textContent = "Restaurar";
    restoreBtn.addEventListener("click", function () {
      if (rhPapeleraTieneConflicto(entry)) {
        var ok = confirm(
          "Ya existe una jornada guardada para el " + rhFormatDateDisplay(entry.item.fecha) + ". " +
          "Restaurar esta versión reemplazará la jornada actual de ese día. ¿Continuar?"
        );
        if (!ok) return;
      }
      rhPapeleraRestaurar(entry.id);
      renderPapelera();
      renderMarcajeTable();
      rhMarcajeLoadFecha(marcajeFechaInput.value || rhTodayISO());
      renderEstadisticas();
      renderLicencias();
      renderProyectos();
      rhShowAlert("Restaurado desde la papelera.", "success");
    });

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-small btn-danger";
    delBtn.textContent = "Eliminar definitivo";
    delBtn.addEventListener("click", function () {
      if (!confirm("Esto elimina el registro de la papelera en forma permanente. ¿Estás seguro?")) return;
      rhPapeleraEliminarDefinitivo(entry.id);
      renderPapelera();
      rhShowAlert("Eliminado definitivamente.", "success");
    });

    actionsWrap.appendChild(restoreBtn);
    actionsWrap.appendChild(delBtn);
    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

rhEl("papelera-vaciar-btn").addEventListener("click", function () {
  var total = rhLoadPapelera().length;
  if (total === 0) return;
  if (!confirm("Esto elimina en forma permanente los " + total + " elemento(s) de la papelera. ¿Estás seguro?")) return;
  rhPapeleraVaciar();
  renderPapelera();
  rhShowAlert("Papelera vaciada.", "success");
});
