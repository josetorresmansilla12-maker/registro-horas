"use strict";

// ---------- Configuración › Privado ----------
//
// Apartado con candado (la contraseña son 4 espacios). Es solo una cortina
// para que no se vea a la pasada: no cifra nada. Se vuelve a cerrar al salir
// de Configuración o al recargar la app.
//
// "Modificación de horas posibles": días hábiles ya pasados con pocas horas
// registradas, para agregar lo que trabajaste y no anotaste (por ejemplo, una
// tarde en tu casa). Las horas se agregan ahí mismo, dentro de la tarjeta del
// día: al guardar quedan como cualquier otra jornada en toda la app y la
// lista se queda donde estabas, para seguir con el día siguiente.

var RH_PRIVADO_CLAVE = /^\s{4}$/;

var rhPrivado = {
  abierto: false,
  periodo: rhNuevoPeriodo("mes"),
  umbral: rhPrefGet("rh_pref_privado_umbral", "contrato") === "completo" ? "completo" : "contrato"
};

var privadoClave = rhEl("privado-clave");

function rhPrivadoBloquear() {
  rhPrivado.abierto = false;
  privadoClave.value = "";
  rhEl("privado-error").textContent = "";
  rhEl("privado-bloqueado").classList.remove("hidden");
  rhEl("privado-abierto").classList.add("hidden");
  rhEl("privado-cerrar").classList.add("hidden");
}

rhEl("privado-bloqueado").addEventListener("submit", function (e) {
  e.preventDefault();
  if (!RH_PRIVADO_CLAVE.test(privadoClave.value)) {
    rhEl("privado-error").textContent = "Contraseña incorrecta.";
    privadoClave.value = "";
    privadoClave.focus();
    return;
  }
  rhPrivado.abierto = true;
  privadoClave.value = "";
  privadoClave.blur();
  renderPrivado();
});

rhEl("privado-cerrar").addEventListener("click", rhPrivadoBloquear);

rhEl("privado-umbral").addEventListener("click", function (e) {
  var b = e.target.closest(".segmented-btn");
  if (!b) return;
  rhPrivado.umbral = b.getAttribute("data-umbral");
  rhPrefSet("rh_pref_privado_umbral", rhPrivado.umbral);
  rhPrivadoRenderHoras();
});

function renderPrivado() {
  rhEl("privado-bloqueado").classList.toggle("hidden", rhPrivado.abierto);
  rhEl("privado-abierto").classList.toggle("hidden", !rhPrivado.abierto);
  rhEl("privado-cerrar").classList.toggle("hidden", !rhPrivado.abierto);
  if (!rhPrivado.abierto) return;
  rhCrearSelectorPeriodo(rhEl("periodo-privado"), rhPrivado.periodo, rhPrivadoRenderHoras);
  rhPrivadoRenderHoras();
}

// Horario sugerido para agregar: la jornada de tarde si ese día no tiene nada
// en la tarde; si no, el tramo libre más largo dentro del horario normal
// (ej. 15:30–17:30 si trabajaste hasta las 15:30). En blanco si no queda nada.
function rhPrivadoSugerencia(registro, config) {
  var ocupados = rhRegistroBloques(registro).filter(function (b) { return b.entrada && b.salida; }).map(function (b) {
    return [rhTimeToMinutes(b.entrada), rhTimeToMinutes(b.salida)];
  }).sort(function (x, y) { return x[0] - y[0]; });
  var mejor = null;
  function huecos(ventana) {
    var ini = rhTimeToMinutes(ventana.entrada);
    var fin = rhTimeToMinutes(ventana.salida);
    var res = [];
    if (ini === null || fin === null || fin <= ini) return res;
    var cursor = ini;
    ocupados.forEach(function (o) {
      if (o[1] <= cursor || o[0] >= fin) return;
      if (o[0] > cursor) res.push([cursor, o[0]]);
      cursor = Math.max(cursor, o[1]);
    });
    if (cursor < fin) res.push([cursor, fin]);
    return res;
  }
  var tarde = config.horarioBase.bloque2;
  var libresTarde = huecos(tarde);
  if (libresTarde.length === 1 && libresTarde[0][0] === rhTimeToMinutes(tarde.entrada) && libresTarde[0][1] === rhTimeToMinutes(tarde.salida)) {
    return { entrada: tarde.entrada, salida: tarde.salida };
  }
  libresTarde.concat(huecos(config.horarioBase.bloque1)).forEach(function (h) {
    if (h[1] - h[0] >= 15 && (!mejor || h[1] - h[0] > mejor[1] - mejor[0])) mejor = h;
  });
  return mejor ? { entrada: rhMinutesToTimeStr(mejor[0]), salida: rhMinutesToTimeStr(mejor[1]) } : { entrada: "", salida: "" };
}

