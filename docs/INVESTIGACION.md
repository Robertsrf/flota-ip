# Investigación — aplicaciones de control de flota y combustible

**Fase 0 · 03/10/2026.** Base: los hallazgos previos del handoff (sección 4.1) más la revisión de 11 productos y guías del sector. Cada afirmación lleva su fuente al final. Lo que no se pudo verificar en fuentes públicas dice "no documentado".

---

## 1. Conclusiones en cinco líneas

1. **Nadie usa el viaje como unidad de costo.** Fleetio, Fuelly, Fuelio y AUTOsist parten de la carga de combustible. Simply Fleet y Drivvo tienen viajes/rutas, pero el rendimiento sigue saliendo de las cargas. Nuestro modelo (viaje + lleno-a-lleno como validación cruzada) no tiene equivalente directo: es la diferencia del producto.
2. **El método lleno-a-lleno es universal, y todos tienen una válvula de escape para el registro olvidado:** Fleetio "Reset usage", Simply Fleet "Missed previous fill-up", Drivvo "falta el registro anterior". Nuestro modelo no la tiene; propongo agregarla (OPCIONES, ajuste M2).
3. **Medir por horas es estándar.** Fleetio maneja medidores en millas, km **u horas**. Eso resuelve las plantas eléctricas que pidió Roberts el 03/10 sin inventar nada (D9).
4. **Las soluciones latinoamericanas en español** (TuFlota, Vecon, SmartReport) son buenas en mantenimiento y documentos, pero **flojas en el móvil del chofer**: en Vecon es la queja principal de los usuarios. Nuestra ventaja de uso está ahí.
5. **Los dashboards útiles se quedan en 10–15 KPIs**, tienen una capa "de un vistazo" de unos 4 indicadores más el conteo de alertas, y muestran primero lo que se desvía.

---

## 2. Tabla comparativa

| Producto (origen) | Cómo modela vehículo / viaje / carga / gasto | KPIs que muestra primero | Flujo del chofer en el móvil | Monedas y unidades | Datos incompletos |
|---|---|---|---|---|---|
| **Fleetio** (EE. UU.) | Vehículo con **medidor principal** (millas, km u horas); cargas de combustible; servicios; incidencias. Sin viaje como entidad central | Costo por distancia, costo por litro, gasto anual de combustible, distancia recorrida, excepciones de combustible por operador, **combustible vs. mantenimiento por mes** | Fleetio Go: fecha (ahora), **precio prellenado con la última carga**, cantidad, total calculado, odómetro; detalles opcionales (tipo, proveedor, referencia); adjuntos | Unidades configurables (distancia u horas); moneda: no documentado en lo revisado | Interruptor **"Parcial"**: sus litros y km pasan a la siguiente carga llena. **"Reset usage"** cuando faltó registrar la carga anterior |
| **Simply Fleet** | Vehículos; **viajes** (el gerente asigna, el chofer inicia y termina; registra ubicación y km de inicio y fin); combustible; gastos (peajes, multas); servicio con recordatorios por km o tiempo | Disponibilidad, costo por km, utilización, cumplimiento de mantenimiento; luego tendencias de consumo y gasto | App: foto del recibo con **lectura automática (IA)**, detección de la estación por ubicación, odómetro o distancia del viaje | Distancia del viaje como alternativa al odómetro; moneda no documentada | Solo las cargas llenas dan rendimiento; casilla **"Missed previous fill-up"** |
| **Drivvo** (Brasil, en español) | Vehículos; repostajes; gastos; servicios; ingresos; **rutas** (origen, destino, odómetro inicial; la ruta queda abierta y se cierra luego con el odómetro final); checklists; recordatorios | Consumo promedio, costo por km, km recorridos. Informes separados: general / repostaje / gastos / servicios | El gerente usa la web; el chofer registra desde Android/iOS; **el administrador define qué vehículos ve cada chofer**; login con correo | Según la configuración regional de la cuenta y del vehículo | Bandera **"¿Tanque lleno?"** y **"Falta el registro anterior"**. Exporta CSV (app), Excel y PDF (web) |
| **Fuelly** | Personal. Cargas con odómetro | Rendimiento por carga y promedio general | Registro rápido de carga | No documentado | La parcial no tiene rendimiento propio; hacen falta **dos llenas seguidas**. **El promedio general sí incluye las parciales** (km totales ÷ litros totales) |
| **Fuelio** (Sygic) | Personal. Cargas, costos, **registro de viajes con GPS y su costo** | Totales y promedios de cargas, costo de combustible y kilometraje, con gráficos | Registro de carga; viaje manual o automático (Bluetooth del vehículo) | No documentado | Algoritmo de tanque lleno; admite parciales |
| **AUTOsist** | Registros de mantenimiento, combustible, inspecciones y documentos; app + portal web sincronizados | Análisis de gasto y rendimiento | El chofer actualiza inspecciones digitales; recibos y documentos con foto | No documentado | Recordatorios por **odómetro y/o tiempo** (push y correo); exporta a Excel |
| **Whip Around** | Inspecciones pre y post viaje (DVIR) con fotos y defectos; combustible; mantenimiento y órdenes de trabajo | Estado de la flota, defectos abiertos | Inspección guiada en el teléfono, sincroniza con la web | No documentado | Precio por vehículo, pensado para flotas pequeñas y medianas |
| **Fleet Complete** | Telemática: GPS en tiempo real, comportamiento del chofer, ralentí, geocercas, combustible, rutas | Panel en tiempo real: eficiencia de combustible, conducta, precisión de ruta | App del chofer orientada a despacho y rutas | No documentado | Depende de hardware instalado. **Fuera de alcance** para IP |
| **TuFlota** (en español) | Inventario de vehículos o equipos con motor; cargas con **cálculo de rendimiento**; bitácora de mantenimiento; asignación operador–vehículo; proveedores (talleres y estaciones); incidentes; documentos con fotos | Rendimiento y vehículos más costosos | Web sin instalación; acceso por vehículo | No documentado | Recordatorios de mantenimiento y vencimientos (licencias, seguros) |
| **Vecon** (México, 2019) | Combustible y rendimiento, mantenimiento preventivo con recordatorios, vigencia de documentos de vehículo y chofer (aviso 15 días antes) | **Costo por km de cada unidad, semanal** | **Débil**: los usuarios piden mejorar el acceso desde el teléfono; menús poco intuitivos; sin importación desde Excel | Pesos mexicanos | No documentado |
| **SmartReport** (Chile) | **"Hoja de vida digital"** por vehículo (datos técnicos, operación y costos); combustible y consumo con detección de anomalías; mantenimiento; documentos y seguros | **"Costo real por kilómetro (CPK)"**, flota operativa, ahorro del mes, ranking de riesgo | No documentado | Pesos chilenos | No documentado |

