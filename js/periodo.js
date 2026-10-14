"use strict";

// ---------- Selector de período (Mes / Todo / Desde–hasta) ----------
//
// Lo usan los cuadros de Estadísticas y la pestaña Arreglo de horas. Cada uno
// guarda su propio estado { modo, mes, desde, hasta }:
//  - "mes": un mes calendario, con flechas para avanzar o retroceder;
//  - "todo": desde el inicio del seguimiento hasta hoy;
//  - "rango": las fechas que elijas.

function rhNuevoPeriodo(modo) {
  var hoy = rhTodayISO();
  return { modo: modo || "mes", mes: rhMonthRange(hoy).start, desde: rhMonthRange(hoy).start, hasta: hoy };
}

// Fechas concretas de un período, más textos para usar en la interfaz.
function rhPeriodoRango(p) {
  var hoy = rhTodayISO();
  if (p.modo === "todo") {
    var inicio = rhBalanceStartDate();
    if (rhCompareISO(inicio, hoy) > 0) inicio = hoy;
    return {
      modo: "todo", start: inicio, end: hoy,
      etiqueta: "Del " + rhFormatDateDisplay(inicio) + " al " + rhFormatDateDisplay(hoy),
      corta: "todo tu historial"
    };
  }
  if (p.modo === "rango") {
    var a = p.desde || hoy;
    var b = p.hasta || hoy;
    if (rhCompareISO(a, b) > 0) { var t = a; a = b; b = t; }
    return {
      modo: "rango", start: a, end: b,
      etiqueta: "Del " + rhFormatDateDisplay(a) + " al " + rhFormatDateDisplay(b),
      corta: "el período elegido"
    };
  }
  var r = rhMonthRange(p.mes || hoy);
  var nombre = RH_MESES[rhParseISO(r.start).getMonth()];
  return {
    modo: "mes", mes: r.start, start: r.start, end: r.end,
    etiqueta: nombre + " " + rhParseISO(r.start).getFullYear(),
    corta: nombre.toLowerCase()
  };
}

// Meses (primer día de cada uno) que toca un rango de fechas.
function rhMesesEnRango(start, end) {
  var meses = [];
  var mes = rhMonthRange(start).start;
  var fin = rhMonthRange(end).start;
  var guard = 0;
  while (rhCompareISO(mes, fin) <= 0 && guard < 240) {
    meses.push(mes);
    var d = rhParseISO(mes);
    d.setMonth(d.getMonth() + 1);
    mes = rhDateToISO(d);
    guard++;
  }
  return meses;
}

// Arma el selector dentro de `cont`. `estado` se modifica en el lugar y se
// llama `alCambiar()` cada vez que cambia el período.
function rhCrearSelectorPeriodo(cont, estado, alCambiar) {
  rhClear(cont);
  cont.className = "periodo";

  var modos = document.createElement("div");
  modos.className = "segmented periodo-modos";
  [["mes", "Mes"], ["todo", "Todo"], ["rango", "Elegir fechas"]].forEach(function (m) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "segmented-btn" + (estado.modo === m[0] ? " activo" : "");
    b.textContent = m[1];
    b.addEventListener("click", function () {
      if (estado.modo === m[0]) return;
      estado.modo = m[0];
      rhCrearSelectorPeriodo(cont, estado, alCambiar);
      alCambiar();
    });
    modos.appendChild(b);
  });
  cont.appendChild(modos);

  if (estado.modo === "mes") {
    var nav = document.createElement("div");
    nav.className = "nav-mes";
    function mover(delta) {
      var d = rhParseISO(estado.mes);
      d.setMonth(d.getMonth() + delta);
      estado.mes = rhMonthRange(rhDateToISO(d)).start;
      rhCrearSelectorPeriodo(cont, estado, alCambiar);
      alCambiar();
    }
    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "btn btn-icon nav-mes-btn";
    prev.textContent = "◀";
    prev.setAttribute("aria-label", "Mes anterior");
    prev.addEventListener("click", function () { mover(-1); });

    var centro = document.createElement("div");
    centro.className = "nav-mes-centro";
    var nombre = document.createElement("span");
    nombre.className = "nav-mes-nombre";
    nombre.textContent = rhPeriodoRango(estado).etiqueta;
    centro.appendChild(nombre);
    if (estado.mes !== rhMonthRange(rhTodayISO()).start) {
      var hoyBtn = document.createElement("button");
      hoyBtn.type = "button";
      hoyBtn.className = "btn-link";
      hoyBtn.textContent = "Volver al mes actual";
      hoyBtn.addEventListener("click", function () {
        estado.mes = rhMonthRange(rhTodayISO()).start;
        rhCrearSelectorPeriodo(cont, estado, alCambiar);
        alCambiar();
      });
      centro.appendChild(hoyBtn);
    }

    var next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn-icon nav-mes-btn";
    next.textContent = "▶";
    next.setAttribute("aria-label", "Mes siguiente");
    next.addEventListener("click", function () { mover(1); });

    nav.appendChild(prev);
    nav.appendChild(centro);
    nav.appendChild(next);
    cont.appendChild(nav);
  } else if (estado.modo === "todo") {
    var todo = document.createElement("div");
    todo.className = "nav-mes periodo-texto";
    todo.textContent = rhPeriodoRango(estado).etiqueta + " (todo lo registrado)";
    cont.appendChild(todo);
  } else {
    var rango = document.createElement("div");
    rango.className = "nav-mes periodo-fechas";
    function campo(texto, clave) {
      var label = document.createElement("label");
      label.className = "periodo-campo";
      var span = document.createElement("span");
      span.textContent = texto;
      var input = document.createElement("input");
      input.type = "date";
      input.value = estado[clave];
      input.addEventListener("change", function () {
        if (!input.value) return;
        estado[clave] = input.value;
        alCambiar();
      });
      label.appendChild(span);
      label.appendChild(input);
      return label;
    }
    rango.appendChild(campo("Desde", "desde"));
    rango.appendChild(campo("Hasta", "hasta"));
    cont.appendChild(rango);
  }
}
