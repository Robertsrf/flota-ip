# HANDOFF — Sistema de control de flota para Distribuidora y Suministros IP

**Para:** Claude Code
**De:** Roberts Flores (Emory Studios)
**Fecha:** 03/10/2026
**Nombre de trabajo:** Flota IP (provisional, se confirma en el checkpoint de la Fase 0)
**Repositorio:** GitHub (privado) — **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions + Realtime)

---

## 0. Cómo trabajar este proyecto

Lee este documento completo antes de escribir código. Es la especificación funcional, el modelo de datos y el plan de trabajo.

1. **Trabaja por fases** (sección 14). Al cerrar cada fase: commit con mensaje claro, actualiza `docs/BITACORA.md` (qué se hizo, qué falta, qué se decidió) y muestra un resumen breve.
2. **Checkpoints obligatorios 🛑.** En ellos te detienes, presentas lo pedido y esperas la aprobación de Roberts. No los saltes aunque creas tener la respuesta.
3. **`CLAUDE.md` en la raíz** (Fase 1): resumen operativo de este handoff (máximo 150 líneas: contexto, stack, comandos, convenciones, reglas de cálculo, decisiones tomadas). Es la fuente única de verdad entre sesiones; mantenlo al día. Guarda este handoff completo en `docs/HANDOFF.md`.
4. **Idioma:** interfaz en español venezolano. Dominio en español (tablas, columnas, tipos: `vehiculos`, `repostajes`, `km_salida`). Código genérico o de infraestructura puede ir en inglés. Documenta la convención en `CLAUDE.md`.
5. **Nada va a producción sin verificar:** los cálculos de combustible y costos deben cuadrar al centavo con los casos de la sección 12; cero errores de TypeScript y ESLint; RLS probado con un usuario de cada rol.
6. **Moneda base USD.** Bs y USD nunca se mezclan sin etiqueta clara. Todo total del dashboard está en USD; Bs aparece solo como dato de referencia, en su propia columna.
7. **Nunca borrar datos operativos.** Se anulan con motivo (soft delete) y queda auditoría.
8. Si algo es ambiguo y no bloquea: asume lo razonable, regístralo en `docs/DECISIONES.md` y sigue. Si bloquea: llévalo al siguiente checkpoint.

---

## 1. Contexto del cliente

- **Distribuidora y Suministros IP:** distribuidora venezolana (desechables y repostería) que opera en los estados Trujillo, Mérida y Zulia. Roberts ya trabaja con ellos en inteligencia comercial y dashboards.
- **El problema:** no tienen control centralizado del costo de su flota de camiones. No saben cuánto cuesta cada ruta, cuánto rinde realmente cada camión ni cuánto se va en mantenimiento.
- **Usuarios:**
  - **Dirección / gerencia:** entra a ver el dashboard. Quiere respuestas rápidas: cuánto se gastó, qué camión consume de más, qué ruta sale cara.
  - **Administración de flota:** registra mantenimiento, gestiona camiones, ubicaciones y precios, corrige registros.
  - **Choferes:** inician y cierran rutas y registran repostajes desde el teléfono, en la calle o en la estación, muchas veces con señal irregular y con poco tiempo.
- **Convenciones locales:** zona horaria `America/Caracas`; formato `es-VE` → `10.400 km`, `$ 48,00`, `Bs 1.234,56`, fechas `dd/mm/aaaa`. Usar `Intl.NumberFormat('es-VE')` y un único módulo `src/lib/formato.ts`.

---

## 2. Alcance

### MVP (construir)

1. **Ficha por camión:** foto, placa, alias, marca/modelo/año, tipo de combustible, capacidad del tanque (L), km iniciales, combustible inicial (L), chofer habitual, estado.
2. **Botón "En ruta / Disponible"** que acciona cada chofer: encenderlo = iniciar viaje; apagarlo = finalizar viaje (sección 9.2; no es un simple interruptor).
3. **Registro de rutas (viajes):** destino desde lista desplegable (catálogo de ubicaciones), fecha/hora y km de salida, nivel de combustible al salir, fecha/hora y km de llegada.
4. **Repostajes:** litros, km del odómetro, precio por litro **seleccionable $0,50 o $0,60** en cada carga (catálogo editable), ¿llenó el tanque?, foto del recibo.
5. **Cálculo automático por viaje:** km recorridos, litros consumidos, km/L, L/100 km, costo del viaje y costo por km, con sus fechas (sección 8).
6. **Gastos de mantenimiento** por categoría (lista desplegable): monto en **Bs o $**, con tasa BCV del día para llevarlo a USD.
7. **Dashboard** global (toda la flota) e individual (por camión), con KPIs y gráficos de consumo y gasto. Todo usuario que entra lo ve.
8. Roles y permisos, fotos en Storage, exportación CSV/Excel de las tablas.

### Fase 2 (no construir aún, pero el modelo de datos no debe impedirlo)

- Recordatorios de mantenimiento por km o fecha (ej. aceite cada X km).
- Paradas múltiples por viaje.
- Documentos del vehículo con vencimiento (seguro/RCV, permisos).
- Conexión directa de Power BI a Postgres con un rol de solo lectura.
- Modo offline completo, si en la Fase 0 se decide dejarlo para después (decisión D4).

### Fuera de alcance

GPS en tiempo real o telemetría, nómina de choferes, facturación, inventario de repuestos.

---

## 3. Skills y herramientas

Verifica qué tienes instalado. Si falta algo, instálalo (o pídeselo a Roberts si requiere permisos). Revisa los comandos vigentes de cada skill en su `SKILL.md` en vez de asumirlos.

