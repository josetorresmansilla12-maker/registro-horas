# Registro de Horas

App personal de marcaje de horas, licencias/feriados, estadísticas y control de saldo de horas.
Todo se guarda en el `localStorage` del navegador donde la abras (o del teléfono, si se instala
como PWA). Opcionalmente se sincroniza entre dispositivos con Firebase (ver abajo).

## Funciones

- **Marcaje**: bloque "Marcaje rápido" para marcar la hora de entrada/salida con un toque (con
  botón para deshacer la última marca por si se presiona por error) y elegir ahí mismo las
  actividades del día; varias jornadas por día; **actividades rápidas** (botones de selección
  múltiple: Talleres vocacionales Kuder, Aplicaciones de test vocacionales Kuder, Oficina, Home
  office, Ensayos PAES y "Otro" para escribir una); nota/bitácora; historial
  mensual (en el celular se ve como tarjetas) con fines de semana y feriados en rojo, "no
  convocado" en ámbar, días libres en celeste, los sábados y domingos como **Descanso**, para
  seguir cada semana, y los días hábiles ya pasados **sin registro** destacados, con botones para
  registrarlos o marcarlos como día libre. Si guardas una jornada en una fecha que ya tenía registro, se **suma** a lo
  existente (con aviso) en vez de reemplazarlo. Al editar un día y cambiarle la fecha, la jornada
  completa (horas, nota y actividades) se mueve a la nueva fecha.
- **Ocupar horas libres** (botón 🌴 en Marcaje y en Arreglo de horas): para los días que no
  trabajas y pagas con las horas que te deben (por ejemplo, si te enfermas y te piden no presentar
  licencia). Eliges la mañana, la tarde, el día completo u otra cantidad de horas, para un día o un
  rango de fechas; ese día no cuenta como día a trabajar y esas horas se descuentan del saldo.
- **Licencias y Feriados**: licencia médica, permiso especial, feriado, *No convocado* u otro, cada
  uno con rango de fechas; botón para agregar de una vez los **feriados nacionales de Chile** del
  año que caen en días hábiles.
- **Arreglo de horas**: cuántas horas te deben (o debes) según tu contrato para el período que
  elijas (todo, un mes o fechas a elección), como una boleta simple: trabajadas − contrato − horas
  libres ocupadas = saldo. Muestra para cuántos días completos, mañanas o tardes libres te alcanza,
  un **planificador** para elegir qué días ocupar (en verde los que alcanzan, en rojo los que no) y
  agendarlos, la lista de horas libres ocupadas, el detalle por mes, las horas trabajadas en la
  mañana/tarde (respaldo) y un botón para copiar un resumen. Ahí se configuran las horas semanales
  del contrato (con cambios desde una fecha, sin alterar los meses anteriores) y el horario normal:
  mañana 09:00–13:00 y tarde 14:30–17:30 (día completo = 7 h).
- **Contrato**: 22 h semanales (media jornada) = 4h 24m por día hábil. El botón **✏️ Cambiar
  contrato** (en Arreglo de horas, en el informe "Horas que me deben" y en Configuración) cambia las
  horas para todo el período o solo desde una fecha, muestra antes cómo queda tu saldo y recalcula
  todo: estadísticas, arreglo de horas, informes y Excel.
- **Estadísticas** (uso personal, no se informa); **cada cuadro tiene su propio selector de
  período**: mes con flechas, todo el historial o fechas a elección, independiente de los demás:
  - Cuota del mes en horas y porcentaje, con el cálculo explicado (días hábiles − feriados − no
    convocados × horas por día) y el ritmo necesario por semana y por día hábil.
  - **Por revisar**: feriados nacionales sin marcar, días hábiles sin registro y días con horas
    dentro de un período "no convocado".
  - Balance por **mes calendario** (contado hasta hoy en el mes en curso) y acumulado, con
    gráficos circulares y barras "mes a mes".
  - Asistencia con filtro **Mes** (calendario), **Semana** (porcentaje por semana) o **Día**.
  - Balance con 4 gráficos circulares: balance del mes, acumulado, meses a favor/en contra y días
    hábiles del mes (trabajados, justificados, sin registro).
  - Más estadísticas: días trabajados, promedio por día, jornada más larga y más corta, días con
    más de una y de dos jornadas, actividad más realizada, semana con más horas, comparación con
    el mes anterior y horas por día de la semana; y **actividades frecuentes** (mes o todo).
- **Informe**: pestaña con identidad visual morada (Universidad de Magallanes) pensada para
  compartir con la jefatura, con dos tipos:
  - **Horas trabajadas**: resumen de meta vs. horas trabajadas y detalle día por día con horarios en
    formato de 24 horas, actividades y la descripción de cada día resumida y con la ortografía
    corregida (la nota original no cambia; en Marcaje se ve una vista previa y se puede escribir
    otro texto solo para el informe).
  - **Horas que me deben**: saldo según el contrato, detalle por mes, horas libres ocupadas y el
    respaldo día por día (trabajé / contrato / libre / saldo).
  Selector de período (desde el inicio, mes actual, últimos 30/60/90 días, año o fechas a mano),
  botón ✏️ en cada día para corregirlo ahí mismo (el cambio se guarda en toda la app) y botón
  Imprimir / PDF. Si el período abarca más de un mes, los días se separan con el nombre de cada
  mes. Con "Tus datos en el informe" se agregan tu nombre, cargo, institución y logo
  arriba del informe, y una línea de firma con la fecha de emisión al final.
- **Funciones y Proyectos**: bitácora aparte de responsabilidades o proyectos asignados.
- **Configuración**: días laborales, fecha de inicio del seguimiento, sincronización, lista de
  actividades habituales, una Papelera con lo eliminado (recuperable por 30 días) y un apartado
  **🔒 Privado** con contraseña. La meta de
  cada mes se calcula sola: horas semanales ÷ días laborales × días hábiles reales del mes.
- **Exportar a Excel**: reporte `.xlsx` por rango de fechas con total del período, hoja "Informe"
  lista para capturar y hoja opcional de proyectos.
- **Respaldo**: exportar/importar todos los datos en `.json` (la importación nunca sobrescribe un
  marcaje ya guardado; solo le agrega las actividades que traiga el respaldo) y aviso si llevas
  más de 7 días sin respaldar.
- **Sincronización** teléfono ↔ computador (Configuración): con un mismo código secreto, los datos
  se guardan en Firebase (proyecto propio "Registro de Horas", Realtime Database) y aparecen solos
  en el otro dispositivo en segundos. Sin internet se guarda local y se sube al volver la conexión;
  si ambos cambiaron algo a la vez, se combina sin perder jornadas.
- **Diseño**: color morado de la Universidad de Magallanes, pensado primero para el celular. Todas
  las horas se muestran y se ingresan en formato de 24 horas: al tocar un campo de hora se abre una
  ruleta como la del iPhone, con las horas (00–23) y los minutos lado a lado.

## Uso local

Necesita servirse por HTTP (no abrir el `index.html` directo con doble clic), porque usa un
service worker y módulos:

```bash
cd registro-horas
python3 -m http.server 8000
```

Luego abre `http://localhost:8000`.

## Privacidad

Ningún dato sale del dispositivo: no hay backend, no hay analítica, no hay llamadas de red salvo
para cargar los propios archivos de la app. El respaldo `.json` y el reporte `.xlsx` se generan y
descargan localmente en el navegador.
