"use strict";

// ---------- Tab: Estadísticas ----------
//
// Todo lo de esta pestaña se calcula para el mes elegido arriba (por defecto
// el mes en curso). Es información personal: no se informa a la jefatura.

var RH_COLOR_PRINCIPAL = "#5c2d82";
var RH_COLOR_VERDE = "#1f7a5c";
var RH_COLOR_ROJO = "#c0453c";
var RH_COLOR_PISTA = "#ece4f4";
var RH_COLOR_TEXTO_SUAVE = "#6b6478";

// Mes que muestra cada cuadro (independientes entre sí).
var RH_CUADROS_STATS = ["cuota", "revisar", "balance", "asistencia", "mas", "actividades"];
var rhStatsMeses = {};
RH_CUADROS_STATS.forEach(function (c) { rhStatsMeses[c] = rhMonthRange(rhTodayISO()).start; });
var rhStatsVista = rhPrefGet("rh_pref_asistencia_vista", "mes");
var rhStatsAlcanceActividades = rhPrefGet("rh_pref_actividades_alcance", "mes");
var rhStatsDiaElegido = null;

// Preferencias de vista (solo comodidad de este dispositivo).
function rhPrefGet(clave, porDefecto) {
  try {
    return localStorage.getItem(clave) || porDefecto;
  } catch (e) {
    return porDefecto;
  }
}

function rhPrefSet(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch (e) { /* sin almacenamiento: solo no se recuerda la vista */ }
}

function rhPlural(n, singular, plural) {
  return n + " " + (n === 1 ? singular : plural);
}

// "4h", "4h30", "45m": versión corta para celdas pequeñas del calendario.
function rhMinutosCorto(min) {
  var m = Math.round(min || 0);
  var h = Math.floor(m / 60);
  var mm = m % 60;
  if (h === 0) return mm + "m";
  return mm === 0 ? h + "h" : h + "h" + String(mm).padStart(2, "0");
}

function rhConSigno(min) {
  return (min > 0 ? "+" : min < 0 ? "−" : "") + rhMinutesToHM(Math.abs(min));
}

function rhNombreMes(iso, conAnio) {
  var d = rhParseISO(iso);
  return RH_MESES[d.getMonth()] + (conAnio ? " " + d.getFullYear() : "");
}

// Momento del mes elegido respecto de hoy: "pasado", "actual" o "futuro".
function rhMomentoMes(mesIso) {
  var actual = rhMonthRange(rhTodayISO()).start;
  if (mesIso === actual) return "actual";
  return rhCompareISO(mesIso, actual) < 0 ? "pasado" : "futuro";
}

// ---------- Gráficos circulares (SVG) ----------

function rhSvg(tag, attrs) {
  var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
  return el;
}

// Dona con segmentos de colores sobre un total, y texto al centro.
// opts: { segmentos: [{valor, color}], total, texto, subtexto, colorTexto, size }
function rhRenderDonut(container, opts) {
  var size = opts.size || 136;
  var grosor = opts.grosor || 14;
  var radio = (size - grosor) / 2;
  var circ = 2 * Math.PI * radio;
  var centro = size / 2;
  var svg = rhSvg("svg", { viewBox: "0 0 " + size + " " + size, width: size, height: size, role: "img" });
  if (opts.ariaLabel) svg.setAttribute("aria-label", opts.ariaLabel);

  svg.appendChild(rhSvg("circle", { cx: centro, cy: centro, r: radio, fill: "none", stroke: RH_COLOR_PISTA, "stroke-width": grosor }));

  var total = opts.total || 0;
  var avance = 0;
  if (total > 0) {
    opts.segmentos.forEach(function (seg) {
      if (!(seg.valor > 0)) return;
      var largo = circ * Math.min(1, seg.valor / total);
      if (largo <= 0.5) return;
      svg.appendChild(rhSvg("circle", {
        cx: centro, cy: centro, r: radio, fill: "none",
        stroke: seg.color, "stroke-width": grosor,
        "stroke-dasharray": largo + " " + (circ - largo),
        "stroke-dashoffset": -avance,
        transform: "rotate(-90 " + centro + " " + centro + ")"
      }));
      avance += largo;
    });
  }

  var t1 = rhSvg("text", {
    x: "50%", y: opts.subtexto ? "46%" : "50%", "text-anchor": "middle", "dominant-baseline": "middle",
    "font-size": opts.tamTexto || 19, "font-weight": "800", fill: opts.colorTexto || RH_COLOR_PRINCIPAL
  });
  t1.textContent = opts.texto;
  svg.appendChild(t1);

  if (opts.subtexto) {
    var t2 = rhSvg("text", {
      x: "50%", y: "62%", "text-anchor": "middle", "dominant-baseline": "middle",
      "font-size": 11, "font-weight": "600", fill: RH_COLOR_TEXTO_SUAVE
    });
    t2.textContent = opts.subtexto;
    svg.appendChild(t2);
  }

  rhClear(container);
  container.appendChild(svg);
}

// Dona de balance: la parte azul es lo esperado que sí se cumplió; la verde,
// lo trabajado de más (te deben); la roja, lo que falta (debes).
function rhRenderDonaBalance(container, b) {
  var cumplido = Math.min(b.trabajadoMin, b.esperadoMin);
  var resto = Math.abs(b.balanceMin);
  var favor = b.balanceMin > 1;
  var contra = b.balanceMin < -1;
  var sinDatos = b.trabajadoMin === 0 && b.esperadoMin === 0;
  rhRenderDonut(container, {
    total: Math.max(b.trabajadoMin, b.esperadoMin),
    segmentos: [
      { valor: cumplido, color: RH_COLOR_PRINCIPAL },
      { valor: favor || contra ? resto : 0, color: favor ? RH_COLOR_VERDE : RH_COLOR_ROJO }
    ],
    texto: sinDatos ? "—" : rhConSigno(b.balanceMin),
    subtexto: sinDatos ? "sin datos" : favor ? "te deben" : contra ? "debes" : "al día",
    colorTexto: favor ? RH_COLOR_VERDE : contra ? RH_COLOR_ROJO : RH_COLOR_PRINCIPAL,
    tamTexto: 17,
    size: 124,
    ariaLabel: "Balance " + rhConSigno(b.balanceMin)
  });
}

// ---- Helpers de balance (a favor / en contra / al día) ----

function rhBalanceTagClass(balanceMin) {
  if (balanceMin > 1) return "favor";
  if (balanceMin < -1) return "contra";
  return "neutro";
}

function rhBalanceTagLabel(balanceMin, corto) {
  if (balanceMin > 1) return corto ? "A favor" : "Horas a favor (te deben)";
  if (balanceMin < -1) return corto ? "En contra" : "Horas en contra (debes)";
  return "Al día";
}