| Skill / herramienta | Para qué en este proyecto | Instalación de referencia |
|---|---|---|
| **impeccable** (pbakaus) | Dirección de diseño: `teach` para fijar contexto (genera PRODUCT.md / DESIGN.md), `shape` para planificar UX antes de codificar, `critique`, `audit` y `polish` al cerrar cada pantalla | `npx skills add pbakaus/impeccable` o `/plugin marketplace add pbakaus/impeccable` |
| **ui-ux-pro-max** (nextlevelbuilder) | Patrones de dashboard, paletas, tipografía, reglas UX para formularios móviles y tablas de datos | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` |
| **frontend-design** (Anthropic) | Criterio estético base y anti-patrones de UI genérica | Repo `anthropics/skills` |
| **webapp-testing** (Anthropic, Playwright) | Probar flujos de chofer y admin; capturas para autocrítica visual | Repo `anthropics/skills` |
| **Supabase CLI** | Migraciones versionadas, seed, tipos generados, entorno local | `npm i -D supabase` |
| **Supabase MCP** (opcional) | Inspeccionar el proyecto remoto y verificar migraciones | Solo si Roberts lo conecta |
| **WebSearch / WebFetch** | Investigación de la Fase 0 | Nativo |

Orden de uso para diseño: `impeccable teach` (con la información de las secciones 1, 9, 10 y 11) → investigación → `shape` por pantalla clave → construir → captura → `critique` → corregir → `polish`. Al final del proyecto, `audit` completo.

---

## 4. FASE 0 — Investigación y opciones 🛑

Roberts pidió una investigación exhaustiva de aplicaciones similares **antes** de construir, para ordenar bien la información y presentarle opciones.

### 4.1 Hallazgos previos (punto de partida, ya verificados)

- **Fleetio** (referente del sector): asume que cada carga llena el tanque; si no, la carga se marca como *parcial*. Las parciales no generan rendimiento propio: sus litros y km se suman a la siguiente carga completa. Métricas por carga: costo total, litros, distancia entre cargas, costo por km, costo por litro, km/L y L/100 km. Tiene app móvil para registrar en la bomba, con el precio prellenado desde la última carga.
- **Fuelly:** mide por "diferencia hasta lleno"; necesita dos cargas completas seguidas para calcular el rendimiento de un tramo. Las parciales sí cuentan para el promedio general (km totales ÷ litros totales).
- **Simply Fleet:** módulo de viajes donde el gerente asigna y el chofer inicia y termina el viaje desde el teléfono (queda registrado el km de inicio y fin); el chofer también carga combustible, peajes y multas con foto del recibo; el kilometraje alimenta recordatorios de mantenimiento por km o tiempo; categorías de servicio editables.
- **Drivvo** (muy usado en Latinoamérica, en español): el formulario de repostaje trae fecha, km, tipo de combustible, precio por litro, total, litros, interruptor de "tanque lleno", estación, adjunto y notas. Informes separados en general / repostaje / gastos / servicios; catálogos editables de combustibles, servicios y tipos de gasto.
- **KPIs de referencia del sector:** costo por km (costo total ÷ km), costo de combustible por km, L/100 km por vehículo, gasto de mantenimiento por vehículo. Los dashboards útiles se limitan a 10–15 KPIs y marcan desviaciones de 10 % o más contra el promedio.

Enlaces en el Anexo B.

**Patrones que ya adoptamos:** método lleno-a-lleno con bandera de "parcial"; precio guardado como copia fija en cada carga; catálogos editables (nunca borrables); foto de recibo; ficha con pestañas; acción rápida en móvil; filtros por período, camión y chofer; promedios ponderados (Σ km ÷ Σ litros), nunca promedio de ratios.

**Lo que distingue este proyecto:** el **viaje** es la unidad principal (el chofer marca salida y llegada), no solo la carga de combustible. El cálculo combina ambos (sección 8).

### 4.2 Lo que debes investigar tú

1. Profundiza en Fleetio, Simply Fleet, Drivvo (versión flotas), Fuelly, Fuelio, AUTOsist, Whip Around, Fleet Complete y al menos dos soluciones latinoamericanas en español.
2. Para cada una: cómo modela vehículo / viaje / carga / gasto, qué KPIs muestra primero, cómo resuelve el flujo del chofer en móvil, cómo maneja monedas y unidades, qué hace con datos incompletos.
3. Patrones de UI para: dashboards de flota (jerarquía de KPIs, tablas densas, comparativos), formularios móviles de campo (teclado numérico, botones grandes, mínimo tecleo), estados vacíos y alertas.
4. Qué **no** copiar (sobrecarga de funciones, menús profundos, gráficos decorativos).

### 4.3 Entregables del checkpoint 🛑

- `docs/INVESTIGACION.md`: tabla comparativa + patrones adoptados y descartados, con enlaces.
- `docs/OPCIONES.md` con:
  - **Estructura de navegación:** 2 opciones (ej. barra lateral en escritorio + barra inferior en móvil, contra otra que propongas), con wireframes ASCII de inicio del chofer, dashboard global y ficha del camión.
  - **3 direcciones visuales** distintas, cada una con 4–6 colores hex con nombre, tipografías y su rol, concepto de layout y principios. Ancladas al mundo del cliente (camiones, carretera andina y zuliana, odómetro, aguja de combustible, ticket de estación), no a plantillas. Una de ellas puede usar el azul marino de los reportes de IP (`#1B2A4A`) como ancla, por consistencia con lo que la dirección ya conoce.
  - **Flujo del botón "En ruta":** 2 variantes (sección 9.2).
  - **Decisiones D1–D8** (tabla abajo) con tu recomendación final.
  - **Preguntas abiertas** (sección 15).
- Luego **detente** y espera a Roberts.

| ID | Decisión | Opciones | Recomendación inicial |
|---|---|---|---|
| D1 | Hosting del frontend | GitHub Pages vía Actions / Netlify conectado al repo | GitHub Pages (es lo que Roberts ya usa con IP); Netlify si se quieren previews por rama |
| D2 | Librería de gráficos | ECharts / Recharts | ECharts (consistencia con el dashboard IP actual y buen rendimiento con series largas) |
| D3 | Login de choferes | Correo + contraseña / usuario + PIN (correo sintético interno) | Usuario + PIN: muchos choferes no usan correo |
| D4 | Offline | Nivel 1: PWA instalable + reintentos / Nivel 2: cola offline en IndexedDB para iniciar/cerrar ruta y repostar | Nivel 2 solo en los flujos del chofer: en carretera la señal falla |
| D5 | Precio para el costo del viaje | Promedio ponderado de las cargas del viaje / precio de la última carga | Promedio ponderado (sección 8.3) |
| D6 | Nivel de combustible al salir | Aguja por cuartos / litros exactos / ambos | Ambos: "Lleno" por defecto, cuartos como atajo, litros si se saben |
| D7 | ¿Choferes registran mantenimiento? | Sí / No (solo dejan una novedad) | No: lo registra flota/admin |
| D8 | ¿Quién crea ubicaciones? | Solo flota/admin / el chofer propone y flota aprueba | Solo flota/admin (evita duplicados tipo "Mcbo" vs "Maracaibo") |

---

## 5. Stack

