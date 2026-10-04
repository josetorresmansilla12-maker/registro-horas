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

// Estados especiales de una jornada (día sin horas trabajadas que igual NO
// cuenta como incumplimiento ni afecta el cálculo de horas):
//  - no_convocado: la oficina pidió no asistir ese día. Se mantiene solo
//    para leer registros antiguos guardados así (día suelto marcado desde
//    Marcaje); desde que "No convocado" se puede marcar por rango de fechas,
//    lo nuevo se guarda como licencia (ver RH_TIPOS_LICENCIA) para que un
//    período completo quede en un solo registro editable.
//  - no_contratado: día previo al inicio del contrato, o período sin contrato
//    (aún no trabajabas / no te habían recontratado).
var RH_ESTADO_NO_CONVOCADO = "no_convocado";
var RH_ESTADO_NO_CONTRATADO = "no_contratado";

// Actividades habituales que se marcan con un toque en cada jornada
// (editables en Configuración). Se guardan en el registro por su nombre, así
// que cambiar esta lista nunca altera lo ya registrado.
var RH_ACTIVIDADES_DEFAULT = [
  "Ir a talleres vocacionales Kuder",
  "Aplicaciones de talleres vocacionales Kuder",
  "Ir a la oficina",
  "Hacer home office",
  "Ensayos PAES"
];

// ---------- Configuración por defecto ----------
//
// Refleja el contrato inicial del usuario: 09:00 a 13:00, un solo bloque,
// jornada de lunes a viernes. Todo esto es editable desde Configuración
// para cuando el contrato cambie (jornada completa, bloque de tarde, etc).
//
// La meta de cada mes NO es un número fijo: se calcula día a día (horas
// semanales ÷ días laborales = horas por día hábil) sobre los días hábiles
// reales de ese mes. `metaMensual` queda solo para leer respaldos antiguos.

var RH_CONFIG_DEFAULT = {
  metaSemanal: 20,
  metaMensual: 86.67,
  horarioBase: {
    bloque1: { entrada: "09:00", salida: "13:00" },
    bloque2: { entrada: "14:00", salida: "18:00" }
  },
  bloque2Activo: false,
  diasLaborales: [1, 2, 3, 4, 5], // 0=domingo ... 6=sábado
  fechaInicioBalance: null, // se autocompleta con el primer registro
  actividades: RH_ACTIVIDADES_DEFAULT.slice()
};

// Feriados nacionales de Chile, para sugerir marcarlos cuando caen en un día
// hábil. Los que la ley traslada a lunes (San Pedro y San Pablo, Encuentro de
// Dos Mundos) ya vienen en su fecha trasladada.
var RH_FERIADOS_CHILE = {
  "2026-01-01": "Año Nuevo",
  "2026-04-03": "Viernes Santo",
  "2026-04-04": "Sábado Santo",
  "2026-05-01": "Día del Trabajo",
  "2026-05-21": "Día de las Glorias Navales",
  "2026-06-21": "Día de los Pueblos Indígenas",
  "2026-06-29": "San Pedro y San Pablo",
  "2026-07-16": "Virgen del Carmen",
  "2026-08-15": "Asunción de la Virgen",
  "2026-09-18": "Independencia Nacional",
  "2026-09-19": "Glorias del Ejército",
  "2026-10-12": "Encuentro de Dos Mundos",
  "2026-10-31": "Día de las Iglesias Evangélicas",
  "2026-11-01": "Día de Todos los Santos",
  "2026-12-08": "Inmaculada Concepción",
  "2026-12-25": "Navidad",
  "2027-01-01": "Año Nuevo",
  "2027-03-26": "Viernes Santo",
  "2027-03-27": "Sábado Santo",
  "2027-05-01": "Día del Trabajo",
  "2027-05-21": "Día de las Glorias Navales",
  "2027-06-21": "Día de los Pueblos Indígenas",
  "2027-06-28": "San Pedro y San Pablo",
  "2027-07-16": "Virgen del Carmen",
  "2027-08-15": "Asunción de la Virgen",
  "2027-09-18": "Independencia Nacional",
  "2027-09-19": "Glorias del Ejército",
  "2027-10-11": "Encuentro de Dos Mundos",
  "2027-10-31": "Día de las Iglesias Evangélicas",
  "2027-11-01": "Día de Todos los Santos",
  "2027-12-08": "Inmaculada Concepción",
  "2027-12-25": "Navidad"
};

var RH_TIPOS_LICENCIA = [
  { id: "medica", label: "Licencia médica" },
  { id: "permiso", label: "Permiso especial" },
  { id: "feriado", label: "Feriado" },
  { id: "no_convocado", label: "No convocado" },
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
