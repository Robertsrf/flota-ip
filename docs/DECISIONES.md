# Decisiones y supuestos

Registro de lo que se asumió o decidió sin bloquear el trabajo (handoff, sección 0.8). Estado: **propuesta** (espera el checkpoint), **aprobada**, **descartada**.

## Checkpoint F0 · respuestas de Roberts · 03/10/2026

| Tema | Decisión | Consecuencia para la construcción |
|---|---|---|
| Navegación | **Mixta:** cabina sin barra para el chofer; barra lateral en escritorio y barra inferior en móvil para la oficina | Dos layouts: `CabinaLayout` y `OficinaLayout` |
| Dirección visual | **B · Señal vial** (verde vía `#0F5B3F`, Overpass, firma "el pórtico") | Se fija en `DESIGN.md` en la F2 |
| Botón "En ruta" | **Variante B:** botón de acción a todo el ancho, estado aparte, "Deshacer" 10 s | — |
| Nombre e identidad | **Flota IP con el logo de IP** | Falta el archivo del logo (ideal: SVG y una versión blanca para la barra verde) |
| D1 Hosting | **GitHub Pages con repo público** (Roberts no tiene GitHub Pro) | Cambia el supuesto del handoff (repo privado). En el repo nunca entran claves, `.env`, dumps ni fotos reales; las llaves van en los secrets de GitHub Actions; `base` de Vite y fallback `404.html` |
| Plan de Supabase | **Gratuito + respaldo semanal** | Workflow semanal con `pg_dump` **cifrado** antes de guardarse (en repo público cualquier usuario de GitHub puede descargar los artefactos de Actions) y ping para que el proyecto no se pause a los 7 días sin uso |
| D2 Gráficos | **ECharts**, importación modular | — |
| D3 Login | **Usuario + PIN de 6 dígitos** para choferes; correo + contraseña para la oficina | Bloqueo temporal tras 5 intentos fallidos |
| D4 Offline | **Nivel 2 en los flujos del chofer** | Cola en IndexedDB (Dexie); vaciado al abrir, `online` y `visibilitychange` |
| D5 Precio | **Promedio ponderado** de las cargas del viaje | Respaldo: última carga de la unidad → precio de catálogo, marcado `estimado` |
| D6 Nivel al salir | **Ambos:** Lleno (o heredado), cuartos, litros | — |
| D7 Mantenimiento | **Los choferes sí registran gastos**, que quedan **pendientes hasta que flota los apruebe** | Cambia la recomendación. `mantenimientos` lleva estado de aprobación (`pendiente` / `aprobado` / `rechazado`, con quién y cuándo); el dashboard suma solo los aprobados; la bandeja de revisión muestra los pendientes |
| D8 Ubicaciones | **Solo flota y superusuario.** Roberts las cargará desde la app (no hay lista inicial) | "Eliminar" en la interfaz: si la ubicación nunca se usó, se borra; si tiene viajes, se archiva (deja de aparecer en listas, el historial la conserva). La ubicación de sistema "Otro (indicar en la nota)" se mantiene |
| D9 Plantas | **Tabla `unidades`** con `tipo` (`camion`/`planta`) y `medidor` (`km`/`horas`/`ninguno`) | Las 2 plantas **no tienen horómetro**: `medidor = 'ninguno'`, se controlan litros y costo por período (sin L/h ni ciclos). Sus cargas las registran flota o el superusuario; el combustible llega en bidones desde la estación |
| D10 Superusuario | **El rol `admin` pasa a `superusuario`**: edita cualquier dato de entrada con motivo y auditoría; las cifras calculadas se recalculan, no se editan a mano | Superusuarios: **Roberts y una persona de IP** (nombre pendiente). **Flota puede crear choferes** y restablecer su PIN; usuarios de oficina y roles, solo el superusuario |
| M1 | Aprobado (sigue de D9) | `vehiculos` → `unidades`; `km_odometro` → `lectura_medidor` (nula si `medidor = 'ninguno'`) |
| M2 | **Aprobado:** `carga_previa_omitida` en repostajes | — |
| M3 | **Aprobado:** folio legible (V-0142, R-0311, M-0058) | Secuencia en el servidor; "pendiente" mientras está en la cola offline |
| M4 | Aprobado (sigue de D8) | — |
| M5 | Aprobado (sigue de D10) | — |
| Combustible | **Mixto** (gasolina y diésel) | `combustible` por unidad; el dashboard puede separar litros por tipo |
| Precios | **USD por litro**; **$0,50 y $0,60 valen para ambos combustibles** | El catálogo de precios no se separa por combustible |
| Asignación | **Los choferes rotan seguido** | La cabina pide elegir el camión al iniciar la ruta (el último usado, preseleccionado). El chofer solo registra repostajes y gastos en el camión de su ruta en curso o, sin ruta abierta, en el último que manejó |
| Paradas | **Varias paradas, en el MVP, como lista** (sin km por parada) | Nueva tabla `viaje_paradas (viaje_id, orden, ubicacion_id)`. Combustible y costo por ruta completa; el dashboard muestra costo por ruta y por destino principal. Supuesto: el destino principal es la última parada, editable |
| Fotos | **Todas opcionales** | Recibo, odómetro y factura opcionales; se comprimen igual (~200 KB) |
| Tamaño | **6 a 10 camiones** + 2 plantas | Prueba de rendimiento del dashboard con 15 unidades (margen sobre la flota real) |
| Moneda de mantenimiento | **Bs y $** | Tasa BCV propuesta y editable |
| Origen | **Siempre la misma sede** | Origen por defecto: la sede (la carga Roberts) |
| Histórico | **No hay: se arranca de cero** | Sin importador |

