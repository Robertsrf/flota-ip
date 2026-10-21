# Flota IP — guía operativa

Control de flota y combustible de **Distribuidora y Suministros IP** (Trujillo, Mérida y Zulia, Venezuela): 6 a 10 camiones y 2 plantas eléctricas. Cliente y dueño del proyecto: **Roberts Flores** (Emory Studios). Fuente de verdad completa: `docs/HANDOFF.md`. Decisiones: `docs/DECISIONES.md`. Historial por fase: `docs/BITACORA.md`. Versiones: `CHANGELOG.md`. Diseño: `DESIGN.md` y `PRODUCT.md`. Mantén este archivo al día (≤150 líneas).

## Estado
Versión **0.6.0** (20/10/2026): F0–F8 más la renovación (teléfono, vencimientos, ayuda, novedades, CSP). Todo probado en local (sin Docker, con PGlite). Falta la puesta en marcha real con Roberts (será la **1.0.0**): repo público en GitHub, proyecto Supabase, secrets y primer superusuario → `docs/PUESTA_EN_MARCHA.md`. Después, mudanza a un VPS con dominio propio → `docs/MIGRACION_VPS.md`. Datos demo (`DEMO-*`) solo en local; `supabase/sql/limpiar_demo.sql` los borra.

## CHANGELOG (obligatorio)
- **Todo cambio** que alguien note (pantalla, cálculo, permiso, dato, seguridad, documentación de uso) se anota en `CHANGELOG.md` **el mismo día**, en `## [Sin publicar]`, bajo su tipo: Agregado, Cambiado, Corregido, Eliminado, Obsoleto o Seguridad.
- Al cerrar una versión: la sección pasa a `## [X.Y.Z] - AAAA-MM-DD - Título corto`, se crea un `## [Sin publicar]` vacío arriba, se sube `version` en `package.json` y `package-lock.json`, y se etiqueta `git tag -a vX.Y.Z`. La prueba `src/features/ayuda/changelog.test.ts` exige que la primera versión coincida con `package.json` y que todas tengan fecha en orden.
- Se escribe para quien usa el sistema (Roberts, IP), en español llano: qué cambió y para qué, no la lista de commits. El detalle técnico va en `docs/BITACORA.md`. La app lo muestra en **Novedades** (`/novedades`) y la versión en la barra lateral.
- Esquema: `0.x` mientras se construye; `1.0.0` = primera puesta en marcha con datos reales; luego parche (corrección), menor (función nueva), mayor (cambio que obliga a reinstalar o migrar).

## Stack
- Vite 8 + React 19 + TypeScript 6.0 (typescript-eslint exige <6.1) + Tailwind v4 (`@tailwindcss/vite`, tokens en `src/styles/index.css`).
- React Router 8, TanStack Query 5, ECharts 6 modular (renderer SVG), Dexie 4 (cola offline), vite-plugin-pwa 2, SheetJS (desde cdn.sheetjs.com), lucide-react, Overpass.
- Supabase plan **gratuito**: Postgres + RLS, Auth, Storage (`unidades`, `comprobantes`), Realtime (`viajes`, `unidades`), Edge Functions (`admin-usuarios`, `tasa-bcv`), pg_cron + Vault. Límites: 500 MB de base, 1 GB de Storage, 5 GB de transferencia; **se pausa tras 7 días sin peticiones** y **no tiene respaldos** → `respaldo.yml` hace consulta cada 3 días y `pg_dump` semanal cifrado con age.
- Hosting: GitHub Pages desde `main` (repo **público**: Roberts no tiene GitHub Pro).

## Comandos
```
npm run dev:local     # backend local (PGlite: REST, Auth, Storage, Functions en :54321) + Vite en :5173
npm run dev           # Vite contra el Supabase de .env.local
npm run typecheck     # tsc -b
npm run lint          # ESLint 10 (react-hooks v7, reglas del React Compiler)
npm test              # Vitest: SQL sobre PGlite (motor, RLS, T1–T14, vencimientos) + unitarias (formato, consumo, CSP, changelog)
npm run test:e2e      # Playwright contra el backend local (:5179/:54329, base .local-db-e2e)
npm run build         # tsc -b && vite build
npm run gen:types     # tipos desde las migraciones (PGlite) → src/lib/database.types.ts
npm run gen:types:remote  # igual, desde el proyecto Supabase (requiere SUPABASE_PROJECT_REF)
npm run icons         # regenera public/iconos con Playwright
```
- Local: `cp .env.local.example .env.local`. La base local se recrea sola si cambian migraciones, seed o shim (huella `*.huella`); `--reset` la fuerza.
- Usuarios demo: `demo.super`, `demo.flota`, `demo.gerencia` (clave `demo1234`); `demo.pedro`, `demo.luis`, `demo.carlos` (PIN `123456`).
- Playwright usa Edge (`channel: msedge`) en local y Chromium en CI.

