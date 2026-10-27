"use strict";

// ---------- Tab: Configuración ----------

var configForm = rhEl("config-form");
var configDiasLaboralesWrap = rhEl("config-dias-laborales");
var configFechaInicioBalanceInput = rhEl("config-fecha-inicio-balance");

RH_DIAS_SEMANA_ORDEN.forEach(function (diaId) {
  var dia = RH_DIAS_SEMANA[diaId];
  var label = document.createElement("label");
  label.className = "dia-toggle";
  var input = document.createElement("input");
  input.type = "checkbox";
  input.value = String(dia.id);
  input.id = "config-dia-" + dia.id;
  label.appendChild(input);
  label.appendChild(document.createTextNode(dia.corto));
  configDiasLaboralesWrap.appendChild(label);
});

// El contrato y las jornadas se configuran en la pestaña Arreglo de horas.
rhEl("config-ir-arreglo").addEventListener("click", function () {
  rhActivateTab("arreglo");
  var form = rhEl("arreglo-form");
  window.scrollTo({ top: Math.max(0, form.getBoundingClientRect().top + window.scrollY - 80), behavior: "smooth" });
});

function renderConfigForm() {
  var config = rhLoadConfig();
  rhEl("config-contrato-linea").textContent = "📄 Tu contrato: " + rhContratoTextoHoy(config);
  configFechaInicioBalanceInput.value = config.fechaInicioBalance || "";

  RH_DIAS_SEMANA.forEach(function (dia) {
    var input = rhEl("config-dia-" + dia.id);
    input.checked = config.diasLaborales.indexOf(dia.id) !== -1;
  });

  rhConfigRenderActividades();
  renderSyncConfig();
}

// ---------- Actividades habituales ----------

function rhConfigGuardarActividades(lista) {
  rhSaveConfig(Object.assign({}, rhLoadConfig(), { actividades: lista }));
  rhConfigRenderActividades();
  // Se rearman los botones de Marcaje con la lista nueva, sin borrar lo que
  // esté escrito en el formulario.
  rhMarcajeSetActividades(rhMarcajeActividadesPicker ? rhMarcajeActividadesPicker.obtener() : []);
  renderMarcajeTable();
}

function rhConfigRenderActividades() {
  var ul = rhEl("config-actividades-list");
  rhClear(ul);
  var lista = rhLoadConfig().actividades;
  if (lista.length === 0) {
    var vacio = document.createElement("li");
    vacio.className = "label-hint";
    vacio.textContent = "No tienes actividades. Agrega las que más haces.";
    ul.appendChild(vacio);
  }
  lista.forEach(function (nombre, idx) {
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.textContent = nombre;
    li.appendChild(span);
    var quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "btn btn-small btn-secondary";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", function () {
      if (!confirm("¿Quitar “" + nombre + "” de tus actividades habituales? Lo ya registrado no cambia.")) return;
      var nueva = lista.slice();
      nueva.splice(idx, 1);
      rhConfigGuardarActividades(nueva);
    });
    li.appendChild(quitar);
    ul.appendChild(li);
  });
}

rhEl("config-actividad-agregar").addEventListener("click", function () {
  var input = rhEl("config-actividad-nueva");
  var nombre = input.value.trim();
  if (!nombre) {
    rhShowAlert("Escribe el nombre de la actividad.", "error");
    return;
  }
  var lista = rhLoadConfig().actividades;
  var repetida = lista.some(function (a) { return a.toLowerCase() === nombre.toLowerCase(); });
  if (repetida) {
    rhShowAlert("Esa actividad ya está en la lista.", "error");
    return;
  }
  input.value = "";
  rhConfigGuardarActividades(lista.concat([nombre]));
  rhShowAlert("Actividad agregada.", "success");
});

rhEl("config-actividad-nueva").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    rhEl("config-actividad-agregar").click();
  }
});

configForm.addEventListener("submit", function (e) {
  e.preventDefault();

  var diasLaborales = RH_DIAS_SEMANA
    .filter(function (dia) { return rhEl("config-dia-" + dia.id).checked; })
    .map(function (dia) { return dia.id; });

  if (diasLaborales.length === 0) {
    rhShowAlert("Selecciona al menos un día laboral.", "error");
    return;
  }

  // Se parte de la configuración actual para no perder lo que no está en
  // este formulario (ej. la lista de actividades).
  var config = Object.assign({}, rhLoadConfig(), {
    diasLaborales: diasLaborales,
    fechaInicioBalance: configFechaInicioBalanceInput.value || null
  });

  rhSaveConfig(config);
  rhShowAlert("Configuración guardada.", "success");
});

// ---------- Zona de peligro: eliminar todos los datos ----------

rhEl("delete-all-data-btn").addEventListener("click", function () {
  var registros = rhLoadRegistros();
  var licencias = rhLoadLicencias();
  var proyectos = rhLoadProyectos();

  if (registros.length === 0 && licencias.length === 0 && proyectos.length === 0) {
    rhShowAlert("No hay datos guardados para eliminar.", "success");
    return;
  }

  var mensaje = "Esto eliminará " + registros.length + " jornada(s), " +
    licencias.length + " licencia(s)/feriado(s) y " + proyectos.length + " función(es)/proyecto(s) " +
    "guardados en este dispositivo. Tu configuración no se modifica.\n\n" +
    "Quedarán en la Papelera por " + RH_PAPELERA_DIAS + " días por si necesitas recuperar algo, " +
    "pero de todos modos te recomendamos hacer un respaldo (.json) antes por si acaso.\n\n" +
    "¿Estás seguro de que quieres eliminar todos los datos?";

  if (!confirm(mensaje)) return;

  rhPapeleraAgregarMuchos("registro", registros);
  rhPapeleraAgregarMuchos("licencia", licencias);
  rhPapeleraAgregarMuchos("proyecto", proyectos);

  rhSaveRegistros([]);
  rhSaveLicencias([]);
  rhSaveProyectos([]);

  renderMarcajeTable();
  rhMarcajeLoadFecha(marcajeFechaInput.value || rhTodayISO());
  renderEstadisticas();
  renderLicencias();
  renderProyectos();
  renderPapelera();

  rhShowAlert("Todos los datos fueron eliminados (recuperables desde la Papelera).", "success");
});
