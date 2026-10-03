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
| 012 | 03/10/2026 | Destino principal de una ruta con paradas = última parada, editable por el chofer | Supuesto no bloqueante; se revisa en el `shape` de la F4 | propuesta |