## Estructura
- `supabase/migrations/` 01 esquema · 02 motor y RPC · 03 RLS · 04 vistas y RPC del dashboard · 05 Storage y Realtime · 06 datos iniciales de producción · 07 permisos de ejecución (lista blanca) · 08 recordatorios de servicio y documentos con vencimiento (más `v_alertas` con la novedad del chofer).
- `supabase/seed.sql` (solo demo), `supabase/sql/` (limpieza demo, cron de la tasa), `supabase/tests/` (Vitest + PGlite), `supabase/functions/`.
- `scripts/pglite/` shim que imita Supabase (auth.uid, roles anon/authenticated/service_role); `scripts/backend-local/` emulador HTTP.
- `src/app` (rutas, layouts Cabina y Oficina), `src/components` (controles, tabla, filtros, hoja, datos, estructura), `src/lib` (supabase, api, formato, consumo, offline/cola, exportar, fotos, sesión), `src/features/<módulo>` (incluye `vencimientos` y `ayuda`: Ayuda, Novedades y el lector del changelog).
- `tests/e2e/` Playwright. `tests/unit/` (CSP). `scripts/csp.mjs` arma la CSP del build. `.github/workflows/` ci, deploy, supabase (manual), respaldo.

## Convenciones
- **Idioma:** interfaz en español venezolano llano, voz activa. Dominio en español en tablas, columnas, tipos, funciones y componentes (`unidades`, `repostajes`, `km_salida`, `FichaCamion`). Infraestructura genérica puede ir en inglés.
- **Formato es-VE solo con `src/lib/formato.ts`:** `10.400 km`, `$ 48,00`, `Bs 1.234,56`, `dd/mm/aaaa`, zona `America/Caracas`. Cifra y unidad van unidas con espacio de no separación. "—" cuando no hay dato.
- **USD manda:** todo total en USD; Bs solo como referencia rotulada. Nunca sumar Bs sin convertir.
- **Nunca borrar datos operativos:** se anulan con motivo (`anular_registro`) y se pueden restaurar; toda edición pasa por `corregir_registro` con motivo y queda en `auditoria` (trigger `tg_auditar`, solo columnas cambiadas). Excepción: una ubicación nunca usada se borra; con uso, se archiva.
- **Escrituras del cliente por RPC** (`security definer`, `set search_path = ''`, `exigir_rol`). Las funciones nacen cerradas (migración 07 cierra los privilegios por defecto de Supabase): cada función nueva lleva su `grant execute ... to authenticated` solo si el cliente, la RLS o una vista la usan, y se agrega a la prueba de lista blanca de `rls.test.ts`. `anon` no ejecuta nada.
- **Migraciones:** una vez aplicada en Supabase, una migración no se edita; se agrega otra. Después de cambiar el esquema: `npm run gen:types` y pruebas SQL.
- **IDs de cliente** (`crypto.randomUUID`) en viajes, repostajes y gastos: los reintentos de la cola offline son idempotentes.
- **Validación** escrita en cada formulario (sin librería de formularios) y repetida en el servidor. **Errores** con los números involucrados y cómo corregir, sin disculpas (`traducirError`).
- Diseño: tokens de `index.css`, nunca hex sueltos en componentes; reglas en `DESIGN.md`. Capturas a 360 y 1440 px con `node scripts/capturas.mjs`.
- **Tablas:** cada columna dice cómo se ve en el teléfono (`movil`: `principal`, `derecha` u `oculta`; `movilCelda` para un valor que se entienda solo, como "213 km"). Lo que se pueda hacer con una fila (editar, eliminar, PIN) va dentro de la hoja que abre la fila, nunca en una columna que el teléfono oculta. Filtros con `PanelFiltros` (en el teléfono se resumen en un botón).
- **Cada cifra nueva del dashboard** lleva su `ayuda` (qué es y si más alto es mejor) y su entrada en la pantalla de Ayuda.
- Commits por fase con mensaje en español y bitácora actualizada.

