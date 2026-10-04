"use strict";

// ---------- Sincronización entre dispositivos (Firebase Realtime Database) ----------
//
// Guarda una copia de todos los datos (jornadas, licencias/feriados, proyectos
// y configuración) en una rama privada del proyecto de Firebase "Registro de
// Horas", identificada por un código secreto. Los dispositivos que usan el
// mismo código ven los mismos datos y se actualizan solos.
//
// Se usa la API REST de Firebase (sin librerías externas): cada cambio se
// sube con PUT y los cambios de otros dispositivos llegan en vivo por
// EventSource. Modelo: "gana el último que escribe" sobre el bloque completo,
// pero si al subir se nota que otro dispositivo escribió algo que este aún no
// tenía, primero se combinan ambos (no se pierde ninguna jornada).

var RH_SYNC_DB_URL = "https://registro-de-horas-cf072-default-rtdb.firebaseio.com";
var RH_SYNC_CONFIG_KEY = "rh_sync_config"; // { codigo, ultimoRemoto, pendiente }
var RH_SYNC_DISPOSITIVO_KEY = "rh_sync_dispositivo";
var RH_SYNC_CLAVES = [RH_REGISTROS_KEY, RH_LICENCIAS_KEY, RH_PROYECTOS_KEY, RH_CONFIG_KEY];

var rhSync = {
  codigo: null,
  ultimoRemoto: 0,
  pendiente: false,
  fuente: null,
  timer: null,
  subiendo: false,
  aplicandoRemoto: false,
  estado: "desconectado", // desconectado | conectando | sincronizado | subiendo | sin_conexion | error
  ultimaSync: null
};

// ---------- Configuración guardada en este dispositivo ----------

function rhSyncLeerConfig() {
  try {
    return JSON.parse(localStorage.getItem(RH_SYNC_CONFIG_KEY) || "null");
  } catch (e) {
    return null;
  }
}

function rhSyncGuardarConfig() {
  try {
    if (!rhSync.codigo) {
      localStorage.removeItem(RH_SYNC_CONFIG_KEY);
      return;
    }
    localStorage.setItem(RH_SYNC_CONFIG_KEY, JSON.stringify({
      codigo: rhSync.codigo,
      ultimoRemoto: rhSync.ultimoRemoto,
      pendiente: rhSync.pendiente
    }));
  } catch (e) { /* sin almacenamiento: la sync dura solo esta sesión */ }
}

function rhSyncDispositivoId() {
  try {
    var id = localStorage.getItem(RH_SYNC_DISPOSITIVO_KEY);
    if (!id) {
      id = rhUid();
      localStorage.setItem(RH_SYNC_DISPOSITIVO_KEY, id);
    }
    return id;
  } catch (e) {
    return "sin-id";
  }
}

// Código legible y difícil de adivinar: 4 grupos de 4 caracteres.
function rhSyncGenerarCodigo() {
  var letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  var codigo = "";
  for (var i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 4 === 0) codigo += "-";
    codigo += letras[bytes[i] % letras.length];
  }
  return codigo;
}

function rhSyncNormalizarCodigo(texto) {
  return String(texto || "").trim().toUpperCase().replace(/\s+/g, "");
}

function rhSyncCodigoValido(codigo) {
  return /^[A-Z0-9-]{12,64}$/.test(codigo);
}

function rhSyncUrl(codigo) {
  return RH_SYNC_DB_URL + "/registroHoras/" + encodeURIComponent(codigo) + ".json";
}

// ---------- Datos locales ----------

function rhSyncEstadoLocal() {
  var config = null;
  try {
    config = JSON.parse(localStorage.getItem(RH_CONFIG_KEY) || "null");
  } catch (e) { /* config inválida: se envía la de por defecto */ }
  return {
    registros: rhLoadRegistros(),
    licencias: rhLoadLicencias(),
    proyectos: rhLoadProyectos(),
    config: config || rhLoadConfig()
  };
}

function rhSyncTieneDatos(estado) {
  return !!estado && ((estado.registros || []).length + (estado.licencias || []).length + (estado.proyectos || []).length) > 0;
}

