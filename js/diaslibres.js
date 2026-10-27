"use strict";

// ---------- Ocupar horas libres (horas que te deben) ----------
//
// Cuando no trabajas un día (o parte de él) y lo pagas con tus horas a favor
// —por ejemplo, si te enfermas y te piden no presentar licencia—, ese día se
// marca como día libre: no cuenta como día a trabajar del contrato y se
// descuentan de tu saldo las horas de la parte elegida (mañana, tarde, día
// completo u otra cantidad). Se guarda en el registro del día como
// `diaLibre: { jornada, minutos, motivo }` (ver rhGuardarDiasLibres).

var RH_LIBRE_MAX_DIAS = 62;

var libreModal = rhEl("libre-modal");
var libreDesde = rhEl("libre-desde");
var libreHasta = rhEl("libre-hasta");
var libreOpciones = rhEl("libre-opciones");
var libreOtraWrap = rhEl("libre-otra-wrap");
var libreOtraHoras = rhEl("libre-otra-horas");
var libreMotivo = rhEl("libre-motivo");
var libreResumen = rhEl("libre-resumen");
var libreConfirmar = rhEl("libre-confirmar");

var rhLibre = { jornada: "completa" };

// "Lun 27/10"
function rhFechaCorta(iso) {
  return rhDayOfWeekLabel(iso, true) + " " + rhFormatDateDisplay(iso).slice(0, 5);
}

// Días de un rango en que se pueden ocupar horas libres: los laborales que no
// están cubiertos por un feriado, licencia o "no convocado", ni marcados como
// "aún no contratado". Los fines de semana se saltan sin aviso.
function rhDiasParaLibre(desde, hasta) {
  var config = rhLoadConfig();
  var res = { dias: [], omitidos: [] };
  if (!desde || !hasta || rhCompareISO(hasta, desde) < 0) return res;
  rhDaysBetweenInclusive(desde, hasta).slice(0, RH_LIBRE_MAX_DIAS).forEach(function (iso) {
    if (!rhEsDiaLaboral(iso, config)) return;
    var lic = rhLicenciaForDate(iso);
    var estado = rhRegistroEstadoLabel(rhGetRegistroByFecha(iso));
    if (lic && rhLicenciaAjustaMeta(lic)) {
      res.omitidos.push(rhFechaCorta(iso) + " (" + rhTipoLicenciaLabel(lic.tipo).toLowerCase() + ")");
    } else if (estado) {
      res.omitidos.push(rhFechaCorta(iso) + " (" + estado.toLowerCase() + ")");
    } else {
      res.dias.push(iso);
    }
  });
  return res;
}

// Minutos que vale una parte del día con el horario actual.
function rhLibreMinutosOpcion(jornada, horasOtra) {
  if (jornada === "otra") return Math.round((Number(String(horasOtra || "").replace(",", ".")) || 0) * 60);
  var j = rhJornadasNorma()[jornada];
  return j ? j.minutos : 0;
}

function rhLibreRenderOpciones() {
  var norma = rhJornadasNorma();
  rhClear(libreOpciones);
  [norma.manana, norma.tarde, norma.completa, { id: "otra", nombre: "Otra cantidad", horario: "Tú eliges cuántas horas" }].forEach(function (j) {
    var activa = rhLibre.jornada === j.id;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "libre-opcion" + (activa ? " activa" : "");
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", activa ? "true" : "false");
    var t = document.createElement("strong");
    t.textContent = j.nombre + (j.minutos ? " · " + rhMinutesToHM(j.minutos).replace(" 00m", "") : "");
    var h = document.createElement("span");
    h.textContent = j.horario;
    b.appendChild(t);
    b.appendChild(h);
    b.addEventListener("click", function () {
      rhLibre.jornada = j.id;
      rhLibreRenderOpciones();
      libreOtraWrap.classList.toggle("hidden", j.id !== "otra");
      if (j.id === "otra") libreOtraHoras.focus();
      rhLibreActualizarResumen();
    });
    libreOpciones.appendChild(b);
  });
}

