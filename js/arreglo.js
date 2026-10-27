"use strict";

// ---------- Tab: Arreglo de horas ----------
//
// Cuántas horas te deben (o debes) según tu contrato, para cuántos días libres
// te alcanzan y un planificador para elegir qué días ocupar.
//
// Criterio:
//  - Saldo = horas trabajadas − horas que pedía el contrato − horas libres ya
//    ocupadas (la misma regla de toda la app: horas semanales ÷ días
//    laborales por cada día hábil, sin contar feriados, días sin
//    convocatoria, licencias ni días libres, y solo hasta hoy).
//  - Los días libres se cuentan en jornadas del horario normal: mañana,
//    tarde o día completo (mañana + tarde).

var rhArregloPeriodo = rhNuevoPeriodo("todo");
var arregloForm = rhEl("arreglo-form");

// Planificador: desde qué día mostrar, cuántos días hábiles y lo elegido en
// cada uno (iso → "manana" | "tarde" | "completa" | "actual" | "").
var rhPlan = { cantidad: 10, elegidos: {} };

// Texto del contrato con sus cambios: "20 h hasta el 30/09/2026 y 22 h desde el 01/10/2026".
function rhArregloTextoContrato(config) {
  var cambios = (config.contratoCambios || []).filter(function (c) { return c && c.desde; })
    .slice().sort(function (a, b) { return rhCompareISO(a.desde, b.desde); });
  if (cambios.length === 0) return config.metaSemanal + " h semanales";
  var partes = [config.metaSemanal + " h semanales hasta el " + rhFormatDateDisplay(rhAddDays(cambios[0].desde, -1))];
  cambios.forEach(function (c) { partes.push(c.horasSemanales + " h desde el " + rhFormatDateDisplay(c.desde)); });
  return partes.join(" y ");
}

// Cuántas jornadas enteras caben en un saldo y cuánto sobra.
function rhArregloCuantas(minutos, jornadaMin) {
  if (!(jornadaMin > 0) || !(minutos > 0)) return { n: 0, sobra: Math.max(0, minutos) };
  var n = Math.floor(minutos / jornadaMin + 1e-9);
  return { n: n, sobra: minutos - n * jornadaMin };
}

// "6 días completos (7h) y 3h 30m".
function rhArregloEnJornadas(minutos, jornada, singular, plural) {
  var c = rhArregloCuantas(minutos, jornada.minutos);
  var txt = rhPlural(c.n, singular, plural) + " de " + rhHorasCorto(jornada.minutos);
  if (c.sobra >= 1) txt += " y " + rhMinutesToHM(c.sobra);
  return txt;
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
  renderArregloAlcanza();
  renderArregloPlan();
  renderArregloLibres();
  renderArregloForm();
}

// Fila "concepto ... valor" del resumen tipo boleta.
function rhArregloCuenta(cont, etiqueta, valor, clase) {
  var fila = document.createElement("div");
  fila.className = "arreglo-cuenta" + (clase ? " " + clase : "");
  var l = document.createElement("span");
  l.textContent = etiqueta;
  var v = document.createElement("strong");
  v.textContent = valor;
  fila.appendChild(l);
  fila.appendChild(v);
  cont.appendChild(fila);
}

