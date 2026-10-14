"use strict";

// ---------- Tab: Informe ----------
//
// Vista pensada para compartir con la jefatura: horas trabajadas día a día,
// con la descripción de cada día resumida y corregida (sin tocar la nota
// original). El balance de lo que se debe solo aparece si marcas "Incluir
// arreglo de horas".

var informeInicioInput = rhEl("informe-inicio");
var informeFinInput = rhEl("informe-fin");
var informeAnioSelect = rhEl("informe-anio");

function rhInformeSetRango(inicio, fin) {
  informeInicioInput.value = inicio;
  informeFinInput.value = fin;
  renderInforme();
}

// Rango por defecto: el mes en curso completo (ej. 1 al 31 de agosto), para
// generar un informe rápido sin tener que elegir las fechas cada vez.
function rhInformeMesActual() {
  var r = rhMonthRange(rhTodayISO());
  rhInformeSetRango(r.start, r.end);
}

// Presets por cantidad de días hacia atrás, contando hoy (últimos N días).
function rhInformeAplicarDias(n) {
  var hoy = rhTodayISO();
  var d = rhParseISO(hoy);
  d.setDate(d.getDate() - (n - 1));
  rhInformeSetRango(rhDateToISO(d), hoy);
}

rhEl("informe-preset-mes").addEventListener("click", rhInformeMesActual);
rhEl("informe-preset-30d").addEventListener("click", function () { rhInformeAplicarDias(30); });
rhEl("informe-preset-60d").addEventListener("click", function () { rhInformeAplicarDias(60); });
rhEl("informe-preset-90d").addEventListener("click", function () { rhInformeAplicarDias(90); });

function rhInformePoblarAnios() {
  var hoy = rhTodayISO();
  var anioActual = rhParseISO(hoy).getFullYear();
  var anios = {};
  anios[anioActual] = true;
  rhLoadRegistros().forEach(function (r) { anios[rhParseISO(r.fecha).getFullYear()] = true; });

  var lista = Object.keys(anios).map(Number).sort(function (a, b) { return b - a; });
  rhClear(informeAnioSelect);

  var placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Ver año…";
  informeAnioSelect.appendChild(placeholder);

  lista.forEach(function (anio) {
    var opt = document.createElement("option");
    opt.value = String(anio);
    opt.textContent = String(anio);
    informeAnioSelect.appendChild(opt);
  });
}

informeAnioSelect.addEventListener("change", function () {
  var anio = Number(informeAnioSelect.value);
  if (!anio) return;
  var hoy = rhTodayISO();
  var inicio = anio + "-01-01";
  var fin = anio + "-12-31";
  if (anio === rhParseISO(hoy).getFullYear()) fin = hoy;
  rhInformeSetRango(inicio, fin);
  informeAnioSelect.value = "";
});

[informeInicioInput, informeFinInput].forEach(function (input) {
  input.addEventListener("change", renderInforme);
});

rhEl("informe-print-btn").addEventListener("click", function () {
  window.print();
});

function rhInformeBlockLabel(minutes) {
  return minutes > 0 ? rhMinutesToHM(minutes) : "—";
}

// ---- Qué incluir (se recuerda en este dispositivo) ----

var informeIncluirDescripciones = rhEl("informe-incluir-descripciones");
var informeIncluirArreglo = rhEl("informe-incluir-arreglo");
informeIncluirDescripciones.checked = rhPrefGet("rh_pref_informe_descripciones", "1") === "1";
informeIncluirArreglo.checked = rhPrefGet("rh_pref_informe_arreglo", "0") === "1";

informeIncluirDescripciones.addEventListener("change", function () {
  rhPrefSet("rh_pref_informe_descripciones", informeIncluirDescripciones.checked ? "1" : "0");
  renderInforme();
});

informeIncluirArreglo.addEventListener("change", function () {
  rhPrefSet("rh_pref_informe_arreglo", informeIncluirArreglo.checked ? "1" : "0");
  renderInforme();
});