**Guía complementaria (Geotab Latinoamérica):** muestra primero el consumo por unidad, ruta y período con comparativos; luego alertas cuando el consumo se aparta de la línea base, y comparación entre vehículos similares. Recomienda cruzar las cargas contra la operación real: cargas que no coinciden con viajes, o cargas fuera de horario.

**Contexto regional:** en las transportistas medianas de Colombia el combustible se maneja con vales o tarjetas que se concilian a fin de mes, con un asiento contable único, o confiando en lo que reporta el chofer. *Este dato viene del resumen del buscador: la página original (Ofima) bloqueó la lectura directa.* Es el mismo punto de partida que IP: el sistema reemplaza "confiar en el reporte" por un reporte con foto, km y cálculo.

---

## 3. Patrones de UI

### 3.1 Dashboard de flota

- **Tres capas.** (1) De un vistazo: unos 4 KPIs principales más el conteo de alertas, sin hacer scroll, legible en menos de 10 s. (2) Tendencias: consumo y gasto por mes, rendimiento por unidad. (3) Detalle: tablas de unidades, viajes y cargas.
- **Comparar siempre contra algo:** el período anterior (▲/▼, como los reportes de IP), el promedio de la flota (línea de referencia en el ranking) o el propio historial de la unidad (90 días).
- **Primero la excepción:** marcar solo lo que se desvía ≥ 10–15 %; si todo está "en color", nada lo está.
- **Combustible vs. mantenimiento por mes** aparece en Fleetio y SmartReport como el gráfico que la gerencia lee primero. Coincide con el gráfico 1 del handoff.
- **Costo por km** es el KPI "norte" en las soluciones latinoamericanas (SmartReport, Vecon). Lo dejamos en la primera fila.

### 3.2 Tablas densas

- Numerales tabulares, cifras alineadas a la derecha, unidad en el encabezado ("km/L", "$") y no repetida en cada celda.
- Encabezado fijo, columnas ordenables con `aria-sort`, primera columna (placa o alias) fija en móvil.
- Cada gráfico tiene su tabla equivalente (accesibilidad y exportación).
- En móvil, la tabla de unidades se convierte en lista de filas de dos líneas, no en tarjetas idénticas.

### 3.3 Formularios móviles de campo (el chofer)

