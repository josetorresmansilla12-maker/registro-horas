"use strict";

// ---------- Tabs ----------

var rhTabIds = ["marcaje", "estadisticas", "licencias", "proyectos", "config"];

function rhActivateTab(tab) {
  rhTabIds.forEach(function (id) {
    var btn = rhEl("tab-" + id + "-btn");
    var panel = rhEl("tab-" + id);
    if (btn) btn.classList.toggle("active", id === tab);
    if (panel) panel.classList.toggle("hidden", id !== tab);
  });

  if (tab === "estadisticas") renderEstadisticas();
  if (tab === "licencias") renderLicencias();
  if (tab === "proyectos") renderProyectos();
  if (tab === "config") { renderConfigForm(); renderPapelera(); }
  if (tab === "marcaje") renderMarcajeTable();
}

rhTabIds.forEach(function (id) {
  var btn = rhEl("tab-" + id + "-btn");
  if (btn) btn.addEventListener("click", function () { rhActivateTab(id); });
});
