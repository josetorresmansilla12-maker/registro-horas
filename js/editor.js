"use strict";

// ---------- Editar un día desde el informe ----------
//
// Ventana para corregir un día sin salir del informe: horarios, horas libres
// ocupadas, actividades y nota. Guarda en el mismo registro que usa el resto
// de la app (historial, estadísticas, arreglo de horas e informes), así que el
// cambio se ve en todas partes.

var editorModal = rhEl("editor-modal");
var editorJornadasWrap = rhEl("editor-jornadas");
var editorError = rhEl("editor-error");
var editorLibre = rhEl("editor-libre");
var editorLibreHoras = rhEl("editor-libre-horas");
var editorNota = rhEl("editor-nota");
var editorTotal = rhEl("editor-total");

var rhEditor = { fecha: null, jornadas: [], libreOriginal: null, actividades: null };

function rhEditorActualizarTotal() {
  var min = rhEditor.jornadas.reduce(function (s, b) { return s + rhBlockMinutes(b); }, 0);
  editorTotal.textContent = "Total trabajado: " + rhMinutesToHM(min);
}

function rhEditorCampoHora(texto, bloque, clave) {
  var field = document.createElement("div");
  field.className = "field";
  var label = document.createElement("label");
  label.textContent = texto;
  field.appendChild(label);
  var input = document.createElement("input");
  input.type = "time";
  input.value = bloque[clave] || "";
  function sync() {
    bloque[clave] = input.value;
    rhEditorActualizarTotal();
  }
  input.addEventListener("input", sync);
  input.addEventListener("change", sync);
  field.appendChild(input);
  return field;
}

function rhEditorRenderJornadas() {
  rhClear(editorJornadasWrap);
  rhEditor.jornadas.forEach(function (bloque, idx) {
    var group = document.createElement("div");
    group.className = "block-group";
    var head = document.createElement("div");
    head.className = "block-group-header";
    var h3 = document.createElement("h3");
    h3.textContent = idx === 0 ? "Jornada" : "Jornada " + (idx + 1);
    head.appendChild(h3);
    var quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "btn btn-small btn-secondary";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", function () {
      rhEditor.jornadas.splice(idx, 1);
      rhEditorRenderJornadas();
    });
    head.appendChild(quitar);
    group.appendChild(head);
    var row = document.createElement("div");
    row.className = "field-row";
    row.appendChild(rhEditorCampoHora("Entrada", bloque, "entrada"));
    row.appendChild(rhEditorCampoHora("Salida", bloque, "salida"));
    group.appendChild(row);
    editorJornadasWrap.appendChild(group);
  });
  if (rhEditor.jornadas.length === 0) {
    var vacio = document.createElement("p");
    vacio.className = "label-hint";
    vacio.textContent = "Sin horarios trabajados este día.";
    editorJornadasWrap.appendChild(vacio);
  }
  rhEnhanceTimeInputs(editorJornadasWrap);
  rhEditorActualizarTotal();
}

// Opciones de horas libres: ninguna, las del horario normal u otra cantidad.
function rhEditorRenderLibre(dl) {
  var norma = rhJornadasNorma();
  rhClear(editorLibre);
  [["", "No (día normal)"],
    ["manana", "Mañana libre · " + rhMinutesToHM(norma.manana.minutos)],
    ["tarde", "Tarde libre · " + rhMinutesToHM(norma.tarde.minutos)],
    ["completa", "Día libre completo · " + rhMinutesToHM(norma.completa.minutos)],
    ["otra", "Otra cantidad de horas…"]].forEach(function (o) {
    var opt = document.createElement("option");
    opt.value = o[0];
    opt.textContent = o[1];
    editorLibre.appendChild(opt);
  });
  var valor = "";
  if (dl) {
    var j = norma[dl.jornada];
    // Si el horario cambió desde que se marcó, se conservan sus minutos.
    valor = j && j.minutos === Number(dl.minutos) ? dl.jornada : "otra";
  }
  editorLibre.value = valor;
  editorLibreHoras.value = valor === "otra" && dl ? String(Math.round((dl.minutos / 60) * 100) / 100) : "";
  editorLibreHoras.classList.toggle("hidden", valor !== "otra");
}

editorLibre.addEventListener("change", function () {
  editorLibreHoras.classList.toggle("hidden", editorLibre.value !== "otra");
  if (editorLibre.value === "otra") editorLibreHoras.focus();
});

// Horas libres elegidas en la ventana ({ jornada, minutos, motivo } o null).
function rhEditorLibreElegido() {
  var v = editorLibre.value;
  if (!v) return null;
  var original = rhEditor.libreOriginal;
  var minutos = rhLibreMinutosOpcion(v, editorLibreHoras.value);
  if (!(minutos > 0)) return undefined;
  if (original && Number(original.minutos) === minutos && (v === original.jornada || v === "otra")) return original;
  var dl = { jornada: v, minutos: minutos };
  if (original && original.motivo) dl.motivo = original.motivo;
  return dl;
}

