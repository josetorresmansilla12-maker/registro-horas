"use strict";

// ---------- Tab: Marcaje ----------

var rhMarcajeMesActual = rhMonthRange(rhTodayISO()).start;

var marcajeForm = rhEl("marcaje-form");
var marcajeIdInput = rhEl("marcaje-id");
var marcajeFechaInput = rhEl("marcaje-fecha");
var marcajeJornadasWrap = rhEl("marcaje-jornadas");
var marcajeNota = rhEl("marcaje-nota");
var marcajeTotalPreview = rhEl("marcaje-total-preview");
var marcajeSubmitBtn = rhEl("marcaje-submit-btn");
var marcajeCancelBtn = rhEl("marcaje-cancel-btn");
var marcajeFormTitle = rhEl("marcaje-form-title");
var marcajeLicenciaBanner = rhEl("marcaje-licencia-banner");
var marcajeLicenciaBannerText = rhEl("marcaje-licencia-banner-text");
var marcajeExistenteBanner = rhEl("marcaje-existente-banner");
var marcajeExistenteBannerText = rhEl("marcaje-existente-banner-text");
var marcajeErrorBloques = rhEl("error-marcaje-bloques");
var marcajeRapidoStatus = rhEl("marcaje-rapido-status");
var marcajeMarcarEntradaBtn = rhEl("marcaje-marcar-entrada-btn");
var marcajeMarcarSalidaBtn = rhEl("marcaje-marcar-salida-btn");
var marcajeDeshacerBtn = rhEl("marcaje-deshacer-btn");
var marcajeActividadesWrap = rhEl("marcaje-actividades");
var marcajeRapidoActividadesWrap = rhEl("marcaje-rapido-actividades-wrap");
var marcajeRapidoActividades = rhEl("marcaje-rapido-actividades");
var marcajeNotaInforme = rhEl("marcaje-nota-informe");
var marcajeNotaInformeTexto = rhEl("marcaje-nota-informe-texto");
var marcajeNotaInformeCampo = rhEl("marcaje-nota-informe-campo");
var marcajeNotaInformeInput = rhEl("marcaje-nota-informe-input");

// La jornada del día es una lista de bloques entrada/salida (puede haber más
// de dos: reunión en la mañana, al mediodía y en la tarde, por ejemplo).
// Este arreglo es la fuente de la verdad mientras se edita el formulario.
var rhMarcajeJornadas = [];

// Selector de actividades del formulario (se rearma al cambiar de fecha).
var rhMarcajeActividadesPicker = null;

// Estado del formulario: `fechaOriginal` es el día que se abrió para editar
// (null si es una jornada nueva) y `sucio` indica que tocaste algo (horas,
// nota o actividades) que aún no guardas. Con esto, cambiar la fecha nunca
// borra lo escrito: si estabas editando, la jornada se mueve al guardar.
var rhMarcajeForm = { fechaOriginal: null, sucio: false };

function rhMarcajeMarcarSucio() {
  rhMarcajeForm.sucio = true;
}

// Vista previa de cómo se verá la nota en el informe (resumida y corregida),
// o el texto que escribiste a mano solo para el informe.
function rhMarcajeActualizarPreviaInforme() {
  var nota = marcajeNota.value.trim();
  marcajeNotaInforme.classList.toggle("hidden", !nota);
  if (!nota) return;
  marcajeNotaInformeTexto.textContent = marcajeNotaInformeInput.value.trim() || rhResumirDescripcion(nota);
}

function rhMarcajeSetNotaInforme(texto) {
  marcajeNotaInformeInput.value = texto || "";
  marcajeNotaInformeCampo.classList.toggle("hidden", !texto);
  rhMarcajeActualizarPreviaInforme();
}

// Texto manual para el informe, guardado junto a la nota a la que corresponde
// (si después cambias la nota, vuelve a usarse el resumen automático).
function rhMarcajeAplicarNotaInforme(registro) {
  var manual = marcajeNotaInformeInput.value.trim();
  // Si quedó igual al resumen automático no se guarda como texto manual.
  if (manual && registro.nota && manual !== rhResumirDescripcion(registro.nota)) {
    registro.notaInforme = manual;
    registro.notaInformeDe = registro.nota;
  } else {
    delete registro.notaInforme;
    delete registro.notaInformeDe;
  }
  return registro;
}

function rhMarcajeSetActividades(lista) {
  rhMarcajeActividadesPicker = rhCrearSelectorActividades(marcajeActividadesWrap, lista, rhMarcajeMarcarSucio);
}

// Copia de un registro con algunos campos cambiados, conservando el resto
// (actividades, nota, etc.). Quita el formato antiguo bloque1/bloque2 porque
// desde ahora las jornadas van en `bloques`.
function rhRegistroActualizado(base, cambios) {
  var r = Object.assign({}, base || {}, cambios);
  delete r.bloque1;
  delete r.bloque2;
  return r;
}

function rhMarcajeResumenBloques(bloques) {
  return bloques.map(function (b) {
    if (b.entrada && b.salida) return rhFormatBloque(b);
    if (b.entrada) return rhFormatHora(b.entrada) + " – (en curso)";
    return "—";
  }).join(" · ");
}

function rhMarcajeBloqueVacio() {
  return { entrada: "", salida: "" };
}

function rhMarcajeUpdateTotalPreview() {
  var minutes = rhMarcajeJornadas.reduce(function (sum, b) {
    return sum + rhBlockMinutes(b);
  }, 0);
  marcajeTotalPreview.textContent = "Total del día: " + rhMinutesToHM(minutes);
}