| Capa | Recomendado | Alternativa |
|---|---|---|
| Frontend | Vite + React + TypeScript (SPA) | Next.js (innecesario: no hay SSR ni SEO) |
| Estilos | Tailwind CSS v4 + primitivas de shadcn/ui **personalizadas** (no el look por defecto) | CSS Modules |
| Datos | `@supabase/supabase-js` v2 + TanStack Query | — |
| Formularios | React Hook Form + Zod | — |
| Router | React Router (con fallback `404.html` si va en GitHub Pages) | HashRouter |
| Gráficos | ECharts (`echarts-for-react`) | Recharts |
| Fechas | date-fns + date-fns-tz (`America/Caracas`) | — |
| PWA / offline | vite-plugin-pwa + Dexie (IndexedDB) | — |
| Imágenes | browser-image-compression (máx. 1280 px, ~200 KB) antes de subir | — |
| Exportación | SheetJS (xlsx) y CSV | — |
| Pruebas | Vitest (lógica), pruebas SQL (RLS, RPC, vistas), Playwright (flujos) | — |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions, Realtime, pg_cron | — |

**Llaves:** en el frontend solo va la llave pública (anon/publishable). La llave secreta (`service_role`) **jamás** va al repo ni al cliente; solo vive en los secrets de las Edge Functions. `.env` en `.gitignore`; `.env.example` en el repo.

**Plan de Supabase:** confirma con Roberts si es gratuito o pago, sus límites de Storage y la política de pausa por inactividad; documéntalo en `CLAUDE.md`.

---

## 6. Roles y permisos

Roles: `admin` (Roberts / sistemas), `flota` (administración de flota), `chofer`, `consulta` (dirección/gerencia, solo lectura).

| Acción | admin | flota | chofer | consulta |
|---|:-:|:-:|:-:|:-:|
| Ver dashboard, fichas e historiales de **todos** los camiones | ✔ | ✔ | ✔ | ✔ |
| Crear/editar camiones y su foto | ✔ | ✔ | — | — |
| Catálogos: ubicaciones, categorías, precios de combustible | ✔ | ✔ | — | — |
| Iniciar y finalizar **su** ruta | ✔ | ✔ | ✔ | — |
| Finalizar la ruta de otro (ruta olvidada) | ✔ | ✔ | — | — |
| Registrar repostaje | ✔ | ✔ | ✔ (camión de su ruta en curso o su camión habitual) | — |
| Corregir su propio registro | ✔ | ✔ | ✔ dentro de 30 min | — |
| Corregir/anular cualquier registro (motivo obligatorio) | ✔ | ✔ | — | — |
| Registrar mantenimiento | ✔ | ✔ | según D7 | — |
| Usuarios y roles | ✔ | — | — | — |
| Exportar | ✔ | ✔ | — | ✔ |

Implementación: función `public.rol_actual()` (`security definer`, `stable`) que lee `perfiles.rol` del `auth.uid()` activo; todas las políticas RLS se apoyan en ella. Usuarios creados por la Edge Function `admin-usuarios` (usa la llave secreta y valida que quien llama sea admin). Sin registro público.

---

## 7. Modelo de datos (Supabase / Postgres)

Escríbelo como migraciones en `supabase/migrations/`. Lo de abajo es la especificación; ajusta detalles si mejoran la integridad y documenta el cambio. Todas las tablas operativas llevan además `created_at`, `updated_at`, `created_by`, `anulado boolean default false` y `anulado_motivo text`.

