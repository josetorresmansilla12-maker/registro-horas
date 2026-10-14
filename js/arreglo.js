"use strict";

// ---------- Tab: Arreglo de horas ----------
//
// Cuántas horas te deben (o debes) según tu contrato en el período elegido, y
// cómo se traducen a jornadas y semanas de trabajo para poder cobrarlas.
//
// Criterio:
//  - Saldo = horas trabajadas − horas que pedía el contrato (la misma regla de
//    todo el resto de la app: horas semanales ÷ días laborales por cada día
//    hábil, sin contar feriados, días sin convocatoria ni licencias, y solo
//    hasta hoy).
//  - "Una jornada" es configurable: un día de contrato (horas semanales ÷ 5),
//    la jornada de mañana, la de tarde o el día completo (mañana + tarde).
//  - "Una semana" son 5 jornadas (lunes a viernes, o los días laborales que
//    tengas configurados).

var rhArregloPeriodo = rhNuevoPeriodo("todo");
var arregloForm = rhEl("arreglo-form");

function rhNumero(x) {
  return (Math.round(x * 10) / 10).toLocaleString("es-CL", { maximumFractionDigits: 1 });
}

function rhDuracionJornada(bloque) {
  return rhBlockMinutes(bloque);
}

// Tipos de jornada con su duración, para traducir el saldo de horas.
function rhArregloUnidades(config, iso) {
  var b1 = config.horarioBase.bloque1;
  var b2 = config.horarioBase.bloque2;
  var dias = config.diasLaborales.length || 5;
  var horasSemana = rhHorasSemanalesEn(iso, config);
  var mDia = rhMetaDiariaMinutos(config, iso);
  var m1 = rhDuracionJornada(b1);
  var m2 = rhDuracionJornada(b2);
  return [
    {
      id: "contrato",
      label: "Día de contrato (" + horasSemana + " h ÷ " + dias + " días = " + rhMinutesToHM(mDia) + ")",
      corto: "día de contrato",
      plural: "días de contrato",
      minutos: mDia
    },
    {
      id: "manana",
      label: "Jornada de mañana (" + rhFormatBloque(b1) + " = " + rhMinutesToHM(m1) + ")",
      corto: "jornada de mañana",
      plural: "jornadas de mañana",
      minutos: m1
    },
    {
      id: "tarde",
      label: "Jornada de tarde (" + rhFormatBloque(b2) + " = " + rhMinutesToHM(m2) + ")",
      corto: "jornada de tarde",
      plural: "jornadas de tarde",
      minutos: m2
    },
    {
      id: "completa",
      label: "Día completo: mañana + tarde (" + rhMinutesToHM(m1 + m2) + ")",
      corto: "día completo",
      plural: "días completos",
      minutos: m1 + m2
    }
  ];
}

function rhArregloUnidadElegida(config, iso) {
  var unidades = rhArregloUnidades(config, iso);
  return unidades.find(function (u) { return u.id === config.arregloUnidad; }) || unidades[0];
}

// "5 jornadas y 3h 30m" (parte entera + resto en horas).
function rhEnteroYResto(minutos, unidadMin, singular, plural) {
  if (!(unidadMin > 0)) return "—";
  var enteras = Math.floor(minutos / unidadMin + 1e-9);
  var resto = minutos - enteras * unidadMin;
  if (enteras === 0) return "menos de 1 " + singular;
  var txt = rhPlural(enteras, singular, plural);
  if (resto >= 1) txt += " y " + rhMinutesToHM(resto);
  return txt;
}

// Texto del contrato con sus cambios: "20 h hasta el 30/09/2026 y 22 h desde el 01/10/2026".
function rhArregloTextoContrato(config) {
  var cambios = (config.contratoCambios || []).filter(function (c) { return c && c.desde; })
    .slice().sort(function (a, b) { return rhCompareISO(a.desde, b.desde); });
  if (cambios.length === 0) return config.metaSemanal + " h semanales";
  var partes = [config.metaSemanal + " h semanales hasta el " + rhFormatDateDisplay(rhAddDays(cambios[0].desde, -1))];
  cambios.forEach(function (c) { partes.push(c.horasSemanales + " h desde el " + rhFormatDateDisplay(c.desde)); });
  return partes.join(" y ");
}

