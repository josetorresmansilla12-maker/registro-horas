# Registro de Horas

App personal de marcaje de horas, licencias/feriados, estadísticas y control de saldo de horas.
100% local: no usa servidor ni base de datos externa — todo se guarda en el `localStorage` del
navegador donde la abras (o del teléfono, si se instala como PWA).

## Funciones

- **Marcaje**: bloque "Marcaje rápido" para marcar la hora de entrada/salida con un toque (con
  botón para deshacer la última marca por si se presiona por error); varias jornadas por día
  (agregas las que necesites con "Agregar jornada extra", y si el día elegido ya tiene horas
  guardadas se precargan y se deja listo un espacio para sumar una jornada extra sin perder lo
  guardado); nota/bitácora, autocompletado desde tu horario base, historial mensual navegable.
  El formulario queda en blanco después de cada guardado, listo para otra fecha. Botón "No me
  convocaron" (🚫) y "Aún no contratado" (🪪) para días que no cuentan como falta ni afectan el
  cálculo de horas.
- **Licencias y Feriados**: licencia médica, permiso especial, feriado, *No convocado* (la oficina
  pidió no asistir) u otro — cada uno con **rango de fecha inicio/fin** (útil para un período
  completo, ej. una semana de receso, sin marcar día por día) y un interruptor de si ajusta o no
  la meta de horas de esos días.
- **Estadísticas** (uso personal, no se informa): cuota mensual como gráfico principal (horas
  cumplidas/faltantes en horas y porcentaje, más el ritmo necesario por semana y por día hábil
  para llegar a la meta), semana actual como referencia, balance semanal/mensual/acumulado (horas
  a favor/en contra), promedio de horas por día, conteo de feriados/no convocados/licencias, y un
  detalle mensual semana por semana en acordeón desplegable. Cualquier día trabajado (sin importar
  las horas) se marca como "Cumplido".
- **Informe**: pestaña con identidad visual morada (Universidad de Magallanes) pensada para
  compartir con la jefatura — rango por defecto el mes actual completo, selector de período
  (manual, mes actual, últimos 30/60/90 días o año completo), resumen de meta vs. horas trabajadas
  del mes (sin balance a favor/en contra) y detalle día por día con los horarios en formato AM/PM
  y total; incluye botón Imprimir / PDF.
- **Funciones y Proyectos**: bitácora aparte de responsabilidades o proyectos asignados.
- **Configuración**: metas de horas, horario base, días laborales (lunes a domingo), fecha desde la
  que se calcula el balance, y una Papelera con lo eliminado (recuperable por 30 días).
- **Exportar a Excel**: reporte `.xlsx` por rango de fechas con total del período, hoja "Informe"
  lista para capturar y hoja opcional de proyectos.
- **Respaldo**: exportar/importar todos los datos en `.json` (la importación nunca sobrescribe un
  marcaje ya guardado) y aviso si llevas más de 7 días sin respaldar.

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