```sql
-- ===== Tipos =====
create type rol_usuario      as enum ('admin','flota','chofer','consulta');
create type estado_vehiculo  as enum ('disponible','en_ruta','taller','inactivo');
create type tipo_combustible as enum ('gasolina','diesel');
create type moneda           as enum ('USD','VES');
create type estado_viaje     as enum ('en_curso','cerrado','anulado');
create type calidad_calculo  as enum ('exacto','estimado','incompleto');

-- ===== Personas =====
create table perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  usuario    text unique,                      -- login por usuario + PIN (D3)
  telefono   text,
  rol        rol_usuario not null default 'chofer',
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== Camiones =====
create table vehiculos (
  id                    uuid primary key default gen_random_uuid(),
  placa                 text not null unique,
  alias                 text,                  -- "Camión 3", "El blanco"
  marca                 text,
  modelo                text,
  anio                  int,
  combustible           tipo_combustible not null default 'gasolina',
  capacidad_tanque_l    numeric(7,2)  not null check (capacidad_tanque_l > 0),
  km_inicial            numeric(10,1) not null check (km_inicial >= 0),
  combustible_inicial_l numeric(7,2)  not null check (combustible_inicial_l >= 0),
  fecha_alta            date not null default current_date,
  foto_path             text,                  -- Storage: bucket 'vehiculos'
  estado                estado_vehiculo not null default 'disponible',
  chofer_habitual_id    uuid references perfiles(id),
  rendimiento_min_kml   numeric(6,2) default 1.5,   -- rango razonable para alertas
  rendimiento_max_kml   numeric(6,2) default 15,
  notas                 text,
  check (combustible_inicial_l <= capacidad_tanque_l)
);

-- ===== Catálogos =====
create table ubicaciones (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  estado_ve text,                              -- Trujillo / Mérida / Zulia / ...
  municipio text,
  tipo      text not null default 'cliente'
            check (tipo in ('sede','almacen','cliente','taller','estacion','otro')),
  activo    boolean not null default true,
  unique (nombre, municipio)
);

create table precios_combustible (
  id               uuid primary key default gen_random_uuid(),
  etiqueta         text not null,              -- "$0,50", "$0,60"
  precio_usd_litro numeric(6,3) not null check (precio_usd_litro > 0),
  activo           boolean not null default true,
  orden            int not null default 0
);

create table categorias_mantenimiento (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  icono  text,
  activo boolean not null default true,
  orden  int not null default 0
);

-- ===== Viajes (rutas) =====
create table viajes (
  id                    uuid primary key,      -- generado en el cliente (idempotencia offline)
  vehiculo_id           uuid not null references vehiculos(id),
  chofer_id             uuid not null references perfiles(id),
  origen_id             uuid references ubicaciones(id),
  destino_id            uuid not null references ubicaciones(id),
  salida_at             timestamptz not null,
  km_salida             numeric(10,1) not null,
  litros_salida         numeric(7,2)  not null,   -- nivel al salir en litros (lleno = capacidad)
  fuente_nivel_salida   text not null
                        check (fuente_nivel_salida in ('lleno','aguja','litros','heredado')),
  llegada_at            timestamptz,
  km_llegada            numeric(10,1),
  litros_llegada_aguja  numeric(7,2),             -- solo si NO terminó con el tanque lleno
  estado                estado_viaje not null default 'en_curso',
  -- Resultados: los escribe recalcular_viaje(); el cliente nunca los envía
  km_recorridos         numeric(10,1),
  litros_consumidos     numeric(8,2),
  rendimiento_kml       numeric(6,2),
  litros_100km          numeric(6,2),
  costo_combustible_usd numeric(10,2),
  costo_km_usd          numeric(8,4),
  calidad               calidad_calculo,
  revisar               boolean not null default false,   -- marcado por validaciones blandas
  foto_odometro_salida  text,
  foto_odometro_llegada text,
  notas                 text,
  check (km_llegada is null or km_llegada > km_salida)
);
create unique index uq_viaje_abierto_vehiculo on viajes(vehiculo_id) where estado = 'en_curso';
create unique index uq_viaje_abierto_chofer   on viajes(chofer_id)   where estado = 'en_curso';

-- ===== Repostajes =====
create table repostajes (
  id               uuid primary key,           -- generado en el cliente
  vehiculo_id      uuid not null references vehiculos(id),
  viaje_id         uuid references viajes(id), -- se enlaza solo si el camión tiene ruta abierta
  chofer_id        uuid references perfiles(id),
  fecha            timestamptz not null,
  km_odometro      numeric(10,1) not null,
  litros           numeric(7,2)  not null check (litros > 0),
  precio_id        uuid references precios_combustible(id),
  precio_usd_litro numeric(6,3)  not null,     -- copia fija del precio elegido
  monto_usd        numeric(10,2) generated always as (round(litros * precio_usd_litro, 2)) stored,
  tanque_lleno     boolean not null default true,
  es_cierre_viaje  boolean not null default false,
  estacion         text,
  recibo_path      text,                       -- Storage: bucket 'comprobantes'
  notas            text
);

-- ===== Tasa BCV y mantenimiento =====
create table tasas_bcv (
  fecha        date primary key,
  bs_por_usd   numeric(14,4) not null check (bs_por_usd > 0),
  fuente       text not null default 've.dolarapi.com',
  manual       boolean not null default false,
  capturada_at timestamptz not null default now()
);

create table mantenimientos (
  id           uuid primary key default gen_random_uuid(),
  vehiculo_id  uuid not null references vehiculos(id),
  categoria_id uuid not null references categorias_mantenimiento(id),
  fecha        date not null default current_date,
  km_odometro  numeric(10,1),
  descripcion  text,
  proveedor    text,
  moneda       moneda not null,
  monto        numeric(14,2) not null check (monto > 0),
  bs_por_usd   numeric(14,4),                  -- obligatoria si moneda = 'VES'
  monto_usd    numeric(12,2) generated always as (
                 case when moneda = 'USD' then monto
                      else round(monto / bs_por_usd, 2) end) stored,
  monto_bs     numeric(16,2) generated always as (
                 case when moneda = 'VES' then monto
                      when bs_por_usd is not null then round(monto * bs_por_usd, 2) end) stored,
  factura_path text,
  check (moneda = 'USD' or (bs_por_usd is not null and bs_por_usd > 0))
);

-- ===== Auditoría =====
create table auditoria (
  id          bigserial primary key,
  tabla       text not null,
  registro_id uuid not null,
  accion      text not null,                   -- 'update' / 'anular'
  antes       jsonb,
  despues     jsonb,
  motivo      text,
  usuario_id  uuid,
  fecha       timestamptz not null default now()
);
```

### 7.1 Funciones RPC (toda escritura de viajes pasa por aquí, en una sola transacción)

- `iniciar_viaje(p_id, p_vehiculo_id, p_destino_id, p_origen_id, p_salida_at, p_km_salida, p_litros_salida, p_fuente_nivel, p_foto)`
  - Valida: camión `disponible`; sin ruta abierta del camión ni del chofer; `p_km_salida ≥ km actual conocido` (sección 8.5); `0 ≤ p_litros_salida ≤ capacidad`.
  - Efecto: inserta el viaje y pone el camión `en_ruta`. Idempotente por `p_id` (si ya existe, devuelve el existente).
- `registrar_repostaje(p_id, p_vehiculo_id, p_fecha, p_km, p_litros, p_precio_id, p_tanque_lleno, p_estacion, p_recibo, p_notas)`
  - Copia `precio_usd_litro` del catálogo. Si el camión tiene ruta abierta, enlaza `viaje_id`. Valida km y litros (sección 8.5). Idempotente por `p_id`.
- `finalizar_viaje(p_viaje_id, p_llegada_at, p_km_llegada, p_reposto, p_repostaje_id, p_litros, p_precio_id, p_tanque_lleno, p_litros_aguja, p_recibo, p_foto, p_notas)`
  - Si `p_reposto`: inserta el repostaje de cierre (`es_cierre_viaje = true`).
  - Cierra el viaje, llama `recalcular_viaje`, pone el camión `disponible`. Idempotente.
- `recalcular_viaje(p_viaje_id)`: aplica la sección 8 y escribe las columnas de resultado. También lo dispara un trigger cuando se edita o anula un repostaje o el propio viaje.
- `anular_registro(p_tabla, p_id, p_motivo)`: soft delete + auditoría + recálculo de lo afectado.

### 7.2 Vistas para el dashboard

- `v_odometro_actual` — último km conocido por camión (máximo entre `km_inicial`, viajes, repostajes y mantenimientos no anulados) y su fecha.
- `v_ciclos_combustible` — tramos lleno-a-lleno por camión (sección 8.6).
- `v_kpi_vehiculo_mes` — por camión y mes: km, litros, gasto combustible, gasto mantenimiento, km/L, L/100 km, costo/km (combustible y total), número de viajes.
- `v_kpi_flota_mes` — lo mismo agregado a la flota (siempre ponderado).
- `v_mant_categoria_mes` — gasto por categoría, camión y mes.
- `v_costo_por_destino` — por destino: viajes, km promedio, litros promedio, costo promedio, km/L ponderado.
- `v_alertas` — sección 10.3.

Si una consulta pesa, conviértela en RPC con parámetros `desde / hasta / vehiculo_id / chofer_id / destino_id`. **Atribución temporal:** un viaje cuenta en el mes de su **llegada**; un mantenimiento, en el mes de su **fecha**; un repostaje suelto, en el de su **fecha**.