// Descripción del día para el informe: la nota resumida (o el texto escrito a
// mano para el informe) y, en días con feriado/licencia, su detalle.
function rhInformeDescripcion(iso, registro) {
  var texto = rhTextoInforme(registro);
  if (texto) return texto;
  var licencia = rhLicenciaForDate(iso);
  if (licencia && licencia.detalle && rhEsDiaLaboral(iso)) return rhResumirDescripcion(licencia.detalle);
  return "";
}

function renderInforme() {
  var inicio = informeInicioInput.value;
  var fin = informeFinInput.value;
  var hoy = rhTodayISO();
  var config = rhLoadConfig();
  var rangoValido = inicio && fin && rhCompareISO(fin, inicio) >= 0;

  // ---- Resumen del período elegido (sin balance) ----
  if (rangoValido) {
    var metaMin = rhMetaEnRango(inicio, fin);
    var desglose = rhStatsDesgloseCuota({ start: inicio, end: fin });
    var valores = Object.keys(desglose.grupos);
    rhEl("informe-meta-mes-value").textContent = rhMinutesToHM(metaMin);
    rhEl("informe-meta-mes-sub").textContent = rhPlural(desglose.conMeta, "día hábil", "días hábiles") +
      (valores.length === 1 ? " × " + rhHorasCorto(Number(valores[0])) : "") + " (sin feriados ni licencias)";
    rhEl("informe-trabajado-mes-value").textContent = rhMinutesToHM(rhWorkedMinutesInRange(inicio, fin));
    rhEl("informe-trabajado-mes-sub").textContent = "Del " + rhFormatDateDisplay(inicio) + " al " + rhFormatDateDisplay(fin);
  }

  // ---- Detalle del período seleccionado ----
  var tbody = rhEl("informe-table-body");
  rhClear(tbody);
  rhEl("informe-empty-state").classList.toggle("hidden", rangoValido);
  rhEl("informe-table-wrap").classList.toggle("hidden", !rangoValido);
  rhEl("informe-arreglo-section").classList.toggle("hidden", !rangoValido || !informeIncluirArreglo.checked);
  if (!rangoValido) return;

  var conDescripciones = informeIncluirDescripciones.checked;
  var totalMin = 0;

  rhDaysBetweenInclusive(inicio, fin).forEach(function (iso) {
    var registro = rhGetRegistroByFecha(iso);
    var minTotal = rhRegistroMinutes(registro);
    totalMin += minTotal;
    var claseDia = rhClaseFilaDia(rhEstadoDia(iso, config, hoy));
    var descripcion = conDescripciones ? rhInformeDescripcion(iso, registro) : "";

    var tr = document.createElement("tr");
    tr.className = claseDia + (descripcion ? " con-descripcion" : "");

    var tdDia = document.createElement("td");
    tdDia.className = "celda-fecha";
    tdDia.textContent = rhDayOfWeekLabel(iso, true);
    tr.appendChild(tdDia);

    // En el celular se oculta el año (el período ya lo indica) para que la
    // tabla quepa sin deslizar de lado.
    var tdFecha = document.createElement("td");
    tdFecha.className = "celda-fecha";
    var fechaTxt = rhFormatDateDisplay(iso);
    tdFecha.appendChild(document.createTextNode(fechaTxt.slice(0, 5)));
    var anio = document.createElement("span");
    anio.className = "fecha-anio";
    anio.textContent = fechaTxt.slice(5);
    tdFecha.appendChild(anio);
    tr.appendChild(tdFecha);

    var tdJornadas = document.createElement("td");
    tdJornadas.className = "jornadas-cell";
    var horario = document.createElement("span");
    horario.textContent = rhFormatJornadasDia(iso);
    tdJornadas.appendChild(horario);
    var actividades = rhRegistroActividades(registro);
    if (actividades.length) {
      var acts = document.createElement("span");
      acts.className = "informe-actividades";
      acts.textContent = actividades.join(" · ");
      tdJornadas.appendChild(acts);
    }
    tr.appendChild(tdJornadas);

    var tdTotal = document.createElement("td");
    tdTotal.textContent = rhInformeBlockLabel(minTotal);
    tr.appendChild(tdTotal);
    tbody.appendChild(tr);

    // La descripción va en una fila propia bajo el día, a todo el ancho, para
    // que se lea bien en el celular y al imprimir.
    if (descripcion) {
      var trDesc = document.createElement("tr");
      trDesc.className = claseDia + " fila-descripcion";
      var tdDesc = document.createElement("td");
      tdDesc.colSpan = 4;
      tdDesc.textContent = descripcion;
      trDesc.appendChild(tdDesc);
      tbody.appendChild(trDesc);
    }
  });

  rhEl("informe-total-periodo").textContent = rhMinutesToHM(totalMin);
  if (informeIncluirArreglo.checked) rhInformeRenderArreglo(inicio, fin, config);
}

