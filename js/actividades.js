"use strict";

// ---------- Actividades rápidas ----------
//
// Botones (chips) para marcar con un toque qué se hizo en la jornada, en vez
// de escribir siempre lo mismo en la nota. Se pueden marcar varias, más
// "Otro" para escribir una actividad que no está en la lista.

// Arma el selector dentro de `container`. `seleccionadas` son los nombres ya
// marcados (los que no están en la lista configurada se muestran en "Otro").
// `onChange(lista)` se llama solo cuando la lista resultante cambia.
// Devuelve { obtener() } para leer la lista actual al guardar.
function rhCrearSelectorActividades(container, seleccionadas, onChange) {
  var opciones = rhLoadConfig().actividades;
  var marcadas = {};
  var otros = [];
  (seleccionadas || []).forEach(function (a) {
    if (opciones.indexOf(a) !== -1) marcadas[a] = true;
    else otros.push(a);
  });
  var otroActivo = otros.length > 0;

  rhClear(container);
  container.className = "actividades-picker";

  var chips = document.createElement("div");
  chips.className = "chips";
  container.appendChild(chips);

  var otroWrap = document.createElement("div");
  otroWrap.className = "actividad-otro" + (otroActivo ? "" : " hidden");
  var input = document.createElement("input");
  input.type = "text";
  input.maxLength = 120;
  input.placeholder = "Escribe la actividad (ej: Feria TP)";
  input.setAttribute("aria-label", "Otra actividad");
  input.value = otros.join(", ");
  otroWrap.appendChild(input);
  container.appendChild(otroWrap);

  function lista() {
    var res = opciones.filter(function (o) { return marcadas[o]; });
    var texto = input.value.trim();
    if (otroActivo && texto) res.push(texto);
    return res;
  }

  var ultima = JSON.stringify(lista());
  function emitir() {
    var actual = lista();
    var json = JSON.stringify(actual);
    if (json === ultima) return;
    ultima = json;
    if (onChange) onChange(actual);
  }

  function crearChip(texto, activo, alTocar) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (activo ? " activo" : "");
    b.setAttribute("aria-pressed", activo ? "true" : "false");
    b.textContent = texto;
    b.addEventListener("click", function () {
      var ahora = alTocar();
      b.classList.toggle("activo", ahora);
      b.setAttribute("aria-pressed", ahora ? "true" : "false");
    });
    return b;
  }

  opciones.forEach(function (op) {
    chips.appendChild(crearChip(op, !!marcadas[op], function () {
      marcadas[op] = !marcadas[op];
      emitir();
      return marcadas[op];
    }));
  });

  chips.appendChild(crearChip("Otro…", otroActivo, function () {
    otroActivo = !otroActivo;
    otroWrap.classList.toggle("hidden", !otroActivo);
    if (otroActivo) input.focus();
    emitir();
    return otroActivo;
  }));

  input.addEventListener("change", emitir);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
  });

  return { obtener: lista };
}

// Etiquetas pequeñas (solo lectura) con las actividades de un día, para
// tablas y detalles.
function rhEtiquetasActividades(lista) {
  var wrap = document.createElement("span");
  wrap.className = "tags-actividades";
  lista.forEach(function (a) {
    var t = document.createElement("span");
    t.className = "tag-actividad";
    t.textContent = a;
    wrap.appendChild(t);
  });
  return wrap;
}

// Une dos listas de actividades sin repetir (respeta el orden de aparición).
function rhUnirActividades(a, b) {
  var res = [];
  (a || []).concat(b || []).forEach(function (x) {
    if (res.indexOf(x) === -1) res.push(x);
  });
  return res;
}

// Cuántos días se marcó cada actividad en un rango (o en todo el historial si
// no se pasa rango). Devuelve [{ nombre, dias }] de mayor a menor, y cuántos
// días trabajados no tienen ninguna actividad marcada.
function rhContarActividades(start, end) {
  var conteo = {};
  var sinActividad = 0;
  var diasTrabajados = 0;
  rhLoadRegistros().forEach(function (r) {
    if (start && end && !rhIsDateInRange(r.fecha, start, end)) return;
    var acts = rhRegistroActividades(r);
    if (rhRegistroMinutes(r) > 0) {
      diasTrabajados++;
      if (acts.length === 0) sinActividad++;
    }
    acts.forEach(function (a) {
      var nombre = a.trim();
      conteo[nombre] = (conteo[nombre] || 0) + 1;
    });
  });
  var lista = Object.keys(conteo).map(function (k) { return { nombre: k, dias: conteo[k] }; });
  lista.sort(function (x, y) { return y.dias - x.dias || x.nombre.localeCompare(y.nombre); });
  return { lista: lista, sinActividad: sinActividad, diasTrabajados: diasTrabajados };
}