// ---------- Render principal ----------

var RH_RENDER_CUADRO = {
  cuota: function (mes) { rhStatsRenderCuota(mes); },
  revisar: function (mes) { rhStatsRenderRevisar(mes); },
  balance: function (mes) { rhStatsRenderBalance(mes); },
  asistencia: function (mes) { rhStatsRenderAsistencia(mes); },
  mas: function (mes) { rhStatsRenderMasEstadisticas(mes); },
  actividades: function (mes) { rhStatsRenderActividades(mes); }
};

function renderEstadisticas() {
  RH_CUADROS_STATS.forEach(function (c) {
    rhStatsRenderNav(c);
    RH_RENDER_CUADRO[c](rhStatsMeses[c]);
  });
}

function rhStatsCambiarMes(cuadro, nuevoMes) {
  rhStatsMeses[cuadro] = rhMonthRange(nuevoMes).start;
  if (cuadro === "asistencia") rhStatsDiaElegido = null;
  rhStatsRenderNav(cuadro);
  RH_RENDER_CUADRO[cuadro](rhStatsMeses[cuadro]);
}

function rhStatsMoverMes(cuadro, delta) {
  var d = rhParseISO(rhStatsMeses[cuadro]);
  d.setMonth(d.getMonth() + delta);
  rhStatsCambiarMes(cuadro, rhDateToISO(d));
}

// Selector ◀ Mes Año ▶ de un cuadro (con "volver al mes actual" si hace falta).
function rhStatsRenderNav(cuadro) {
  var cont = rhEl("nav-mes-" + cuadro);
  var mes = rhStatsMeses[cuadro];
  rhClear(cont);

  var prev = document.createElement("button");
  prev.type = "button";
  prev.className = "btn btn-icon nav-mes-btn";
  prev.textContent = "◀";
  prev.setAttribute("aria-label", "Mes anterior");
  prev.addEventListener("click", function () { rhStatsMoverMes(cuadro, -1); });

  var centro = document.createElement("div");
  centro.className = "nav-mes-centro";
  var nombre = document.createElement("span");
  nombre.className = "nav-mes-nombre";
  nombre.textContent = rhNombreMes(mes, true);
  centro.appendChild(nombre);
  if (mes !== rhMonthRange(rhTodayISO()).start) {
    var hoy = document.createElement("button");
    hoy.type = "button";
    hoy.className = "btn-link";
    hoy.textContent = "Volver al mes actual";
    hoy.addEventListener("click", function () { rhStatsCambiarMes(cuadro, rhTodayISO()); });
    centro.appendChild(hoy);
  }

  var next = document.createElement("button");
  next.type = "button";
  next.className = "btn btn-icon nav-mes-btn";
  next.textContent = "▶";
  next.setAttribute("aria-label", "Mes siguiente");
  next.addEventListener("click", function () { rhStatsMoverMes(cuadro, 1); });

  cont.appendChild(prev);
  cont.appendChild(centro);
  cont.appendChild(next);
}

// ---------- Cuota del mes ----------

// Cuántos días hábiles tiene el mes y por qué se descuentan algunos, para
// mostrar el cálculo de la cuota paso a paso.
function rhStatsDesgloseCuota(range) {
  var config = rhLoadConfig();
  var inicio = rhBalanceStartDate();
  var d = { habiles: 0, antes: 0, sinContrato: 0, feriados: 0, noConvocados: 0, licencias: 0, conMeta: 0 };
  rhDaysBetweenInclusive(range.start, range.end).forEach(function (iso) {
    if (!rhEsDiaLaboral(iso, config)) return;
    d.habiles++;
    if (rhCompareISO(iso, inicio) < 0) { d.antes++; return; }
    if (!rhDiaAjustaMeta(iso)) { d.conMeta++; return; }
    var lic = rhLicenciaForDate(iso);
    var reg = rhGetRegistroByFecha(iso);
    if (lic && rhLicenciaAjustaMeta(lic)) {
      if (lic.tipo === "feriado") d.feriados++;
      else if (lic.tipo === "no_convocado") d.noConvocados++;
      else d.licencias++;
    } else if (reg && reg.estado === RH_ESTADO_NO_CONTRATADO) {
      d.sinContrato++;
    } else {
      d.noConvocados++;
    }
  });
  return d;
}