## Reglas de cálculo (sección 8 del handoff; el oficial es `recalcular_viaje` en Postgres)
- `litros_consumidos = L_salida + Σ L_cargados_en_el_viaje − L_final`.
- `L_salida`: lleno = capacidad; heredado = nivel final del viaje anterior si el km coincide (tolerancia 5 km); o aguja en cuartos o litros.
- `L_final`: si la carga de cierre llenó el tanque, capacidad; si no, la aguja al llegar (calidad baja a `estimado`); sin dato, `incompleto`.
- Precio (D5): promedio ponderado de las cargas del viaje; sin cargas, la última carga de la unidad; sin historial, el precio activo de menor orden (`estimado`).
- `costo = consumo × precio`; `km/L = km ÷ L`; `L/100 km`; `costo/km`. Redondeo a 2 decimales al guardar.
- Calidad: `exacto` (salida llena o heredada y llegada llena), `estimado`, `incompleto`. Consumo ≤ 0 o nivel > tanque: en estricto se rechaza con los números; al recalcular se marca para revisar.
- Agregados **ponderados**: Σkm ÷ ΣL, nunca promedio de ratios (T10).
- Gasto de combustible = compras (cada carga una vez; las de un viaje cuentan en el mes de llegada). Costo/km total = (combustible + mantenimiento aprobado) ÷ km.
- Ciclos lleno a lleno (`v_ciclos_combustible`) como validación cruzada; divergencia > 10 % → alerta.
- Plantas (`medidor = 'ninguno'`): solo litros y costo del período, sin km/L ni ciclos.
- Umbrales editables en `configuracion` (ruta abierta 48 h, consumo anómalo 15 % con ≥5 viajes, km sin ruta 5, viaje máx. 1.500 km / 72 h, ventana de corrección del chofer 30 min).
- **Vencimientos** (`v_recordatorios`, `v_documentos`): `situacion` = `vencido` (km o días restantes ≤ 0; documento con `vence` < hoy), `pronto` (dentro del aviso), `al_dia` o `archivado`. Un gasto **aprobado** de la categoría del recordatorio en esa unidad lo marca hecho (trigger); sin km en el gasto, usa el último km solo si el gasto es de los últimos 7 días. Renovar un documento archiva el anterior (`renovado_por`).

## Roles (RLS en todas las tablas)
- `superusuario` (Roberts + una persona de IP): todo, incluidos usuarios de oficina, roles y configuración.
- `flota`: unidades, catálogos, cargas de plantas, mantenimiento, aprobación de gastos, alta de choferes y PIN, correcciones.
- `chofer`: sus rutas, repostajes y gastos (estos quedan pendientes); corrige lo suyo solo 30 min. Lee el dashboard.
- `consulta` (gerencia): solo lectura.

## Seguridad
- En el frontend solo la llave pública (anon/publishable). La `service_role` vive solo en los secrets de las Edge Functions; jamás en el repo ni en el cliente.
- Nunca subir `.env`, dumps ni fotos reales. Respaldos solo cifrados (`age`).
- Login: usuario + PIN de 6 dígitos (choferes) o contraseña ≥ 8 (oficina) sobre correo sintético `<usuario>@usuarios.flota-ip.invalid`; registro público desactivado; bloqueo de 30 s en el cliente tras 5 fallos (el límite real lo pone GoTrue).
- **CSP** en el `<meta>` del build (`scripts/csp.mjs`, probada en `tests/unit/csp.test.ts`): solo código propio y el origen de `VITE_SUPABASE_URL`. Ningún script ni recurso de terceros en tiempo de ejecución (por eso la compresión de fotos va sin web worker). Si se agrega un servicio externo, se agrega a la CSP y a su prueba.
- Edge Functions: errores internos genéricos al cliente (`errorInterno`), CORS limitado por el secret `ORIGENES_APP`, secreto del cron comparado en tiempo constante.
- Tablas nuevas: `revoke all ... from anon, authenticated` + `grant select` + RLS; escritura solo por RPC.

## Decisiones clave (detalle en DECISIONES.md)
Navegación mixta (cabina sin barra / oficina con barra lateral e inferior) · dirección visual "Señal vial" · botón En ruta a todo el ancho con Deshacer 10 s · offline nivel 2 (cola Dexie; vaciado al abrir, `online`, `visibilitychange` y cada 30 s, porque Safari no tiene Background Sync) · ECharts · paradas múltiples, destino principal = última parada · fotos opcionales · `unidades` con `tipo` camión/planta y `medidor` · folios V-/R-/M- · choferes rotan de camión · combustible mixto con precios $0,50 y $0,60 por litro para ambos.

## Trampas conocidas
- Git Bash convierte rutas tipo `/x` en argumentos: usar `MSYS_NO_PATHCONV=1`. Al escribir JS o TS con heredoc se pierden las barras invertidas: editar regex con el editor.
- PGlite: varias sentencias van con `exec`; `text[] || 'x'` necesita `'x'::text`; sin `INSERT` en `LATERAL`.
- El "·" de Overpass queda pegado a la palabra siguiente: usar "•".
- GitHub desactiva los flujos programados de repos públicos tras 60 días sin commits.
