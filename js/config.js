"use strict";

// ---------- Tab: Configuración ----------

var configForm = rhEl("config-form");
var configMetaSemanalInput = rhEl("config-meta-semanal");
var configMetaMensualInput = rhEl("config-meta-mensual");
var configB1EntradaInput = rhEl("config-b1-entrada");
var configB1SalidaInput = rhEl("config-b1-salida");
var configB2ActivoInput = rhEl("config-b2-activo");
var configB2EntradaInput = rhEl("config-b2-entrada");
var configB2SalidaInput = rhEl("config-b2-salida");
var configDiasLaboralesWrap = rhEl("config-dias-laborales");
var configFechaInicioBalanceInput = rhEl("config-fecha-inicio-balance");

RH_DIAS_SEMANA.forEach(function (dia) {
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

function renderConfigForm() {
  var config = rhLoadConfig();
  configMetaSemanalInput.value = config.metaSemanal;
  configMetaMensualInput.value = config.metaMensual;
  configB1EntradaInput.value = config.horarioBase.bloque1.entrada || "";
  configB1SalidaInput.value = config.horarioBase.bloque1.salida || "";
  configB2ActivoInput.checked = config.bloque2Activo;
  configB2EntradaInput.value = config.horarioBase.bloque2.entrada || "";
  configB2SalidaInput.value = config.horarioBase.bloque2.salida || "";
  configFechaInicioBalanceInput.value = config.fechaInicioBalance || "";

  RH_DIAS_SEMANA.forEach(function (dia) {
    var input = rhEl("config-dia-" + dia.id);
    input.checked = config.diasLaborales.indexOf(dia.id) !== -1;
  });
}

configForm.addEventListener("submit", function (e) {
  e.preventDefault();

  var diasLaborales = RH_DIAS_SEMANA
    .filter(function (dia) { return rhEl("config-dia-" + dia.id).checked; })
    .map(function (dia) { return dia.id; });

  if (diasLaborales.length === 0) {
    rhShowAlert("Selecciona al menos un día laboral.", "error");
    return;
  }

  var config = {
    metaSemanal: Number(configMetaSemanalInput.value) || 0,
    metaMensual: Number(configMetaMensualInput.value) || 0,
    horarioBase: {
      bloque1: { entrada: configB1EntradaInput.value, salida: configB1SalidaInput.value },
      bloque2: { entrada: configB2EntradaInput.value, salida: configB2SalidaInput.value }
    },
    bloque2Activo: configB2ActivoInput.checked,
    diasLaborales: diasLaborales,
    fechaInicioBalance: configFechaInicioBalanceInput.value || null
  };

  rhSaveConfig(config);
  rhShowAlert("Configuración guardada.", "success");
});