// Firebase guarda los arreglos vacíos como "nada": se normaliza al leer.
function rhSyncNormalizarEstado(estado) {
  estado = estado || {};
  function lista(x) {
    if (Array.isArray(x)) return x.filter(Boolean);
    if (x && typeof x === "object") return Object.keys(x).map(function (k) { return x[k]; }).filter(Boolean);
    return [];
  }
  return {
    registros: lista(estado.registros),
    licencias: lista(estado.licencias),
    proyectos: lista(estado.proyectos),
    config: estado.config || null
  };
}

// Escribe el estado recibido en este dispositivo sin volver a subirlo.
function rhSyncAplicarEstado(estado) {
  rhSync.aplicandoRemoto = true;
  try {
    localStorage.setItem(RH_REGISTROS_KEY, JSON.stringify(estado.registros));
    localStorage.setItem(RH_LICENCIAS_KEY, JSON.stringify(estado.licencias));
    localStorage.setItem(RH_PROYECTOS_KEY, JSON.stringify(estado.proyectos));
    if (estado.config) localStorage.setItem(RH_CONFIG_KEY, JSON.stringify(estado.config));
    rhInvalidarCache();
  } finally {
    rhSync.aplicandoRemoto = false;
  }
  rhSyncRefrescarVista();
}

function rhSyncRefrescarVista() {
  var activa = document.querySelector(".tab-btn.active");
  renderMarcajeTable();
  if (activa) rhActivateTab(activa.getAttribute("data-tab"));
}

// Combina dos estados sin perder nada: jornadas por fecha, licencias y
// proyectos por id. Si una misma fecha está en ambos, gana `preferido`.
function rhSyncCombinar(preferido, otro) {
  function porClave(listaPref, listaOtra, clave) {
    var vistos = {};
    var res = [];
    listaPref.forEach(function (x) { vistos[clave(x)] = true; res.push(x); });
    listaOtra.forEach(function (x) { if (!vistos[clave(x)]) { vistos[clave(x)] = true; res.push(x); } });
    return res;
  }
  var registros = porClave(preferido.registros, otro.registros, function (r) { return r.fecha; });
  registros.sort(function (a, b) { return rhCompareISO(a.fecha, b.fecha); });
  return {
    registros: registros,
    licencias: porClave(preferido.licencias, otro.licencias, function (l) {
      return l.fechaInicio + "|" + l.fechaFin + "|" + l.tipo;
    }),
    proyectos: porClave(preferido.proyectos, otro.proyectos, function (p) { return p.id || (p.fecha + "|" + p.titulo); }),
    config: preferido.config || otro.config
  };
}

// ---------- Red ----------

function rhSyncLeerRemoto(codigo) {
  return fetch(rhSyncUrl(codigo), { cache: "no-store" }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function rhSyncEscribirRemoto(codigo, estado) {
  var paquete = { estado: estado, actualizadoEn: Date.now(), dispositivo: rhSyncDispositivoId() };
  return fetch(rhSyncUrl(codigo), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paquete)
  }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return paquete.actualizadoEn;
  });
}

function rhSyncMarcarSubido(actualizadoEn) {
  rhSync.ultimoRemoto = actualizadoEn;
  rhSync.pendiente = false;
  rhSync.ultimaSync = new Date();
  rhSyncGuardarConfig();
  rhSyncCambiarEstado("sincronizado");
}

// Sube los datos de este dispositivo. Si otro dispositivo escribió algo que
// aquí todavía no llegaba, primero se combina (gana lo de este dispositivo
// en una misma fecha) para no borrar lo del otro.
function rhSyncSubir() {
  if (!rhSync.codigo || rhSync.subiendo) return Promise.resolve();
  if (!navigator.onLine) {
    rhSyncCambiarEstado("sin_conexion");
    return Promise.resolve();
  }
  rhSync.subiendo = true;
  rhSyncCambiarEstado("subiendo");
  var codigo = rhSync.codigo;
  return rhSyncLeerRemoto(codigo).then(function (remoto) {
    var local = rhSyncEstadoLocal();
    var aSubir = local;
    var otroEscribio = remoto && remoto.dispositivo !== rhSyncDispositivoId() && remoto.actualizadoEn > rhSync.ultimoRemoto;
    if (otroEscribio) {
      aSubir = rhSyncCombinar(local, rhSyncNormalizarEstado(remoto.estado));
      rhSyncAplicarEstado(aSubir);
    }
    return rhSyncEscribirRemoto(codigo, aSubir);
  }).then(function (actualizadoEn) {
    rhSyncMarcarSubido(actualizadoEn);
  }).catch(function (err) {
    console.warn("No se pudo sincronizar:", err);
    rhSyncCambiarEstado(navigator.onLine ? "error" : "sin_conexion");
  }).then(function () {
    rhSync.subiendo = false;
    if (rhSync.pendiente && rhSync.estado === "sincronizado") rhSyncProgramarSubida();
  });
}