### 7.3 Storage

- Bucket `vehiculos` (fotos de camiones): lectura para autenticados; escritura flota/admin.
- Bucket `comprobantes` (recibos, facturas, fotos de odómetro): privado, URLs firmadas; escritura por quien registra.
- Compresión en el cliente antes de subir: los datos móviles son caros.

### 7.4 Tasa BCV

- Edge Function `tasa-bcv` programada con `pg_cron` (lunes a viernes, en la mañana): consulta `https://ve.dolarapi.com/v1/dolares/oficial` y guarda en `tasas_bcv`. Verifica el formato real de la respuesta antes de mapear campos.
- Al registrar un gasto en Bs, el formulario propone la tasa de esa fecha (o la última anterior disponible) y permite sobrescribirla a mano (se guarda en el gasto; si no existía tasa para ese día, se crea con `manual = true`).
- Si la API falla, no se bloquea nada: se pide la tasa manual.

---

## 8. Motor de cálculo de combustible (el corazón del sistema)

### 8.1 La idea (el ejemplo de Roberts)

El chofer sale con el odómetro en **10.000 km** y el tanque **lleno**. Llega con **10.400 km**. Al repostar hasta llenar, los litros que entran son exactamente lo que gastó en ese viaje. Con eso sale el gasto de la ruta y el consumo por km, con sus fechas.

### 8.2 Fórmula general por viaje

```
L_salida  = litros en el tanque al salir (lleno ⇒ capacidad del tanque)
ΣL_viaje  = litros de TODAS las cargas entre la salida y la llegada, incluida la de cierre
L_final   = nivel después de la última carga del viaje:
              · cierre con tanque lleno             ⇒ capacidad
              · sin carga al llegar                 ⇒ litros_llegada_aguja
              · carga de cierre parcial             ⇒ litros_llegada_aguja (leída después de cargar)

litros_consumidos = L_salida + ΣL_viaje − L_final
km_recorridos     = km_llegada − km_salida
rendimiento_kml   = km_recorridos ÷ litros_consumidos
litros_100km      = litros_consumidos ÷ km_recorridos × 100
```

Con el ejemplo y un tanque de 200 L (capacidad supuesta solo para ilustrar): `200 + 80 − 200 = 80 L` → 400 km ÷ 80 L = **5,00 km/L** = **20,00 L/100 km**.

Si sale a medio tanque (100 L) y al llegar llena con 180 L: `100 + 180 − 200 = 80 L`. La fórmula sirve igual.

### 8.3 Costo del viaje (D5)

```
precio_ponderado      = Σ monto_usd de las cargas del viaje ÷ Σ litros de esas cargas
                        (si el viaje no tuvo cargas ⇒ precio de la última carga del camión)
costo_combustible_usd = litros_consumidos × precio_ponderado   (redondear a 2 decimales al final)
costo_km_usd          = costo_combustible_usd ÷ km_recorridos
```

Cuando sale lleno y llega llenando, esto equivale exactamente a la suma de lo pagado durante el viaje.

### 8.4 Calidad del dato

| Calidad | Cuándo |
|---|---|
| `exacto` | Nivel de salida conocido con certeza (`lleno` o `heredado`) **y** cierre con tanque lleno |
| `estimado` | Interviene alguna lectura de aguja o litros declarados a ojo |
| `incompleto` | Falta el km de llegada o no hay forma de conocer el nivel final; no entra en promedios |

Los promedios del dashboard usan `exacto` + `estimado` por defecto, con un filtro para ver solo `exacto`. La interfaz siempre muestra la calidad con ícono + texto (no solo color).

**Nivel heredado:** al iniciar un viaje, si el último evento del camión fue una carga con tanque lleno (o el alta del camión con `combustible_inicial_l = capacidad`) y el km de salida coincide con ese km (tolerancia configurable, por defecto 5 km), el sistema propone "Tanque lleno (último repostaje)" y guarda `fuente_nivel_salida = 'heredado'`.

### 8.5 Validaciones

| Regla | Chofer | Flota / admin |
|---|---|---|
| `km_llegada > km_salida` | bloquea | bloquea |
| km nuevo menor que el último km conocido del camión | bloquea | permite con motivo |
| Litros de una carga > capacidad × 1,05 | bloquea | bloquea |
| `litros_consumidos ≤ 0` | bloquea y pide revisar | bloquea |
| `L_final > capacidad` o `litros_consumidos > L_salida + ΣL_viaje` | bloquea | bloquea |
| Rendimiento fuera de `rendimiento_min_kml`–`rendimiento_max_kml` del camión | permite, marca `revisar` | igual |
| Viaje > 1.500 km o > 72 h | pide confirmación | igual |
| km de salida > km actual + 5 (hubo km sin ruta registrada) | permite, genera alerta "km sin ruta" | igual |

Mensajes de error concretos, con los números involucrados y cómo corregirlo.

### 8.6 Ciclos lleno-a-lleno (validación cruzada)

Independiente de los viajes, `v_ciclos_combustible` calcula el rendimiento por tramos entre dos cargas completas (método Fleetio/Fuelly): km = diferencia de odómetro entre dos cargas llenas consecutivas; litros = suma de las cargas del tramo (parciales + la llena que lo cierra, sin contar la que lo abre). El alta cuenta como "lleno" si `combustible_inicial_l = capacidad_tanque_l`. Sirve para:

- validar los resultados por viaje (si en un mes divergen más de 10 %, alerta);
- tener rendimiento aunque haya km fuera de viajes registrados.

### 8.7 Agregados

Siempre ponderados: `km/L del período = Σ km ÷ Σ litros`; `costo/km = Σ costo ÷ Σ km`. Nunca promediar los ratios de cada viaje.

### 8.8 Dónde vive la lógica

- En Postgres (`recalcular_viaje` y vistas): fuente única de verdad.
- Duplicada como función pura en `src/lib/consumo.ts` **solo** para la vista previa del formulario ("400 km y 80 L → 5,00 km/L, $48,00"). La cifra oficial siempre viene de la base.
- Los casos de la sección 12 se prueban en ambos lados (Vitest y pruebas SQL) y deben dar lo mismo.

---

## 9. Flujos de usuario

### 9.1 Chofer (móvil primero)

