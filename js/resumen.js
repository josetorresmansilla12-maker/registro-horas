"use strict";

// ---------- Descripción para el informe (resumen + ortografía) ----------
//
// El informe muestra la nota de cada día corregida y algo más breve. La nota
// original nunca se modifica: esto solo cambia lo que se ve en el informe.
// Funciona sin internet, con reglas: tildes frecuentes, siglas y nombres
// propios de tu trabajo, mayúscula inicial, quitar muletillas y palabras
// repetidas, y acortar si queda muy larga.
// Si un día quieres otro texto, en Marcaje puedes escribirlo a mano
// ("Editar texto del informe"); se guarda aparte en `notaInforme`.

// Palabras que se corrigen tal cual (clave en minúsculas y sin tilde).
var RH_ORTOGRAFIA = {
  "aplicacion": "aplicación", "devolucion": "devolución", "reunion": "reunión",
  "basico": "básico", "basicos": "básicos", "basica": "básica", "basicas": "básicas",
  "pagina": "página", "paginas": "páginas", "dia": "día", "dias": "días",
  "tambien": "también", "despues": "después", "ademas": "además", "aqui": "aquí",
  "proximo": "próximo", "proxima": "próxima", "ultimo": "último", "ultima": "última",
  "numero": "número", "telefono": "teléfono", "tecnico": "técnico", "tecnica": "técnica",
  "tecnicos": "técnicos", "academico": "académico", "academica": "académica",
  "matematica": "matemática", "matematicas": "matemáticas", "musica": "música",
  "fisica": "física", "quimica": "química", "biologia": "biología", "psicologia": "psicología",
  "orientacion": "orientación", "vocacion": "vocación", "britanico": "Británico",
  "jose": "José", "maria": "María", "ingles": "inglés", "frances": "francés",
  "practica": "práctica", "practicas": "prácticas", "teorica": "teórica",
  "logistica": "logística", "estadistica": "estadística", "estadisticas": "estadísticas",
  "metodologia": "metodología", "tematica": "temática", "pedagogico": "pedagógico",
  "homeoffice": "home office", "kuder": "Kuder", "kuders": "Kuders", "paes": "PAES",
  "ppt": "PPT", "pptx": "PPT", "tp": "TP", "idb": "IDB", "lma": "LMA", "ppl": "PPL",
  "ceia": "CEIA", "cmc": "CMC", "leumag": "LEUMAG", "umag": "UMAG", "lab": "LAB",
  "milagrosa": "Milagrosa", "luterano": "Luterano", "experimental": "Experimental",
  "excel": "Excel", "powerpoint": "PowerPoint", "whatsapp": "WhatsApp", "zoom": "Zoom"
};

// Frases (nombres de colegios, etc.) que van con mayúscula.
var RH_FRASES = [
  [/\bla milagrosa\b/gi, "La Milagrosa"],
  [/\bsan jos[eé]\b/gi, "San José"],
  [/\bgreen hill\b/gi, "Green Hill"],
  [/\bcharles darwin\b/gi, "Charles Darwin"],
  [/\bhome[\s-]?office\b/gi, "home office"],
  [/\bcolegio andino\b/gi, "Colegio Andino"]
];

var RH_LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";

function rhSinTildes(t) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function rhCorregirPalabra(palabra) {
  var base = rhSinTildes(palabra.toLowerCase());
  var corregida = RH_ORTOGRAFIA[base];
  if (!corregida) {
    // -cion → -ción y -sion → -sión (en singular; el plural no lleva tilde).
    if (/[a-z]{3,}cion$/.test(base)) corregida = palabra.slice(0, -4) + "ción";
    else if (/[a-z]{4,}sion$/.test(base)) corregida = palabra.slice(0, -4) + "sión";
    else return palabra;
  }
  // Siglas y nombres propios van como en la lista; lo demás respeta la
  // mayúscula inicial que hayas escrito.
  if (corregida !== corregida.toLowerCase()) return corregida;
  if (palabra[0] === palabra[0].toUpperCase() && palabra[0] !== palabra[0].toLowerCase()) {
    return corregida[0].toUpperCase() + corregida.slice(1);
  }
  return corregida;
}

function rhCorregirOrtografia(texto) {
  var t = String(texto || "");
  RH_FRASES.forEach(function (f) { t = t.replace(f[0], f[1]); });
  return t.replace(new RegExp("[" + RH_LETRAS + "]+", "g"), rhCorregirPalabra);
}

// Primera palabra de un fragmento, para detectar repeticiones ("Devolución
// IDB, Devolución Luterano" → "Devolución IDB, Luterano").
function rhPrimeraPalabra(t) {
  var m = t.trim().match(new RegExp("^[" + RH_LETRAS + "]+"));
  return m ? rhSinTildes(m[0].toLowerCase()) : "";
}

function rhQuitarRepetidas(texto, separador) {
  var partes = texto.split(separador);
  var previa = "";
  return partes.map(function (p, i) {
    var primera = rhPrimeraPalabra(p);
    if (i > 0 && primera && primera === previa && primera.length > 3) {
      return p.replace(new RegExp("^(\\s*)[" + RH_LETRAS + "]+\\s+"), "$1");
    }
    if (primera) previa = primera;
    return p;
  }).join(separador);
}

var RH_MAX_RESUMEN = 140;

function rhResumirDescripcion(texto) {
  var t = String(texto || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  t = rhCorregirOrtografia(t);

  // Muletillas al inicio ("Trabajé en borrador…" → "Borrador…").
  t = t.replace(/^(hoy\s+)?(trabaj[ée]|estuve|fui|realic[ée]|hice)\s+(en|a)\s+/i, "");
  t = t.replace(/^(hoy\s+)?(trabaj[ée]|realic[ée]|hice)\s+/i, "");
  // "…, en la tarde mejora…" → "…; tarde: mejora…".
  t = t.replace(/,?\s+en la (tarde|mañana)\s+/gi, function (_, parte) { return "; " + parte.toLowerCase() + ": "; });
  // Paréntesis final → dos puntos.
  t = t.replace(/\s*\(([^()]+)\)\s*\.?$/, ": $1");
  // Palabras repetidas al inicio de cada parte de una lista.
  t = rhQuitarRepetidas(t, ", ");
  t = rhQuitarRepetidas(t, " y ");

  t = t.replace(/\s+([,.;:])/g, "$1").replace(/\s{2,}/g, " ").replace(/[.;,\s]+$/, "").trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);

  if (t.length > RH_MAX_RESUMEN) {
    var corte = t.lastIndexOf(" ", RH_MAX_RESUMEN - 1);
    t = t.slice(0, corte > 60 ? corte : RH_MAX_RESUMEN - 1).replace(/[,;:\s]+$/, "") + "…";
  }
  return t;
}

// Texto que se muestra en el informe para un día: el que escribiste a mano
// para el informe (si corresponde a la nota actual) o el resumen automático.
function rhTextoInforme(registro) {
  if (!registro || !registro.nota || !String(registro.nota).trim()) return "";
  if (registro.notaInforme && registro.notaInformeDe === registro.nota) return registro.notaInforme;
  return rhResumirDescripcion(registro.nota);
}