- `inputmode="decimal"` en km, litros y montos; nada de selects nativos para elecciones de 2–5 opciones: botones segmentados grandes ($0,50 / $0,60; Lleno · 3/4 · 1/2 · 1/4 · Otro).
- **Área táctil ≥ 48 px** (el handoff) y la acción principal a 64–72 px. Las guías para trabajo con guantes piden 60 px y 16 px de separación.
- **A pleno sol:** texto negro o casi negro, bordes visibles en campos y botones (el brillo borra las sombras), nada de degradados ni sombras como única separación. Los azules y verdes claros desaparecen al sol.
- Sin gestos de deslizar ni multitáctil. Vibración corta al confirmar (Android; iOS no la expone en la web).
- Valores prellenados (último km, último precio usado, "Lleno" heredado) y la diferencia a la vista ("+0 km desde el último registro").
- Errores junto al campo, con los números ("El km de llegada (10.380) es menor que el de salida (10.400)").

### 3.4 Estados vacíos y alertas

- El estado vacío enseña la siguiente acción: "Aún no hay rutas este mes. Inicia la primera desde el camión."
- Gráfico sin datos: mensaje + acción, nunca ejes vacíos. Carga: esqueleto, no spinner en medio del contenido.
- Alertas con regla visible ("15 % peor que su promedio de 90 días"), enlace al registro y una acción ("Revisar viaje").
- Estado offline explícito ("Sin señal: 2 registros esperando envío"), no un error genérico.

---

## 4. Patrones adoptados

| Patrón | De dónde | Cómo lo usamos |
|---|---|---|
| Lleno-a-lleno con bandera de parcial | Fleetio, Fuelly, Drivvo, Simply Fleet | `tanque_lleno` en cada carga; las parciales se suman al siguiente ciclo |
| **Bandera "carga anterior omitida"** | Fleetio (Reset usage), Simply Fleet, Drivvo | Nuevo: corta el ciclo lleno-a-lleno sin inventar litros (ajuste M2) |
| **Medidor por horas** | Fleetio | Plantas eléctricas medidas con horómetro: L/h y costo/h (D9) |
| Precio prellenado con la última carga | Fleetio Go | El último precio usado por ese camión queda preseleccionado |
| Ruta abierta que se cierra después con el odómetro final | Drivvo, Simply Fleet | Es nuestro viaje `en_curso` |
| Permisos por vehículo para el chofer | Drivvo, TuFlota | El chofer registra en el camión de su ruta o en su camión habitual |
| Gerencia en web, chofer en app | Drivvo, AUTOsist, Whip Around | Dos contextos con una misma identidad (ver OPCIONES, navegación) |
| Combustible vs. mantenimiento por mes | Fleetio, SmartReport | Gráfico 1 del dashboard |
| Costo por km como KPI norte | SmartReport, Vecon | Primera fila del dashboard |
| Ficha / "hoja de vida" por unidad con pestañas | SmartReport, Fleetio | Ficha del camión (y de la planta) |
| Informes separados por tipo de registro | Drivvo | Pestañas Viajes / Combustible / Mantenimiento |
| Exportar con los filtros aplicados | Drivvo, AUTOsist | Botón CSV/Excel en cada tabla |
| Promedio general que incluye parciales | Fuelly | Agregados ponderados Σ km ÷ Σ L |

## 5. Lo que no copiamos

- **Telemática y GPS** (Fleet Complete, Motive, Geotab): requieren hardware, inflan el panel y están fuera de alcance.
- **Paneles de 30–40 indicadores** con el mismo peso visual: producen "fatiga de dashboard".
- **Menús profundos por módulo** (los usuarios de Vecon se quejan de menús poco intuitivos): máximo dos niveles.
- **Puntaje y ranking de choferes** como gamificación: el ranking es de camiones y rutas, no de personas. Si algún día se compara a los choferes, que sea una decisión explícita de la gerencia.
- **Lectura automática del recibo con IA** (Simply Fleet): costo y error en recibos térmicos borrosos. La foto queda como respaldo y el dato se toca con dos botones.
- **Inspecciones DVIR y órdenes de trabajo** (Whip Around, AUTOsist): útiles, pero no son el problema de IP. Fase 2 como mucho.
- **Gráficos decorativos:** velocímetros 3D, donas con más de 5 categorías, mapas sin GPS.
- **Login por correo obligatorio** (Drivvo): muchos choferes no usan correo (D3).

---

## 6. Verificaciones técnicas hechas en la Fase 0