// Minutos trabajados dentro de cada jornada configurada (y fuera de ellas).
function rhArregloFranjas(p, config) {
  var b1 = config.horarioBase.bloque1;
  var b2 = config.horarioBase.bloque2;
  var res = { manana: 0, diasManana: 0, tarde: 0, diasTarde: 0, fuera: 0, total: 0 };
  rhLoadRegistros().forEach(function (r) {
    if (!rhIsDateInRange(r.fecha, p.start, p.end)) return;
    var bloques = rhRegistroBloques(r).filter(function (b) { return b.entrada && b.salida; });
    var total = rhRegistroMinutes(r);
    if (total <= 0) return;
    var m = rhMinutosEnVentana(bloques, b1);
    var t = rhMinutosEnVentana(bloques, b2);
    res.manana += m;
    res.tarde += t;
    if (m > 0) res.diasManana++;
    if (t > 0) res.diasTarde++;
    res.fuera += Math.max(0, total - m - t);
    res.total += total;
  });
  return res;
}

function renderArreglo() {
  rhCrearSelectorPeriodo(rhEl("periodo-arreglo"), rhArregloPeriodo, renderArregloCalculo);
  renderArregloCalculo();
  renderArregloForm();
}

function renderArregloCalculo() {
  var config = rhLoadConfig();
  var p = rhPeriodoRango(rhArregloPeriodo);
  var b = rhBalancePeriodo(p.start, p.end);
  var ref = b.hasta || rhTodayISO();
  var unidad = rhArregloUnidadElegida(config, ref);
  var dias = config.diasLaborales.length || 5;
  var semanaMin = unidad.minutos * dias;
  var saldo = b.balanceMin;
  var abs = Math.abs(saldo);
  var favor = saldo > 1;
  var contra = saldo < -1;

  rhEl("arreglo-titulo").textContent = favor ? "Te deben" : contra ? "Debes" : "Saldo de horas";

  var total = rhEl("arreglo-total");
  rhClear(total);
  total.className = "arreglo-total " + (favor ? "favor" : contra ? "contra" : "neutro");
  var grande = document.createElement("strong");
  grande.textContent = favor || contra ? rhMinutesToHM(abs) : "Estás al día";
  total.appendChild(grande);
  var subTotal = document.createElement("span");
  subTotal.textContent = favor ? "horas a tu favor en " + p.corta : contra ? "horas en contra en " + p.corta : "en " + p.corta;
  total.appendChild(subTotal);

  var eq = rhEl("arreglo-equivalencias");
  rhClear(eq);
  function tarjeta(etiqueta, valor, sub) {
    var c = document.createElement("div");
    c.className = "arreglo-eq";
    var l = document.createElement("span");
    l.className = "arreglo-eq-label";
    l.textContent = etiqueta;
    var v = document.createElement("strong");
    v.textContent = valor;
    var s = document.createElement("span");
    s.className = "arreglo-eq-sub";
    s.textContent = sub;
    c.appendChild(l);
    c.appendChild(v);
    c.appendChild(s);
    eq.appendChild(c);
  }
  tarjeta("En horas", rhMinutesToHM(abs), favor ? "a tu favor" : contra ? "en contra" : "al día");
  tarjeta("En jornadas", unidad.minutos > 0 ? rhNumero(abs / unidad.minutos) : "—",
    unidad.plural + " de " + rhHorasCorto(unidad.minutos));
  tarjeta("En semanas", semanaMin > 0 ? rhNumero(abs / semanaMin) : "—",
    "de " + rhHorasCorto(semanaMin) + " (lun a vie)");
  var desglose = document.createElement("p");
  desglose.className = "arreglo-desglose";
  desglose.textContent = "Es decir: " + rhEnteroYResto(abs, unidad.minutos, unidad.corto, unidad.plural) +
    ", o " + rhEnteroYResto(abs, semanaMin, "semana", "semanas") + ".";
  eq.appendChild(desglose);

  rhEl("arreglo-explica").textContent = "Del " + rhFormatDateDisplay(b.desde) + " al " + rhFormatDateDisplay(b.hasta) +
    ": trabajaste " + rhMinutesToHM(b.trabajadoMin) + " y tu contrato (" + rhArregloTextoContrato(config) + ") pedía " +
    rhMinutesToHM(b.esperadoMin) + ". No se cuentan como día a trabajar los feriados, días sin convocatoria ni licencias.";

  // Franjas horarias trabajadas (respaldo de las tardes).
  var f = rhArregloFranjas(p, config);
  var b1 = config.horarioBase.bloque1;
  var b2 = config.horarioBase.bloque2;
  rhStatsRenderBarras(rhEl("arreglo-franjas"), [
    { etiqueta: "Mañana", valor: f.manana, texto: rhMinutesToHM(f.manana) + " · " + rhPlural(f.diasManana, "día", "días") + " (" + rhFormatBloque(b1) + ")" },
    { etiqueta: "Tarde", valor: f.tarde, texto: rhMinutesToHM(f.tarde) + " · " + rhPlural(f.diasTarde, "día", "días") + " (" + rhFormatBloque(b2) + ")" },
    { etiqueta: "Otras", valor: f.fuera, texto: rhMinutesToHM(f.fuera) + " fuera de esos horarios" }
  ], "No hay horas registradas en este período.");
  rhEl("arreglo-franjas").classList.add("barras-actividades");

  // Detalle por mes.
  rhEl("arreglo-col-jornadas").textContent = "Jornadas";
  var tbody = rhEl("arreglo-meses-body");
  rhClear(tbody);
  var filasTexto = [];
  rhMesesEnRango(p.start, p.end).forEach(function (mes) {
    var r = rhMonthRange(mes);
    var desde = rhCompareISO(r.start, p.start) < 0 ? p.start : r.start;
    var hasta = rhCompareISO(r.end, p.end) > 0 ? p.end : r.end;
    var bm = rhBalancePeriodo(desde, hasta);
    if (bm.trabajadoMin === 0 && bm.esperadoMin === 0) return;
    var tr = document.createElement("tr");
    tr.className = "fila-" + rhBalanceTagClass(bm.balanceMin);
    var dm = rhParseISO(mes);
    var signo = bm.balanceMin > 0 ? "+" : bm.balanceMin < 0 ? "−" : "";
    [
      RH_MESES_ABREV[dm.getMonth()] + " " + String(dm.getFullYear()).slice(2),
      rhMinutosCorto(bm.trabajadoMin),
      rhMinutosCorto(bm.esperadoMin),
      signo + rhMinutosCorto(Math.abs(bm.balanceMin)),
      unidad.minutos > 0 ? signo + rhNumero(Math.abs(bm.balanceMin) / unidad.minutos) : "—"
    ].forEach(function (t, i) {
      var td = document.createElement("td");
      td.textContent = t;
      if (i === 3) td.className = "celda-saldo";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    filasTexto.push("• " + rhNombreMes(mes, true) + ": " + rhMinutesToHM(bm.trabajadoMin) + " trabajadas / " +
      rhMinutesToHM(bm.esperadoMin) + " según contrato → " + rhConSigno(bm.balanceMin));
  });
  if (!tbody.children.length) {
    var vacio = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 5;
    td.className = "label-hint";
    td.textContent = "Sin horas en este período.";
    vacio.appendChild(td);
    tbody.appendChild(vacio);
  }

  // Otras equivalencias.
  var eqBody = rhEl("arreglo-equiv-body");
  rhClear(eqBody);
  rhArregloUnidades(config, ref).forEach(function (u) {
    var tr = document.createElement("tr");
    if (u.id === unidad.id) tr.className = "fila-elegida";
    [u.label, u.minutos > 0 ? rhNumero(abs / u.minutos) : "—", u.minutos > 0 ? rhNumero(abs / (u.minutos * dias)) : "—"].forEach(function (t) {
      var td = document.createElement("td");
      td.textContent = t;
      tr.appendChild(td);
    });
    eqBody.appendChild(tr);
  });

  // Texto para copiar y enviar (respaldo).
  var lineas = [
    "Resumen de horas — Registro de Horas",
    "Período: del " + rhFormatDateDisplay(b.desde) + " al " + rhFormatDateDisplay(b.hasta),
    "Contrato: " + rhArregloTextoContrato(config) + " (" + dias + " días laborales por semana)",
    "",
    "Horas trabajadas: " + rhMinutesToHM(b.trabajadoMin),
    "Horas según contrato: " + rhMinutesToHM(b.esperadoMin),
    (favor ? "Saldo a mi favor: " : contra ? "Saldo en contra: " : "Saldo: ") + rhMinutesToHM(abs),
    "= " + rhNumero(unidad.minutos > 0 ? abs / unidad.minutos : 0) + " " + unidad.plural + " de " + rhMinutesToHM(unidad.minutos),
    "= " + rhNumero(semanaMin > 0 ? abs / semanaMin : 0) + " semanas de " + rhMinutesToHM(semanaMin) + " (lunes a viernes)"
  ];
  if (filasTexto.length) {
    lineas.push("", "Detalle por mes:");
    Array.prototype.push.apply(lineas, filasTexto);
  }
  if (f.tarde > 0) {
    lineas.push("", "Horas en jornada de tarde (" + rhFormatBloque(b2) + "): " + rhMinutesToHM(f.tarde) + " en " + rhPlural(f.diasTarde, "día", "días") + ".");
  }
  lineas.push("", "No se cuentan como día a trabajar los feriados, días sin convocatoria ni licencias.");
  rhEl("arreglo-resumen").value = lineas.join("\n");
}

rhEl("arreglo-copiar-btn").addEventListener("click", function () {
  var area = rhEl("arreglo-resumen");
  area.classList.remove("hidden");
  var texto = area.value;
  function mostrarSeleccion() {
    area.focus();
    area.select();
    rhShowAlert("Selecciona el texto de abajo y cópialo.", "success");
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function () {
      rhShowAlert("Resumen copiado: pégalo en un correo o WhatsApp.", "success");
    }, mostrarSeleccion);
  } else {
    mostrarSeleccion();
  }
});

// ---------- Datos del cálculo (contrato, jornadas y unidad) ----------

function renderArregloForm() {
  var config = rhLoadConfig();
  rhEl("arreglo-horas-base").value = config.metaSemanal;
  rhEl("arreglo-b1-entrada").value = config.horarioBase.bloque1.entrada || "";
  rhEl("arreglo-b1-salida").value = config.horarioBase.bloque1.salida || "";
  rhEl("arreglo-b2-entrada").value = config.horarioBase.bloque2.entrada || "";
  rhEl("arreglo-b2-salida").value = config.horarioBase.bloque2.salida || "";
  rhEl("arreglo-b2-activo").checked = !!config.bloque2Activo;

  var sel = rhEl("arreglo-unidad");
  rhClear(sel);
  rhArregloUnidades(config, rhTodayISO()).forEach(function (u) {
    var opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.label;
    sel.appendChild(opt);
  });
  sel.value = rhArregloUnidadElegida(config, rhTodayISO()).id;

  var ul = rhEl("arreglo-cambios-list");
  rhClear(ul);
  (config.contratoCambios || []).slice().sort(function (a, b) { return rhCompareISO(a.desde, b.desde); }).forEach(function (c) {
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.textContent = "Desde el " + rhFormatDateDisplay(c.desde) + ": " + c.horasSemanales + " h semanales";
    li.appendChild(span);
    var quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "btn btn-small btn-secondary";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", function () {
      if (!confirm("¿Quitar el cambio de contrato del " + rhFormatDateDisplay(c.desde) + "?")) return;
      var actual = rhLoadConfig();
      rhSaveConfig(Object.assign({}, actual, {
        contratoCambios: (actual.contratoCambios || []).filter(function (x) { return !(x.desde === c.desde && x.horasSemanales === c.horasSemanales); })
      }));
      renderArreglo();
    });
    li.appendChild(quitar);
    ul.appendChild(li);
  });

  rhArregloExplicarContrato();
}

