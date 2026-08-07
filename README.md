# Registro de Horas

App personal de marcaje de horas, licencias/feriados, estadísticas y control de saldo de horas.
100% local: no usa servidor ni base de datos externa — todo se guarda en el `localStorage` del
navegador donde la abras (o del teléfono, si se instala como PWA).

## Funciones

- **Marcaje**: varias jornadas por día (agregas las que necesites con "Agregar jornada extra"),
  nota/bitácora, autocompletado desde tu horario base, botones +/- 1 hora, historial mensual
  navegable. Botón "Me pidieron no asistir" para dejar el día como *No convocado* (no resta horas
  al balance, pero queda registrado que la ausencia no fue por decisión propia).
- **Licencias y Feriados**: licencia médica, permiso especial u otro, y feriados — cada uno con un
  interruptor de si ajusta o no la meta de horas de ese día.
- **Estadísticas**: cumplimiento semanal y mensual, balance semanal, mensual y acumulado (horas a
  favor/en contra), promedio de horas por día, conteo de feriados/licencias, y un detalle mensual
  semana por semana en acordeón desplegable.
- **Informe**: pestaña con identidad visual morada (Universidad de Magallanes) pensada para
  compartir con la jefatura — selector de período (manual, último/2/3 meses o año completo),
  resumen de meta vs. horas trabajadas del mes (sin balance a favor/en contra) y detalle día por
  día con los horarios en formato AM/PM y total; incluye botón Imprimir / PDF.
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