// Lo que pasaría con el saldo al ocupar la opción elegida en esas fechas.
function rhLibreCalculo() {
  var desde = libreDesde.value;
  var hasta = libreHasta.value || desde;
  var info = rhDiasParaLibre(desde, hasta);
  var porDia = rhLibreMinutosOpcion(rhLibre.jornada, libreOtraHoras.value);
  var s = rhSaldoParaLibres();
  var hoy = rhTodayISO();
  var inicio = rhBalanceStartDate();
  var config = rhLoadConfig();
  // Si un día ya tenía horas libres se reemplazan (vuelven al saldo), y si
  // era un día pasado sin registro deja de contarse como día a trabajar.
  var previo = 0;
  var recuperado = 0;
  info.dias.forEach(function (iso) {
    var reg = rhGetRegistroByFecha(iso);
    previo += rhDiaLibreMinutos(reg);
    if (rhCompareISO(iso, hoy) > 0 || rhCompareISO(iso, inicio) < 0) return;
    if (iso === hoy && rhRegistroMinutes(reg) === 0) return;
    recuperado += rhMinutosEsperadosDia(iso, config);
  });
  var total = porDia * info.dias.length;
  return {
    info: info,
    porDia: porDia,
    total: total,
    previo: previo,
    recuperado: recuperado,
    saldo: s,
    queda: s.disponibleMin + previo + recuperado - total
  };
}

function rhLibreParrafo(texto, clase) {
  var p = document.createElement("p");
  if (clase) p.className = clase;
  p.textContent = texto;
  libreResumen.appendChild(p);
  return p;
}

function rhLibreRenderSaldo() {
  var s = rhSaldoParaLibres();
  var el = rhEl("libre-saldo");
  rhClear(el);
  var fuerte = document.createElement("strong");
  fuerte.textContent = s.saldoMin > 1 ? "Hoy tienes " + rhMinutesToHM(s.saldoMin) + " a favor."
    : s.saldoMin < -1 ? "Hoy debes " + rhMinutesToHM(-s.saldoMin) + "." : "Hoy estás al día (0 horas a favor).";
  el.appendChild(fuerte);
  if (s.agendadoMin > 0) {
    var extra = document.createElement("span");
    extra.textContent = " Ya agendaste " + rhMinutesToHM(s.agendadoMin) + " para días que vienen: te quedan " +
      rhMinutesToHM(Math.max(0, s.disponibleMin)) + " disponibles.";
    el.appendChild(extra);
  }
}

function rhLibreActualizarResumen() {
  rhClear(libreResumen);
  var c = rhLibreCalculo();
  var n = c.info.dias.length;
  libreConfirmar.disabled = n === 0 || !(c.porDia > 0);
  libreConfirmar.textContent = n > 0 && c.total > 0 ? "Ocupar " + rhMinutesToHM(c.total) : "Ocupar horas";

  if (n === 0) {
    rhLibreParrafo("No hay días hábiles disponibles en esas fechas." +
      (c.info.omitidos.length ? " Se omiten: " + c.info.omitidos.join(", ") + "." : ""), "libre-alerta");
    return;
  }
  rhLibreParrafo("Se aplicará a " + rhPlural(n, "día", "días") + ": " + c.info.dias.map(rhFechaCorta).join(", ") + ".");
  if (c.info.omitidos.length) rhLibreParrafo("Se omiten: " + c.info.omitidos.join(", ") + ".", "label-hint");
  if (!(c.porDia > 0)) {
    rhLibreParrafo("Escribe cuántas horas quieres ocupar por día.", "libre-alerta");
    return;
  }
  rhLibreParrafo("Se descuentan " + rhMinutesToHM(c.total) + " de tus horas a favor" +
    (n > 1 ? " (" + rhMinutesToHM(c.porDia) + " por día)." : "."));
  if (c.previo > 0) rhLibreParrafo("Reemplaza las horas libres que ya tenía " + (n > 1 ? "alguno de esos días" : "ese día") +
    " (" + rhMinutesToHM(c.previo) + ").", "label-hint");
  if (c.recuperado > 0) rhLibreParrafo("Como " + (n > 1 ? "esos días figuraban" : "ese día figuraba") +
    " sin registro, ya se te descontaban " + rhMinutesToHM(c.recuperado) + " por contrato; eso se reemplaza por las horas libres.", "label-hint");
  if (c.queda >= -1) {
    rhLibreParrafo("Te quedarían " + rhMinutesToHM(Math.max(0, c.queda)) + " a favor. ✓", "libre-ok");
  } else {
    rhLibreParrafo("No te alcanzan: quedarías debiendo " + rhMinutesToHM(-c.queda) + ".", "libre-alerta");
  }
}

