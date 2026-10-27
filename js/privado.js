"use strict";

// ---------- Configuración › Privado ----------
//
// Apartado con candado (la contraseña son 4 espacios). Es solo una cortina
// para que no se vea a la pasada: no cifra nada. Se vuelve a cerrar al salir
// de Configuración o al recargar la app.
//
// "Modificación de horas posibles": días hábiles ya pasados con pocas horas
// registradas, para agregar lo que trabajaste y no anotaste (por ejemplo, una
// tarde en tu casa). Las horas se agregan con el mismo editor del informe,
// así que quedan como cualquier otra jornada en toda la app.

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

// Horario sugerido para agregar: la jornada de tarde si ese día no tiene
// nada en la tarde; si no, la de mañana; si ambas tienen algo, en blanco.
function rhPrivadoSugerencia(registro, config) {
  var bloques = rhRegistroBloques(registro).filter(function (b) { return b.entrada && b.salida; });
  var b1 = config.horarioBase.bloque1;
  var b2 = config.horarioBase.bloque2;
  if (rhMinutosEnVentana(bloques, b2) === 0) return { entrada: b2.entrada, salida: b2.salida };
  if (rhMinutosEnVentana(bloques, b1) === 0) return { entrada: b1.entrada, salida: b1.salida };
  return { entrada: "", salida: "" };
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
      rhAbrirEditorDia(d.iso, { agregar: rhPrivadoSugerencia(d.registro, config), actividad: "Home office" });
    });
    pie.appendChild(falta);
    pie.appendChild(agregar);
    li.appendChild(pie);
    ul.appendChild(li);
  });
}