function rhStatsRenderCuota(mes) {
  var config = rhLoadConfig();
  var range = rhMonthRange(mes);
  var momento = rhMomentoMes(mes);
  var metaMin = rhMetaMensualAjustada(mes);
  var trabajadoMin = rhWorkedMinutesInRange(range.start, range.end);
  var pct = metaMin > 0 ? (trabajadoMin / metaMin) * 100 : 0;
  var cumplida = metaMin > 0 && trabajadoMin >= metaMin;

  rhRenderDonut(rhEl("stats-gauge-mes"), {
    total: metaMin,
    segmentos: [{ valor: Math.min(trabajadoMin, metaMin), color: cumplida ? RH_COLOR_VERDE : RH_COLOR_PRINCIPAL }],
    texto: metaMin > 0 ? Math.round(pct) + "%" : "—",
    subtexto: "de la cuota",
    colorTexto: cumplida ? RH_COLOR_VERDE : RH_COLOR_PRINCIPAL,
    size: 128,
    ariaLabel: Math.round(pct) + "% de la cuota"
  });

  rhEl("stats-hero-meta").textContent = rhMinutesToHM(metaMin);
  rhEl("stats-hero-trabajado").textContent = rhMinutesToHM(trabajadoMin);
  var faltanMin = Math.max(0, metaMin - trabajadoMin);
  var fila = rhEl("stats-hero-faltan-fila");
  if (cumplida) {
    rhEl("stats-hero-faltan-label").textContent = "Horas extra";
    rhEl("stats-hero-faltan").textContent = "+" + rhMinutesToHM(trabajadoMin - metaMin);
    fila.classList.add("hero-figure-extra");
  } else {
    rhEl("stats-hero-faltan-label").textContent = "Me faltan";
    rhEl("stats-hero-faltan").textContent = rhMinutesToHM(faltanMin);
    fila.classList.remove("hero-figure-extra");
  }

  // El cálculo, paso a paso: días hábiles − días que no cuentan = días con
  // meta × horas por día.
  var d = rhStatsDesgloseCuota(range);
  var metaDiaria = rhMetaDiariaMinutos(config);
  var partes = [];
  if (d.antes) partes.push(rhPlural(d.antes, "antes de tu inicio", "antes de tu inicio"));
  if (d.sinContrato) partes.push(rhPlural(d.sinContrato, "aún no contratado", "aún no contratado"));
  if (d.feriados) partes.push(rhPlural(d.feriados, "feriado", "feriados"));
  if (d.noConvocados) partes.push(rhPlural(d.noConvocados, "no convocado", "no convocados"));
  if (d.licencias) partes.push(rhPlural(d.licencias, "con licencia", "con licencia"));
  var explica = rhEl("stats-hero-explica");
  if (d.habiles === 0) {
    explica.textContent = "Este mes no tiene días hábiles según tu configuración.";
  } else {
    explica.textContent = "Cálculo: " + rhPlural(d.habiles, "día hábil", "días hábiles") +
      (partes.length ? " − " + partes.join(" − ") + " = " + rhPlural(d.conMeta, "día", "días") : "") +
      " × " + rhMinutesToHM(metaDiaria).replace(" 00m", "") + " = " + rhMinutesToHM(metaMin) + ".";
  }

  var ritmoEl = rhEl("stats-hero-ritmo");
  rhClear(ritmoEl);
  ritmoEl.classList.remove("hidden");

  if (momento === "futuro") {
    var f = document.createElement("span");
    f.className = "hero-ritmo-ok";
    f.textContent = "Mes futuro: aún no hay horas. Si sabes de feriados o días sin convocatoria, márcalos y la cuota se ajusta sola.";
    ritmoEl.appendChild(f);
    return;
  }

  if (momento === "pasado") {
    var p = document.createElement("span");
    p.className = "hero-ritmo-ok";
    p.textContent = metaMin > 0
      ? "Mes cerrado: cumpliste el " + Math.round(pct) + "% de la cuota (" + rhConSigno(trabajadoMin - metaMin) + ")."
      : "Mes cerrado sin horas esperadas.";
    ritmoEl.appendChild(p);
    return;
  }

  if (faltanMin <= 0) {
    var ok = document.createElement("span");
    ok.className = "hero-ritmo-ok";
    ok.textContent = "🎉 Ya cumpliste la cuota de horas de " + rhNombreMes(mes).toLowerCase() + ".";
    ritmoEl.appendChild(ok);
    return;
  }

  // Ritmo necesario para cumplir lo que falta antes de fin de mes, contando
  // solo los días hábiles que todavía tienen meta (sin feriados ni licencias).
  var today = rhTodayISO();
  var diasRestantesMes = rhDaysBetweenInclusive(today, range.end).length;
  var semanasRestantes = Math.max(1, Math.ceil(diasRestantesMes / 7));
  var diasHabilesRestantes = rhDaysBetweenInclusive(today, range.end).filter(function (iso) {
    return rhMinutosEsperadosDia(iso, config) > 0;
  }).length;

  var titulo = document.createElement("span");
  titulo.className = "hero-ritmo-title";
  titulo.textContent = "Para cumplir lo que falta:";
  ritmoEl.appendChild(titulo);

  var ul = document.createElement("ul");
  ul.className = "hero-ritmo-list";

  var liSemana = document.createElement("li");
  liSemana.className = "hero-ritmo-item ritmo-semana";
  liSemana.innerHTML = "<strong>~" + rhMinutesToHM(faltanMin / semanasRestantes) + "</strong> por semana " +
    "<em>(quedan " + rhPlural(semanasRestantes, "semana", "semanas") + ")</em>";
  ul.appendChild(liSemana);

  var liDia = document.createElement("li");
  liDia.className = "hero-ritmo-item ritmo-dia";
  if (diasHabilesRestantes > 0) {
    liDia.innerHTML = "<strong>~" + rhMinutesToHM(faltanMin / diasHabilesRestantes) + "</strong> por día " +
      "<em>(quedan " + rhPlural(diasHabilesRestantes, "día hábil", "días hábiles") + ")</em>";
  } else {
    liDia.innerHTML = "<em>No quedan días hábiles en el mes.</em>";
  }
  ul.appendChild(liDia);
  ritmoEl.appendChild(ul);
}

// ---------- Por revisar ----------

function rhStatsMarcarFeriado(iso, nombre) {
  rhUpsertLicencia({ id: null, fechaInicio: iso, fechaFin: iso, tipo: "feriado", detalle: nombre, ajustaMeta: true });
  rhShowAlert("El " + rhFormatDateDisplay(iso) + " quedó marcado como feriado (" + nombre + ").", "success");
  renderEstadisticas();
}

function rhStatsBoton(texto, clase, alTocar) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-small " + clase;
  b.textContent = texto;
  b.addEventListener("click", alTocar);
  return b;
}

function rhStatsRenderRevisar(mes) {
  var range = rhMonthRange(mes);
  var items = rhDiasPorRevisar(range.start, range.end);
  var section = rhEl("stats-revisar-section");
  var ul = rhEl("stats-revisar-list");
  rhClear(ul);
  section.classList.toggle("revisar-ok", items.length === 0);
  rhEl("stats-revisar-count").textContent = items.length ? "(" + items.length + ")" : "";
  rhEl("stats-revisar-hint").classList.toggle("hidden", items.length === 0);
  if (items.length === 0) {
    var ok = document.createElement("li");
    ok.className = "revisar-vacio";
    ok.textContent = "✅ Todo en orden en " + rhNombreMes(mes).toLowerCase() + ": no hay días pendientes de revisar.";
    ul.appendChild(ok);
    return;
  }

  var metaDiaria = rhMinutesToHM(rhMetaDiariaMinutos(rhLoadConfig())).replace(" 00m", "");
  var today = rhTodayISO();

  items.forEach(function (it) {
    var li = document.createElement("li");
    li.className = "revisar-item revisar-" + it.tipo;
    var fecha = rhDayOfWeekLabel(it.iso, true) + " " + rhFormatDateDisplay(it.iso);

    var texto = document.createElement("div");
    texto.className = "revisar-texto";
    var strong = document.createElement("strong");
    strong.textContent = fecha;
    texto.appendChild(strong);
    var detalle = document.createElement("span");

    var acciones = document.createElement("div");
    acciones.className = "revisar-acciones";

    if (it.tipo === "feriado") {
      var futuro = rhCompareISO(it.iso, today) > 0;
      detalle.textContent = "Feriado nacional (" + it.nombre + ") sin marcar: " +
        (futuro ? "si no lo marcas, se contará en tu cuota como día a trabajar." : "hoy cuenta como día que debías trabajar (" + metaDiaria + ").");
      acciones.appendChild(rhStatsBoton("Marcar feriado", "btn-rojo", function () { rhStatsMarcarFeriado(it.iso, it.nombre); }));
    } else if (it.tipo === "conflicto") {
      detalle.textContent = "Tiene " + rhMinutesToHM(it.minutos) + " registradas, pero está dentro de “" +
        rhTipoLicenciaLabel(it.licencia.tipo) + "” (" + rhFormatDateDisplay(it.licencia.fechaInicio) + " al " +
        rhFormatDateDisplay(it.licencia.fechaFin) + "). ¿Esas horas son de otro día? Si sí trabajaste ese día, sácalo del período en Licencias.";
      acciones.appendChild(rhStatsBoton("Ver jornada", "btn-secondary", function () { rhMarcajeAbrirFecha(it.iso); }));
      acciones.appendChild(rhStatsBoton("Ver período", "btn-secondary", function () {
        rhActivateTab("licencias");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }));
    } else {
      detalle.textContent = "Día hábil sin registro: cuenta como " + metaDiaria + " que debes. Si trabajaste, regístralo; si no te convocaron, márcalo.";
      acciones.appendChild(rhStatsBoton("Registrar", "btn-secondary", function () { rhMarcajeAbrirFecha(it.iso); }));
      acciones.appendChild(rhStatsBoton("No me convocaron", "btn-secondary", function () {
        rhLicenciaPrefillNoConvocado(it.iso);
        rhActivateTab("licencias");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }));
    }
    texto.appendChild(detalle);
    li.appendChild(texto);
    li.appendChild(acciones);
    ul.appendChild(li);
  });
}