// `opciones` (opcional): { agregar: { entrada, salida } } deja lista una
// jornada más con ese horario, y { actividad } la deja marcada (se usa al
// agregar horas desde Privado).
function rhAbrirEditorDia(fecha, opciones) {
  opciones = opciones || {};
  var registro = rhGetRegistroByFecha(fecha);
  rhEditor.fecha = fecha;
  rhEditor.libreOriginal = rhDiaLibre(registro);
  rhEditor.jornadas = rhRegistroBloques(registro).map(function (b) {
    return { entrada: b.entrada || "", salida: b.salida || "" };
  });
  if (opciones.agregar) rhEditor.jornadas.push({ entrada: opciones.agregar.entrada || "", salida: opciones.agregar.salida || "" });
  else if (!registro) rhEditor.jornadas = [{ entrada: "", salida: "" }];
  rhEl("editor-titulo").textContent = (opciones.agregar ? "Agregar horas — " : registro ? "Editar " : "Registrar ") +
    rhDayOfWeekLabel(fecha, false).toLowerCase() + " " + rhFormatDateDisplay(fecha);
  editorError.textContent = "";
  editorNota.value = (registro && registro.nota) || "";
  var actividades = rhRegistroActividades(registro);
  if (opciones.actividad) actividades = rhUnirActividades(actividades, [opciones.actividad]);
  rhEditor.actividades = rhCrearSelectorActividades(rhEl("editor-actividades"), actividades, null);
  rhEditorRenderLibre(rhEditor.libreOriginal);
  rhEditorRenderJornadas();
  editorModal.classList.remove("hidden");
}

function rhCerrarEditorDia() {
  editorModal.classList.add("hidden");
  rhEditor.fecha = null;
}

rhEl("editor-add-jornada").addEventListener("click", function () {
  rhEditor.jornadas.push({ entrada: "", salida: "" });
  rhEditorRenderJornadas();
});
rhEl("editor-cancelar").addEventListener("click", rhCerrarEditorDia);
editorModal.addEventListener("click", function (e) { if (e.target === editorModal) rhCerrarEditorDia(); });
document.addEventListener("keydown", function (e) {
  // Si la ruleta de hora está abierta, Escape cierra solo la ruleta.
  var ruedaAbierta = rhRueda && !rhRueda.overlay.classList.contains("hidden");
  if (e.key === "Escape" && !ruedaAbierta && !editorModal.classList.contains("hidden")) rhCerrarEditorDia();
});

rhEl("editor-guardar").addEventListener("click", function () {
  var fecha = rhEditor.fecha;
  if (!fecha) return;
  editorError.textContent = "";
  var bloques = [];
  for (var i = 0; i < rhEditor.jornadas.length; i++) {
    var b = rhEditor.jornadas[i];
    if (!b.entrada && !b.salida) continue;
    if (!b.entrada || !b.salida) {
      editorError.textContent = "Completa entrada y salida en cada jornada, o quítala.";
      return;
    }
    if (rhBlockIsInvalid(b)) {
      editorError.textContent = "En cada jornada, la salida debe ser posterior a la entrada.";
      return;
    }
    bloques.push({ entrada: b.entrada, salida: b.salida });
  }
  bloques.sort(function (a, b) { return rhTimeToMinutes(a.entrada) - rhTimeToMinutes(b.entrada); });
  var libre = rhEditorLibreElegido();
  if (libre === undefined) {
    editorError.textContent = "Escribe cuántas horas libres ocupaste, o elige otra opción.";
    return;
  }
  var nota = editorNota.value.trim();
  var actividades = rhEditor.actividades ? rhEditor.actividades.obtener() : [];
  var existente = rhGetRegistroByFecha(fecha);

  if (bloques.length === 0 && !nota && actividades.length === 0 && !libre) {
    if (existente) {
      if (!confirm("El " + rhFormatDateDisplay(fecha) + " quedará sin nada registrado. ¿Eliminar su registro?")) return;
      rhDeleteRegistro(existente.id);
    }
  } else {
    var registro = rhRegistroActualizado(existente, { fecha: fecha, bloques: bloques, nota: nota, actividades: actividades });
    if (libre) registro.diaLibre = libre;
    else delete registro.diaLibre;
    // Un día "aún no contratado" conserva su estado mientras no tenga horas.
    if (bloques.length > 0 || !existente || !existente.estado) delete registro.estado;
    rhUpsertRegistro(registro);
  }
  rhCerrarEditorDia();
  rhShowAlert("Se guardaron los cambios del " + rhFormatDateDisplay(fecha) + ".", "success");
  rhRefrescarVistas();
});