// Días hábiles del período (hasta hoy) con menos horas que el umbral. No se
// incluyen feriados, licencias, días no convocados, sin contrato ni días libres.
function rhPrivadoDias(p, config) {
  var hoy = rhTodayISO();
  var inicio = rhBalanceStartDate();
  var desde = rhCompareISO(p.start, inicio) < 0 ? inicio : p.start;
  var hasta = rhCompareISO(p.end, hoy) > 0 ? hoy : p.end;
  var completo = rhJornadasNorma(config).completa.minutos;
  var dias = [];
  if (rhCompareISO(desde, hasta) > 0) return dias;
  rhDaysBetweenInclusive(desde, hasta).forEach(function (iso) {
    if (!rhEsDiaLaboral(iso, config)) return;
    var lic = rhLicenciaForDate(iso);
    if (lic && rhLicenciaAjustaMeta(lic)) return;
    var registro = rhGetRegistroByFecha(iso);
    if (rhRegistroEstadoLabel(registro) || rhDiaLibre(registro)) return;
    var umbral = rhPrivado.umbral === "completo" ? completo : rhMetaDiariaMinutos(config, iso);
    var minutos = rhRegistroMinutes(registro);
    if (minutos >= umbral) return;
    dias.push({ iso: iso, registro: registro, minutos: minutos, falta: umbral - minutos });
  });
  return dias.reverse();
}

function rhPrivadoRenderHoras() {
  var config = rhLoadConfig();
  var p = rhPeriodoRango(rhPrivado.periodo);
  var cuota = rhMetaDiariaMinutos(config);
  var norma = rhJornadasNorma(config);

  rhEl("privado-umbral").querySelectorAll(".segmented-btn").forEach(function (b) {
    var id = b.getAttribute("data-umbral");
    b.classList.toggle("activo", id === rhPrivado.umbral);
    b.textContent = id === "completo" ? "Menos de " + rhHorasCorto(norma.completa.minutos) + " (día completo)"
      : "Menos de " + rhMinutesToHM(cuota) + " (contrato)";
  });

  var dias = rhPrivadoDias(p, config);
  var faltaTotal = dias.reduce(function (s, d) { return s + d.falta; }, 0);
  var saldo = rhCalcularBalance().balanceMin;
  rhEl("privado-resumen").textContent = (dias.length
    ? rhPlural(dias.length, "día", "días") + " con pocas horas en " + p.corta + ". Para completarlos faltarían " + rhMinutesToHM(faltaTotal) + "."
    : "No hay días con pocas horas en " + p.corta + ".") +
    " Tu saldo hoy: " + (saldo > 1 ? rhMinutesToHM(saldo) + " a favor." : saldo < -1 ? "debes " + rhMinutesToHM(-saldo) + "." : "al día.");

  var ul = rhEl("privado-lista");
  rhClear(ul);
  var variosMeses = rhMesesEnRango(p.start, p.end).length > 1;
  var variosAnios = p.start.slice(0, 4) !== p.end.slice(0, 4);
  var mesActual = "";

  dias.forEach(function (d) {
    if (variosMeses && d.iso.slice(0, 7) !== mesActual) {
      mesActual = d.iso.slice(0, 7);
      var sep = document.createElement("li");
      sep.className = "privado-mes";
      sep.textContent = rhNombreMes(d.iso, variosAnios);
      ul.appendChild(sep);
    }

    var li = document.createElement("li");
    li.className = "privado-dia" + (d.minutos === 0 ? " privado-sin-registro" : "");

    var cab = document.createElement("div");
    cab.className = "privado-dia-cab";
    var fecha = document.createElement("strong");
    fecha.textContent = rhFechaCorta(d.iso);
    var total = document.createElement("span");
    total.className = "privado-total";
    total.textContent = d.minutos > 0 ? rhMinutesToHM(d.minutos) : "Sin registro";
    cab.appendChild(fecha);
    cab.appendChild(total);
    li.appendChild(cab);

    if (d.registro) {
      var detalle = document.createElement("p");
      detalle.className = "privado-detalle";
      var acts = rhRegistroActividades(d.registro);
      detalle.textContent = rhFormatJornadasRegistro(d.registro) + (acts.length ? " · " + acts.join(", ") : "") +
        (d.registro.nota ? " — " + d.registro.nota : "");
      li.appendChild(detalle);
    }

    var pie = document.createElement("div");
    pie.className = "privado-dia-pie";
    var falta = document.createElement("span");
    falta.className = "privado-falta";
    falta.textContent = "Faltan " + rhMinutesToHM(d.falta);
    var agregar = document.createElement("button");
    agregar.type = "button";
    agregar.className = "btn btn-small btn-primary";
    agregar.textContent = "➕ Agregar horas";
    agregar.addEventListener("click", function () {
      // Una tarjeta abierta a la vez.
      ul.querySelectorAll(".privado-form").forEach(function (f) {
        f.parentNode.querySelector(".privado-dia-pie").classList.remove("hidden");
        f.remove();
      });
      pie.classList.add("hidden");
      li.appendChild(rhPrivadoFormulario(li, d, config));
    });
    pie.appendChild(falta);
    pie.appendChild(agregar);
    li.appendChild(pie);
    li.setAttribute("data-iso", d.iso);
    ul.appendChild(li);
  });
}