**Inicio del chofer**
- Sin ruta abierta: tarjeta de su camión habitual (foto, placa, km actual, nivel estimado) con opción de cambiar de camión si hoy maneja otro. Acción principal: **Iniciar ruta**.
- Con ruta abierta: destino, hora de salida, tiempo transcurrido, km de salida. Acción principal: **Finalizar ruta**; secundaria: **Registrar repostaje** (carga en el camino).
- Acceso al dashboard en modo lectura.

**Iniciar ruta** (una sola pantalla u hoja)
1. Destino: lista desplegable con búsqueda; recientes primero. Origen por defecto: la sede o el último destino.
2. Km de salida: prellenado con el último km conocido, teclado numérico, muestra la diferencia ("+0 km desde el último registro").
3. Combustible al salir: `Lleno` (por defecto, o heredado) · `3/4` · `1/2` · `1/4` · `Otro: __ L`.
4. Foto del odómetro (opcional u obligatoria según configuración).
5. **Iniciar ruta** → el camión aparece "En ruta" para todos (Realtime).

**Finalizar ruta**
1. Km de llegada, con validación inmediata y km recorridos a la vista.
2. ¿Repostaste al llegar? Sí / No.
   - Sí: litros; precio por litro con dos botones grandes **$0,50** / **$0,60** (el último usado preseleccionado); ¿llenaste el tanque? (Sí por defecto); foto del recibo.
   - No: nivel de la aguja al llegar.
3. Resumen antes de confirmar: km, litros, km/L, costo, calidad.
4. **Finalizar ruta** → camión "Disponible" y resumen en pantalla.

**Registrar repostaje** suelto (en ruta o fuera de ella): km, litros, precio $0,50 / $0,60, tanque lleno sí/no, recibo.

### 9.2 El botón "En ruta" (presentar 2 variantes en la Fase 0)

Roberts lo pidió como un botón que activa cada chofer. No puede ser un interruptor mudo: encenderlo exige destino y km; apagarlo exige km de llegada y el dato de combustible.

- **Variante A:** interruptor grande "En ruta" en la tarjeta del camión; al tocarlo abre la hoja de inicio o cierre. El estado se lee de un vistazo.
- **Variante B:** botón de acción a todo el ancho que cambia de texto y color según el estado (Iniciar ruta / Finalizar ruta), con el estado mostrado aparte.

En ambas: área táctil ≥ 48 px, confirmación clara y "Deshacer" durante unos segundos si fue un toque accidental (anula el viaje recién creado, con auditoría).

### 9.3 Flota / admin (escritorio primero, usable en móvil)

- **Camiones:** listado + crear/editar ficha con foto. Estado manual `taller` / `inactivo`.
- **Registrar mantenimiento:** camión, categoría, fecha, km, descripción, proveedor, moneda **$ / Bs**, monto, tasa BCV (prellenada si es Bs), foto de factura. Muestra el equivalente en USD en vivo.
- **Catálogos:** ubicaciones, categorías, precios de combustible (activar/desactivar; nunca borrar).
- **Bandeja de revisión:** viajes marcados `revisar`, rutas abiertas hace más de 48 h, km sin ruta, viajes `incompleto`.
- **Correcciones** con motivo; historial de auditoría por registro.
- **Usuarios** (solo admin): crear, asignar rol, restablecer PIN, desactivar.

---

## 10. Dashboard

Todo usuario lo ve al entrar. El chofer puede aterrizar en su inicio con acceso directo al dashboard (confirmar en la Fase 0).

### 10.1 Global (flota)

**Filtros:** período (este mes, mes anterior, últimos 90 días, este año, rango), camión, chofer, destino, calidad (todos / solo exactos).

**KPIs**, cada uno con variación contra el período anterior (▲/▼), como en los reportes de IP:
- Gasto total (USD) = combustible + mantenimiento
- Gasto en combustible (USD)
- Gasto en mantenimiento (USD)
- Km recorridos
- Rendimiento de la flota (km/L; L/100 km como dato secundario)
- Costo por km (total y solo combustible)

**Ahora mismo:** camiones en ruta (placa, chofer, destino, desde cuándo), en tiempo real.

**Gráficos:**
1. Gasto mensual combustible vs. mantenimiento (barras apiladas, 12 meses).
2. Rendimiento km/L por camión (barras horizontales ordenadas, con línea del promedio de flota).
3. Tendencia del rendimiento por camión (líneas; camiones seleccionables).
4. Mantenimiento por categoría (barras horizontales).
5. Costo por destino: viajes, km promedio, litros promedio, costo promedio, km/L.
6. Costo por km por camión (ranking).

**Tabla de camiones:** foto, placa/alias, estado, km actual, km del período, km/L, costo/km, gasto de mantenimiento, alertas. Clic → ficha.

### 10.2 Ficha del camión (individual)

- **Cabecera:** foto, placa, alias, marca/modelo/año, estado, chofer habitual, km actual, capacidad del tanque, nivel estimado actual (último nivel conocido − km desde entonces × L/km promedio del camión, marcado como estimado). Acción contextual: Iniciar/Finalizar ruta, Registrar repostaje, Registrar gasto (según rol).
- **Pestañas:**
  - **Resumen:** KPIs del camión, rendimiento por viaje en el tiempo (con su promedio como referencia), gasto mensual apilado, mantenimiento por categoría, comparación con el promedio de la flota.
  - **Viajes:** fecha de salida/llegada, destino, chofer, km, litros, km/L, costo, costo/km, calidad.
  - **Combustible:** historial de repostajes (fecha, km, litros, precio, monto, lleno/parcial, recibo) + ciclos lleno-a-lleno.
  - **Mantenimiento:** historial con moneda original, tasa y equivalente USD; totales por categoría.
  - **Datos:** ficha técnica (editable según rol).

### 10.3 Alertas

| Alerta | Regla inicial (configurable) |
|---|---|
| Consumo anómalo | km/L del viaje 15 % peor que el promedio de ese camión en los últimos 90 días (mínimo 5 viajes) |
| Ruta abierta mucho tiempo | viaje `en_curso` por más de 48 h |
| Km sin ruta | salto de odómetro > 5 km entre la llegada de un viaje y la salida del siguiente |
| Viaje sin datos de combustible | calidad `incompleto` |
| Divergencia de cálculo | viajes vs. ciclos lleno-a-lleno difieren > 10 % en el mes |
| (Fase 2) Mantenimiento próximo | por km o fecha |

### 10.4 Exportación

Botón en cada tabla: CSV y Excel, con las columnas visibles y los filtros aplicados; montos USD y Bs en columnas separadas y etiquetadas.

---

## 11. Dirección de diseño y UX