// ---------- Balance (por mes calendario, hasta hoy) ----------

// Balance de cada mes desde el inicio del seguimiento hasta el mes en curso.
function rhStatsBalancesPorMes() {
  var hoyMes = rhMonthRange(rhTodayISO()).start;
  var mes = rhMonthRange(rhBalanceStartDate()).start;
  var filas = [];
  var guard = 0;
  while (rhCompareISO(mes, hoyMes) <= 0 && guard < 120) {
    filas.push({ mes: mes, b: rhBalanceMes(mes) });
    var d = rhParseISO(mes);
    d.setMonth(d.getMonth() + 1);
    mes = rhDateToISO(d);
    guard++;
  }
  return filas;
}

function rhStatsRenderBalance(mes) {
  var momento = rhMomentoMes(mes);
  var range = rhMonthRange(mes);
  var b = rhBalanceMes(mes);
  rhEl("stats-balance-mes-titulo").textContent = "Balance de " + rhNombreMes(mes).toLowerCase();
  rhRenderDonaBalance(rhEl("stats-balance-mes-donut"), b);

  var tag = rhEl("stats-balance-mes-tag");
  var sub = rhEl("stats-balance-mes-sub");
  if (momento === "futuro" || (b.esperadoMin === 0 && b.trabajadoMin === 0)) {
    tag.className = "balance-tag neutro";
    tag.textContent = momento === "futuro" ? "Mes futuro" : "Sin horas aún";
    sub.textContent = "";
  } else {
    tag.className = "balance-tag " + rhBalanceTagClass(b.balanceMin);
    tag.textContent = rhBalanceTagLabel(b.balanceMin, false);
    var hastaTxt = momento === "actual"
      ? "Del 1 al " + rhParseISO(b.hasta).getDate() + " de " + rhNombreMes(mes).toLowerCase() + " (hasta hoy)"
      : "Del " + rhFormatDateShort(b.desde) + " al " + rhFormatDateShort(range.end);
    sub.textContent = hastaTxt + ": trabajaste " + rhMinutesToHM(b.trabajadoMin) + " de " + rhMinutesToHM(b.esperadoMin) + " esperadas.";
  }

  var acum = rhCalcularBalance();
  rhRenderDonaBalance(rhEl("stats-balance-acum-donut"), acum);
  var tagA = rhEl("stats-balance-acum-tag");
  tagA.className = "balance-tag " + rhBalanceTagClass(acum.balanceMin);
  tagA.textContent = rhBalanceTagLabel(acum.balanceMin, false);
  rhEl("stats-balance-acum-sub").textContent = "Desde el " + rhFormatDateDisplay(acum.desde) + " hasta hoy: " +
    rhMinutesToHM(acum.trabajadoMin) + " de " + rhMinutesToHM(acum.esperadoMin) + " esperadas. Es la suma de todos los meses.";

  rhEl("stats-balance-explica").textContent = "Se calcula por mes calendario (del 1 al último día). " +
    "En el mes en curso cuenta solo hasta hoy, para que no aparezca como deuda lo que todavía no ocurre. " +
    "Trabajas a honorario: es solo una referencia personal.";

  var filas = rhStatsBalancesPorMes();
  rhStatsRenderDonaMeses(filas);
  rhStatsRenderDonaDias(mes);
  rhStatsRenderHistoria(filas);
}

// Cuántas horas te deben los meses a favor y cuántas debes en los meses en
// contra, por separado (el acumulado es la diferencia entre ambas).
function rhStatsRenderDonaMeses(filas) {
  var favor = 0;
  var contra = 0;
  var mesesFavor = [];
  var mesesContra = [];
  filas.forEach(function (f) {
    var nombre = RH_MESES_ABREV[rhParseISO(f.mes).getMonth()];
    if (f.b.balanceMin > 1) { favor += f.b.balanceMin; mesesFavor.push(nombre); }
    else if (f.b.balanceMin < -1) { contra -= f.b.balanceMin; mesesContra.push(nombre); }
  });
  rhRenderDonut(rhEl("stats-balance-meses-donut"), {
    total: favor + contra,
    segmentos: [{ valor: favor, color: RH_COLOR_VERDE }, { valor: contra, color: RH_COLOR_ROJO }],
    texto: mesesFavor.length + " / " + mesesContra.length,
    subtexto: "favor / contra",
    tamTexto: 18,
    size: 124,
    ariaLabel: mesesFavor.length + " meses a favor y " + mesesContra.length + " en contra"
  });
  rhEl("stats-balance-meses-sub").textContent =
    "Te deben " + rhMinutesToHM(favor) + (mesesFavor.length ? " (" + mesesFavor.join(", ") + ")" : "") +
    " · Debes " + rhMinutesToHM(contra) + (mesesContra.length ? " (" + mesesContra.join(", ") + ")" : "") + ".";
}

