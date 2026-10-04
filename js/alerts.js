"use strict";

// ---------- Alertas de la app (feedback tras guardar/eliminar/exportar) ----------
//
// Se muestran flotando abajo de la pantalla para que se vean aunque estés más
// abajo en un formulario largo (en el celular el botón Guardar queda lejos del
// inicio de la página).

function rhShowAlert(message, type) {
  var container = rhEl("app-toasts");
  var alertEl = document.createElement("div");
  alertEl.className = "app-alert " + (type || "success");
  var text = document.createElement("span");
  text.textContent = message;
  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "app-alert-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", function () { alertEl.remove(); });
  alertEl.appendChild(text);
  alertEl.appendChild(closeBtn);
  container.appendChild(alertEl);
  setTimeout(function () { alertEl.remove(); }, 4000);
}
