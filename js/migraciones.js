"use strict";

// ---------- Ajustes únicos de los datos guardados ----------
//
// Cambios que se aplican una sola vez sobre tus datos (y que viajan con la
// sincronización). Cada uno queda anotado en `config.migraciones` para no
// repetirse. Con la sincronización activa se esperan primero los datos de la
// nube, para aplicarlos sobre la versión más nueva.

// ---- Categorías según la descripción del día ----

var RH_ACT_TALLERES = "Talleres vocacionales Kuder";
var RH_ACT_APLICACIONES = "Aplicaciones de test vocacionales Kuder";
var RH_ACT_OFICINA = "Oficina";
var RH_ACT_HOME_OFFICE = "Home office";
var RH_ACT_PAES = "Ensayos PAES";
var RH_ACT_REUNIONES = "Reuniones";
var RH_ACT_FERIAS = "Ferias";
var RH_ACT_DESARROLLO = "Desarrollo app Kuder";

function rhTextoSinTildes(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Categorías que corresponden a una descripción. Se revisa cada parte de la
// nota por separado ("Aplicación San José y oficina corrección kuders" →
// aplicaciones + oficina), porque "aplicación" a veces es aplicar el test
// Kuder en un colegio y a veces la app que estás programando.
function rhInferirActividades(nota) {
  var res = [];
  function agregar(nombre) {
    if (res.indexOf(nombre) === -1) res.push(nombre);
  }
  rhTextoSinTildes(nota).split(/[,;()]|\s+y\s+|\.\s+/).forEach(function (frase) {
    frase = frase.trim();
    if (!frase) return;
    var homeOffice = /home\s?office/.test(frase);
    var paes = /\bpaes\b|\bpptx?\b/.test(frase);
    var desarrollo = /\b(app|programa|pagina)\b/.test(frase) ||
      /\b(mejora|creacion|crear|trabajo en|configuracion|finalizacion|desarrollo)\b[\s\S]*\baplicacion/.test(frase) ||
      (homeOffice && /\baplicacion/.test(frase));
    var taller = /\btaller(es)?\b/.test(frase) && !paes;
    var devolucion = /\bdevolucion/.test(frase);
    var aplicacion = !desarrollo && !taller && !devolucion &&
      /\baplicacion(es)?\b|\btest\b|\bkuders?\b/.test(frase);
    if (taller || devolucion) agregar(RH_ACT_TALLERES);
    if (aplicacion) agregar(RH_ACT_APLICACIONES);
    if (/\boficina\b/.test(frase)) agregar(RH_ACT_OFICINA);
    if (homeOffice) agregar(RH_ACT_HOME_OFFICE);
    if (paes) agregar(RH_ACT_PAES);
    if (/\breunion(es)?\b/.test(frase)) agregar(RH_ACT_REUNIONES);
    if (/\bferias?\b/.test(frase)) agregar(RH_ACT_FERIAS);
    if (desarrollo) agregar(RH_ACT_DESARROLLO);
  });
  return res;
}

// Agrega a los días de un rango las categorías que calzan con su descripción
// (nunca quita las que ya tenían). Devuelve cuántos días cambiaron.
function rhCompletarEtiquetas(start, end) {
  var cambiados = 0;
  var list = rhLoadRegistros().map(function (r) {
    if (!rhIsDateInRange(r.fecha, start, end) || r.estado || !(r.nota || "").trim()) return r;
    var actuales = rhRegistroActividades(r);
    var unidas = rhUnirActividades(actuales, rhInferirActividades(r.nota));
    if (unidas.length === actuales.length) return r;
    cambiados++;
    return Object.assign({}, r, { actividades: unidas });
  });
  if (cambiados) rhSaveRegistros(list);
  return cambiados;
}

// ---- Lista de ajustes (en orden) ----

var RH_MIGRACIONES = [
  {
    // Horario normal: 09:00–13:00 y 14:30–17:30 (7 h), y se propone la tarde
    // al registrar un día.
    id: "horario-2026-10",
    aplicar: function () {
      rhSaveConfig(Object.assign({}, rhLoadConfig(), {
        horarioBase: {
          bloque1: { entrada: "09:00", salida: "13:00" },
          bloque2: { entrada: "14:30", salida: "17:30" }
        },
        bloque2Activo: true
      }));
      return "";
    }
  },
  {
    // Contrato de media jornada: 22 h semanales para todo el período.
    id: "contrato-22h-2026-10",
    aplicar: function () {
      var config = rhLoadConfig();
      if (Number(config.metaSemanal) === 22 && !(config.contratoCambios || []).length) return "";
      rhSaveConfig(Object.assign({}, config, { metaSemanal: 22, contratoCambios: [] }));
      return "Tu contrato quedó en 22 h semanales (media jornada) para todos los cálculos.";
    }
  },
  {
    // Categorías de agosto y septiembre según la descripción de cada día.
    id: "etiquetas-ago-sep-2026",
    aplicar: function () {
      var n = rhCompletarEtiquetas("2026-08-01", "2026-09-30");
      return n ? "Se completaron las categorías de " + rhPlural(n, "día", "días") + " de agosto y septiembre." : "";
    }
  }
];

var rhMigrando = false;

function rhAplicarMigraciones() {
  if (rhMigrando) return;
  var hechas = rhLoadConfig().migraciones;
  hechas = Array.isArray(hechas) ? hechas.slice() : [];
  var pendientes = RH_MIGRACIONES.filter(function (m) { return hechas.indexOf(m.id) === -1; });
  if (!pendientes.length) return;
  rhMigrando = true;
  var mensajes = [];
  try {
    pendientes.forEach(function (m) {
      var msg = m.aplicar();
      if (msg) mensajes.push(msg);
      hechas.push(m.id);
    });
    rhSaveConfig(Object.assign({}, rhLoadConfig(), { migraciones: hechas }));
  } finally {
    rhMigrando = false;
  }
  if (mensajes.length) rhShowAlert(mensajes.join(" "), "success");
  if (!rhMarcajeForm.sucio) rhMarcajeResetForm();
  rhRefrescarVistas();
}