// ---- Arreglo de horas del período (opcional) ----

function rhInformeRenderArreglo(inicio, fin, config) {
  var b = rhBalancePeriodo(inicio, fin);
  var unidad = rhArregloUnidadElegida(config, b.hasta);
  var dias = config.diasLaborales.length || 5;
  var semanaMin = unidad.minutos * dias;
  var abs = Math.abs(b.balanceMin);
  var favor = b.balanceMin > 1;
  var contra = b.balanceMin < -1;

  rhEl("informe-arreglo-contrato").textContent = "Contrato: " + rhArregloTextoContrato(config) +
    ". Calculado del " + rhFormatDateDisplay(b.desde) + " al " + rhFormatDateDisplay(b.hasta) +
    (rhCompareISO(b.hasta, fin) < 0 ? " (hasta hoy)" : "") + ".";

  var cifras = rhEl("informe-arreglo-cifras");
  rhClear(cifras);
  function cifra(etiqueta, valor, clase) {
    var c = document.createElement("div");
    c.className = "informe-cifra" + (clase ? " " + clase : "");
    var l = document.createElement("span");
    l.textContent = etiqueta;
    var v = document.createElement("strong");
    v.textContent = valor;
    c.appendChild(l);
    c.appendChild(v);
    cifras.appendChild(c);
  }
  cifra("Horas trabajadas", rhMinutesToHM(b.trabajadoMin));
  cifra("Horas según contrato", rhMinutesToHM(b.esperadoMin));
  cifra(favor ? "Saldo a mi favor" : contra ? "Saldo en contra" : "Saldo", favor || contra ? rhMinutesToHM(abs) : "Al día",
    favor ? "favor" : contra ? "contra" : "");
  cifra("En " + unidad.plural + " (" + rhHorasCorto(unidad.minutos) + ")", unidad.minutos > 0 ? rhNumero(abs / unidad.minutos) : "—");
  cifra("En semanas de " + rhHorasCorto(semanaMin) + " (lun a vie)", semanaMin > 0 ? rhNumero(abs / semanaMin) : "—");

  var tbody = rhEl("informe-arreglo-body");
  rhClear(tbody);
  rhMesesEnRango(inicio, fin).forEach(function (mes) {
    var r = rhMonthRange(mes);
    var bm = rhBalancePeriodo(rhCompareISO(r.start, inicio) < 0 ? inicio : r.start, rhCompareISO(r.end, fin) > 0 ? fin : r.end);
    if (bm.trabajadoMin === 0 && bm.esperadoMin === 0) return;
    var tr = document.createElement("tr");
    tr.className = "fila-" + rhBalanceTagClass(bm.balanceMin);
    [rhNombreMes(mes, true), rhMinutesToHM(bm.trabajadoMin), rhMinutesToHM(bm.esperadoMin), rhConSigno(bm.balanceMin)].forEach(function (t, i) {
      var td = document.createElement("td");
      td.textContent = t;
      if (i === 3) td.className = "celda-saldo";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

rhInformePoblarAnios();
rhInformeMesActual();