function rhMarcajeBuildTimeField(labelText, bloque, key) {
  var field = document.createElement("div");
  field.className = "field";

  var label = document.createElement("label");
  label.textContent = labelText;
  field.appendChild(label);

  var input = document.createElement("input");
  input.type = "time";
  input.value = bloque[key] || "";
  function sync() {
    if (bloque[key] !== input.value) rhMarcajeMarcarSucio();
    bloque[key] = input.value;
    rhMarcajeUpdateTotalPreview();
  }
  input.addEventListener("input", sync);
  input.addEventListener("change", sync);
  field.appendChild(input);

  return field;
}

function rhMarcajeBuildJornadaRow(bloque, idx) {
  var group = document.createElement("div");
  group.className = "block-group";

  var head = document.createElement("div");
  head.className = "block-group-header";

  var h3 = document.createElement("h3");
  h3.textContent = idx === 0 ? "Jornada" : "Jornada extra " + idx;
  head.appendChild(h3);

  // Se puede quitar cualquier jornada siempre que quede al menos una.
  if (rhMarcajeJornadas.length > 1) {
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-small btn-secondary";
    removeBtn.textContent = "Quitar";
    removeBtn.addEventListener("click", function () {
      rhMarcajeJornadas.splice(idx, 1);
      rhMarcajeMarcarSucio();
      rhMarcajeRenderJornadas();
    });
    head.appendChild(removeBtn);
  }
  group.appendChild(head);

  var row = document.createElement("div");
  row.className = "field-row";
  row.appendChild(rhMarcajeBuildTimeField("Entrada", bloque, "entrada"));
  row.appendChild(rhMarcajeBuildTimeField("Salida", bloque, "salida"));
  group.appendChild(row);

  return group;
}

function rhMarcajeRenderJornadas() {
  rhClear(marcajeJornadasWrap);
  rhMarcajeJornadas.forEach(function (bloque, idx) {
    marcajeJornadasWrap.appendChild(rhMarcajeBuildJornadaRow(bloque, idx));
  });
  rhEnhanceTimeInputs(marcajeJornadasWrap);
  rhMarcajeUpdateTotalPreview();
}

function rhMarcajeSetJornadas(bloques) {
  var base = (bloques && bloques.length) ? bloques : [rhMarcajeBloqueVacio()];
  rhMarcajeJornadas = base.map(function (b) {
    return { entrada: b.entrada || "", salida: b.salida || "" };
  });
  rhMarcajeRenderJornadas();
}

// Aviso de horas libres ocupadas en la fecha del formulario, con botones para
// cambiarlas o quitarlas.
function rhMarcajeMostrarLibre() {
  var fecha = marcajeFechaInput.value || rhTodayISO();
  var dl = rhDiaLibre(rhGetRegistroByFecha(fecha));
  rhEl("marcaje-libre-banner").classList.toggle("hidden", !dl);
  if (!dl) return;
  rhEl("marcaje-libre-banner-text").textContent = "🌴 " + rhDiaLibreTexto(dl) + ": este día se pagó con tus horas a favor" +
    (dl.motivo ? " (" + dl.motivo + ")" : "") + ".";
}

rhEl("marcaje-ocupar-libre-btn").addEventListener("click", function () {
  rhAbrirOcuparLibre(marcajeFechaInput.value || rhTodayISO());
});
rhEl("marcaje-libre-cambiar").addEventListener("click", function () {
  rhAbrirOcuparLibre(marcajeFechaInput.value || rhTodayISO());
});
rhEl("marcaje-libre-quitar").addEventListener("click", function () {
  rhQuitarDiaLibre(marcajeFechaInput.value || rhTodayISO());
});

function rhMarcajeShowLicenciaBanner(fecha) {
  rhMarcajeMostrarLibre();
  var licencia = rhLicenciaForDate(fecha);
  if (licencia) {
    marcajeLicenciaBannerText.textContent = "Este día está marcado como \"" + rhTipoLicenciaLabel(licencia.tipo) + "\" (del " +
      rhFormatDateDisplay(licencia.fechaInicio) + " al " + rhFormatDateDisplay(licencia.fechaFin) + ").";
    marcajeLicenciaBanner.classList.remove("hidden");
  } else {
    marcajeLicenciaBanner.classList.add("hidden");
  }
}

// Deja el formulario listo para una jornada nueva: horario base configurado,
// sin nota y sin nada cargado desde un registro existente. Se usa después de
// guardar (para no dejar "pegados" los datos del día recién guardado) y
// cuando la fecha elegida todavía no tiene registro.
function rhMarcajeBlankSetup(fecha) {
  rhMarcajeForm.fechaOriginal = null;
  rhMarcajeForm.sucio = false;
  marcajeIdInput.value = "";
  marcajeNota.value = "";
  rhMarcajeSetNotaInforme("");
  rhMarcajeSetActividades([]);
  marcajeFormTitle.textContent = "Registrar jornada — " + rhFormatDateDisplay(fecha);

  // Si esa fecha ya tiene algo guardado (ej. lo que marcaste hoy con "Marcaje
  // rápido"), lo que se ingrese aquí se SUMA: se parte con una jornada vacía
  // en vez del horario base, para no duplicar horas sin querer.
  var existente = rhGetRegistroByFecha(fecha);
  var bloquesPrevios = existente ? rhRegistroBloques(existente) : [];
  if (bloquesPrevios.length > 0) {
    marcajeExistenteBannerText.textContent = "El " + rhFormatDateDisplay(fecha) + " ya tiene: " +
      rhMarcajeResumenBloques(bloquesPrevios) + ". Lo que guardes aquí se sumará a eso; para cambiarlo usa “Editar” en el historial.";
    marcajeExistenteBanner.classList.remove("hidden");
    rhMarcajeSetJornadas([rhMarcajeBloqueVacio()]);
    return;
  }

  marcajeExistenteBanner.classList.add("hidden");
  var config = rhLoadConfig();
  var base = [config.horarioBase.bloque1];
  if (config.bloque2Activo) base.push(config.horarioBase.bloque2);
  rhMarcajeSetJornadas(base);
}