- **Dos contextos, una identidad.** El chofer usa el teléfono en la cabina o en la bomba, a pleno sol y con prisa: alto contraste, botones ≥ 48 px, una tarea por pantalla, teclado numérico (`inputmode="decimal"`), mínimo tecleo, valores prellenados. La gerencia usa escritorio: densidad de información, comparativos, tablas ordenables.
- **Los números son el producto.** Cifras con numerales tabulares, alineadas a la derecha en tablas, unidades siempre visibles (km, L, km/L, $, Bs). La calidad del dato (exacto/estimado) siempre a la vista.
- **Anclado al mundo del cliente:** carretera, odómetro, aguja de combustible, ticket de estación. Que no parezca una plantilla genérica de SaaS.
- **Evitar los clichés de UI generada:** fondo crema con acento terracota; fondo negro con un solo acento neón; todo partido en tarjetas idénticas con la misma sombra gris; etiquetas en MAYÚSCULAS espaciadas encima de cada título; flechas "→" pegadas a cada botón; degradados decorativos; animación de entrada en cada sección. Concentrar la audacia en un solo elemento memorable (por ejemplo, cómo se presenta el rendimiento de cada camión) y mantener lo demás sobrio.
- **Gráficos:** colores accesibles en modo claro y oscuro; nunca depender solo del color; leyendas directas sobre las series cuando se pueda; tooltips con unidades.
- **Textos:** español venezolano llano, voz activa, mayúscula solo al inicio. El botón dice lo que hace y el aviso usa la misma palabra ("Finalizar ruta" → "Ruta finalizada"). Errores que dicen qué pasó y cómo corregirlo, sin disculpas: "El km de llegada (10.380) es menor que el de salida (10.400). Revísalo en el tablero." Estados vacíos que invitan a actuar: "Aún no hay rutas este mes. Inicia la primera desde el camión."
- **Calidad mínima:** responsive desde 360 px, foco visible con teclado, `prefers-reduced-motion` respetado, contraste AA, modo oscuro.
- **Proceso por pantalla clave:** `impeccable shape` → construir → captura con Playwright → `critique` → corregir → `polish`.

---

## 12. Casos de prueba (deben cuadrar al centavo)

Camión de prueba: capacidad 200 L.

| # | Escenario | Datos | Resultado esperado |
|---|---|---|---|
| T1 | Ejemplo de Roberts | Sale lleno en km 10.000; llega a 10.400; llena con 80 L a $0,60 | 400 km; 80,00 L; 5,00 km/L; 20,00 L/100 km; $48,00; $0,1200/km; exacto |
| T2 | Sale a medio tanque | Sale con 1/2 (100 L, aguja) en km 10.000; llega a 10.400; llena con 180 L a $0,50 | 80,00 L; 5,00 km/L; $40,00; estimado |
| T3 | Carga parcial en el camino | Sale lleno en km 10.000; en 10.250 carga 40 L a $0,50 (parcial); llega a 10.600 y llena con 70 L a $0,60 | 600 km; 110,00 L; 5,45 km/L; $62,00; $0,1033/km; exacto |
| T4 | No repostó al llegar | Sale lleno en km 10.000; llega a 10.300; aguja 3/4 (150 L); última carga del camión a $0,60 | 50,00 L; 6,00 km/L; $30,00; estimado |
| T5 | Km incoherente | Llegada 9.990 con salida 10.000 | Rechazado con mensaje claro |
| T6 | Litros imposibles | Carga de 250 L en tanque de 200 L | Rechazado |
| T7 | Ciclo lleno-a-lleno | Lleno en km 10.000; parcial de 30 L en 10.300; lleno con 90 L en 10.700 | Ciclo: 700 km; 120 L; 5,83 km/L |
| T8 | Nivel heredado | T1 cerrado; nuevo viaje sale en km 10.400 | Propone "Tanque lleno", fuente `heredado`; puede quedar `exacto` |
| T9 | Mantenimiento en Bs | Bs 37.900,00 con tasa 379,00 | $100,00; el dashboard suma en USD |
| T10 | Agregado ponderado | T1 + T3 en el mismo mes | 1.000 km ÷ 190 L = 5,26 km/L (no 5,23, que sería el promedio de ratios); $110,00; $0,1100/km |
| T11 | Anulación | Anular la carga de cierre de T1 | El viaje pasa a `incompleto` (o pide aguja); auditoría registrada; dashboard actualizado |
| T12 | Doble envío offline | Mismo `id` de viaje enviado dos veces | Un solo registro |
| T13 | RLS | Chofer intenta editar un mantenimiento o el viaje de otro chofer | Denegado |
| T14 | Rutas simultáneas | Chofer con ruta abierta intenta iniciar otra; o camión ya en ruta | Rechazado con mensaje claro |

**Criterios de aceptación del MVP:**
- T1–T14 en verde, en Vitest y en pruebas SQL.
- Un chofer completa "Iniciar ruta" en menos de 30 segundos y "Finalizar ruta con repostaje" en menos de 60, en un teléfono de gama media.
- El dashboard global carga en menos de 2 s con 12 meses de datos de 15 camiones.
- Ningún total en USD mezcla montos en Bs sin convertir.

---

## 13. Repositorio, entorno y despliegue

```
flota-ip/
├── CLAUDE.md
├── README.md
├── .env.example                # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── docs/
│   ├── HANDOFF.md              # este documento
│   ├── INVESTIGACION.md
│   ├── OPCIONES.md
│   ├── DECISIONES.md
│   ├── BITACORA.md
│   └── MANUAL_CHOFER.md        # 1 página con capturas
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   ├── tests/                  # pruebas SQL de RLS, RPC y vistas
│   └── functions/
│       ├── admin-usuarios/
│       └── tasa-bcv/
├── src/
│   ├── app/                    # router, providers, layout
│   ├── features/
│   │   ├── vehiculos/
│   │   ├── viajes/
│   │   ├── repostajes/
│   │   ├── mantenimiento/
│   │   ├── dashboard/
│   │   ├── catalogos/
│   │   └── usuarios/
│   ├── lib/                    # supabase.ts, formato.ts (es-VE), consumo.ts, offline.ts
│   ├── components/
│   └── styles/
├── tests/                      # Vitest + Playwright
└── .github/workflows/
    ├── ci.yml                  # typecheck, lint, tests
    └── deploy.yml              # build + deploy (según D1)
```