## Registro de supuestos de la F0

| # | Fecha | Decisión o supuesto | Motivo | Estado |
|---|---|---|---|---|
| 001 | 03/10/2026 | Se instalaron a nivel de usuario las skills `impeccable` (pbakaus), `frontend-design` y `webapp-testing` (anthropics/skills). `ui-ux-pro-max` ya estaba instalada. Su buscador local necesita Python, que no está instalado: se consultó su referencia estática | Sección 3 del handoff | aprobada |
| 002 | 03/10/2026 | `PRODUCT.md` (contexto de `impeccable teach`) se escribió a partir del handoff, sin la entrevista de la skill; el checkpoint F0 hizo de ronda de aprobación y el archivo se actualizó con las respuestas | El handoff fija la fuente de `teach` | aprobada |
| 003 | 03/10/2026 | Las direcciones visuales salieron de `impeccable concept-seed` (modo operar, semilla `5ae8474e`); se presentaron en `docs/OPCIONES.md` y `docs/opciones-visuales.html` | El handoff pide presentar en `OPCIONES.md` | aprobada |
| 004 | 03/10/2026 | Plantas eléctricas → D9 / M1 | Mensaje de Roberts durante la F0 | aprobada |
| 005 | 03/10/2026 | Superusuario → D10 / M5 | Mensaje de Roberts durante la F0 | aprobada |
| 006 | 03/10/2026 | Tasa BCV: `bs_por_usd = promedio`; `fecha = fechaActualizacion` en `America/Caracas`; `compra` y `venta` vienen en `null` | Respuesta real de `ve.dolarapi.com` del 03/10/2026 | aprobada (F5) |
| 007 | 03/10/2026 | M2 `carga_previa_omitida` | Fleetio, Simply Fleet, Drivvo | aprobada |
| 008 | 03/10/2026 | M3 folio legible | Soporte telefónico | aprobada |
| 009 | 03/10/2026 | Repo git local en `main`; el remoto se crea en la F1 (público, según D1) | La F0 solo produce documentos | aprobada |
| 010 | 03/10/2026 | `docs/HANDOFF.md` es copia exacta de `HANDOFF_Flota_IP.md` | Sección 0.3 del handoff | aprobada |
| 011 | 03/10/2026 | "Eliminar" una ubicación borra solo si nunca se usó; si tiene viajes, la archiva | Roberts quiere agregar y eliminar destinos; el handoff prohíbe borrar datos operativos | aprobada |
| 012 | 03/10/2026 | Destino principal de una ruta con paradas = última parada, editable por el chofer | Supuesto no bloqueante | aplicada (confirmar con Roberts en la prueba conjunta) |