function rhSyncProgramarSubida() {
  clearTimeout(rhSync.timer);
  rhSync.timer = setTimeout(rhSyncSubir, 1500);
}

// Llamado por rhSaveList / rhSaveConfig después de cada guardado.
function rhSyncAlGuardar(clave) {
  if (!rhSync.codigo || rhSync.aplicandoRemoto) return;
  if (RH_SYNC_CLAVES.indexOf(clave) === -1) return;
  rhSync.pendiente = true;
  rhSyncGuardarConfig();
  rhSyncProgramarSubida();
}

// Recibe en vivo los cambios hechos en el otro dispositivo.
function rhSyncEscuchar() {
  rhSyncDejarDeEscuchar();
  if (!rhSync.codigo || typeof EventSource === "undefined") return;
  var fuente = new EventSource(rhSyncUrl(rhSync.codigo));
  rhSync.fuente = fuente;

  fuente.addEventListener("put", function (e) {
    var msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg || msg.path !== "/") {
      // Cambio parcial (no lo hace esta app): se relee completo.
      rhSyncLeerRemoto(rhSync.codigo).then(rhSyncRecibir).catch(function () {});
      return;
    }
    rhSyncRecibir(msg.data);
  });

  fuente.addEventListener("patch", function () {
    rhSyncLeerRemoto(rhSync.codigo).then(rhSyncRecibir).catch(function () {});
  });

  fuente.addEventListener("cancel", function () {
    rhSyncCambiarEstado("error");
    rhSyncDejarDeEscuchar();
  });

  fuente.onopen = function () {
    if (rhSync.estado !== "subiendo") rhSyncCambiarEstado(rhSync.pendiente ? "subiendo" : "sincronizado");
    if (rhSync.pendiente) rhSyncProgramarSubida();
  };

  fuente.onerror = function () {
    if (rhSync.codigo) rhSyncCambiarEstado(navigator.onLine ? "conectando" : "sin_conexion");
  };
}

function rhSyncDejarDeEscuchar() {
  if (rhSync.fuente) {
    rhSync.fuente.close();
    rhSync.fuente = null;
  }
}

function rhSyncRecibir(remoto) {
  if (!remoto || !remoto.estado) return;
  if (remoto.dispositivo === rhSyncDispositivoId()) {
    if (remoto.actualizadoEn > rhSync.ultimoRemoto && !rhSync.pendiente) {
      rhSync.ultimoRemoto = remoto.actualizadoEn;
      rhSyncGuardarConfig();
    }
    return;
  }
  if (!(remoto.actualizadoEn > rhSync.ultimoRemoto)) return;

  var estadoRemoto = rhSyncNormalizarEstado(remoto.estado);
  if (rhSync.pendiente) {
    // Hay cambios de este dispositivo sin subir: se combinan y se suben.
    rhSyncAplicarEstado(rhSyncCombinar(rhSyncEstadoLocal(), estadoRemoto));
    rhSync.ultimoRemoto = remoto.actualizadoEn;
    rhSyncGuardarConfig();
    rhSyncProgramarSubida();
    return;
  }
  rhSyncAplicarEstado(estadoRemoto);
  rhSync.ultimoRemoto = remoto.actualizadoEn;
  rhSync.ultimaSync = new Date();
  rhSyncGuardarConfig();
  rhSyncCambiarEstado("sincronizado");
  rhShowAlert("☁️ Tus datos se actualizaron con los cambios del otro dispositivo.", "success");
}