// Días hábiles del mes: cuáles se trabajaron, cuáles no contaban (feriado, no
// convocado, licencia) y cuáles quedaron sin registro (esos son los que
// generan horas en contra).
function rhStatsRenderDonaDias(mes) {
  var config = rhLoadConfig();
  var today = rhTodayISO();
  var c = { trabajados: 0, justificados: 0, sinRegistro: 0, proximos: 0 };
  rhDaysBetweenInclusive(rhMonthRange(mes).start, rhMonthRange(mes).end).forEach(function (iso) {
    var e = rhEstadoDia(iso, config, today);
    if (!e.laboral || e.clave === "fuera") return;
    if (e.clave === "cumplido") c.trabajados++;
    else if (e.clave === "sin_registro") c.sinRegistro++;
    else if (e.clave === "futuro" || e.clave === "hoy") c.proximos++;
    else c.justificados++;
  });
  var total = c.trabajados + c.justificados + c.sinRegistro + c.proximos;
  rhEl("stats-balance-dias-titulo").textContent = "Días hábiles de " + rhNombreMes(mes).toLowerCase();
  rhRenderDonut(rhEl("stats-balance-dias-donut"), {
    total: total,
    segmentos: [
      { valor: c.trabajados, color: RH_COLOR_VERDE },
      { valor: c.justificados, color: "#d99a1e" },
      { valor: c.sinRegistro, color: RH_COLOR_ROJO }
    ],
    texto: total ? c.trabajados + "/" + total : "—",
    subtexto: "trabajados",
    tamTexto: 18,
    size: 124,
    ariaLabel: c.trabajados + " de " + total + " días hábiles trabajados"
  });
  var partes = [rhPlural(c.trabajados, "trabajado", "trabajados")];
  if (c.justificados) partes.push(c.justificados + " sin convocatoria/feriado");
  if (c.sinRegistro) partes.push(rhPlural(c.sinRegistro, "sin registro", "sin registro"));
  if (c.proximos) partes.push(rhPlural(c.proximos, "por venir", "por venir"));
  rhEl("stats-balance-dias-sub").textContent = partes.join(" · ") + ".";
}

// Barras divergentes con el balance de cada mes, desde el inicio hasta hoy.
function rhStatsRenderHistoria(filas) {
  var cont = rhEl("stats-balance-historia");
  rhClear(cont);
  var hoyMes = rhMonthRange(rhTodayISO()).start;
  if (filas.length === 0) {
    cont.textContent = "Aún no hay meses con registros.";
    return;
  }
  var maxAbs = filas.reduce(function (m, f) { return Math.max(m, Math.abs(f.b.balanceMin)); }, 0) || 1;

  filas.forEach(function (f) {
    var fila = document.createElement("button");
    fila.type = "button";
    fila.className = "hist-fila" + (f.mes === rhStatsMeses.balance ? " elegido" : "");
    fila.setAttribute("aria-label", rhNombreMes(f.mes, true) + ": " + rhConSigno(f.b.balanceMin));

    var etiqueta = document.createElement("span");
    etiqueta.className = "hist-mes";
    var dm = rhParseISO(f.mes);
    etiqueta.textContent = RH_MESES_ABREV[dm.getMonth()] + " " + String(dm.getFullYear()).slice(2) + (f.mes === hoyMes ? "*" : "");
    fila.appendChild(etiqueta);

    var barra = document.createElement("span");
    barra.className = "hist-barra";
    var neg = document.createElement("span");
    neg.className = "hist-mitad hist-neg";
    var pos = document.createElement("span");
    pos.className = "hist-mitad hist-pos";
    var relleno = document.createElement("i");
    var pctAncho = Math.max(2, Math.round((Math.abs(f.b.balanceMin) / maxAbs) * 100));
    relleno.style.width = pctAncho + "%";
    if (f.b.balanceMin < 0) neg.appendChild(relleno);
    else pos.appendChild(relleno);
    barra.appendChild(neg);
    barra.appendChild(pos);
    fila.appendChild(barra);

    var valor = document.createElement("span");
    valor.className = "hist-valor " + rhBalanceTagClass(f.b.balanceMin);
    valor.textContent = rhConSigno(f.b.balanceMin);
    fila.appendChild(valor);

    fila.addEventListener("click", function () { rhStatsCambiarMes("balance", f.mes); });
    cont.appendChild(fila);
  });

  var nota = document.createElement("p");
  nota.className = "label-hint hist-nota";
  nota.textContent = "* mes en curso, contado hasta hoy.";
  cont.appendChild(nota);
}

// ---------- Asistencia: Mes (calendario) / Semana / Día ----------

function rhStatsRenderAsistencia(mes) {
  rhEl("stats-asistencia-vista").querySelectorAll(".segmented-btn").forEach(function (b) {
    var activo = b.getAttribute("data-vista") === rhStatsVista;
    b.classList.toggle("activo", activo);
    b.setAttribute("aria-selected", activo ? "true" : "false");
  });
  var body = rhEl("stats-asistencia-body");
  rhClear(body);
  if (rhStatsVista === "semana") rhStatsVistaSemanas(body, mes);
  else if (rhStatsVista === "dia") rhStatsVistaDias(body, mes);
  else rhStatsVistaCalendario(body, mes);
}

rhEl("stats-asistencia-vista").addEventListener("click", function (e) {
  var b = e.target.closest(".segmented-btn");
  if (!b) return;
  rhStatsVista = b.getAttribute("data-vista");
  rhPrefSet("rh_pref_asistencia_vista", rhStatsVista);
  rhStatsRenderAsistencia(rhStatsMeses.asistencia);
});

function rhStatsPill(estado) {
  var pill = document.createElement("span");
  pill.className = "status-pill est-" + estado.clave;
  pill.textContent = estado.label;
  return pill;
}

var RH_LEYENDA_ESTADOS = [
  { clave: "cumplido", label: "Trabajado" },
  { clave: "no_convocado", label: "No convocado" },
  { clave: "feriado", label: "Feriado" },
  { clave: "no_laboral", label: "Fin de semana" },
  { clave: "licencia", label: "Licencia" },
  { clave: "sin_registro", label: "Sin registro" },
  { clave: "sin_contrato", label: "Aún no contratado" }
];