function renderArregloCalculo() {
  var config = rhLoadConfig();
  var p = rhPeriodoRango(rhArregloPeriodo);
  var b = rhBalancePeriodo(p.start, p.end);
  var norma = rhJornadasNorma(config);
  var saldo = b.balanceMin;
  var abs = Math.abs(saldo);
  var favor = saldo > 1;
  var contra = saldo < -1;
  var hastaHoy = rhCompareISO(b.hasta, p.end) < 0;

  rhEl("arreglo-titulo").textContent = favor ? "Te deben" : contra ? "Debes" : "Saldo de horas";

  var total = rhEl("arreglo-total");
  rhClear(total);
  total.className = "arreglo-total " + (favor ? "favor" : contra ? "contra" : "neutro");
  var grande = document.createElement("strong");
  grande.textContent = favor || contra ? rhMinutesToHM(abs) : "Estás al día";
  total.appendChild(grande);
  var subTotal = document.createElement("span");
  subTotal.textContent = (favor ? "a tu favor" : contra ? "en contra" : "") + (p.modo === "todo" ? "" : " en " + p.corta) +
    (hastaHoy ? " · contado hasta hoy" : "");
  total.appendChild(subTotal);

  var cuentas = rhEl("arreglo-cuentas");
  rhClear(cuentas);
  rhArregloCuenta(cuentas, "Horas trabajadas", "+" + rhMinutesToHM(b.trabajadoMin));
  rhArregloCuenta(cuentas, "Horas que pedía tu contrato", "−" + rhMinutesToHM(b.esperadoMin));
  if (b.libresMin > 0) {
    rhArregloCuenta(cuentas, "Horas libres ocupadas (" + rhPlural(b.diasLibres, "día", "días") + ")", "−" + rhMinutesToHM(b.libresMin));
  }
  rhArregloCuenta(cuentas, favor ? "Saldo a tu favor" : contra ? "Saldo en contra" : "Saldo", favor || contra ? rhMinutesToHM(abs) : "0h 00m",
    "arreglo-cuenta-total " + (favor ? "favor" : contra ? "contra" : ""));

  rhEl("arreglo-explica").textContent = "Del " + rhFormatDateDisplay(b.desde) + " al " + rhFormatDateDisplay(b.hasta) +
    ". Contrato: " + rhArregloTextoContrato(config) + " (" + rhMinutesToHM(rhMetaDiariaMinutos(config, b.hasta)) +
    " por día hábil). Los fines de semana, feriados, días sin convocatoria, licencias y días libres no cuentan como días a trabajar.";

  // Detalle por mes.
  var tbody = rhEl("arreglo-meses-body");
  rhClear(tbody);
  var filasTexto = [];
  rhMesesEnRango(p.start, p.end).forEach(function (mes) {
    var r = rhMonthRange(mes);
    var desde = rhCompareISO(r.start, p.start) < 0 ? p.start : r.start;
    var hasta = rhCompareISO(r.end, p.end) > 0 ? p.end : r.end;
    var bm = rhBalancePeriodo(desde, hasta);
    if (bm.trabajadoMin === 0 && bm.esperadoMin === 0 && bm.libresMin === 0) return;
    var tr = document.createElement("tr");
    tr.className = "fila-" + rhBalanceTagClass(bm.balanceMin);
    var dm = rhParseISO(mes);
    var signo = bm.balanceMin > 0 ? "+" : bm.balanceMin < 0 ? "−" : "";
    [
      RH_MESES_ABREV[dm.getMonth()] + " " + String(dm.getFullYear()).slice(2),
      rhMinutosCorto(bm.trabajadoMin),
      rhMinutosCorto(bm.esperadoMin),
      bm.libresMin > 0 ? "−" + rhMinutosCorto(bm.libresMin) : "—",
      signo + rhMinutosCorto(Math.abs(bm.balanceMin))
    ].forEach(function (t, i) {
      var td = document.createElement("td");
      td.textContent = t;
      if (i === 4) td.className = "celda-saldo";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    filasTexto.push("• " + rhNombreMes(mes, true) + ": " + rhMinutesToHM(bm.trabajadoMin) + " trabajadas / " +
      rhMinutesToHM(bm.esperadoMin) + " según contrato" +
      (bm.libresMin > 0 ? " / " + rhMinutesToHM(bm.libresMin) + " libres" : "") + " → " + rhConSigno(bm.balanceMin));
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

  // Texto para copiar y enviar (respaldo).
  var lineas = [
    "Resumen de horas — Registro de Horas",
    "Período: del " + rhFormatDateDisplay(b.desde) + " al " + rhFormatDateDisplay(b.hasta),
    "Contrato: " + rhArregloTextoContrato(config) + " (" + (config.diasLaborales.length || 5) + " días laborales por semana)",
    "Horario: mañana " + norma.manana.horario + " (" + rhHorasCorto(norma.manana.minutos) + "), tarde " +
      norma.tarde.horario + " (" + rhHorasCorto(norma.tarde.minutos) + ")",
    "",
    "Horas trabajadas: " + rhMinutesToHM(b.trabajadoMin),
    "Horas según contrato: " + rhMinutesToHM(b.esperadoMin)
  ];
  if (b.libresMin > 0) lineas.push("Horas libres ya ocupadas: " + rhMinutesToHM(b.libresMin) + " (" + rhPlural(b.diasLibres, "día", "días") + ")");
  lineas.push((favor ? "Saldo a mi favor: " : contra ? "Saldo en contra: " : "Saldo: ") + rhMinutesToHM(abs));
  if (favor || contra) lineas.push("= " + rhArregloEnJornadas(abs, norma.completa, "día completo", "días completos"));
  if (filasTexto.length) {
    lineas.push("", "Detalle por mes:");
    Array.prototype.push.apply(lineas, filasTexto);
  }
  if (f.tarde > 0) {
    lineas.push("", "Horas en jornada de tarde (" + rhFormatBloque(b2) + "): " + rhMinutesToHM(f.tarde) + " en " + rhPlural(f.diasTarde, "día", "días") + ".");
  }
  lineas.push("", "No se cuentan como días a trabajar los feriados, días sin convocatoria, licencias ni días libres.");
  rhEl("arreglo-resumen").value = lineas.join("\n");
}

// ---- ¿Para cuántos días libres te alcanza? (saldo total, hasta hoy) ----

function renderArregloAlcanza() {
  var s = rhSaldoParaLibres();
  var norma = rhJornadasNorma();
  var disp = s.disponibleMin;
  var hint = rhEl("arreglo-alcanza-hint");
  if (disp > 1) {
    hint.textContent = "Con tu saldo total de " + rhMinutesToHM(s.saldoMin) + " a favor" +
      (s.agendadoMin > 0 ? ", menos " + rhMinutesToHM(s.agendadoMin) + " ya agendadas," : "") +
      " tienes " + rhMinutesToHM(disp) + " disponibles. Te alcanza para cualquiera de estas opciones:";
  } else {
    hint.textContent = "Por ahora no tienes horas a favor disponibles para ocupar." +
      (s.agendadoMin > 0 ? " (Ya agendaste " + rhMinutesToHM(s.agendadoMin) + ".)" : "");
  }

  var eq = rhEl("arreglo-equivalencias");
  rhClear(eq);
  [
    { j: norma.completa, titulo: "Días completos" },
    { j: norma.manana, titulo: "Mañanas" },
    { j: norma.tarde, titulo: "Tardes" }
  ].forEach(function (o) {
    var c = rhArregloCuantas(disp, o.j.minutos);
    var card = document.createElement("div");
    card.className = "arreglo-eq";
    var l = document.createElement("span");
    l.className = "arreglo-eq-label";
    l.textContent = o.titulo;
    var v = document.createElement("strong");
    v.textContent = String(c.n);
    var sub = document.createElement("span");
    sub.className = "arreglo-eq-sub";
    sub.textContent = "de " + rhHorasCorto(o.j.minutos) + " (" + o.j.horario + ")" +
      (c.n > 0 && c.sobra >= 1 ? " · sobran " + rhMinutesToHM(c.sobra) : "");
    card.appendChild(l);
    card.appendChild(v);
    card.appendChild(sub);
    eq.appendChild(card);
  });
}

// ---- Planificar días libres ----

function rhPlanOpciones(dl) {
  var norma = rhJornadasNorma();
  var ops = [
    ["", "No ocupar"],
    ["manana", "Mañana · " + rhHorasCorto(norma.manana.minutos)],
    ["tarde", "Tarde · " + rhHorasCorto(norma.tarde.minutos)],
    ["completa", "Día completo · " + rhHorasCorto(norma.completa.minutos)]
  ];
  if (dl && rhPlanValorInicial(dl) === "actual") ops.push(["actual", rhDiaLibreTexto(dl) + " (agendado)"]);
  return ops;
}

// Opción que corresponde a un día ya agendado ("actual" si sus horas no
// calzan con el horario de hoy, para no cambiarlas sin querer).
function rhPlanValorInicial(dl) {
  if (!dl) return "";
  var j = rhJornadasNorma()[dl.jornada];
  return j && j.minutos === Number(dl.minutos) ? dl.jornada : "actual";
}

function rhPlanMinutos(valor, dl) {
  if (!valor) return 0;
  if (valor === "actual") return dl ? Number(dl.minutos) : 0;
  return rhJornadasNorma()[valor].minutos;
}

function renderArregloPlan() {
  var hoy = rhTodayISO();
  var inputDesde = rhEl("plan-desde");
  inputDesde.min = hoy;
  if (!inputDesde.value || rhCompareISO(inputDesde.value, hoy) < 0) inputDesde.value = rhAddDays(hoy, 1);
  var desde = inputDesde.value;
  var dias = rhDiasParaLibre(desde, rhAddDays(desde, RH_LIBRE_MAX_DIAS - 1)).dias.slice(0, rhPlan.cantidad);
  var norma = rhJornadasNorma();
  var s = rhSaldoParaLibres();

  // Saldo con el que se parte: lo disponible, más lo que ya tenían agendado
  // los días de la lista (porque aquí se vuelven a elegir).
  var base = s.disponibleMin;
  dias.forEach(function (iso) { base += rhDiaLibreMinutos(rhGetRegistroByFecha(iso)); });

  var lista = rhEl("plan-lista");
  rhClear(lista);
  var restante = base;
  var elegidosMin = 0;
  var elegidosN = 0;
  var cambios = 0;

  dias.forEach(function (iso) {
    var dl = rhDiaLibre(rhGetRegistroByFecha(iso));
    var inicial = rhPlanValorInicial(dl);
    var valor = rhPlan.elegidos[iso] !== undefined ? rhPlan.elegidos[iso] : inicial;
    if (valor !== inicial) cambios++;
    var min = rhPlanMinutos(valor, dl);
    if (min > 0) {
      restante -= min;
      elegidosMin += min;
      elegidosN++;
    }

    var fila = document.createElement("div");
    fila.className = "plan-dia" + (min > 0 ? (restante >= -1 ? " plan-ok" : " plan-no") : "");

    var fecha = document.createElement("span");
    fecha.className = "plan-fecha";
    fecha.textContent = rhFechaCorta(iso);
    if (dl) {
      var tag = document.createElement("span");
      tag.className = "plan-tag";
      tag.textContent = "agendado";
      fecha.appendChild(tag);
    }
    fila.appendChild(fecha);

    var sel = document.createElement("select");
    sel.setAttribute("aria-label", "Ocupar el " + rhFormatDateDisplay(iso));
    rhPlanOpciones(dl).forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0];
      opt.textContent = o[1];
      sel.appendChild(opt);
    });
    sel.value = valor;
    sel.addEventListener("change", function () {
      rhPlan.elegidos[iso] = sel.value;
      renderArregloPlan();
    });
    fila.appendChild(sel);

    var estado = document.createElement("span");
    estado.className = "plan-estado";
    if (min > 0) {
      estado.textContent = restante >= -1 ? "✓ Te alcanza · quedan " + rhMinutesToHM(Math.max(0, restante))
        : "✗ No alcanza · faltan " + rhMinutesToHM(-restante);
    } else if (restante >= norma.completa.minutos) {
      estado.textContent = "Puedes ocuparlo completo";
    } else if (restante >= Math.min(norma.manana.minutos, norma.tarde.minutos)) {
      estado.textContent = "Te alcanza para " + (restante >= norma.manana.minutos ? "la mañana" : "la tarde");
    } else {
      estado.textContent = "Ya no te alcanzan las horas";
    }
    fila.appendChild(estado);
    lista.appendChild(fila);
  });

  if (!dias.length) {
    var vacio = document.createElement("p");
    vacio.className = "label-hint";
    vacio.textContent = "No hay días hábiles disponibles desde esa fecha.";
    lista.appendChild(vacio);
  }

  var totalEl = rhEl("plan-total");
  totalEl.className = "plan-total" + (elegidosN ? (restante >= -1 ? " plan-ok" : " plan-no") : "");
  totalEl.textContent = elegidosN
    ? "Días elegidos: " + elegidosN + " (" + rhMinutesToHM(elegidosMin) + "). " +
      (restante >= -1 ? "Te quedarían " + rhMinutesToHM(Math.max(0, restante)) + " a favor." : "No te alcanza: faltarían " + rhMinutesToHM(-restante) + ".")
    : "Disponibles: " + rhMinutesToHM(Math.max(0, base)) + ". Elige una opción en los días que quieras ocupar.";
  var agendar = rhEl("plan-agendar");
  agendar.disabled = cambios === 0;
  agendar.textContent = cambios ? "Agendar cambios (" + cambios + ")" : "Agendar días elegidos";
}

rhEl("plan-desde").addEventListener("change", function () {
  rhPlan.cantidad = 10;
  renderArregloPlan();
});

rhEl("plan-mas").addEventListener("click", function () {
  rhPlan.cantidad = Math.min(rhPlan.cantidad + 10, 40);
  renderArregloPlan();
});

rhEl("plan-agendar").addEventListener("click", function () {
  var cambios = [];
  var nuevos = 0;
  var quitados = 0;
  var minutos = 0;
  Object.keys(rhPlan.elegidos).forEach(function (iso) {
    var dl = rhDiaLibre(rhGetRegistroByFecha(iso));
    var valor = rhPlan.elegidos[iso];
    if (valor === rhPlanValorInicial(dl) || valor === "actual") return;
    if (!valor) {
      cambios.push({ fecha: iso, diaLibre: null });
      quitados++;
      return;
    }
    var nuevo = { jornada: valor, minutos: rhJornadasNorma()[valor].minutos };
    if (dl && dl.motivo) nuevo.motivo = dl.motivo;
    cambios.push({ fecha: iso, diaLibre: nuevo });
    nuevos++;
    minutos += nuevo.minutos;
  });
  if (!cambios.length) return;
  var texto = [];
  if (nuevos) texto.push("agendar " + rhPlural(nuevos, "día libre", "días libres") + " (" + rhMinutesToHM(minutos) + ")");
  if (quitados) texto.push("quitar " + rhPlural(quitados, "día agendado", "días agendados"));
  if (!confirm("¿" + texto.join(" y ").replace(/^./, function (c) { return c.toUpperCase(); }) + "?\n\n" +
    "Las horas se descuentan de tu saldo cuando llegue cada día. Puedes cambiarlo cuando quieras.")) return;
  rhGuardarDiasLibres(cambios);
  rhPlan.elegidos = {};
  rhShowAlert("Días libres actualizados.", "success");
  rhRefrescarVistas();
});

// ---- Lista de horas libres ocupadas y agendadas ----

function renderArregloLibres() {
  var ul = rhEl("arreglo-libres-lista");
  rhClear(ul);
  var hoy = rhTodayISO();
  var lista = rhDiasLibresLista().slice().reverse();
  if (!lista.length) {
    var vacio = document.createElement("li");
    vacio.className = "label-hint libres-vacio";
    vacio.textContent = "Todavía no ocupas horas libres. Usa “🌴 Ocupar horas libres” (aquí o en Marcaje) el día que no trabajes.";
    ul.appendChild(vacio);
    return;
  }
  lista.forEach(function (r) {
    var dl = rhDiaLibre(r);
    var li = document.createElement("li");
    var info = document.createElement("span");
    info.className = "libres-info";
    var fecha = document.createElement("strong");
    fecha.textContent = rhDayOfWeekLabel(r.fecha, true) + " " + rhFormatDateDisplay(r.fecha);
    info.appendChild(fecha);
    var det = document.createElement("span");
    det.textContent = rhDiaLibreTexto(dl) + (dl.motivo ? " · " + dl.motivo : "");
    info.appendChild(det);
    if (rhCompareISO(r.fecha, hoy) > 0) {
      var tag = document.createElement("span");
      tag.className = "plan-tag";
      tag.textContent = "agendado";
      fecha.appendChild(tag);
    }
    li.appendChild(info);
    var acciones = document.createElement("span");
    acciones.className = "row-actions";
    var cambiar = document.createElement("button");
    cambiar.type = "button";
    cambiar.className = "btn btn-small btn-secondary";
    cambiar.textContent = "Cambiar";
    cambiar.addEventListener("click", function () { rhAbrirOcuparLibre(r.fecha); });
    var quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "btn btn-small btn-danger";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", function () { rhQuitarDiaLibre(r.fecha); });
    acciones.appendChild(cambiar);
    acciones.appendChild(quitar);
    li.appendChild(acciones);
    ul.appendChild(li);
  });
}

rhEl("arreglo-ocupar-btn").addEventListener("click", function () {
  rhAbrirOcuparLibre(rhTodayISO());
});

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

// ---------- Datos del cálculo (contrato y horario normal) ----------

function renderArregloForm() {
  var config = rhLoadConfig();
  rhEl("arreglo-horas-base").value = config.metaSemanal;
  rhEl("arreglo-b1-entrada").value = config.horarioBase.bloque1.entrada || "";
  rhEl("arreglo-b1-salida").value = config.horarioBase.bloque1.salida || "";
  rhEl("arreglo-b2-entrada").value = config.horarioBase.bloque2.entrada || "";
  rhEl("arreglo-b2-salida").value = config.horarioBase.bloque2.salida || "";
  rhEl("arreglo-b2-activo").checked = !!config.bloque2Activo;

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
  var norma = rhJornadasNorma(config);
  rhEl("arreglo-unidad-explica").textContent = "Con este horario: mañana = " + rhMinutesToHM(norma.manana.minutos) +
    ", tarde = " + rhMinutesToHM(norma.tarde.minutos) + " y día completo = " + rhMinutesToHM(norma.completa.minutos) +
    ". Es lo que se descuenta al ocupar horas libres.";
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
    bloque2Activo: rhEl("arreglo-b2-activo").checked
  }));
  renderArreglo();
  // El formulario de Marcaje propone el nuevo horario (si no tiene cambios sin guardar).
  if (!rhMarcajeForm.sucio) rhMarcajeResetForm();
  rhShowAlert("Datos del cálculo guardados.", "success");
});
