"use strict";

// ---------- Tab: Informe ----------
//
// Dos informes para compartir con la jefatura, sobre el mismo período:
//  - "Horas trabajadas": día a día, con la descripción de cada día resumida y
//    corregida (sin tocar la nota original).
//  - "Horas que me deben": saldo según el contrato, detalle por mes, horas
//    libres ocupadas y el respaldo día por día.
// En ambos, el botón ✏️ de cada día abre el editor (editor.js): lo que se
// corrige ahí queda guardado en toda la app.

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

// Todo lo registrado: desde el inicio del seguimiento hasta hoy.
function rhInformeDesdeInicio() {
  rhInformeSetRango(rhBalanceStartDate(), rhTodayISO());
}

rhEl("informe-preset-todo").addEventListener("click", rhInformeDesdeInicio);
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

// ---- Tipo de informe (se recuerda en este dispositivo) ----

var rhInformeTipo = rhPrefGet("rh_pref_informe_tipo", "trabajadas") === "deben" ? "deben" : "trabajadas";

rhEl("informe-tipo").addEventListener("click", function (e) {
  var b = e.target.closest(".segmented-btn");
  if (!b) return;
  var tipo = b.getAttribute("data-tipo");
  if (tipo === rhInformeTipo) return;
  rhInformeTipo = tipo;
  rhPrefSet("rh_pref_informe_tipo", rhInformeTipo);
  // Lo que te deben se mira desde el inicio; las horas trabajadas, por mes.
  if (tipo === "deben") rhInformeDesdeInicio();
  else rhInformeMesActual();
});

// Fila con el nombre del mes, para separar los meses cuando la lista tiene
// más de uno (así no hay que fijarse en el número del mes de cada fecha).
function rhInformeFilaMes(iso, columnas, conAnio) {
  var tr = document.createElement("tr");
  tr.className = "fila-mes";
  var td = document.createElement("td");
  td.colSpan = columnas;
  td.textContent = rhNombreMes(iso, conAnio);
  tr.appendChild(td);
  return tr;
}

// Botón ✏️ para corregir un día desde el informe (no se imprime).
function rhInformeBotonEditar(iso) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = "btn-editar-dia";
  b.textContent = "✏️";
  b.title = "Editar este día";
  b.setAttribute("aria-label", "Editar el " + rhFormatDateDisplay(iso));
  b.addEventListener("click", function () { rhAbrirEditorDia(iso); });
  return b;
}

function rhInformeBlockLabel(minutes) {
  return minutes > 0 ? rhMinutesToHM(minutes) : "—";
}

// ---- Tus datos en el informe: nombre, cargo, institución y logo ----
//
// Se guardan en la configuración (config.informe), así viajan con el
// respaldo y la sincronización. El logo se achica antes de guardarlo para
// que no pese.

var RH_LOGO_MAX_ALTO = 160;
var RH_LOGO_MAX_ANCHO = 480;
var rhInformeLogoNuevo = null; // logo elegido y aún sin guardar ("" = quitarlo)

function rhInformeDatos() {
  var d = rhLoadConfig().informe || {};
  return { nombre: d.nombre || "", cargo: d.cargo || "", institucion: d.institucion || "", logo: d.logo || "" };
}

function rhInformeMostrarLogoPreview(url) {
  var img = rhEl("informe-logo-preview");
  img.classList.toggle("hidden", !url);
  if (url) img.src = url;
  else img.removeAttribute("src");
  rhEl("informe-logo-quitar").classList.toggle("hidden", !url);
}

function rhInformeRenderDatosForm() {
  var d = rhInformeDatos();
  rhEl("informe-dato-nombre").value = d.nombre;
  rhEl("informe-dato-cargo").value = d.cargo;
  rhEl("informe-dato-institucion").value = d.institucion || "Universidad de Magallanes";
  rhEl("informe-dato-logo").value = "";
  rhInformeLogoNuevo = null;
  rhInformeMostrarLogoPreview(d.logo);
}

