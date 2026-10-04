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
  mensual (en el celular se ve como tarjetas) con fines de semana y feriados en rojo y "no
  convocado" en ámbar. Si guardas una jornada en una fecha que ya tenía registro, se **suma** a lo
  existente (con aviso) en vez de reemplazarlo.
- **Licencias y Feriados**: licencia médica, permiso especial, feriado, *No convocado* u otro, cada
  uno con rango de fechas; botón para agregar de una vez los **feriados nacionales de Chile** del
  año que caen en días hábiles.
- **Estadísticas** (uso personal, no se informa); **cada cuadro tiene su propio selector de mes**
  con flechas, independiente de los demás:
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
  compartir con la jefatura — rango por defecto el mes actual completo, selector de período
  (manual, mes actual, últimos 30/60/90 días o año completo), resumen de meta vs. horas trabajadas
  del mes (sin balance a favor/en contra) y detalle día por día con horarios AM/PM, actividades y
  días rojos (fines de semana/feriados); incluye botón Imprimir / PDF.
- **Funciones y Proyectos**: bitácora aparte de responsabilidades o proyectos asignados.
- **Configuración**: horas por semana (la meta de cada mes se calcula sola: horas por día hábil ×
  días hábiles reales del mes), horario base, días laborales, fecha de inicio del seguimiento,
  lista de actividades habituales y una Papelera con lo eliminado (recuperable por 30 días).
- **Exportar a Excel**: reporte `.xlsx` por rango de fechas con total del período, hoja "Informe"
  lista para capturar y hoja opcional de proyectos.
- **Respaldo**: exportar/importar todos los datos en `.json` (la importación nunca sobrescribe un
  marcaje ya guardado; solo le agrega las actividades que traiga el respaldo) y aviso si llevas
  más de 7 días sin respaldar.
- **Sincronización** teléfono ↔ computador (Configuración): con un mismo código secreto, los datos
  se guardan en Firebase (proyecto propio "Registro de Horas", Realtime Database) y aparecen solos
  en el otro dispositivo en segundos. Sin internet se guarda local y se sube al volver la conexión;
  si ambos cambiaron algo a la vez, se combina sin perder jornadas.
- **Diseño**: color morado de la Universidad de Magallanes, pensado primero para el celular.

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
