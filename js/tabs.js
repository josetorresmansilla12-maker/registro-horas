"use strict";

// ---------- Tabs ----------

var rhTabIds = ["marcaje", "estadisticas", "arreglo", "licencias", "proyectos", "informe", "config"];

function rhActivateTab(tab) {
  rhTabIds.forEach(function (id) {
    var btn = rhEl("tab-" + id + "-btn");
    var panel = rhEl("tab-" + id);
    if (btn) btn.classList.toggle("active", id === tab);
    if (panel) panel.classList.toggle("hidden", id !== tab);
  });

  if (tab === "estadisticas") renderEstadisticas();
  if (tab === "arreglo") renderArreglo();
  if (tab === "licencias") renderLicencias();
  if (tab === "proyectos") renderProyectos();
  if (tab === "informe") renderInforme();
  if (tab === "config") { renderConfigForm(); renderPapelera(); renderPrivado(); }
  else rhPrivadoBloquear();
  if (tab === "marcaje") renderMarcajeTable();
}

rhTabIds.forEach(function (id) {
  var btn = rhEl("tab-" + id + "-btn");
  if (btn) btn.addEventListener("click", function () { rhActivateTab(id); });
});

// Vuelve a dibujar la pestaña abierta y el historial después de un cambio en
// los datos (día libre, edición desde el informe, sincronización, etc.).
// Se conserva la posición de la pantalla para seguir donde estabas.
function rhRefrescarVistas() {
  var activa = document.querySelector(".tab-btn.active");
  var y = window.scrollY;
  renderMarcajeTable();
  rhMarcajeMostrarLibre();
  if (activa) rhActivateTab(activa.getAttribute("data-tab"));
  window.scrollTo(0, y);
}