function rhStatsVistaCalendario(body, mes) {
  var config = rhLoadConfig();
  var today = rhTodayISO();
  var range = rhMonthRange(mes);
  var dias = rhDaysBetweenInclusive(range.start, range.end);

  var cal = document.createElement("div");
  cal.className = "cal";
  ["L", "M", "M", "J", "V", "S", "D"].forEach(function (l, i) {
    var h = document.createElement("span");
    h.className = "cal-cab" + (i >= 5 ? " rojo" : "");
    h.textContent = l;
    cal.appendChild(h);
  });

  var offset = (rhParseISO(range.start).getDay() + 6) % 7;
  for (var i = 0; i < offset; i++) {
    var vacio = document.createElement("span");
    vacio.className = "cal-vacio";
    cal.appendChild(vacio);
  }

  var conteo = {};
  dias.forEach(function (iso) {
    var e = rhEstadoDia(iso, config, today);
    conteo[e.clave] = (conteo[e.clave] || 0) + 1;

    var celda = document.createElement("button");
    celda.type = "button";
    celda.className = "cal-dia est-" + e.clave + (e.rojo ? " rojo" : "") +
      (iso === today ? " es-hoy" : "") + (iso === rhStatsDiaElegido ? " elegido" : "");
    celda.setAttribute("aria-label", rhFormatDateDisplay(iso) + ": " + e.label + (e.minutos ? ", " + rhMinutesToHM(e.minutos) : ""));

    var num = document.createElement("span");
    num.className = "cal-num";
    num.textContent = rhParseISO(iso).getDate();
    celda.appendChild(num);

    var info = document.createElement("span");
    info.className = "cal-info";
    if (e.minutos > 0) info.textContent = rhMinutosCorto(e.minutos);
    else if (e.clave === "feriado") info.textContent = "Fer.";
    else if (e.clave === "no_convocado") info.textContent = "N/C";
    else if (e.clave === "licencia") info.textContent = "Lic.";
    else if (e.clave === "sin_registro") info.textContent = "?";
    celda.appendChild(info);
    if (e.conflicto) {
      var alerta = document.createElement("span");
      alerta.className = "cal-alerta";
      alerta.textContent = "!";
      celda.appendChild(alerta);
    }

    celda.addEventListener("click", function () {
      rhStatsDiaElegido = iso;
      cal.querySelectorAll(".cal-dia.elegido").forEach(function (c) { c.classList.remove("elegido"); });
      celda.classList.add("elegido");
      rhStatsRenderDetalleDia(detalle, iso);
    });
    cal.appendChild(celda);
  });
  body.appendChild(cal);

  var detalle = document.createElement("div");
  detalle.className = "cal-detalle";
  body.appendChild(detalle);
  if (rhStatsDiaElegido && rhIsDateInRange(rhStatsDiaElegido, range.start, range.end)) {
    rhStatsRenderDetalleDia(detalle, rhStatsDiaElegido);
  } else {
    detalle.innerHTML = '<span class="label-hint">Toca un día para ver su detalle.</span>';
  }

  var resumen = document.createElement("div");
  resumen.className = "cal-resumen";
  RH_LEYENDA_ESTADOS.forEach(function (l) {
    if (!conteo[l.clave] && ["cumplido", "no_convocado", "feriado", "sin_registro"].indexOf(l.clave) === -1) return;
    var item = document.createElement("span");
    item.className = "cal-ley";
    var muestra = document.createElement("i");
    muestra.className = "cal-muestra est-" + l.clave;
    item.appendChild(muestra);
    item.appendChild(document.createTextNode(l.label + ": " + (conteo[l.clave] || 0)));
    resumen.appendChild(item);
  });
  body.appendChild(resumen);
}

function rhStatsRenderDetalleDia(cont, iso) {
  var e = rhEstadoDia(iso);
  rhClear(cont);

  var cab = document.createElement("div");
  cab.className = "cal-detalle-cab";
  var titulo = document.createElement("strong");
  titulo.textContent = rhDayOfWeekLabel(iso, false) + " " + rhFormatDateDisplay(iso);
  if (e.rojo) titulo.className = "texto-rojo";
  cab.appendChild(titulo);
  cab.appendChild(rhStatsPill(e));
  cont.appendChild(cab);

  var lineas = [];
  if (e.minutos > 0) lineas.push(rhMinutesToHM(e.minutos) + " · " + rhFormatJornadasRegistro(e.registro));
  if (e.licencia) {
    lineas.push(rhTipoLicenciaLabel(e.licencia.tipo) + (e.licencia.detalle ? ": " + e.licencia.detalle : "") +
      (e.licencia.fechaInicio !== e.licencia.fechaFin
        ? " (del " + rhFormatDateDisplay(e.licencia.fechaInicio) + " al " + rhFormatDateDisplay(e.licencia.fechaFin) + ")"
        : ""));
  }
  if (!e.licencia && RH_FERIADOS_CHILE[iso]) lineas.push("Feriado nacional: " + RH_FERIADOS_CHILE[iso] + " (sin marcar)");
  lineas.forEach(function (t) {
    var p = document.createElement("p");
    p.textContent = t;
    cont.appendChild(p);
  });

  var acts = rhRegistroActividades(e.registro);
  if (acts.length) cont.appendChild(rhEtiquetasActividades(acts));
  if (e.registro && e.registro.nota) {
    var nota = document.createElement("p");
    nota.className = "label-hint";
    nota.textContent = "Nota: " + e.registro.nota;
    cont.appendChild(nota);
  }
  if (e.conflicto) {
    var aviso = document.createElement("p");
    aviso.className = "cal-aviso";
    aviso.textContent = "⚠️ Tiene horas registradas pero está dentro de un período “" + rhTipoLicenciaLabel(e.licencia.tipo) + "”. Revísalo en “Por revisar”.";
    cont.appendChild(aviso);
  }

  var abrir = rhStatsBoton(e.registro ? "Abrir en Marcaje" : "Registrar este día", "btn-secondary", function () { rhMarcajeAbrirFecha(iso); });
  cont.appendChild(abrir);
}

// Semanas (lunes a domingo) del mes, recortadas a los días del mes.
function rhGroupMonthByWeek(monthRange) {
  var groups = [];
  var porInicio = {};
  rhDaysBetweenInclusive(monthRange.start, monthRange.end).forEach(function (iso) {
    var wr = rhWeekRange(iso);
    if (!porInicio[wr.start]) {
      porInicio[wr.start] = { weekStart: wr.start, weekEnd: wr.end, dias: [] };
      groups.push(porInicio[wr.start]);
    }
    porInicio[wr.start].dias.push(iso);
  });
  return groups;
}

function rhStatsVistaSemanas(body, mes) {
  var config = rhLoadConfig();
  var today = rhTodayISO();
  var groups = rhGroupMonthByWeek(rhMonthRange(mes));
  var lista = document.createElement("div");
  lista.className = "semanas";

  groups.forEach(function (g, idx) {
    var primero = g.dias[0];
    var ultimo = g.dias[g.dias.length - 1];
    var metaMin = 0;
    var trabajadoMin = 0;
    g.dias.forEach(function (iso) {
      metaMin += rhMinutosEsperadosDia(iso, config);
      trabajadoMin += rhRegistroMinutes(rhGetRegistroByFecha(iso));
    });
    var estado = rhCompareISO(ultimo, today) < 0 ? "pasada" : rhCompareISO(primero, today) > 0 ? "futura" : "actual";
    var pct = metaMin > 0 ? Math.round((trabajadoMin / metaMin) * 100) : null;

    var fila = document.createElement("div");
    fila.className = "semana-fila" + (estado === "actual" ? " actual" : "");

    var top = document.createElement("div");
    top.className = "semana-top";
    var titulo = document.createElement("strong");
    titulo.textContent = "Semana " + (idx + 1);
    top.appendChild(titulo);
    var rango = document.createElement("span");
    rango.className = "semana-rango";
    rango.textContent = rhParseISO(primero).getDate() + (primero !== ultimo ? "–" + rhParseISO(ultimo).getDate() : "") +
      " " + RH_MESES_ABREV[rhParseISO(primero).getMonth()];
    top.appendChild(rango);
    var tag = document.createElement("span");
    if (estado === "actual") {
      tag.className = "balance-tag neutro";
      tag.textContent = "En curso";
    } else if (estado === "futura") {
      tag.className = "balance-tag neutro";
      tag.textContent = "Próxima";
    } else if (metaMin === 0 && trabajadoMin === 0) {
      tag.className = "balance-tag neutro";
      tag.textContent = "Sin meta";
    } else {
      tag.className = "balance-tag " + rhBalanceTagClass(trabajadoMin - metaMin);
      tag.textContent = rhConSigno(trabajadoMin - metaMin);
    }
    top.appendChild(tag);
    fila.appendChild(top);

    var barra = document.createElement("div");
    barra.className = "progreso";
    var relleno = document.createElement("span");
    relleno.style.width = Math.min(100, pct || 0) + "%";
    if (pct !== null && pct >= 100) relleno.className = "completo";
    barra.appendChild(relleno);
    fila.appendChild(barra);

    var pie = document.createElement("div");
    pie.className = "semana-pie";
    var horas = document.createElement("span");
    horas.textContent = rhMinutesToHM(trabajadoMin) + " de " + rhMinutesToHM(metaMin);
    pie.appendChild(horas);
    var pctEl = document.createElement("strong");
    pctEl.textContent = pct === null ? "—" : pct + "%";
    pie.appendChild(pctEl);
    fila.appendChild(pie);

    lista.appendChild(fila);
  });
  body.appendChild(lista);
}