function rhArregloExplicarContrato() {
  var config = rhLoadConfig();
  var hoy = rhTodayISO();
  var dias = config.diasLaborales.length || 5;
  rhEl("arreglo-contrato-explica").textContent = "Hoy rige: " + rhHorasSemanalesEn(hoy, config) + " h por semana = " +
    rhMinutesToHM(rhMetaDiariaMinutos(config, hoy)) + " por día hábil (" + dias + " días laborales). " +
    RH_MESES[rhParseISO(hoy).getMonth()] + " pide " + rhMinutesToHM(rhMetaMensualAjustada(hoy)) +
    " (los meses se calculan solos con sus días hábiles reales).";
  var unidad = rhArregloUnidadElegida(config, hoy);
  rhEl("arreglo-unidad-explica").textContent = "Con esto, una semana de trabajo (lunes a viernes) = " + dias + " × " +
    rhMinutesToHM(unidad.minutos) + " = " + rhMinutesToHM(unidad.minutos * dias) + ".";
}

rhEl("arreglo-cambio-agregar").addEventListener("click", function () {
  var desde = rhEl("arreglo-cambio-desde").value;
  var horas = Number(rhEl("arreglo-cambio-horas").value);
  if (!desde || !(horas > 0)) {
    rhShowAlert("Indica desde qué fecha y cuántas horas semanales rigen.", "error");
    return;
  }
  var config = rhLoadConfig();
  var cambios = (config.contratoCambios || []).filter(function (c) { return c.desde !== desde; });
  cambios.push({ desde: desde, horasSemanales: horas });
  rhSaveConfig(Object.assign({}, config, { contratoCambios: cambios }));
  rhEl("arreglo-cambio-desde").value = "";
  rhEl("arreglo-cambio-horas").value = "";
  renderArreglo();
  rhShowAlert("Desde el " + rhFormatDateDisplay(desde) + " tu contrato cuenta con " + horas + " h semanales.", "success");
});