| Tema | Hallazgo | Impacto |
|---|---|---|
| API de tasa BCV | `GET https://ve.dolarapi.com/v1/dolares/oficial` responde `{ moneda: "USD", fuente: "oficial", nombre, compra: null, venta: null, promedio: 866.5612, fechaActualizacion: "2026-10-02T00:00:00-04:00" }` (consultado el 03/10/2026) | Mapear `bs_por_usd = promedio` y `fecha = fecha de fechaActualizacion en America/Caracas`. `compra` y `venta` vienen en `null`: no usarlas. El fin de semana no hay dato nuevo: se toma la última tasa anterior |
| Supabase, plan gratuito | 500 MB de base, 1 GB de Storage, 5 GB de transferencia; **el proyecto se pausa tras 7 días sin peticiones**; **sin respaldos automáticos** | Para datos operativos conviene el plan Pro, o como mínimo un respaldo semanal programado (pregunta 9) |
| GitHub Pages | Publicar desde un repo **privado** exige **GitHub Pro** o superior; el sitio publicado es público aunque el repo no lo sea | D1 depende del plan de GitHub de Roberts. Que el sitio sea público no es problema: sin sesión no se ve ningún dato (RLS) |
| Netlify, plan gratuito | Desde 2025 cobra en créditos: 300/mes; cada deploy a producción cuesta 15; los previews por rama son gratis | Con desarrollo activo, unos 20 deploys a producción al mes pueden quedarse cortos |
| Sincronización en segundo plano | Safari (macOS e iOS) **no** soporta Background Sync API | La cola offline se vacía al abrir la app y con los eventos `online` y `visibilitychange`, no con el service worker (D4) |
| ECharts vs. Recharts | Con importación modular (`echarts/core`), ECharts queda en un tamaño comprimido comparable a Recharts | No hay castigo real de peso por elegir ECharts (D2) |

---

## 7. Fuentes

- Fleetio Go, cargas: https://help.fleetio.com/en_US/fuel-entries-in-fleetio-go
- Fleetio, cargas parciales: https://help.fleetio.com/en_US/partial-fuel-entries
- Fleetio, panel de costos de combustible y analítica: https://help.fleetio.com/en_US/advanced-analytics-overview-5 · https://www.fleetio.com/blog/new-reports-cost-summary-trend
- Simply Fleet, viajes: https://www.fleetowner.com/product-spotlight/product/55399565/simply-fleet-fleet-management-software-connects-trip-tracking-driver-data-and-maintenance
- Simply Fleet, combustible: https://www.simplyfleet.app/features/fuel-management-software
- Simply Fleet, dashboard y KPIs: https://www.simplyfleet.app/blog/fleet-management-dashboard
- Drivvo, preguntas frecuentes (flotas): https://drivvo.com/en/faq/ · plataforma: https://drivvo.com/en-US
- Fuelly, parciales: https://www.fuelly.com/forums/f2/partial-fill-up-clarification-1160-post1160.html · FAQ: https://www.fuelly.com/index.php/faq/full
- Fuelio: https://www.bluestacks.com/campaign/com.kajda.fuelio/es
- AUTOsist: https://www.automotive-fleet.com/137263/autosist-launches-fleet-maintenance-and-fuel-tracker-app · https://autosist.com/
- Whip Around: https://marketplace.geotab.com/solutions/whip-around/
- Fleet Complete: https://www.softwaresuggest.com/fleet-complete
- TuFlota: https://www.comparasoftware.com/tuflota
- Vecon: https://www.capterra.es/software/206342/vecon
- SmartReport: https://www.smartreport.cl/gestion-de-flotas
- Geotab Latinoamérica, control de combustible: https://www.geotab.com/es-latam/blog/control-de-combustible-en-flotillas-guia-practica/
- Ofima, combustible en transporte (solo resumen del buscador): https://www.ofima.com/?p=24939
- Jerarquía de KPIs en dashboards de flota: https://heavyvehicleinspection.com/blog/post/modern-fleet-management-ui-ux-dashboard-kpis-guide
- Diseño para trabajo de campo (guantes, sol): https://thisisglance.com/learning-centre/how-should-i-design-apps-for-construction-workers · https://blog.apario.net/on-writing-software-for-people-who-work-outside
- Supabase, límites del plan gratuito: https://automationatlas.io/answers/supabase-free-tier-limits-2026/
- GitHub Pages en repos privados: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Netlify, créditos: https://netli.fyi/blog/netlify-free-plan-limits-2026
- PWA en iOS, Background Sync: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- ECharts, importación modular: https://echarts.apache.org/handbook/en/basics/import
- DolarApi Venezuela: https://ve.dolarapi.com/v1/dolares/oficial · https://dolarapi.com/docs