function rhCerrarOcuparLibre() {
  libreModal.classList.add("hidden");
}

// Abre la ventana para ocupar horas libres desde `desde` (hoy si no se indica)
// hasta `hasta` (el mismo día si no se indica). Si ese día ya tenía horas
// libres, parte con lo que tenía para poder cambiarlo.
function rhAbrirOcuparLibre(desde, hasta) {
  var fecha = desde || rhTodayISO();
  libreDesde.value = fecha;
  libreHasta.value = hasta || fecha;
  var dl = rhDiaLibre(rhGetRegistroByFecha(fecha));
  rhLibre.jornada = dl ? dl.jornada : "completa";
  libreOtraHoras.value = dl && dl.jornada === "otra" ? String(Math.round((dl.minutos / 60) * 100) / 100) : "";
  libreMotivo.value = (dl && dl.motivo) || "";
  libreOtraWrap.classList.toggle("hidden", rhLibre.jornada !== "otra");
  rhLibreRenderSaldo();
  rhLibreRenderOpciones();
  rhLibreActualizarResumen();
  libreModal.classList.remove("hidden");
}

libreDesde.addEventListener("change", function () {
  if (!libreHasta.value || rhCompareISO(libreHasta.value, libreDesde.value) < 0) libreHasta.value = libreDesde.value;
  rhLibreActualizarResumen();
});
libreHasta.addEventListener("change", function () {
  if (libreDesde.value && rhCompareISO(libreHasta.value, libreDesde.value) < 0) libreDesde.value = libreHasta.value;
  rhLibreActualizarResumen();
});
libreOtraHoras.addEventListener("input", rhLibreActualizarResumen);

rhEl("libre-cancelar").addEventListener("click", rhCerrarOcuparLibre);
libreModal.addEventListener("click", function (e) { if (e.target === libreModal) rhCerrarOcuparLibre(); });

libreConfirmar.addEventListener("click", function () {
  var c = rhLibreCalculo();
  if (!c.info.dias.length || !(c.porDia > 0)) return;
  if (c.queda < -1 && !confirm("No te alcanzan las horas a favor: quedarías debiendo " + rhMinutesToHM(-c.queda) +
    ".\n\n¿Ocupar las horas igual?")) return;
  var dl = { jornada: rhLibre.jornada, minutos: c.porDia };
  var motivo = libreMotivo.value.trim();
  if (motivo) dl.motivo = motivo;
  rhGuardarDiasLibres(c.info.dias.map(function (iso) {
    return { fecha: iso, diaLibre: Object.assign({}, dl) };
  }));
  rhCerrarOcuparLibre();
  rhShowAlert("Listo: " + rhDiaLibreNombre(dl).toLowerCase() + " " +
    (c.info.dias.length > 1 ? "en " + c.info.dias.length + " días" : "el " + rhFormatDateDisplay(c.info.dias[0])) +
    ". Se descontaron " + rhMinutesToHM(c.total) + " de tus horas a favor.", "success");
  rhRefrescarVistas();
});

// Quita las horas libres de un día (vuelve a contarse como un día normal).
function rhQuitarDiaLibre(fecha) {
  var dl = rhDiaLibre(rhGetRegistroByFecha(fecha));
  if (!dl) return;
  if (!confirm("¿Quitar \"" + rhDiaLibreTexto(dl) + "\" del " + rhFormatDateDisplay(fecha) + "?\n\n" +
    "Esas horas vuelven a tu saldo y el día se cuenta como un día normal.")) return;
  rhGuardarDiasLibres([{ fecha: fecha, diaLibre: null }]);
  rhShowAlert("Se quitaron las horas libres del " + rhFormatDateDisplay(fecha) + ".", "success");
  rhRefrescarVistas();
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !libreModal.classList.contains("hidden")) {
    rhCerrarOcuparLibre();
  }
});