- Tipos de la base generados con `supabase gen types typescript` → `src/lib/database.types.ts`; regenerar después de cada migración.
- CI en cada push (typecheck, lint, Vitest); deploy solo desde `main`.
- Variables de build como *secrets* de GitHub. La llave secreta de Supabase solo en los secrets de las Edge Functions.
- GitHub Pages: configurar `base` de Vite y el fallback `404.html` para el router.
- Nunca subir `.env`, dumps de la base ni fotos reales de prueba.

---

## 14. Plan por fases

| Fase | Contenido | Cierre |
|---|---|---|
| **F0** | Investigación, opciones visuales y de navegación, decisiones D1–D8, preguntas abiertas | 🛑 Roberts elige |
| **F1** | Repo, Vite + TS + Tailwind, proyecto Supabase enlazado, migraciones (tipos, tablas, índices, RLS, auditoría), seed, tipos generados, `CLAUDE.md`, CI | 🛑 Mostrar esquema y pruebas de RLS por rol |
| **F2** | Auth (según D3), roles, Edge Function `admin-usuarios`, shell responsive con la navegación elegida, formato es-VE | Commit + bitácora |
| **F3** | Catálogos y camiones: listado, ficha (datos, foto), estados manuales | Commit + bitácora |
| **F4** | Viajes + repostajes: RPCs, botón En ruta, formularios del chofer, `recalcular_viaje`, ciclos, validaciones, Realtime de estado. T1–T8, T12–T14 en verde | 🛑 Demo de los flujos del chofer con los casos de prueba |
| **F5** | Mantenimiento + tasa BCV (Edge Function + cron + carga manual). T9 en verde | Commit + bitácora |
| **F6** | Dashboard global e individual, alertas, exportación. T10–T11 en verde | 🛑 Revisión del dashboard |
| **F7** | PWA y offline (según D4), rendimiento, accesibilidad, `impeccable critique → audit → polish` | Commit + bitácora |
| **F8** | QA completo con datos demo realistas, despliegue, `MANUAL_CHOFER.md`, limpieza de datos demo antes de entregar | 🛑 Entrega |

**Definición de terminado (cada fase):** tipos y lint sin errores, pruebas en verde, RLS verificado, sin `console.log` sobrante, bitácora actualizada, capturas de las pantallas nuevas en móvil (360 px) y escritorio (1440 px).

---

## 15. Preguntas abiertas para Roberts (llevarlas al checkpoint F0)

1. ¿Cuántos camiones y choferes hay? ¿Cada chofer tiene camión fijo o rotan?
2. ¿Todos usan gasolina o hay diésel? Confirmar que $0,50 y $0,60 son **USD por litro** (supuesto actual).
3. Lista real de destinos/ubicaciones, y si el origen es siempre la sede (¿cuál?).
4. ¿Los choferes tienen correo o se usa usuario + PIN?
5. ¿Quién registra el mantenimiento? ¿Se paga en Bs, en $ o en ambos?
6. ¿Una ruta tiene un solo destino o recorre varios clientes (paradas)?
7. ¿Se exige foto del odómetro y del recibo, o es opcional?
8. Nombre del sistema y si se usa la identidad de IP (logo, azul marino de los reportes).
9. Hosting (D1) y plan de Supabase.
10. ¿Hay histórico (Excel o cuaderno) de combustible o mantenimiento para importar?

---

## Anexo A — Datos semilla

```sql
-- Precios de combustible (USD por litro)
insert into precios_combustible (etiqueta, precio_usd_litro, orden) values
  ('$0,50', 0.500, 1),
  ('$0,60', 0.600, 2);

-- Categorías de mantenimiento
-- Las 7 primeras las pidió Roberts; el resto son sugerencias a confirmar en F0
insert into categorias_mantenimiento (nombre, orden) values
  ('Cauchos', 1), ('Repuestos', 2), ('Mano de obra', 3), ('Pintura', 4),
  ('Lavado', 5), ('Aceite', 6), ('Filtros', 7),
  ('Frenos', 8), ('Batería', 9), ('Sistema eléctrico', 10), ('Latonería', 11),
  ('Otros', 99);

-- Ubicaciones de EJEMPLO para desarrollo (reemplazar con la lista real de IP)
insert into ubicaciones (nombre, estado_ve, municipio, tipo) values
  ('Sede principal', null, null, 'sede'),
  ('Valera', 'Trujillo', 'Valera', 'cliente'),
  ('Mérida', 'Mérida', 'Libertador', 'cliente'),
  ('El Vigía', 'Mérida', 'Alberto Adriani', 'cliente'),
  ('Maracaibo', 'Zulia', 'Maracaibo', 'cliente'),
  ('Cabimas', 'Zulia', 'Cabimas', 'cliente');
```

**Datos demo (solo desarrollo):** 3 camiones ficticios (`DEMO-001` a `DEMO-003`, tanques entre 150 y 250 L), 3 choferes, 3 meses de viajes, cargas y mantenimientos coherentes con los casos de la sección 12, incluidos algunos parciales, una ruta olvidada y un consumo anómalo para probar alertas. Se eliminan antes de la entrega.

---

## Anexo B — Referencias de la investigación previa

- Fleetio, cargas parciales: https://help.fleetio.com/en_US/fuel-management/partial-fuel-entries
- Fleetio, registro de combustible: https://help.fleetio.com/using-fleetio/fuel-entry-overview
- Fleetio Go (móvil): https://fleetio.helpjuice.com/fleetio-go/fuel-entries-in-fleetio-go
- Fuelly, preguntas frecuentes: https://www.fuelly.com/index.php/faq/full
- Simply Fleet, módulo de viajes: https://www.fleetowner.com/product-spotlight/product/55399565/simply-fleet-fleet-management-software-connects-trip-tracking-driver-data-and-maintenance
- Simply Fleet, combustible: https://www.simplyfleet.app/features/fuel-management-software
- Simply Fleet, dashboard y KPIs: https://www.simplyfleet.app/blog/fleet-management-dashboard
- Drivvo, flotas: https://www.drivvo.com/en/fleet-management
- Drivvo, reseña en español: https://www.elgrupoinformatico.com/noticias/drivvo-que-como-funciona-t78648.html
- Fleetio, KPIs de flota: https://www.fleetio.com/blog/fleet-management-kpis
- Tasa BCV (DolarApi Venezuela): https://ve.dolarapi.com/v1/dolares/oficial — docs: https://dolarapi.com/docs
- impeccable: https://github.com/pbakaus/impeccable
- ui-ux-pro-max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