// Formulario dentro de la tarjeta del día para agregar una jornada (entrada y
// salida con la ruleta), qué hiciste y si fue home office.
function rhPrivadoFormulario(li, d, config) {
  var sug = rhPrivadoSugerencia(d.registro, config);
  var umbral = rhPrivado.umbral === "completo" ? rhJornadasNorma(config).completa.minutos : rhMetaDiariaMinutos(config, d.iso);
  var form = document.createElement("div");
  form.className = "privado-form";

  var horas = document.createElement("div");
  horas.className = "privado-form-horas";
  var campos = {};
  [["entrada", "Entrada"], ["salida", "Salida"]].forEach(function (c) {
    var field = document.createElement("div");
    field.className = "field";
    var label = document.createElement("label");
    label.textContent = c[1];
    var input = document.createElement("input");
    input.type = "time";
    input.value = sug[c[0]];
    field.appendChild(label);
    field.appendChild(input);
    horas.appendChild(field);
    campos[c[0]] = input;
  });
  form.appendChild(horas);
  rhConvertirHora24(campos.entrada);
  rhConvertirHora24(campos.salida);

  var queField = document.createElement("div");
  queField.className = "field";
  var queLabel = document.createElement("label");
  queLabel.textContent = "¿Qué hiciste?";
  var que = document.createElement("input");
  que.type = "text";
  que.maxLength = 160;
  que.placeholder = "Ej: programa de informes en casa";
  queLabel.appendChild(que);
  queField.appendChild(queLabel);
  form.appendChild(queField);

  var homeLabel = document.createElement("label");
  homeLabel.className = "switch-option";
  var home = document.createElement("input");
  home.type = "checkbox";
  home.checked = true;
  homeLabel.appendChild(home);
  homeLabel.appendChild(document.createTextNode("Fue home office"));
  form.appendChild(homeLabel);

  var previa = document.createElement("p");
  previa.className = "privado-previa";
  form.appendChild(previa);
  var error = document.createElement("span");
  error.className = "error-msg";
  form.appendChild(error);

  function nuevoBloque() {
    return { entrada: campos.entrada.value, salida: campos.salida.value };
  }
  function actualizarPrevia() {
    var b = nuevoBloque();
    var min = rhBlockMinutes(b);
    if (!min) {
      previa.textContent = b.entrada && b.salida ? "La salida debe ser después de la entrada." : "Elige la hora de entrada y de salida.";
      return;
    }
    var total = d.minutos + min;
    previa.textContent = "Agregas " + rhMinutesToHM(min) + " → el día queda en " + rhMinutesToHM(total) +
      (total >= umbral ? " ✓" : " (aún faltan " + rhMinutesToHM(umbral - total) + ")");
  }
  ["input", "change"].forEach(function (ev) {
    campos.entrada.addEventListener(ev, actualizarPrevia);
    campos.salida.addEventListener(ev, actualizarPrevia);
  });
  actualizarPrevia();

  var acciones = document.createElement("div");
  acciones.className = "privado-form-acciones";
  var guardar = document.createElement("button");
  guardar.type = "button";
  guardar.className = "btn btn-small btn-primary";
  guardar.textContent = "Guardar";
  var cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "btn btn-small btn-secondary";
  cancelar.textContent = "Cancelar";
  var todo = document.createElement("button");
  todo.type = "button";
  todo.className = "btn-link";
  todo.textContent = "Editar el día completo";
  acciones.appendChild(guardar);
  acciones.appendChild(cancelar);
  acciones.appendChild(todo);
  form.appendChild(acciones);

  cancelar.addEventListener("click", function () {
    form.remove();
    li.querySelector(".privado-dia-pie").classList.remove("hidden");
  });
  todo.addEventListener("click", function () { rhAbrirEditorDia(d.iso); });

  guardar.addEventListener("click", function () {
    error.textContent = "";
    var b = nuevoBloque();
    if (!b.entrada || !b.salida) {
      error.textContent = "Completa la entrada y la salida.";
      return;
    }
    if (rhBlockIsInvalid(b)) {
      error.textContent = "La salida debe ser después de la entrada.";
      return;
    }
    var existente = rhGetRegistroByFecha(d.iso);
    var previos = rhRegistroBloques(existente).filter(function (x) { return x.entrada && x.salida; });
    var ni = rhTimeToMinutes(b.entrada);
    var nf = rhTimeToMinutes(b.salida);
    var cruce = previos.find(function (x) {
      return ni < rhTimeToMinutes(x.salida) && rhTimeToMinutes(x.entrada) < nf;
    });
    if (cruce) {
      error.textContent = "Se cruza con " + rhFormatBloque(cruce) + ". Cambia el horario.";
      return;
    }
    var texto = que.value.trim();
    var notaPrevia = ((existente && existente.nota) || "").trim();
    var actividades = rhRegistroActividades(existente);
    if (home.checked) actividades = rhUnirActividades(actividades, ["Home office"]);
    rhUpsertRegistro(rhRegistroActualizado(existente, {
      fecha: d.iso,
      bloques: previos.concat([b]).sort(function (x, y) { return rhTimeToMinutes(x.entrada) - rhTimeToMinutes(y.entrada); }),
      nota: notaPrevia && texto ? notaPrevia + " · " + texto : (notaPrevia || texto),
      actividades: actividades
    }));

    // Se redibuja la lista sin mover la pantalla: queda a la vista el mismo
    // día (si aún tiene pocas horas) o el que venía después.
    var topAntes = li.getBoundingClientRect().top;
    var siguiente = li.nextElementSibling;
    while (siguiente && !siguiente.getAttribute("data-iso")) siguiente = siguiente.nextElementSibling;
    var sigIso = siguiente ? siguiente.getAttribute("data-iso") : null;
    rhPrivadoRenderHoras();
    renderMarcajeTable();
    var ul = rhEl("privado-lista");
    var mismo = ul.querySelector('[data-iso="' + d.iso + '"]');
    var destino = mismo || (sigIso && ul.querySelector('[data-iso="' + sigIso + '"]'));
    if (destino) window.scrollBy(0, destino.getBoundingClientRect().top - topAntes);
    if (mismo) mismo.classList.add("privado-guardado");
    rhShowAlert("Se agregaron " + rhMinutesToHM(rhBlockMinutes(b)) + " al " + rhFormatDateDisplay(d.iso) + ".", "success");
  });

  return form;
}