// Al elegir una fecha: si ya existe un registro se carga para editarlo (y si
// tiene horarios, se deja un espacio listo para sumar una jornada extra sin
// tener que reescribir lo ya guardado); si no, se autocompleta con el
// horario base configurado.
function rhMarcajeLoadFecha(fecha) {
  rhMarcajeShowLicenciaBanner(fecha);
  marcajeErrorBloques.textContent = "";
  var existente = rhGetRegistroByFecha(fecha);

  if (existente) {
    rhMarcajeForm.fechaOriginal = fecha;
    rhMarcajeForm.sucio = false;
    marcajeIdInput.value = existente.id;
    marcajeNota.value = existente.nota || "";
    rhMarcajeSetNotaInforme(existente.notaInforme && existente.notaInformeDe === existente.nota ? existente.notaInforme : "");
    rhMarcajeSetActividades(rhRegistroActividades(existente));
    var estadoLabel = rhRegistroEstadoLabel(existente);
    if (estadoLabel) {
      marcajeExistenteBanner.classList.add("hidden");
      rhMarcajeSetJornadas([]);
      marcajeFormTitle.textContent = "Editar jornada — " + rhFormatDateDisplay(fecha) + " (" + estadoLabel + ")";
    } else {
      var bloquesExistentes = rhRegistroBloques(existente);
      if (bloquesExistentes.length > 0) {
        marcajeExistenteBannerText.textContent = "El " + rhFormatDateDisplay(fecha) + " ya tiene jornada(s) registrada(s): " +
          rhMarcajeResumenBloques(bloquesExistentes) + ". Se dejó un espacio abajo para sumar una jornada extra — lo ya guardado no se pierde.";
        marcajeExistenteBanner.classList.remove("hidden");
        rhMarcajeSetJornadas(bloquesExistentes.concat([rhMarcajeBloqueVacio()]));
        marcajeFormTitle.textContent = "Sumar jornada extra — " + rhFormatDateDisplay(fecha);
      } else {
        marcajeExistenteBanner.classList.add("hidden");
        rhMarcajeSetJornadas(bloquesExistentes);
        marcajeFormTitle.textContent = "Editar jornada — " + rhFormatDateDisplay(fecha);
      }
    }
  } else {
    rhMarcajeBlankSetup(fecha);
  }
}

// Cambiar la fecha NO borra lo que ya está en el formulario:
//  - si estabas editando un día, la jornada (horas, nota y actividades) se
//    mueve a la nueva fecha al guardar;
//  - si estabas registrando uno nuevo y ya escribiste algo, se conserva;
//  - solo si el formulario está sin tocar se cargan los datos de esa fecha.
function rhMarcajeCambiarFecha(nueva) {
  marcajeErrorBloques.textContent = "";
  if (!rhMarcajeForm.fechaOriginal && !rhMarcajeForm.sucio) {
    rhMarcajeLoadFecha(nueva);
    return;
  }
  rhMarcajeShowLicenciaBanner(nueva);
  var original = rhMarcajeForm.fechaOriginal;
  var destino = nueva !== original ? rhGetRegistroByFecha(nueva) : null;

  if (original && nueva !== original) {
    marcajeFormTitle.textContent = "Mover jornada — del " + rhFormatDateDisplay(original) + " al " + rhFormatDateDisplay(nueva);
  } else if (original) {
    marcajeFormTitle.textContent = "Editar jornada — " + rhFormatDateDisplay(nueva);
  } else {
    marcajeFormTitle.textContent = "Registrar jornada — " + rhFormatDateDisplay(nueva);
  }

  var avisos = [];
  if (original && nueva !== original) {
    avisos.push("Al guardar, esta jornada (horas, nota y actividades) pasará del " + rhFormatDateDisplay(original) +
      " al " + rhFormatDateDisplay(nueva) + ".");
  }
  if (destino) {
    var previos = rhRegistroBloques(destino);
    avisos.push("El " + rhFormatDateDisplay(nueva) + " ya tiene " +
      (previos.length ? "registro: " + rhMarcajeResumenBloques(previos) : "un registro") + "; se sumará a eso.");
  }
  marcajeExistenteBannerText.textContent = avisos.join(" ");
  marcajeExistenteBanner.classList.toggle("hidden", avisos.length === 0);
}

marcajeFechaInput.addEventListener("change", function () {
  rhMarcajeCambiarFecha(marcajeFechaInput.value || rhTodayISO());
});

marcajeNota.addEventListener("input", function () {
  rhMarcajeMarcarSucio();
  rhMarcajeActualizarPreviaInforme();
});

marcajeNotaInformeInput.addEventListener("input", function () {
  rhMarcajeMarcarSucio();
  rhMarcajeActualizarPreviaInforme();
});

rhEl("marcaje-nota-informe-editar").addEventListener("click", function () {
  var abrir = marcajeNotaInformeCampo.classList.contains("hidden");
  marcajeNotaInformeCampo.classList.toggle("hidden", !abrir);
  if (abrir) {
    if (!marcajeNotaInformeInput.value.trim()) marcajeNotaInformeInput.value = rhResumirDescripcion(marcajeNota.value);
    marcajeNotaInformeInput.focus();
  }
});

rhEl("marcaje-add-jornada-btn").addEventListener("click", function () {
  rhMarcajeJornadas.push(rhMarcajeBloqueVacio());
  rhMarcajeRenderJornadas();
});

