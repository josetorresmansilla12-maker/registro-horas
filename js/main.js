"use strict";

// ---------- Inicialización ----------

document.addEventListener("DOMContentLoaded", function () {
  rhEnhanceTimeInputs(document);
  rhPapeleraPurgarVencidos();
  rhMarcajeResetForm();
  rhLicenciaResetForm();
  rhProyectoResetForm();
  renderMarcajeTable();
  renderBackupReminder();
  rhActivateTab("marcaje");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function (e) {
      console.warn("No se pudo registrar el service worker:", e);
    });
  }
});