// ---------- Conectar / desconectar ----------

function rhSyncConectar(codigoTexto) {
  var codigo = rhSyncNormalizarCodigo(codigoTexto);
  if (!rhSyncCodigoValido(codigo)) {
    rhShowAlert("El código debe tener al menos 12 letras o números (puedes usar “Generar código”).", "error");
    return Promise.resolve(false);
  }
  if (!navigator.onLine) {
    rhShowAlert("Necesitas internet para conectar la sincronización.", "error");
    return Promise.resolve(false);
  }
  rhSyncCambiarEstado("conectando");

  return rhSyncLeerRemoto(codigo).then(function (remoto) {
    var local = rhSyncEstadoLocal();
    var hayRemoto = remoto && remoto.estado && rhSyncTieneDatos(rhSyncNormalizarEstado(remoto.estado));

    if (!hayRemoto) {
      // Primer dispositivo con este código: sube lo que tiene.
      rhSync.codigo = codigo;
      return rhSyncEscribirRemoto(codigo, local).then(function (t) {
        rhSyncMarcarSubido(t);
        rhShowAlert("Sincronización activada. Tus datos quedaron guardados en la nube.", "success");
        return true;
      });
    }

    var estadoRemoto = rhSyncNormalizarEstado(remoto.estado);
    if (!rhSyncTieneDatos(local)) {
      // Dispositivo nuevo y vacío: toma los datos de la nube.
      rhSync.codigo = codigo;
      rhSyncAplicarEstado(estadoRemoto);
      rhSync.ultimoRemoto = remoto.actualizadoEn || Date.now();
      rhSync.ultimaSync = new Date();
      rhSyncGuardarConfig();
      rhSyncCambiarEstado("sincronizado");
      rhShowAlert("Sincronización activada: se cargaron " + estadoRemoto.registros.length + " jornada(s) desde la nube.", "success");
      return true;
    }

    // Ambos tienen datos: se combinan (en una misma fecha queda la de la nube).
    var ok = confirm("En la nube ya hay datos con este código (" + estadoRemoto.registros.length + " jornada(s)) y este dispositivo tiene " +
      local.registros.length + ".\n\nSe combinarán sin borrar nada: si una misma fecha está en ambos lados, se deja la versión de la nube.\n\n¿Conectar y combinar?");
    if (!ok) {
      rhSyncCambiarEstado("desconectado");
      return false;
    }
    rhSync.codigo = codigo;
    var combinado = rhSyncCombinar(estadoRemoto, local);
    rhSyncAplicarEstado(combinado);
    return rhSyncEscribirRemoto(codigo, combinado).then(function (t) {
      rhSyncMarcarSubido(t);
      rhShowAlert("Sincronización activada: datos combinados (" + combinado.registros.length + " jornadas).", "success");
      return true;
    });
  }).then(function (conectado) {
    if (conectado) rhSyncEscuchar();
    renderSyncConfig();
    return conectado;
  }).catch(function (err) {
    console.warn("No se pudo conectar la sincronización:", err);
    rhSync.codigo = null;
    rhSyncGuardarConfig();
    rhSyncCambiarEstado("desconectado");
    rhShowAlert(String(err && err.message).indexOf("401") !== -1
      ? "La nube rechazó el acceso: falta publicar las reglas de la base de datos en Firebase."
      : "No se pudo conectar con la nube. Revisa tu internet e inténtalo de nuevo.", "error");
    return false;
  });
}

function rhSyncDesconectar() {
  rhSyncDejarDeEscuchar();
  clearTimeout(rhSync.timer);
  rhSync.codigo = null;
  rhSync.ultimoRemoto = 0;
  rhSync.pendiente = false;
  rhSyncGuardarConfig();
  rhSyncCambiarEstado("desconectado");
}

function rhSyncIniciar() {
  var cfg = rhSyncLeerConfig();
  if (!cfg || !cfg.codigo) {
    rhSyncCambiarEstado("desconectado");
    return;
  }
  rhSync.codigo = cfg.codigo;
  rhSync.ultimoRemoto = cfg.ultimoRemoto || 0;
  rhSync.pendiente = !!cfg.pendiente;
  rhSyncCambiarEstado(navigator.onLine ? "conectando" : "sin_conexion");
  rhSyncEscuchar();
}

