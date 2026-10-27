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
  rhSyncIniciar();
  // Ajustes únicos de los datos: con sincronización se aplican al recibir los
  // datos de la nube (sync.js); si no hay, o no llega nada, se aplican igual.
  if (!rhSync.codigo) rhAplicarMigraciones();
  else setTimeout(rhAplicarMigraciones, 15000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function (e) {
      console.warn("No se pudo registrar el service worker:", e);
    });
  }
});