## Decisiones y supuestos de la construcción (F1–F8)

| # | Fecha | Decisión o supuesto | Motivo | Estado |
|---|---|---|---|---|
| 013 | 03/10/2026 | Los checkpoints de F1, F4 y F6 no se detuvieron: se revisan juntos en la prueba final | Roberts pidió "construye todo, al final creamos repo, subimos y probamos" | aplicada |
| 014 | 03/10/2026 | Desarrollo y pruebas sin Docker: PGlite (Postgres 18 en WebAssembly) con un shim que imita Supabase (esquema `auth`, `auth.uid()`, roles y privilegios por defecto) y un emulador HTTP (REST, Auth, Storage, Functions). Corren las mismas migraciones que irán a producción | No hay Docker ni proyecto Supabase todavía; permite probar RLS, motor y la app completa | aplicada |
| 015 | 03/10/2026 | Realtime no se emula en local: allí la app consulta cada 30 s. En producción se usa Realtime en `viajes` y `unidades` | Limitación del emulador | aplicada |
| 016 | 03/10/2026 | **Gasto de combustible = compras** (cada carga una vez; las de un viaje cuentan en el mes de llegada, las sueltas por su fecha). **Costo del viaje = consumo × precio ponderado**. Son cifras distintas y se rotulan distinto | Un reporte de gasto debe sumar lo pagado; el costo de una ruta debe reflejar lo que consumió | aplicada |
| 017 | 03/10/2026 | **Costo por km total = (combustible comprado + mantenimiento aprobado) ÷ km**; el KPI muestra también el de solo combustible | Sección 9 del handoff; el mantenimiento pendiente o rechazado no cuenta | aplicada |
| 018 | 03/10/2026 | Variaciones ▲/▼ contra los mismos días del período anterior, y solo si ese período tiene 3 viajes o más; si no, "Sin datos para comparar" | Evita variaciones de cientos por ciento con datos escasos | aplicada |
| 019 | 03/10/2026 | Folio por tabla con identidad de Postgres (V-0142, R-0311, M-0058); en la cola offline se muestra "pendiente" | M3 | aplicada |
| 020 | 03/10/2026 | Login con correo sintético `<usuario>@usuarios.flota-ip.invalid`: PIN de 6 dígitos para choferes, contraseña de 8 o más para oficina; registro público desactivado | D3. Supabase solo valida el dominio al enviar correos y la app no envía ninguno | aplicada (verificar en la puesta en marcha) |
| 021 | 03/10/2026 | Bloqueo de 30 s **en el cliente** tras 5 intentos fallidos. El límite real lo pone GoTrue por IP; un bloqueo por usuario en el servidor necesitaría hooks de Auth | Limitación conocida | aplicada |
| 022 | 03/10/2026 | Plantas eléctricas con `medidor = 'ninguno'`: lectura nula, sin ciclos ni km/L; solo litros y costo del período. Sus cargas las registran flota o el superusuario | D9 | aplicada |
| 023 | 06/10/2026 | Ventana de corrección del chofer: 30 min, editable en Configuración; la interfaz y el servidor usan el mismo valor. El chofer corrige la ruta y sus cargas desde el resumen ("Corregir datos"); sus gastos los corrige flota | D10 | aplicada |
| 024 | 03/10/2026 | Ubicación de sistema "Otro (indicar en la nota)": si se usa, la ruta queda marcada para revisión con el texto del chofer | D8 | aplicada |
| 025 | 03/10/2026 | Tasa BCV programada los días hábiles a las 09:30 y 17:30 de Caracas; nunca sobrescribe una tasa cargada a mano | Supuesto 006 y sección 7 del handoff | aplicada |
| 026 | 06/10/2026 | Una sola lista blanca de funciones ejecutables (migración 07) y privilegios por defecto cerrados. Antes, por los privilegios por defecto de Supabase, cualquier usuario autenticado podía llamar funciones internas (`recalcular_viaje`, `modo_sistema`) | Hallado en la revisión final; cubierto con una prueba de lista exacta | aplicada |
| 027 | 06/10/2026 | PWA: los módulos de gráficos y Excel (1,1 MB) quedan fuera del precache y se guardan la primera vez que se usan | La cabina del chofer no los necesita; instalación más liviana con datos móviles | aplicada |
| 028 | 06/10/2026 | Respaldo semanal con `pg_dump` cifrado con age (artefacto de 90 días) y consulta cada 3 días para que el proyecto no se pause | Plan gratuito sin respaldos; repo público | aplicada |
| 029 | 06/10/2026 | Íconos de la app provisionales (panel verde con "IP"), generados con `npm run icons` | Falta el archivo del logo de IP | provisional |
| 030 | 03/10/2026 | Seed demo generado con las RPC reales (3 meses, 3 camiones, 2 plantas, ruta olvidada, gastos pendientes y rechazados); `limpiar_demo.sql` lo borra y `db push` nunca lo sube | Anexo A del handoff | aplicada |

