"use strict";

// ---------- Claves de almacenamiento ----------

var RH_REGISTROS_KEY = "rh_registros";
var RH_LICENCIAS_KEY = "rh_licencias";
var RH_PROYECTOS_KEY = "rh_proyectos";
var RH_CONFIG_KEY = "rh_config";
var RH_LAST_BACKUP_KEY = "rh_last_backup";
var RH_BACKUP_REMINDER_DAYS = 7;
var RH_PAPELERA_KEY = "rh_papelera";
var RH_PAPELERA_DIAS = 30;

// ---------- Configuración por defecto ----------
//
// Refleja el contrato inicial del usuario: 09:00 a 13:00, un solo bloque,
// jornada de lunes a viernes. Todo esto es editable desde Configuración
// para cuando el contrato cambie (jornada completa, bloque de tarde, etc).

var RH_CONFIG_DEFAULT = {
  metaSemanal: 20,
  metaMensual: 86.67, // 20h/semana * 52/12 semanas promedio por mes
  horarioBase: {
    bloque1: { entrada: "09:00", salida: "13:00" },
    bloque2: { entrada: "14:00", salida: "18:00" }
  },
  bloque2Activo: false,
  diasLaborales: [1, 2, 3, 4, 5], // 0=domingo ... 6=sábado
  fechaInicioBalance: null // se autocompleta con el primer registro
};

var RH_TIPOS_LICENCIA = [
  { id: "medica", label: "Licencia médica" },
  { id: "permiso", label: "Permiso especial" },
  { id: "feriado", label: "Feriado" },
  { id: "otro", label: "Otro" }
];

var RH_DIAS_SEMANA = [
  { id: 0, label: "Domingo", corto: "Dom" },
  { id: 1, label: "Lunes", corto: "Lun" },
  { id: 2, label: "Martes", corto: "Mar" },
  { id: 3, label: "Miércoles", corto: "Mié" },
  { id: 4, label: "Jueves", corto: "Jue" },
  { id: 5, label: "Viernes", corto: "Vie" },
  { id: 6, label: "Sábado", corto: "Sáb" }
];

// Orden de despliegue lunes -> domingo (RH_DIAS_SEMANA se mantiene indexado
// por Date.getDay(), 0=domingo, así que este arreglo solo define el orden
// visual de los checkboxes / tablas que muestren la semana completa).
var RH_DIAS_SEMANA_ORDEN = [1, 2, 3, 4, 5, 6, 0];

var RH_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

var RH_MESES_ABREV = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
];

var RH_ORDINALES = ["Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta"];