arregloForm.addEventListener("submit", function (e) {
  e.preventDefault();
  var horas = Number(rhEl("arreglo-horas-base").value);
  var b1 = { entrada: rhEl("arreglo-b1-entrada").value, salida: rhEl("arreglo-b1-salida").value };
  var b2 = { entrada: rhEl("arreglo-b2-entrada").value, salida: rhEl("arreglo-b2-salida").value };
  if (!(horas > 0)) {
    rhShowAlert("Indica las horas semanales de tu contrato.", "error");
    return;
  }
  if (rhBlockMinutes(b1) <= 0 || rhBlockMinutes(b2) <= 0) {
    rhShowAlert("En cada jornada la salida debe ser posterior a la entrada.", "error");
    return;
  }
  rhSaveConfig(Object.assign({}, rhLoadConfig(), {
    metaSemanal: horas,
    horarioBase: { bloque1: b1, bloque2: b2 },
    bloque2Activo: rhEl("arreglo-b2-activo").checked,
    arregloUnidad: rhEl("arreglo-unidad").value
  }));
  renderArreglo();
  // El formulario de Marcaje propone el nuevo horario (si no tiene cambios sin guardar).
  if (!rhMarcajeForm.sucio) rhMarcajeResetForm();
  rhShowAlert("Datos del cálculo guardados.", "success");
});

rhEl("arreglo-unidad").addEventListener("change", function () {
  rhSaveConfig(Object.assign({}, rhLoadConfig(), { arregloUnidad: rhEl("arreglo-unidad").value }));
  renderArregloCalculo();
  rhArregloExplicarContrato();
});
