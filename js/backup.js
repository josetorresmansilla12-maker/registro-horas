"use strict";

// ---------- Respaldo combinado (Guardar / Importar) ----------
//
// Todo vive solo en localStorage (sin servidor), así que la única forma de
// no perder datos si cambias de teléfono o borras el navegador es exportar
// este .json de vez en cuando. En vez de un respaldo silencioso (imposible
// sin servidor), se avisa cuando llevas muchos días sin respaldar — mismo
// mecanismo que "Mis Finanzas" y la app de joyería.

function rhBuildBackupObject() {
  return {
    app: "registro-horas",
    version: 1,
    exportedAt: new Date().toISOString(),
    registros: rhLoadRegistros(),
    licencias: rhLoadLicencias(),
    proyectos: rhLoadProyectos(),
    config: rhLoadConfig()
  };
}

function rhMarkBackupDone() {
  localStorage.setItem(RH_LAST_BACKUP_KEY, String(Date.now()));
}

function rhDaysSinceLastBackup() {
  var raw = localStorage.getItem(RH_LAST_BACKUP_KEY);
  if (!raw) return null;
  var diff = Date.now() - Number(raw);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function renderBackupReminder() {
  var existing = rhEl("backup-reminder-alert");
  if (existing) existing.remove();

  var days = rhDaysSinceLastBackup();
  if (days !== null && days < RH_BACKUP_REMINDER_DAYS) return;

  var container = rhEl("app-alerts");
  var alertEl = document.createElement("div");
  alertEl.id = "backup-reminder-alert";
  alertEl.className = "app-alert warning";

  var text = document.createElement("span");
  text.textContent = days === null
    ? "💾 Todavía no has hecho un respaldo de tus datos."
    : "💾 No has respaldado tus datos hace " + days + " días.";
  alertEl.appendChild(text);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary btn-small";
  btn.textContent = "Respaldar ahora";
  btn.addEventListener("click", function () { rhEl("save-backup-btn").click(); });
  alertEl.appendChild(btn);

  container.appendChild(alertEl);
}

rhEl("save-backup-btn").addEventListener("click", function () {
  var backup = rhBuildBackupObject();
  var filename = "registro-horas_respaldo_" + rhTodayISO() + ".json";
  rhDownloadFile(filename, JSON.stringify(backup, null, 2), "application/json");
  rhMarkBackupDone();
  renderBackupReminder();
  rhShowAlert("Respaldo descargado: " + filename, "success");
});

// ---------- Importar ----------

var rhPendingImport = null;

rhEl("import-file-input").addEventListener("change", function (e) {
  var file = e.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (evt) {
    try {
      var imported = JSON.parse(evt.target.result);
      if (!imported || typeof imported !== "object") throw new Error("Formato inválido");

      var importedRegistros = Array.isArray(imported.registros) ? imported.registros : [];
      var importedLicencias = Array.isArray(imported.licencias) ? imported.licencias : [];
      var importedProyectos = Array.isArray(imported.proyectos) ? imported.proyectos : [];
      var importedConfig = imported.config && typeof imported.config === "object" ? imported.config : null;

      var validRegistros = importedRegistros.every(function (r) { return r && typeof r.fecha === "string"; });
      var validLicencias = importedLicencias.every(function (l) { return l && typeof l.fechaInicio === "string" && typeof l.fechaFin === "string"; });
      var validProyectos = importedProyectos.every(function (p) { return p && typeof p.fecha === "string" && typeof p.titulo === "string"; });
      if (!validRegistros || !validLicencias || !validProyectos) throw new Error("Formato inválido");

      // Registros: uno por fecha. Si ya existe uno local para esa fecha, se
      // conserva el local — importar nunca pisa un marcaje ya guardado.
      var existingRegistros = rhLoadRegistros();
      var existingFechas = {};
      existingRegistros.forEach(function (r) { existingFechas[r.fecha] = true; });
      var nuevosRegistros = importedRegistros.filter(function (r) { return !existingFechas[r.fecha]; });
      nuevosRegistros.forEach(function (r) { r.id = rhUid(); });
      var omitidos = importedRegistros.length - nuevosRegistros.length;

      // Licencias y proyectos: no son únicos por fecha, se agregan todos
      // (con id nuevo si colisiona con uno existente).
      var existingLicenciaIds = {};
      rhLoadLicencias().forEach(function (l) { existingLicenciaIds[l.id] = true; });
      importedLicencias.forEach(function (l) { if (!l.id || existingLicenciaIds[l.id]) l.id = rhUid(); });

      var existingProyectoIds = {};
      rhLoadProyectos().forEach(function (p) { existingProyectoIds[p.id] = true; });
      importedProyectos.forEach(function (p) { if (!p.id || existingProyectoIds[p.id]) p.id = rhUid(); });

      rhPendingImport = {
        mergedRegistros: existingRegistros.concat(nuevosRegistros),
        mergedLicencias: rhLoadLicencias().concat(importedLicencias),
        mergedProyectos: rhLoadProyectos().concat(importedProyectos),
        config: importedConfig,
        counts: {
          registros: nuevosRegistros.length,
          omitidos: omitidos,
          licencias: importedLicencias.length,
          proyectos: importedProyectos.length
        }
      };

      var msg = "El archivo contiene " + importedRegistros.length + " jornada(s)" +
        (omitidos > 0 ? " (" + omitidos + " se omitirán por ya tener un registro en esa fecha)" : "") + ", " +
        importedLicencias.length + " licencia(s)/feriado(s) y " + importedProyectos.length + " función(es) o proyecto(s)." +
        (importedConfig ? " El archivo también trae una configuración guardada." : "") +
        " Se mezclará con tus datos actuales sin borrar nada existente. ¿Confirmar importación?";
      rhEl("import-confirm-message").textContent = msg;
      rhEl("import-confirm-config-option").classList.toggle("hidden", !importedConfig);
      rhEl("import-confirm-config-checkbox").checked = false;
      rhEl("import-confirm-modal").classList.remove("hidden");
    } catch (err) {
      rhShowAlert("No se pudo importar el archivo. Verifica que sea un respaldo .json válido de esta app.", "error");
      console.error(err);
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
});

rhEl("import-confirm-ok-btn").addEventListener("click", function () {
  if (!rhPendingImport) return;
  var d = rhPendingImport;
  rhPendingImport = null;
  rhEl("import-confirm-modal").classList.add("hidden");

  rhSaveRegistros(d.mergedRegistros);
  rhSaveLicencias(d.mergedLicencias);
  rhSaveProyectos(d.mergedProyectos);
  if (d.config && rhEl("import-confirm-config-checkbox").checked) {
    rhSaveConfig(d.config);
  }

  renderMarcajeTable();
  rhMarcajeLoadFecha(marcajeFechaInput.value || rhTodayISO());
  renderEstadisticas();
  renderLicencias();
  renderProyectos();
  renderConfigForm();
  rhShowAlert("Importación completada: " + d.counts.registros + " jornada(s), " + d.counts.licencias +
    " licencia(s)/feriado(s), " + d.counts.proyectos + " función(es)/proyecto(s).", "success");
});

rhEl("import-confirm-cancel-btn").addEventListener("click", function () {
  rhPendingImport = null;
  rhEl("import-confirm-modal").classList.add("hidden");
});

rhEl("import-confirm-modal").addEventListener("click", function (e) {
  if (e.target === rhEl("import-confirm-modal")) {
    rhPendingImport = null;
    rhEl("import-confirm-modal").classList.add("hidden");
  }
});