// Achica la imagen (máximo 480 × 160 px) y la devuelve como data URL: PNG para
// conservar la transparencia, o JPG si como PNG queda muy pesada (ej. una foto).
function rhInformeAchicarLogo(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onerror = reject;
    reader.onload = function () {
      var img = new Image();
      img.onerror = reject;
      img.onload = function () {
        var escala = Math.min(1, RH_LOGO_MAX_ALTO / img.height, RH_LOGO_MAX_ANCHO / img.width);
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var png = canvas.toDataURL("image/png");
        if (png.length <= 120000) {
          resolve(png);
          return;
        }
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

rhEl("informe-datos").addEventListener("toggle", function () {
  if (rhEl("informe-datos").open) rhInformeRenderDatosForm();
});

rhEl("informe-dato-logo").addEventListener("change", function () {
  var file = this.files && this.files[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    rhShowAlert("El logo debe ser una imagen (PNG o JPG).", "error");
    return;
  }
  rhInformeAchicarLogo(file).then(function (url) {
    rhInformeLogoNuevo = url;
    rhInformeMostrarLogoPreview(url);
  }, function () {
    rhShowAlert("No se pudo leer esa imagen. Prueba con un PNG o JPG.", "error");
  });
});

rhEl("informe-logo-quitar").addEventListener("click", function () {
  rhInformeLogoNuevo = "";
  rhEl("informe-dato-logo").value = "";
  rhInformeMostrarLogoPreview("");
});

rhEl("informe-datos-guardar").addEventListener("click", function () {
  var actual = rhInformeDatos();
  rhSaveConfig(Object.assign({}, rhLoadConfig(), {
    informe: {
      nombre: rhEl("informe-dato-nombre").value.trim(),
      cargo: rhEl("informe-dato-cargo").value.trim(),
      institucion: rhEl("informe-dato-institucion").value.trim(),
      logo: rhInformeLogoNuevo !== null ? rhInformeLogoNuevo : actual.logo
    }
  }));
  rhInformeLogoNuevo = null;
  rhEl("informe-datos").open = false;
  renderInforme();
  rhShowAlert("Tus datos del informe quedaron guardados.", "success");
});

// Membrete (logo, institución, nombre y cargo) arriba del informe y firma al final.
function rhInformeRenderMembrete(rangoValido) {
  var d = rhInformeDatos();
  rhEl("informe-membrete").classList.toggle("hidden", !(d.nombre || d.cargo || d.institucion || d.logo));
  var logo = rhEl("informe-logo");
  logo.classList.toggle("hidden", !d.logo);
  if (d.logo) logo.src = d.logo;
  else logo.removeAttribute("src");
  logo.alt = d.institucion ? "Logo " + d.institucion : "Logo";
  rhEl("informe-institucion").textContent = d.institucion;
  rhEl("informe-persona").textContent = d.nombre;
  rhEl("informe-cargo").textContent = d.cargo;

  rhEl("informe-firma").classList.toggle("hidden", !rangoValido || !d.nombre);
  rhEl("informe-firma-nombre").textContent = d.nombre;
  rhEl("informe-firma-cargo").textContent = [d.cargo, d.institucion].filter(Boolean).join(" · ");
  rhEl("informe-firma-fecha").textContent = "Emitido el " + rhFormatDateDisplay(rhTodayISO());
}

// ---- Qué incluir (se recuerda en este dispositivo) ----

var informeIncluirDescripciones = rhEl("informe-incluir-descripciones");
informeIncluirDescripciones.checked = rhPrefGet("rh_pref_informe_descripciones", "1") === "1";

informeIncluirDescripciones.addEventListener("change", function () {
  rhPrefSet("rh_pref_informe_descripciones", informeIncluirDescripciones.checked ? "1" : "0");
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
  var rangoValido = inicio && fin && rhCompareISO(fin, inicio) >= 0;
  var deben = rhInformeTipo === "deben";

  rhEl("informe-tipo").querySelectorAll(".segmented-btn").forEach(function (b) {
    b.classList.toggle("activo", b.getAttribute("data-tipo") === rhInformeTipo);
  });
  rhEl("informe-opcion-descripciones").classList.toggle("hidden", deben);
  rhEl("informe-doc-titulo").textContent = deben ? "Informe de horas que me deben" : "Informe de horas trabajadas";
  rhEl("informe-doc-sub").textContent = rangoValido
    ? "Del " + rhFormatDateDisplay(inicio) + " al " + rhFormatDateDisplay(fin) + " · Contrato: " + rhArregloTextoContrato(rhLoadConfig())
    : "";
  rhEl("informe-empty-state").classList.toggle("hidden", !!rangoValido);
  rhEl("informe-vista-trabajadas").classList.toggle("hidden", deben || !rangoValido);
  rhEl("informe-vista-deben").classList.toggle("hidden", !deben || !rangoValido);
  rhInformeRenderMembrete(rangoValido);
  if (!rangoValido) return;

  if (deben) rhInformeRenderDeben(inicio, fin);
  else rhInformeRenderTrabajadas(inicio, fin);
}

// ---- Informe de horas trabajadas ----

function rhInformeRenderTrabajadas(inicio, fin) {
  var hoy = rhTodayISO();
  var config = rhLoadConfig();

  var metaMin = rhMetaEnRango(inicio, fin);
  var desglose = rhStatsDesgloseCuota({ start: inicio, end: fin });
  var valores = Object.keys(desglose.grupos);
  rhEl("informe-meta-mes-value").textContent = rhMinutesToHM(metaMin);
  rhEl("informe-meta-mes-sub").textContent = rhPlural(desglose.conMeta, "día hábil", "días hábiles") +
    (valores.length === 1 ? " × " + rhHorasCorto(Number(valores[0])) : "") + " (sin feriados, licencias ni días libres)";
  rhEl("informe-trabajado-mes-value").textContent = rhMinutesToHM(rhWorkedMinutesInRange(inicio, fin));
  rhEl("informe-trabajado-mes-sub").textContent = "Del " + rhFormatDateDisplay(inicio) + " al " + rhFormatDateDisplay(fin);

  var tbody = rhEl("informe-table-body");
  rhClear(tbody);
  var conDescripciones = informeIncluirDescripciones.checked;
  var totalMin = 0;
  var variosMeses = rhMesesEnRango(inicio, fin).length > 1;
  var variosAnios = inicio.slice(0, 4) !== fin.slice(0, 4);
  var mesActual = "";

  rhDaysBetweenInclusive(inicio, fin).forEach(function (iso) {
    if (variosMeses && iso.slice(0, 7) !== mesActual) {
      mesActual = iso.slice(0, 7);
      tbody.appendChild(rhInformeFilaMes(iso, 4, variosAnios));
    }
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
    tdTotal.className = "celda-total-editar";
    tdTotal.appendChild(document.createTextNode(rhInformeBlockLabel(minTotal)));
    tdTotal.appendChild(rhInformeBotonEditar(iso));
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
}

// ---- Informe de horas que me deben ----

function rhInformeCelda(tr, texto, clase) {
  var td = document.createElement("td");
  td.textContent = texto;
  if (clase) td.className = clase;
  tr.appendChild(td);
  return td;
}

function rhInformeRenderDeben(inicio, fin) {
  var config = rhLoadConfig();
  var hoy = rhTodayISO();
  var b = rhBalancePeriodo(inicio, fin);
  var norma = rhJornadasNorma(config);
  var abs = Math.abs(b.balanceMin);
  var favor = b.balanceMin > 1;
  var contra = b.balanceMin < -1;

  rhEl("informe-deben-contrato").textContent = "Calculado del " + rhFormatDateDisplay(b.desde) + " al " + rhFormatDateDisplay(b.hasta) +
    (rhCompareISO(b.hasta, fin) < 0 ? " (hasta hoy)" : "") + ". Contrato: " + rhArregloTextoContrato(config) + " = " +
    rhMinutesToHM(rhMetaDiariaMinutos(config, b.hasta)) + " por día hábil. Horario: " + norma.manana.horario + " y " + norma.tarde.horario + ".";

  // Cifras principales.
  var cifras = rhEl("informe-deben-cifras");
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
  cifra("Horas libres ocupadas", rhMinutesToHM(b.libresMin) + (b.diasLibres ? " (" + rhPlural(b.diasLibres, "día", "días") + ")" : ""));
  cifra(favor ? "Saldo a mi favor" : contra ? "Saldo en contra" : "Saldo", favor || contra ? rhMinutesToHM(abs) : "Al día",
    favor ? "favor" : contra ? "contra" : "");
  rhEl("informe-deben-equiv").textContent = favor || contra
    ? (favor ? "Me deben " : "Debo ") + rhMinutesToHM(abs) + ", que equivalen a " +
      rhArregloEnJornadas(abs, norma.completa, "día completo", "días completos") + " (" + norma.completa.horario + ")."
    : "";

  // Por mes.
  var tbodyMeses = rhEl("informe-deben-meses-body");
  rhClear(tbodyMeses);
  rhMesesEnRango(inicio, fin).forEach(function (mes) {
    var r = rhMonthRange(mes);
    var bm = rhBalancePeriodo(rhCompareISO(r.start, inicio) < 0 ? inicio : r.start, rhCompareISO(r.end, fin) > 0 ? fin : r.end);
    if (bm.trabajadoMin === 0 && bm.esperadoMin === 0 && bm.libresMin === 0) return;
    var tr = document.createElement("tr");
    tr.className = "fila-" + rhBalanceTagClass(bm.balanceMin);
    rhInformeCelda(tr, rhNombreMes(mes, true));
    rhInformeCelda(tr, rhMinutosCorto(bm.trabajadoMin));
    rhInformeCelda(tr, rhMinutosCorto(bm.esperadoMin));
    rhInformeCelda(tr, bm.libresMin > 0 ? "−" + rhMinutosCorto(bm.libresMin) : "—");
    rhInformeCelda(tr, (bm.balanceMin > 0 ? "+" : bm.balanceMin < 0 ? "−" : "") + rhMinutosCorto(Math.abs(bm.balanceMin)), "celda-saldo");
    tbodyMeses.appendChild(tr);
  });

  // Horas libres ocupadas en el período (las agendadas a futuro no se cuentan aún).
  var libres = rhDiasLibresLista(inicio, fin).filter(function (r) { return rhCompareISO(r.fecha, hoy) <= 0; });
  rhEl("informe-deben-libres-section").classList.toggle("hidden", libres.length === 0);
  var tbodyLibres = rhEl("informe-deben-libres-body");
  rhClear(tbodyLibres);
  libres.forEach(function (r) {
    var dl = rhDiaLibre(r);
    var tr = document.createElement("tr");
    tr.className = "fila-dia-libre";
    rhInformeCelda(tr, rhDayOfWeekLabel(r.fecha, true) + " " + rhFormatDateDisplay(r.fecha).slice(0, 5), "celda-fecha");
    rhInformeCelda(tr, rhDiaLibreNombre(dl));
    rhInformeCelda(tr, rhMinutesToHM(dl.minutos));
    rhInformeCelda(tr, dl.motivo || "—");
    tbodyLibres.appendChild(tr);
  });

  // Día por día (respaldo), hasta hoy.
  var tbodyDias = rhEl("informe-deben-dias-body");
  rhClear(tbodyDias);
  var tot = { t: 0, e: 0, l: 0 };
  if (rhCompareISO(b.desde, b.hasta) <= 0) {
    var variosMeses = rhMesesEnRango(b.desde, b.hasta).length > 1;
    var variosAnios = b.desde.slice(0, 4) !== b.hasta.slice(0, 4);
    var mesActual = "";
    rhDaysBetweenInclusive(b.desde, b.hasta).forEach(function (iso) {
      var registro = rhGetRegistroByFecha(iso);
      var t = rhRegistroMinutes(registro);
      var l = rhDiaLibreMinutos(registro);
      var e = iso === hoy && t === 0 ? 0 : rhMinutosEsperadosDia(iso, config);
      if (t === 0 && e === 0 && l === 0) return;
      if (variosMeses && iso.slice(0, 7) !== mesActual) {
        mesActual = iso.slice(0, 7);
        tbodyDias.appendChild(rhInformeFilaMes(iso, 5, variosAnios));
      }
      tot.t += t;
      tot.e += e;
      tot.l += l;
      var saldo = t - e - l;
      var tr = document.createElement("tr");
      tr.className = rhClaseFilaDia(rhEstadoDia(iso, config, hoy)) + " fila-" + rhBalanceTagClass(saldo);
      rhInformeCelda(tr, rhDayOfWeekLabel(iso, true) + " " + rhFormatDateDisplay(iso).slice(0, 5), "celda-fecha");
      rhInformeCelda(tr, t > 0 ? rhMinutosCorto(t) : "—");
      rhInformeCelda(tr, e > 0 ? rhMinutosCorto(e) : "—");
      rhInformeCelda(tr, l > 0 ? "−" + rhMinutosCorto(l) : "—");
      var tdSaldo = rhInformeCelda(tr, (saldo > 0 ? "+" : saldo < 0 ? "−" : "") + rhMinutosCorto(Math.abs(saldo)), "celda-saldo celda-total-editar");
      tdSaldo.appendChild(rhInformeBotonEditar(iso));
      tbodyDias.appendChild(tr);
    });
  }
  var foot = rhEl("informe-deben-dias-foot");
  rhClear(foot);
  var trTot = document.createElement("tr");
  var saldoTot = tot.t - tot.e - tot.l;
  ["Total", rhMinutosCorto(tot.t), rhMinutosCorto(tot.e), tot.l > 0 ? "−" + rhMinutosCorto(tot.l) : "—",
    (saldoTot > 0 ? "+" : saldoTot < 0 ? "−" : "") + rhMinutosCorto(Math.abs(saldoTot))].forEach(function (texto) {
    var th = document.createElement("th");
    th.textContent = texto;
    trTot.appendChild(th);
  });
  foot.appendChild(trTot);
}

rhInformePoblarAnios();
if (rhInformeTipo === "deben") rhInformeDesdeInicio();
else rhInformeMesActual();