rhEl("marcaje-marcar-feriado-btn").addEventListener("click", function () {
  var fecha = marcajeFechaInput.value || rhTodayISO();
  rhLicenciaPrefillFeriado(fecha);
  rhActivateTab("licencias");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Marca el día seleccionado con un estado especial (sin horas trabajadas) que
// no cuenta como incumplimiento ni afecta el cálculo, ej: "Aún no contratado".
// Es para un solo día; para períodos de varios días (ej: "No convocado" por
// una semana) se usa una licencia con rango de fechas en vez de esto.
function rhMarcajeMarcarEstado(estado, label, descripcion) {
  var fecha = marcajeFechaInput.value || rhTodayISO();
  var existente = rhGetRegistroByFecha(fecha);

  var aviso = "¿Marcar el " + rhFormatDateDisplay(fecha) + ' como "' + label + '"?\n\n' + descripcion;
  if (existente && rhRegistroMinutes(existente) > 0) {
    aviso += "\n\nOJO: este día ya tiene horas registradas y quedarán reemplazadas.";
  }
  if (!confirm(aviso)) return;

  rhUpsertRegistro({
    id: null,
    fecha: fecha,
    bloques: [],
    nota: marcajeNota.value.trim(),
    estado: estado
  });
  rhShowAlert("El " + rhFormatDateDisplay(fecha) + " quedó marcado como " + label + ".", "success");
  rhMarcajeMesActual = rhMonthRange(fecha).start;
  rhMarcajeResetForm();
  renderMarcajeTable();
}

// "No me convocaron": la oficina pidió no asistir. Se guarda como licencia
// (con fecha de inicio y de término) para poder cubrir de una vez un día
// suelto o un período completo (ej: toda una semana de receso), sin tener
// que marcar día por día.
rhEl("marcaje-no-convocado-btn").addEventListener("click", function () {
  var fecha = marcajeFechaInput.value || rhTodayISO();
  rhLicenciaPrefillNoConvocado(fecha);
  rhActivateTab("licencias");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// "Aún no contratado": días previos al inicio del contrato o períodos sin él.
rhEl("marcaje-no-contratado-btn").addEventListener("click", function () {
  rhMarcajeMarcarEstado(RH_ESTADO_NO_CONTRATADO, "Aún no contratado",
    "Se usa para los días previos al inicio de tu contrato (o un período sin " +
    "contrato): no cuentan como falta ni afectan el cálculo de horas.");
});

function rhMarcajeResetForm() {
  var fecha = rhTodayISO();
  marcajeCancelBtn.classList.add("hidden");
  marcajeSubmitBtn.textContent = "Guardar jornada";
  marcajeFechaInput.value = fecha;
  marcajeErrorBloques.textContent = "";
  rhMarcajeShowLicenciaBanner(fecha);
  rhMarcajeBlankSetup(fecha);
}

marcajeCancelBtn.addEventListener("click", rhMarcajeResetForm);

marcajeForm.addEventListener("submit", function (e) {
  e.preventDefault();
  var fecha = marcajeFechaInput.value || rhTodayISO();
  var nota = marcajeNota.value.trim();
  marcajeErrorBloques.textContent = "";

  var bloques = [];
  for (var i = 0; i < rhMarcajeJornadas.length; i++) {
    var b = rhMarcajeJornadas[i];
    var tieneEntrada = !!b.entrada;
    var tieneSalida = !!b.salida;
    if (!tieneEntrada && !tieneSalida) continue; // jornada vacía: se ignora
    if (tieneEntrada !== tieneSalida) {
      marcajeErrorBloques.textContent = "Completa entrada y salida en cada jornada, o deja la jornada vacía.";
      return;
    }
    if (rhBlockIsInvalid(b)) {
      marcajeErrorBloques.textContent = "En cada jornada, la salida debe ser posterior a la entrada.";
      return;
    }
    bloques.push({ entrada: b.entrada, salida: b.salida });
  }

  var actividades = rhMarcajeActividadesPicker ? rhMarcajeActividadesPicker.obtener() : [];

  if (bloques.length === 0 && !nota && actividades.length === 0) {
    rhShowAlert("Ingresa al menos una jornada con horario, una actividad o una nota antes de guardar.", "error");
    return;
  }

  // Si abriste un día para editarlo y le cambiaste la fecha, la jornada se
  // mueve: se guarda en la fecha nueva (sumándose si ya había algo ahí) y el
  // registro del día original pasa a la Papelera.
  var fechaOriginal = rhMarcajeForm.fechaOriginal;
  var moviendo = !!(fechaOriginal && fechaOriginal !== fecha);
  var original = moviendo ? rhGetRegistroByFecha(fechaOriginal) : null;
  var existente = rhGetRegistroByFecha(fecha);
  var esEdicion = !!marcajeIdInput.value && !moviendo;
  var mensajeOk = moviendo
    ? "Jornada movida del " + rhFormatDateDisplay(fechaOriginal) + " al " + rhFormatDateDisplay(fecha) + "."
    : "Jornada del " + rhFormatDateDisplay(fecha) + " guardada.";

  if (existente && !esEdicion) {
    // La fecha ya tenía registro y el formulario no se abrió para editarlo
    // (ej. marcaste la entrada con "Marcaje rápido" y ahora agregas la tarde):
    // se suma a lo existente en vez de reemplazarlo, para no perder nada.
    var previos = rhRegistroBloques(existente).filter(function (b) { return b.entrada || b.salida; });
    var clavesPrevias = previos.map(function (b) { return b.entrada + "-" + b.salida; });
    var nuevos = bloques.filter(function (b) { return clavesPrevias.indexOf(b.entrada + "-" + b.salida) === -1; });
    var solapados = nuevos.filter(function (n) {
      var ni = rhTimeToMinutes(n.entrada), nf = rhTimeToMinutes(n.salida);
      return previos.some(function (p) {
        var pi = rhTimeToMinutes(p.entrada), pf = rhTimeToMinutes(p.salida);
        if (pi === null) return false;
        if (pf === null) pf = pi + 1;
        return ni < pf && pi < nf;
      });
    });

    var aviso = (moviendo ? "Se moverá la jornada del " + rhFormatDateDisplay(fechaOriginal) + " al " + rhFormatDateDisplay(fecha) + ".\n\n" : "") +
      "El " + rhFormatDateDisplay(fecha) + " ya tiene un registro" +
      (previos.length ? ": " + rhMarcajeResumenBloques(previos) : "") + ".\n\n";
    if (nuevos.length) aviso += "Se sumará: " + rhMarcajeResumenBloques(nuevos) + ".\n";
    if (solapados.length) aviso += "\nOJO: " + rhMarcajeResumenBloques(solapados) + " se cruza con un horario ya guardado y esas horas se contarían dos veces.\n";
    aviso += "\n¿Sumar a lo ya registrado? (Para cambiar lo anterior usa “Editar” en el historial.)";
    if (!confirm(aviso)) return;

    var notaPrevia = (existente.nota || "").trim();
    rhUpsertRegistro(rhRegistroActualizado(existente, {
      bloques: previos.concat(nuevos).sort(function (a, b) {
        return (rhTimeToMinutes(a.entrada) || 0) - (rhTimeToMinutes(b.entrada) || 0);
      }),
      nota: notaPrevia && nota && notaPrevia !== nota ? notaPrevia + " · " + nota : (notaPrevia || nota),
      actividades: rhUnirActividades(rhRegistroActividades(existente), actividades),
      estado: previos.length || nuevos.length ? null : existente.estado
    }));
    if (!moviendo) mensajeOk = "Se sumó a la jornada del " + rhFormatDateDisplay(fecha) + ".";
  } else {
    // Se parte del registro que se está editando (o moviendo) para conservar
    // cualquier otro dato que tenga; solo cambia lo que está en el formulario.
    var base = moviendo ? original : existente;
    var registro = rhRegistroActualizado(base, {
      id: esEdicion ? marcajeIdInput.value : null,
      fecha: fecha,
      bloques: bloques,
      nota: nota,
      actividades: actividades
    });
    // Editar la nota de un día "Aún no contratado" no debe convertirlo en un
    // día hábil sin horas: se conserva el estado mientras no se agreguen horas.
    if (bloques.length > 0 || !base || !base.estado) delete registro.estado;
    rhUpsertRegistro(rhMarcajeAplicarNotaInforme(registro));
  }
  if (moviendo && original) rhDeleteRegistro(original.id);
  rhShowAlert(mensajeOk, "success");
  rhMarcajeMesActual = rhMonthRange(fecha).start;
  rhMarcajeResetForm();
  renderMarcajeTable();
});

// ---------- Marcaje rápido (entrada/salida con la hora actual) ----------

function rhNowHHMM() {
  var d = new Date();
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

// Copia de las jornadas ordenadas por hora de entrada, para que "la última
// marca" sea siempre la más reciente en el tiempo y no la última de la lista
// (al sumar o editar jornadas el orden guardado puede quedar mezclado).
function rhBloquesOrdenados(bloques) {
  return bloques.map(function (b) {
    return { entrada: b.entrada || "", salida: b.salida || "" };
  }).sort(function (a, b) {
    return (rhTimeToMinutes(a.entrada) || 0) - (rhTimeToMinutes(b.entrada) || 0);
  });
}

// Bloque abierto de hoy: el último con entrada marcada y sin salida.
function rhMarcajeBloqueAbiertoHoy(bloques) {
  for (var i = bloques.length - 1; i >= 0; i--) {
    if (bloques[i].entrada && !bloques[i].salida) return bloques[i];
  }
  return null;
}

function rhMarcajeRenderRapidoStatus() {
  var hoy = rhTodayISO();
  var registroHoy = rhGetRegistroByFecha(hoy);
  var bloquesHoy = rhBloquesOrdenados(registroHoy ? rhRegistroBloques(registroHoy) : []);
  var abierto = rhMarcajeBloqueAbiertoHoy(bloquesHoy);

  if (abierto) {
    marcajeRapidoStatus.textContent = "🟢 Entrada marcada hoy a las " + rhFormatHora(abierto.entrada) + " — falta marcar la salida.";
    marcajeMarcarEntradaBtn.disabled = true;
    marcajeMarcarSalidaBtn.disabled = false;
  } else if (bloquesHoy.length > 0) {
    var totalMin = rhRegistroMinutes(registroHoy);
    marcajeRapidoStatus.textContent = "Hoy llevas " + bloquesHoy.length + (bloquesHoy.length === 1 ? " jornada registrada" : " jornadas registradas") +
      " (" + rhMinutesToHM(totalMin) + "). Si vuelves más tarde, marca una nueva entrada.";
    marcajeMarcarEntradaBtn.disabled = false;
    marcajeMarcarSalidaBtn.disabled = true;
  } else {
    marcajeRapidoStatus.textContent = "Hoy aún no tienes marcaje. Toca \"Marcar entrada\" cuando llegues.";
    marcajeMarcarEntradaBtn.disabled = false;
    marcajeMarcarSalidaBtn.disabled = true;
  }

  // Botón para revertir la última marca de hoy (por si se tocó por error).
  if (bloquesHoy.length > 0) {
    var ultimo = bloquesHoy[bloquesHoy.length - 1];
    if (ultimo.salida) {
      marcajeDeshacerBtn.textContent = "↩️ Deshacer salida (" + rhFormatHora(ultimo.salida) + ")";
    } else {
      marcajeDeshacerBtn.textContent = "↩️ Deshacer entrada (" + rhFormatHora(ultimo.entrada) + ")";
    }
    marcajeDeshacerBtn.classList.remove("hidden");
  } else {
    marcajeDeshacerBtn.classList.add("hidden");
  }

  // Actividades de hoy: aparecen apenas hay una entrada marcada y se guardan
  // al tocarlas, sin pasar por el formulario.
  if (bloquesHoy.length > 0) {
    marcajeRapidoActividadesWrap.classList.remove("hidden");
    rhCrearSelectorActividades(marcajeRapidoActividades, rhRegistroActividades(registroHoy), function (lista) {
      var actual = rhGetRegistroByFecha(hoy);
      if (!actual) return;
      rhUpsertRegistro(rhRegistroActualizado(actual, { actividades: lista }));
      // Si el formulario de abajo está mostrando hoy, se actualiza también
      // para que al guardarlo no se pierdan las actividades recién elegidas.
      if (marcajeFechaInput.value === hoy && marcajeIdInput.value) rhMarcajeSetActividades(lista);
      rhShowAlert("Actividades de hoy guardadas.", "success");
      renderMarcajeTable();
    });
  } else {
    marcajeRapidoActividadesWrap.classList.add("hidden");
  }
}

// Marca la hora actual como entrada o salida del día de hoy, directo sobre el
// registro guardado (no depende de que el formulario siga abierto en esta
// fecha), y refresca el formulario si es lo que se está mostrando.
function rhMarcajeMarcarHoraAhora(tipo) {
  var fecha = rhTodayISO();
  var existente = rhGetRegistroByFecha(fecha);
  var bloques = rhBloquesOrdenados(rhRegistroBloques(existente));
  var hora = rhNowHHMM();

  if (tipo === "entrada") {
    if (rhMarcajeBloqueAbiertoHoy(bloques)) {
      rhShowAlert("Ya tienes una entrada marcada hoy sin salida. Marca la salida antes de marcar una nueva entrada.", "error");
      return;
    }
    bloques.push({ entrada: hora, salida: "" });
    bloques = rhBloquesOrdenados(bloques);
  } else {
    var abierto = rhMarcajeBloqueAbiertoHoy(bloques);
    if (!abierto) {
      rhShowAlert("No hay una entrada abierta hoy para marcar la salida.", "error");
      return;
    }
    if (rhBlockIsInvalid({ entrada: abierto.entrada, salida: hora })) {
      rhShowAlert("La hora actual (" + rhFormatHora(hora) + ") no puede ser la salida: es igual o anterior a la entrada (" +
        rhFormatHora(abierto.entrada) + "). Ajusta la hora manualmente si hace falta.", "error");
      return;
    }
    abierto.salida = hora;
  }

  rhUpsertRegistro(rhRegistroActualizado(existente, {
    fecha: fecha,
    bloques: bloques,
    nota: existente ? (existente.nota || "") : "",
    estado: null
  }));

  rhShowAlert((tipo === "entrada" ? "Entrada marcada a las " : "Salida marcada a las ") + rhFormatHora(hora) + ".", "success");

  rhMarcajeMesActual = rhMonthRange(fecha).start;
  // Se refresca el formulario si muestra hoy, salvo que tenga cambios sin guardar.
  if (marcajeFechaInput.value === fecha && !rhMarcajeForm.sucio) rhMarcajeLoadFecha(fecha);
  renderMarcajeTable();
}

marcajeMarcarEntradaBtn.addEventListener("click", function () { rhMarcajeMarcarHoraAhora("entrada"); });
marcajeMarcarSalidaBtn.addEventListener("click", function () { rhMarcajeMarcarHoraAhora("salida"); });

// Revierte la última marca de hoy (por si se presionó "Marcar entrada" o
// "Marcar salida" por error): si lo último fue una salida, solo se borra la
// salida (la entrada queda abierta de nuevo); si lo último fue una entrada
// sin salida, se elimina esa jornada completa.
function rhMarcajeDeshacerUltimaMarca() {
  var fecha = rhTodayISO();
  var existente = rhGetRegistroByFecha(fecha);
  if (!existente) return;
  var bloques = rhBloquesOrdenados(rhRegistroBloques(existente));
  if (bloques.length === 0) return;

  var ultimo = bloques[bloques.length - 1];
  var mensaje;
  if (ultimo.salida) {
    if (!confirm("¿Deshacer la salida marcada a las " + rhFormatHora(ultimo.salida) +
      "? La entrada de las " + rhFormatHora(ultimo.entrada) + " se mantiene.")) return;
    ultimo.salida = "";
    mensaje = "Se deshizo la salida marcada.";
  } else {
    if (!confirm("¿Deshacer la entrada marcada a las " + rhFormatHora(ultimo.entrada) + "?")) return;
    bloques.pop();
    mensaje = "Se deshizo la entrada marcada.";
  }

  if (bloques.length === 0 && !existente.nota && rhRegistroActividades(existente).length === 0) {
    rhDeleteRegistro(existente.id);
  } else {
    rhUpsertRegistro(rhRegistroActualizado(existente, { bloques: bloques, estado: null }));
  }

  rhShowAlert(mensaje, "success");
  // Se refresca el formulario si muestra hoy, salvo que tenga cambios sin guardar.
  if (marcajeFechaInput.value === fecha && !rhMarcajeForm.sucio) rhMarcajeLoadFecha(fecha);
  renderMarcajeTable();
}

marcajeDeshacerBtn.addEventListener("click", rhMarcajeDeshacerUltimaMarca);

// ---------- Historial mensual ----------

var marcajeMesPrevBtn = rhEl("marcaje-mes-prev");
var marcajeMesNextBtn = rhEl("marcaje-mes-next");
var marcajeMesLabel = rhEl("marcaje-mes-label");
var marcajeTableBody = rhEl("marcaje-table-body");
var marcajeEmptyState = rhEl("marcaje-empty-state");

marcajeMesPrevBtn.addEventListener("click", function () {
  var d = rhParseISO(rhMarcajeMesActual);
  d.setMonth(d.getMonth() - 1);
  rhMarcajeMesActual = rhMonthRange(rhDateToISO(d)).start;
  renderMarcajeTable();
});
marcajeMesNextBtn.addEventListener("click", function () {
  var d = rhParseISO(rhMarcajeMesActual);
  d.setMonth(d.getMonth() + 1);
  rhMarcajeMesActual = rhMonthRange(rhDateToISO(d)).start;
  renderMarcajeTable();
});

// Abre una fecha en el formulario de Marcaje para editarla (desde el
// historial, las estadísticas o el calendario).
function rhMarcajeAbrirFecha(iso) {
  rhMarcajeMesActual = rhMonthRange(iso).start;
  marcajeFechaInput.value = iso;
  rhMarcajeLoadFecha(iso);
  if (marcajeIdInput.value) {
    marcajeCancelBtn.classList.remove("hidden");
    marcajeSubmitBtn.textContent = "Guardar cambios";
  }
  rhActivateTab("marcaje");
  var titulo = rhEl("marcaje-form-title");
  window.scrollTo({ top: Math.max(0, titulo.getBoundingClientRect().top + window.scrollY - 70), behavior: "smooth" });
}

// Celda de nota: las actividades marcadas (como etiquetas) y debajo la nota.
function rhMarcajeCeldaNota(actividades, nota) {
  var td = document.createElement("td");
  td.className = "note-cell";
  if (actividades.length) td.appendChild(rhEtiquetasActividades(actividades));
  if (nota || !actividades.length) {
    var p = document.createElement("span");
    p.textContent = nota || "—";
    td.appendChild(p);
  }
  return td;
}

function rhMarcajeBuildRegistroRow(r) {
  var tr = document.createElement("tr");
  tr.className = rhClaseFilaDia(rhEstadoDia(r.fecha));

  var tdFecha = document.createElement("td");
  tdFecha.className = "celda-fecha";
  tdFecha.textContent = rhFormatDateDisplay(r.fecha);
  tr.appendChild(tdFecha);

  var tdDia = document.createElement("td");
  tdDia.className = "celda-fecha";
  tdDia.textContent = rhDayOfWeekLabel(r.fecha, true);
  tr.appendChild(tdDia);

  var minutos = rhRegistroMinutes(r);
  var libre = rhDiaLibre(r);
  var tdJornadas = document.createElement("td");
  tdJornadas.className = "jornadas-cell" + (libre && minutos === 0 ? " celda-estado" : "");
  tdJornadas.textContent = (libre ? "🌴 " : "") + rhFormatJornadasRegistro(r);
  tr.appendChild(tdJornadas);

  var tdTotal = document.createElement("td");
  tdTotal.textContent = libre && minutos === 0 ? "—" : rhMinutesToHM(minutos);
  tr.appendChild(tdTotal);

  tr.appendChild(rhMarcajeCeldaNota(rhRegistroActividades(r), r.nota || (libre && libre.motivo) || ""));

  var tdActions = document.createElement("td");
  tdActions.className = "col-actions";
  var actionsWrap = document.createElement("div");
  actionsWrap.className = "row-actions";

  var editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn-small btn-secondary";
  editBtn.textContent = "Editar";
  editBtn.addEventListener("click", function () { rhMarcajeAbrirFecha(r.fecha); });

  var delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "btn btn-small btn-danger";
  delBtn.textContent = "Eliminar";
  delBtn.addEventListener("click", function () {
    if (!confirm("¿Eliminar el registro del " + rhFormatDateDisplay(r.fecha) + "?")) return;
    rhDeleteRegistro(r.id);
    renderMarcajeTable();
    rhShowAlert("Registro eliminado.", "success");
  });

  actionsWrap.appendChild(editBtn);
  actionsWrap.appendChild(delBtn);
  tdActions.appendChild(actionsWrap);
  tr.appendChild(tdActions);

  return tr;
}

// Fila para un día hábil sin registro propio pero cubierto por una licencia:
// feriado en rojo (como en un calendario) y "no convocado" en ámbar, para
// distinguirlos de un vistazo de los días trabajados y entre sí.
function rhMarcajeBuildLicenciaRow(fecha, licencia) {
  var tr = document.createElement("tr");
  tr.className = rhClaseFilaDia(rhEstadoDia(fecha));

  var tdFecha = document.createElement("td");
  tdFecha.className = "celda-fecha";
  tdFecha.textContent = rhFormatDateDisplay(fecha);
  tr.appendChild(tdFecha);

  var tdDia = document.createElement("td");
  tdDia.className = "celda-fecha";
  tdDia.textContent = rhDayOfWeekLabel(fecha, true);
  tr.appendChild(tdDia);

  var tdJornadas = document.createElement("td");
  tdJornadas.className = "jornadas-cell celda-estado";
  tdJornadas.textContent = rhTipoLicenciaLabel(licencia.tipo);
  tr.appendChild(tdJornadas);

  var tdTotal = document.createElement("td");
  tdTotal.textContent = "—";
  tr.appendChild(tdTotal);

  var tdNota = document.createElement("td");
  tdNota.className = "note-cell";
  tdNota.textContent = licencia.detalle || "—";
  tr.appendChild(tdNota);

  var tdActions = document.createElement("td");
  tdActions.className = "col-actions";
  var verBtn = document.createElement("button");
  verBtn.type = "button";
  verBtn.className = "btn btn-small btn-secondary";
  verBtn.textContent = "Ver en Licencias";
  verBtn.addEventListener("click", function () {
    rhActivateTab("licencias");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  tdActions.appendChild(verBtn);
  tr.appendChild(tdActions);

  return tr;
}

// Fila de un sábado o domingo sin registro: día de descanso (no es feriado),
// para seguir el historial semana a semana.
function rhMarcajeBuildDescansoRow(fecha) {
  var tr = document.createElement("tr");
  tr.className = "dia-rojo fila-descanso";
  [rhFormatDateDisplay(fecha), rhDayOfWeekLabel(fecha, true), "Descanso", "", "", ""].forEach(function (texto, i) {
    var td = document.createElement("td");
    if (i < 2) td.className = "celda-fecha";
    if (i === 2) td.className = "jornadas-cell celda-descanso";
    td.textContent = texto;
    tr.appendChild(td);
  });
  return tr;
}

// Fila de un día hábil ya pasado sin nada registrado: para notar olvidos y
// registrarlo (o marcarlo como día libre) con un toque.
function rhMarcajeBuildSinRegistroRow(fecha) {
  var tr = document.createElement("tr");
  tr.className = "fila-sin-registro";
  [rhFormatDateDisplay(fecha), rhDayOfWeekLabel(fecha, true), "⚠️ Sin registro", "—", "¿Lo olvidaste? Regístralo o marca qué pasó ese día."].forEach(function (texto, i) {
    var td = document.createElement("td");
    if (i < 2) td.className = "celda-fecha";
    if (i === 2) td.className = "jornadas-cell celda-estado";
    if (i === 4) td.className = "note-cell";
    td.textContent = texto;
    tr.appendChild(td);
  });

  var tdActions = document.createElement("td");
  tdActions.className = "col-actions";
  var acciones = document.createElement("div");
  acciones.className = "row-actions";
  var registrar = document.createElement("button");
  registrar.type = "button";
  registrar.className = "btn btn-small btn-secondary";
  registrar.textContent = "Registrar";
  registrar.addEventListener("click", function () { rhMarcajeAbrirFecha(fecha); });
  var libre = document.createElement("button");
  libre.type = "button";
  libre.className = "btn btn-small btn-libre";
  libre.textContent = "🌴 Día libre";
  libre.addEventListener("click", function () { rhAbrirOcuparLibre(fecha); });
  acciones.appendChild(registrar);
  acciones.appendChild(libre);
  tdActions.appendChild(acciones);
  tr.appendChild(tdActions);
  return tr;
}

function renderMarcajeTable() {
  var range = rhMonthRange(rhMarcajeMesActual);
  var d = rhParseISO(rhMarcajeMesActual);
  marcajeMesLabel.textContent = RH_MESES[d.getMonth()] + " " + d.getFullYear();
  var config = rhLoadConfig();

  var registros = rhLoadRegistros()
    .filter(function (r) { return rhIsDateInRange(r.fecha, range.start, range.end); });
  var fechasConRegistro = {};
  registros.forEach(function (r) { fechasConRegistro[r.fecha] = true; });

  // Días laborales del mes cubiertos por una licencia/feriado que todavía no
  // tienen un registro propio: se agregan como filas informativas.
  var filasLicencia = rhDaysBetweenInclusive(range.start, range.end)
    .filter(function (iso) {
      if (fechasConRegistro[iso]) return false;
      if (config.diasLaborales.indexOf(rhParseISO(iso).getDay()) === -1) return false;
      return !!rhLicenciaForDate(iso);
    })
    .map(function (iso) { return { fecha: iso, licencia: rhLicenciaForDate(iso) }; });

  // Sábados y domingos (días no laborales) ya pasados, desde que empezaste:
  // aparecen como descanso para que se vea el orden de cada semana.
  var hoy = rhTodayISO();
  var inicio = rhBalanceStartDate();
  var filasDescanso = rhDaysBetweenInclusive(range.start, range.end)
    .filter(function (iso) {
      if (fechasConRegistro[iso]) return false;
      if (rhCompareISO(iso, hoy) > 0 || rhCompareISO(iso, inicio) < 0) return false;
      return config.diasLaborales.indexOf(rhParseISO(iso).getDay()) === -1;
    })
    .map(function (iso) { return { fecha: iso, descanso: true }; });

  // Días hábiles ya pasados sin ningún registro ni justificación (feriado,
  // licencia, no convocado): así se notan los olvidos.
  var filasSinRegistro = rhDaysBetweenInclusive(range.start, range.end)
    .filter(function (iso) {
      return !fechasConRegistro[iso] && rhEstadoDia(iso, config, hoy).clave === "sin_registro";
    })
    .map(function (iso) { return { fecha: iso, sinRegistro: true }; });

  var filas = registros.map(function (r) { return { fecha: r.fecha, registro: r }; })
    .concat(filasLicencia, filasDescanso, filasSinRegistro)
    .sort(function (a, b) { return rhCompareISO(b.fecha, a.fecha); });

  rhClear(marcajeTableBody);
  marcajeEmptyState.classList.toggle("hidden", filas.length > 0);

  filas.forEach(function (item) {
    var tr = item.registro ? rhMarcajeBuildRegistroRow(item.registro)
      : item.descanso ? rhMarcajeBuildDescansoRow(item.fecha)
      : item.sinRegistro ? rhMarcajeBuildSinRegistroRow(item.fecha)
      : rhMarcajeBuildLicenciaRow(item.fecha, item.licencia);
    marcajeTableBody.appendChild(tr);
  });

  rhMarcajeRenderRapidoStatus();
}