window.addEventListener("online", function () {
  if (!rhSync.codigo) return;
  if (!rhSync.fuente || rhSync.fuente.readyState === 2) rhSyncEscuchar();
  if (rhSync.pendiente) rhSyncProgramarSubida();
});

window.addEventListener("offline", function () {
  if (rhSync.codigo) rhSyncCambiarEstado("sin_conexion");
});

// En el teléfono la app queda en segundo plano y la conexión se corta: al
// volver se reabre la escucha y se sube lo pendiente.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible" || !rhSync.codigo) return;
  if (!rhSync.fuente || rhSync.fuente.readyState === 2) rhSyncEscuchar();
  if (rhSync.pendiente) rhSyncProgramarSubida();
});

// ---------- Interfaz (Configuración) ----------

var RH_SYNC_TEXTO_ESTADO = {
  desconectado: "No conectado: los datos viven solo en este dispositivo.",
  conectando: "Conectando con la nube…",
  subiendo: "Guardando cambios en la nube…",
  sincronizado: "Sincronizado",
  sin_conexion: "Sin internet: los cambios se subirán solos cuando vuelva la conexión.",
  error: "No se pudo sincronizar. Revisa tu internet; se reintentará solo."
};

function rhSyncCambiarEstado(estado) {
  rhSync.estado = estado;
  var el = rhEl("sync-estado");
  if (el) {
    var texto = RH_SYNC_TEXTO_ESTADO[estado] || "";
    if (estado === "sincronizado" && rhSync.ultimaSync) {
      texto += " · " + rhFormatHora12(String(rhSync.ultimaSync.getHours()).padStart(2, "0") + ":" +
        String(rhSync.ultimaSync.getMinutes()).padStart(2, "0"));
    }
    el.textContent = texto;
    el.className = "sync-estado sync-" + estado;
  }
  var indicador = rhEl("sync-indicador");
  if (indicador) {
    indicador.className = "sync-indicador sync-" + estado + (rhSync.codigo ? "" : " hidden");
    indicador.title = RH_SYNC_TEXTO_ESTADO[estado] || "";
  }
}

function renderSyncConfig() {
  var conectado = !!rhSync.codigo;
  rhEl("sync-desconectado").classList.toggle("hidden", conectado);
  rhEl("sync-conectado").classList.toggle("hidden", !conectado);
  if (conectado) rhEl("sync-codigo-actual").textContent = rhSync.codigo;
  rhSyncCambiarEstado(rhSync.estado);
}

rhEl("sync-generar-btn").addEventListener("click", function () {
  rhEl("sync-codigo-input").value = rhSyncGenerarCodigo();
});

rhEl("sync-conectar-btn").addEventListener("click", function () {
  var btn = rhEl("sync-conectar-btn");
  btn.disabled = true;
  rhSyncConectar(rhEl("sync-codigo-input").value).then(function () {
    btn.disabled = false;
  });
});

rhEl("sync-ahora-btn").addEventListener("click", function () {
  rhSync.pendiente = true;
  rhSyncSubir().then(function () {
    if (rhSync.estado === "sincronizado") rhShowAlert("Datos sincronizados.", "success");
  });
});

rhEl("sync-copiar-btn").addEventListener("click", function () {
  var codigo = rhSync.codigo || "";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(codigo).then(function () {
      rhShowAlert("Código copiado.", "success");
    }, function () {
      rhShowAlert("Tu código es: " + codigo, "success");
    });
  } else {
    rhShowAlert("Tu código es: " + codigo, "success");
  }
});

rhEl("sync-desconectar-btn").addEventListener("click", function () {
  if (!confirm("¿Desconectar este dispositivo de la sincronización? Tus datos se quedan aquí y en la nube; solo dejan de actualizarse entre dispositivos.")) return;
  rhSyncDesconectar();
  renderSyncConfig();
  rhShowAlert("Este dispositivo dejó de sincronizarse.", "success");
});