## Decisiones de la renovación (F9 · versión 0.6.0)

| # | Fecha | Decisión o supuesto | Motivo | Estado |
|---|---|---|---|---|
| 031 | 20/10/2026 | Se adelantan dos funciones de la Fase 2: recordatorios de servicio por km o fecha y documentos con vencimiento (de unidades y de personas) | Roberts las eligió en la pregunta de alcance; todos los sistemas comparables las traen | aprobada |
| 032 | 20/10/2026 | Un recordatorio se cumple solo cuando flota **aprueba** un gasto de su categoría en esa unidad. Si el gasto no trae km y es de los últimos 7 días, se toma el último km conocido; si es más viejo, solo se mueve la fecha | Evita registrar dos veces sin inventar km para gastos cargados tarde | aplicada |
| 033 | 20/10/2026 | "Renovar" un documento crea uno nuevo y archiva el anterior (`renovado_por`) en vez de editar la fecha | Nada se borra: queda el historial de pólizas | aplicada |
| 034 | 20/10/2026 | Los documentos de una persona (licencia, certificado médico) los ven ella y la oficina, no los demás choferes | Privacidad básica entre choferes | aplicada |
| 035 | 20/10/2026 | En teléfono y tableta (hasta 1024 px) las tablas son listas de renglones compactos y cada columna declara cómo se ve ahí. Las acciones de una fila viven en la hoja que abre la fila | Con 8 renglones por fila las listas medían hasta 12 pantallas; las acciones ocultas dejaban funciones sin uso en el teléfono | aplicada |
| 036 | 20/10/2026 | Filtros resumidos en un botón en el teléfono (`PanelFiltros`); en escritorio siguen en línea | Los números primero (principio 3 de `PRODUCT.md`) | aplicada |
| 037 | 20/10/2026 | `CHANGELOG.md` con Keep a Changelog en español; versiones 0.1.0 a 0.5.0 reconstruidas desde la bitácora; 1.0.0 = primera puesta en marcha. Se muestra en la app (Novedades) y una prueba exige que coincida con `package.json` | Pedido de Roberts: ver siempre toda versión desde el principio | aplicada |
| 038 | 20/10/2026 | CSP en `<meta>` generada al compilar con el origen de Supabase y el hash del script del tema; `frame-ancestors` y HSTS quedan para las cabeceras del VPS | GitHub Pages no permite cabeceras HTTP | aplicada |
| 039 | 20/10/2026 | Compresión de fotos sin web worker | El worker descargaba la librería de un CDN: código de terceros en tiempo de ejecución, falla sin señal y choca con la CSP | aplicada |
| 040 | 20/10/2026 | Mudanza al VPS en dos etapas: primero solo la app (Supabase sigue en la nube); después, si hace falta, Supabase autoalojado (`docs/MIGRACION_VPS.md`) | La primera etapa no toca datos; la segunda exige mantenimiento propio | propuesta |
| 041 | 20/10/2026 | Los archivos de documentos van al bucket privado `documentos` en `<documento_id>/`: los lee la oficina o quien ve el documento (la política consulta la tabla con su RLS) y solo la oficina sube. Una restricción en la tabla impide apuntar a un archivo de otra carpeta. Versión 0.6.1 | La revisión automática de seguridad mostró que en `comprobantes` (lo lee cualquier usuario activo) un chofer podía abrir el certificado médico de otro, contra la decisión 034 | aplicada |