function rhStatsVistaDias(body, mes) {
  var config = rhLoadConfig();
  var today = rhTodayISO();
  var range = rhMonthRange(mes);
  var wrap = document.createElement("div");
  wrap.className = "table-wrap";
  var table = document.createElement("table");
  table.className = "data-table tabla-dias";
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  ["Día", "Fecha", "Horas", "Estado"].forEach(function (t) {
    var th = document.createElement("th");
    th.textContent = t;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");
  rhDaysBetweenInclusive(range.start, range.end).forEach(function (iso) {
    var e = rhEstadoDia(iso, config, today);
    var tr = document.createElement("tr");
    tr.className = rhClaseFilaDia(e);

    var tdDia = document.createElement("td");
    tdDia.className = "celda-fecha";
    tdDia.textContent = rhDayOfWeekLabel(iso, true);
    tr.appendChild(tdDia);

    var tdFecha = document.createElement("td");
    tdFecha.className = "celda-fecha";
    tdFecha.textContent = rhFormatDateDisplay(iso).slice(0, 5);
    tr.appendChild(tdFecha);

    var tdHoras = document.createElement("td");
    tdHoras.textContent = e.minutos > 0 ? rhMinutesToHM(e.minutos) : "—";
    tr.appendChild(tdHoras);

    var tdEstado = document.createElement("td");
    tdEstado.appendChild(rhStatsPill(e));
    if (e.conflicto) {
      var alerta = document.createElement("span");
      alerta.className = "mini-alerta";
      alerta.textContent = " ⚠️";
      alerta.title = "Tiene horas dentro de un período sin convocatoria";
      tdEstado.appendChild(alerta);
    }
    tr.appendChild(tdEstado);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  body.appendChild(wrap);
}

// ---------- Más estadísticas ----------

function rhStatsMiniCard(etiqueta, valor, sub, clase) {
  var card = document.createElement("div");
  card.className = "mini-card" + (clase ? " " + clase : "");
  var l = document.createElement("span");
  l.className = "mini-label";
  l.textContent = etiqueta;
  var v = document.createElement("strong");
  v.className = "mini-valor";
  v.textContent = valor;
  card.appendChild(l);
  card.appendChild(v);
  if (sub) {
    var s = document.createElement("span");
    s.className = "mini-sub";
    s.textContent = sub;
    card.appendChild(s);
  }
  return card;
}

function rhStatsRenderMasEstadisticas(mes) {
  var config = rhLoadConfig();
  var range = rhMonthRange(mes);
  var registros = rhLoadRegistros().filter(function (r) {
    return rhIsDateInRange(r.fecha, range.start, range.end) && rhRegistroMinutes(r) > 0;
  });
  var totalMin = registros.reduce(function (s, r) { return s + rhRegistroMinutes(r); }, 0);
  var diasConMeta = rhDaysBetweenInclusive(range.start, range.end).filter(function (iso) {
    return rhMinutosEsperadosDia(iso, config) > 0;
  }).length;

  // "Jornada más larga/corta" = total trabajado en el día. "Días con más de
  // una/dos jornadas" = días con 2+ / 3+ bloques de entrada-salida.
  var masLarga = null;
  var masCorta = null;
  var masDeUna = 0;
  var masDeDos = 0;
  registros.forEach(function (r) {
    var min = rhRegistroMinutes(r);
    if (!masLarga || min > masLarga.min) masLarga = { fecha: r.fecha, min: min };
    if (!masCorta || min < masCorta.min) masCorta = { fecha: r.fecha, min: min };
    var bloques = rhRegistroBloques(r).filter(function (b) { return b.entrada && b.salida; });
    if (bloques.length >= 2) masDeUna++;
    if (bloques.length >= 3) masDeDos++;
  });
  function fechaCorta(iso) { return rhDayOfWeekLabel(iso, true) + " " + rhFormatDateDisplay(iso).slice(0, 5); }
  function pctDias(n) { return registros.length ? Math.round((n / registros.length) * 100) + "% de los días trabajados" : ""; }

  // Semana (lunes a domingo, dentro del mes) con más horas trabajadas.
  var mejorSemana = null;
  rhGroupMonthByWeek(range).forEach(function (g, idx) {
    var min = g.dias.reduce(function (sum, iso) { return sum + rhRegistroMinutes(rhGetRegistroByFecha(iso)); }, 0);
    if (min > 0 && (!mejorSemana || min > mejorSemana.min)) {
      mejorSemana = { n: idx + 1, min: min, desde: g.dias[0], hasta: g.dias[g.dias.length - 1] };
    }
  });

  var actividades = rhContarActividades(range.start, range.end).lista;
  var topActividad = actividades[0];

  var mesAnterior = rhParseISO(range.start);
  mesAnterior.setMonth(mesAnterior.getMonth() - 1);
  var rangoAnt = rhMonthRange(rhDateToISO(mesAnterior));
  var trabajadoAnt = rhWorkedMinutesInRange(rangoAnt.start, rangoAnt.end);
  var especiales = rhContarDiasEspeciales(range.start, range.end);

  var cont = rhEl("stats-mini");
  rhClear(cont);
  cont.appendChild(rhStatsMiniCard("Días trabajados", String(registros.length),
    "de " + rhPlural(diasConMeta, "día hábil con meta", "días hábiles con meta")));
  cont.appendChild(rhStatsMiniCard("Promedio por día trabajado",
    registros.length ? rhMinutesToHM(totalMin / registros.length) : "—"));
  cont.appendChild(rhStatsMiniCard("Jornada más larga",
    masLarga ? rhMinutesToHM(masLarga.min) : "—", masLarga ? fechaCorta(masLarga.fecha) + " (total del día)" : ""));
  cont.appendChild(rhStatsMiniCard("Jornada más corta",
    masCorta ? rhMinutesToHM(masCorta.min) : "—", masCorta ? fechaCorta(masCorta.fecha) + " (total del día)" : ""));
  cont.appendChild(rhStatsMiniCard("Días con más de una jornada", String(masDeUna), pctDias(masDeUna)));
  cont.appendChild(rhStatsMiniCard("Días con más de dos jornadas", String(masDeDos), pctDias(masDeDos)));
  cont.appendChild(rhStatsMiniCard("Actividad más realizada",
    topActividad ? topActividad.nombre : "—",
    topActividad ? rhPlural(topActividad.dias, "día", "días") + " este mes" : "Aún sin actividades marcadas",
    "mini-texto"));
  cont.appendChild(rhStatsMiniCard("Semana con más horas",
    mejorSemana ? rhMinutesToHM(mejorSemana.min) : "—",
    mejorSemana ? "Semana " + mejorSemana.n + " (" + rhParseISO(mejorSemana.desde).getDate() + "–" +
      rhParseISO(mejorSemana.hasta).getDate() + " " + RH_MESES_ABREV[rhParseISO(mejorSemana.desde).getMonth()] + ")" : ""));
  cont.appendChild(rhStatsMiniCard("Feriados, no convocados y licencias", String(especiales.total),
    especiales.feriados + " fer. · " + especiales.noConvocados + " no conv. · " + especiales.licencias + " lic."));
  var dif = rhWorkedMinutesInRange(range.start, range.end) - trabajadoAnt;
  cont.appendChild(rhStatsMiniCard("Comparado con " + RH_MESES[mesAnterior.getMonth()].toLowerCase(),
    trabajadoAnt > 0 || totalMin > 0 ? rhConSigno(dif) : "—",
    rhMinutesToHM(trabajadoAnt) + " en " + RH_MESES[mesAnterior.getMonth()].toLowerCase(),
    dif > 0 ? "mini-favor" : dif < 0 ? "mini-contra" : ""));

  // Horas por día de la semana (lunes a domingo; fin de semana solo si hubo).
  var porDia = {};
  registros.forEach(function (r) {
    var dow = rhParseISO(r.fecha).getDay();
    porDia[dow] = porDia[dow] || { min: 0, dias: 0 };
    porDia[dow].min += rhRegistroMinutes(r);
    porDia[dow].dias++;
  });
  var filas = RH_DIAS_SEMANA_ORDEN.filter(function (dow) {
    return config.diasLaborales.indexOf(dow) !== -1 || porDia[dow];
  }).map(function (dow) {
    var d = porDia[dow] || { min: 0, dias: 0 };
    return {
      etiqueta: RH_DIAS_SEMANA[dow].corto,
      valor: d.min,
      texto: d.min ? rhMinutesToHM(d.min) + " · " + rhPlural(d.dias, "día", "días") : "—",
      rojo: dow === 0 || dow === 6
    };
  });
  rhStatsRenderBarras(rhEl("stats-dias-semana"), filas, "No hay horas registradas este mes.");
}

// Barras horizontales simples: [{ etiqueta, valor, texto, rojo }].
function rhStatsRenderBarras(cont, filas, textoVacio) {
  rhClear(cont);
  var max = filas.reduce(function (m, f) { return Math.max(m, f.valor); }, 0);
  if (max === 0) {
    var vacio = document.createElement("p");
    vacio.className = "label-hint";
    vacio.textContent = textoVacio;
    cont.appendChild(vacio);
    return;
  }
  filas.forEach(function (f) {
    var fila = document.createElement("div");
    fila.className = "barra-fila";
    var et = document.createElement("span");
    et.className = "barra-etiqueta" + (f.rojo ? " texto-rojo" : "");
    et.textContent = f.etiqueta;
    fila.appendChild(et);
    var pista = document.createElement("span");
    pista.className = "barra-pista";
    var relleno = document.createElement("i");
    relleno.style.width = (f.valor > 0 ? Math.max(3, Math.round((f.valor / max) * 100)) : 0) + "%";
    pista.appendChild(relleno);
    fila.appendChild(pista);
    var val = document.createElement("span");
    val.className = "barra-valor";
    val.textContent = f.texto;
    fila.appendChild(val);
    cont.appendChild(fila);
  });
}

// ---------- Actividades más frecuentes ----------

rhEl("stats-actividades-alcance").addEventListener("click", function (e) {
  var b = e.target.closest(".segmented-btn");
  if (!b) return;
  rhStatsAlcanceActividades = b.getAttribute("data-alcance");
  rhPrefSet("rh_pref_actividades_alcance", rhStatsAlcanceActividades);
  rhStatsRenderActividades(rhStatsMeses.actividades);
});

function rhStatsRenderActividades(mes) {
  rhEl("stats-actividades-alcance").querySelectorAll(".segmented-btn").forEach(function (b) {
    b.classList.toggle("activo", b.getAttribute("data-alcance") === rhStatsAlcanceActividades);
  });
  var todo = rhStatsAlcanceActividades === "todo";
  // Con "Todo el historial" el mes elegido no aplica: se atenúa su selector.
  rhEl("nav-mes-actividades").classList.toggle("nav-mes-inactivo", todo);
  var range = rhMonthRange(mes);
  var res = todo ? rhContarActividades() : rhContarActividades(range.start, range.end);
  var cont = rhEl("stats-actividades");
  var filas = res.lista.map(function (a) {
    var pct = res.diasTrabajados ? Math.round((a.dias / res.diasTrabajados) * 100) : 0;
    return { etiqueta: a.nombre, valor: a.dias, texto: rhPlural(a.dias, "día", "días") + (pct ? " · " + pct + "%" : "") };
  });
  rhStatsRenderBarras(cont, filas,
    "Aún no hay actividades marcadas " + (rhStatsAlcanceActividades === "todo" ? "" : "en " + rhNombreMes(mes).toLowerCase() + " ") +
    "— elígelas al registrar tu jornada en Marcaje.");
  cont.classList.add("barras-actividades");
  if (res.sinActividad > 0 && filas.length) {
    var nota = document.createElement("p");
    nota.className = "label-hint";
    nota.textContent = rhPlural(res.sinActividad, "día trabajado no tiene", "días trabajados no tienen") + " actividades marcadas.";
    cont.appendChild(nota);
  }
}
