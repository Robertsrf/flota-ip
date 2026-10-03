-- =====================================================================
-- Flota IP · Esquema base
-- Unidades (camiones y plantas), catálogos, viajes con paradas,
-- repostajes, tasas BCV, mantenimientos y auditoría.
-- Convención: dominio en español; toda tabla operativa lleva
-- created_at, updated_at, created_by, anulado y anulado_motivo.
-- =====================================================================

-- ----- Tipos ---------------------------------------------------------
create type public.rol_usuario       as enum ('superusuario', 'flota', 'chofer', 'consulta');
create type public.tipo_unidad       as enum ('camion', 'planta');
create type public.tipo_medidor      as enum ('km', 'horas', 'ninguno');
create type public.estado_unidad     as enum ('disponible', 'en_ruta', 'taller', 'inactivo');
create type public.tipo_combustible  as enum ('gasolina', 'diesel');
create type public.moneda            as enum ('USD', 'VES');
create type public.estado_viaje      as enum ('en_curso', 'cerrado', 'anulado');
create type public.calidad_calculo   as enum ('exacto', 'estimado', 'incompleto');
create type public.estado_aprobacion as enum ('pendiente', 'aprobado', 'rechazado');

-- ----- Utilidades ----------------------------------------------------
create function public.tg_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Fecha "de hoy" en Venezuela
create function public.hoy_caracas() returns date
language sql stable as $$
  select (now() at time zone 'America/Caracas')::date
$$;

-- Formato es-VE para mensajes: 10400 -> '10.400'; 62 (2 dec) -> '62,00'
create function public.fmt_num(n numeric, decimales int default 0) returns text
language sql immutable as $$
  select translate(
    to_char(round(n, decimales),
            'FM999,999,999,990' || case when decimales > 0 then '.' || repeat('0', decimales) else '' end),
    ',.', '.,')
$$;

-- ----- Personas ------------------------------------------------------
create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  usuario     text unique check (usuario ~ '^[a-z0-9._-]{3,32}$'),
  correo      text,
  telefono    text,
  rol         public.rol_usuario not null default 'chofer',
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger perfiles_updated_at before update on public.perfiles
  for each row execute function public.tg_updated_at();

-- Cada usuario de Auth tiene su perfil. El rol viene de app_metadata
-- (solo lo escribe el servidor); si no hay rol, queda como chofer.
create function public.tg_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, usuario, correo, rol)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    nullif(lower(trim(new.raw_user_meta_data ->> 'usuario')), ''),
    new.email,
    coalesce(nullif(new.raw_app_meta_data ->> 'rol', '')::public.rol_usuario, 'chofer')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_nuevo_usuario();

-- ----- Unidades: camiones y plantas eléctricas ------------------------
create table public.unidades (
  id                     uuid primary key default gen_random_uuid(),
  tipo                   public.tipo_unidad not null default 'camion',
  placa                  text unique,
  alias                  text,
  marca                  text,
  modelo                 text,
  anio                   int check (anio between 1950 and 2100),
  combustible            public.tipo_combustible not null default 'gasolina',
  medidor                public.tipo_medidor not null default 'km',
  capacidad_tanque_l     numeric(7, 2) not null check (capacidad_tanque_l > 0),
  lectura_inicial        numeric(10, 1) check (lectura_inicial >= 0),
  combustible_inicial_l  numeric(7, 2) not null default 0 check (combustible_inicial_l >= 0),
  fecha_alta             date not null default public.hoy_caracas(),
  foto_path              text,
  estado                 public.estado_unidad not null default 'disponible',
  chofer_habitual_id     uuid references public.perfiles (id),
  rendimiento_min        numeric(6, 2) not null default 1.5 check (rendimiento_min > 0),
  rendimiento_max        numeric(6, 2) not null default 15 check (rendimiento_max > 0),
  notas                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid default auth.uid(),
  constraint unidades_combustible_inicial_ck check (combustible_inicial_l <= capacidad_tanque_l),
  constraint unidades_camion_ck check (tipo <> 'camion' or (medidor = 'km' and placa is not null)),
  constraint unidades_planta_estado_ck check (tipo <> 'planta' or estado <> 'en_ruta'),
  constraint unidades_lectura_ck check ((medidor = 'ninguno') = (lectura_inicial is null)),
  constraint unidades_rango_rendimiento_ck check (rendimiento_min < rendimiento_max),
  constraint unidades_nombre_ck check (coalesce(nullif(trim(alias), ''), placa) is not null)
);
create trigger unidades_updated_at before update on public.unidades
  for each row execute function public.tg_updated_at();

-- ----- Catálogos -----------------------------------------------------
create table public.ubicaciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(trim(nombre)) > 0),
  estado_ve   text,
  municipio   text,
  tipo        text not null default 'cliente'
              check (tipo in ('sede', 'almacen', 'cliente', 'taller', 'estacion', 'otro')),
  activo      boolean not null default true,
  es_sistema  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create unique index ubicaciones_nombre_uq
  on public.ubicaciones (lower(trim(nombre)), lower(coalesce(trim(municipio), '')));
create trigger ubicaciones_updated_at before update on public.ubicaciones
  for each row execute function public.tg_updated_at();

create table public.precios_combustible (
  id                uuid primary key default gen_random_uuid(),
  etiqueta          text not null,
  precio_usd_litro  numeric(6, 3) not null check (precio_usd_litro > 0),
  activo            boolean not null default true,
  orden             int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger precios_updated_at before update on public.precios_combustible
  for each row execute function public.tg_updated_at();

create table public.categorias_mantenimiento (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  icono       text,
  activo      boolean not null default true,
  orden       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger categorias_updated_at before update on public.categorias_mantenimiento
  for each row execute function public.tg_updated_at();

-- Umbrales y reglas configurables (una sola fila)
create table public.configuracion (
  id                          boolean primary key default true check (id),
  tolerancia_heredado_km      numeric(6, 1) not null default 5,
  umbral_km_sin_ruta          numeric(6, 1) not null default 5,
  umbral_ruta_abierta_h       int not null default 48,
  umbral_consumo_anomalo_pct  numeric(5, 2) not null default 15,
  min_viajes_promedio         int not null default 5,
  umbral_divergencia_pct      numeric(5, 2) not null default 10,
  viaje_max_km                numeric(8, 1) not null default 1500,
  viaje_max_h                 int not null default 72,
  ventana_correccion_min      int not null default 30,
  updated_at                  timestamptz not null default now()
);
create trigger configuracion_updated_at before update on public.configuracion
  for each row execute function public.tg_updated_at();

-- ----- Viajes (rutas) ------------------------------------------------
create table public.viajes (
  id                     uuid primary key,          -- generado en el cliente (idempotencia offline)
  folio                  int generated always as identity unique,
  unidad_id              uuid not null references public.unidades (id),
  chofer_id              uuid not null references public.perfiles (id),
  origen_id              uuid references public.ubicaciones (id),
  destino_id             uuid not null references public.ubicaciones (id),  -- destino principal (última parada)
  salida_at              timestamptz not null,
  km_salida              numeric(10, 1) not null check (km_salida >= 0),
  litros_salida          numeric(7, 2) not null check (litros_salida >= 0),
  fuente_nivel_salida    text not null check (fuente_nivel_salida in ('lleno', 'aguja', 'litros', 'heredado')),
  llegada_at             timestamptz,
  km_llegada             numeric(10, 1),
  litros_llegada_aguja   numeric(7, 2) check (litros_llegada_aguja >= 0),
  estado                 public.estado_viaje not null default 'en_curso',
  -- Resultados: los escribe recalcular_viaje(); el cliente nunca los envía
  km_recorridos          numeric(10, 1),
  litros_consumidos      numeric(8, 2),
  rendimiento_kml        numeric(6, 2),
  litros_100km           numeric(6, 2),
  precio_promedio_usd    numeric(8, 4),
  costo_combustible_usd  numeric(10, 2),
  costo_km_usd           numeric(8, 4),
  calidad                public.calidad_calculo,
  revisar                boolean not null default false,
  revisar_motivos        text[] not null default '{}',
  foto_odometro_salida   text,
  foto_odometro_llegada  text,
  notas                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid default auth.uid(),
  anulado                boolean generated always as (estado = 'anulado') stored,
  anulado_motivo         text,
  constraint viajes_km_llegada_ck check (km_llegada is null or km_llegada > km_salida),
  constraint viajes_llegada_ck check (llegada_at is null or llegada_at >= salida_at),
  constraint viajes_cerrado_ck check (estado <> 'cerrado' or (llegada_at is not null and km_llegada is not null))
);
create unique index uq_viaje_abierto_unidad on public.viajes (unidad_id) where estado = 'en_curso';
create unique index uq_viaje_abierto_chofer on public.viajes (chofer_id) where estado = 'en_curso';
create index viajes_unidad_salida_ix on public.viajes (unidad_id, salida_at);
create index viajes_llegada_ix on public.viajes (llegada_at);
create index viajes_chofer_ix on public.viajes (chofer_id, salida_at);
create trigger viajes_updated_at before update on public.viajes
  for each row execute function public.tg_updated_at();

create table public.viaje_paradas (
  viaje_id      uuid not null references public.viajes (id) on delete cascade,
  orden         smallint not null check (orden >= 1),
  ubicacion_id  uuid not null references public.ubicaciones (id),
  primary key (viaje_id, orden)
);
create index viaje_paradas_ubicacion_ix on public.viaje_paradas (ubicacion_id);

-- ----- Repostajes ----------------------------------------------------
create table public.repostajes (
  id                    uuid primary key,           -- generado en el cliente
  folio                 int generated always as identity unique,
  unidad_id             uuid not null references public.unidades (id),
  viaje_id              uuid references public.viajes (id),
  chofer_id             uuid references public.perfiles (id),
  fecha                 timestamptz not null,
  lectura_medidor       numeric(10, 1) check (lectura_medidor >= 0),  -- km u horas; nula si la unidad no tiene medidor
  litros                numeric(7, 2) not null check (litros > 0),
  precio_id             uuid references public.precios_combustible (id),
  precio_usd_litro      numeric(6, 3) not null check (precio_usd_litro > 0),  -- copia fija del precio elegido
  monto_usd             numeric(10, 2) generated always as (round(litros * precio_usd_litro, 2)) stored,
  tanque_lleno          boolean not null default true,
  es_cierre_viaje       boolean not null default false,
  carga_previa_omitida  boolean not null default false,
  estacion              text,
  recibo_path           text,
  notas                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid default auth.uid(),
  anulado               boolean not null default false,
  anulado_motivo        text,
  constraint repostajes_cierre_ck check (not es_cierre_viaje or viaje_id is not null)
);
create index repostajes_unidad_fecha_ix on public.repostajes (unidad_id, fecha);
create index repostajes_viaje_ix on public.repostajes (viaje_id);
create trigger repostajes_updated_at before update on public.repostajes
  for each row execute function public.tg_updated_at();

-- ----- Tasa BCV ------------------------------------------------------
create table public.tasas_bcv (
  fecha         date primary key,
  bs_por_usd    numeric(14, 4) not null check (bs_por_usd > 0),
  fuente        text not null default 've.dolarapi.com',
  manual        boolean not null default false,
  capturada_at  timestamptz not null default now(),
  created_by    uuid default auth.uid()
);

-- ----- Mantenimiento y gastos ----------------------------------------
create table public.mantenimientos (
  id                 uuid primary key default gen_random_uuid(),  -- el cliente puede enviarlo (offline)
  folio              int generated always as identity unique,
  unidad_id          uuid not null references public.unidades (id),
  categoria_id       uuid not null references public.categorias_mantenimiento (id),
  fecha              date not null default public.hoy_caracas(),
  lectura_medidor    numeric(10, 1) check (lectura_medidor >= 0),
  descripcion        text,
  proveedor          text,
  moneda             public.moneda not null,
  monto              numeric(14, 2) not null check (monto > 0),
  bs_por_usd         numeric(14, 4) check (bs_por_usd > 0),
  monto_usd          numeric(12, 2) generated always as (
                       case when moneda = 'USD' then monto else round(monto / bs_por_usd, 2) end) stored,
  monto_bs           numeric(16, 2) generated always as (
                       case when moneda = 'VES' then monto
                            when bs_por_usd is not null then round(monto * bs_por_usd, 2) end) stored,
  factura_path       text,
  estado_aprobacion  public.estado_aprobacion not null default 'aprobado',
  revisado_por       uuid references public.perfiles (id),
  revisado_at        timestamptz,
  rechazo_motivo     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  anulado            boolean not null default false,
  anulado_motivo     text,
  constraint mantenimientos_tasa_ck check (moneda = 'USD' or bs_por_usd is not null)
);
create index mantenimientos_unidad_fecha_ix on public.mantenimientos (unidad_id, fecha);
create index mantenimientos_pendientes_ix on public.mantenimientos (estado_aprobacion) where estado_aprobacion = 'pendiente';
create trigger mantenimientos_updated_at before update on public.mantenimientos
  for each row execute function public.tg_updated_at();

-- ----- Auditoría -----------------------------------------------------
create table public.auditoria (
  id           bigint generated always as identity primary key,
  tabla        text not null,
  registro_id  text not null,
  accion       text not null,          -- update / anular / restaurar / aprobar / rechazar / eliminar
  antes        jsonb,
  despues      jsonb,
  motivo       text,
  usuario_id   uuid,
  fecha        timestamptz not null default now()
);
create index auditoria_registro_ix on public.auditoria (tabla, registro_id, fecha desc);

-- Columnas que no cuentan como cambio (las recalcula el sistema)
create function public.columnas_no_auditables() returns text[]
language sql immutable as $$
  select array['updated_at', 'km_recorridos', 'litros_consumidos', 'rendimiento_kml', 'litros_100km',
               'precio_promedio_usd', 'costo_combustible_usd', 'costo_km_usd', 'calidad',
               'revisar', 'revisar_motivos', 'monto_usd', 'monto_bs', 'anulado']
$$;

-- Registra solo las columnas que cambiaron. El motivo llega por
-- set_config('flota.motivo', ...) desde las funciones RPC.
create function public.tg_auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes   jsonb := '{}';
  v_despues jsonb := '{}';
  v_old     jsonb;
  v_new     jsonb;
  v_key     text;
  v_accion  text;
  v_motivo  text := nullif(current_setting('flota.motivo', true), '');
  v_id      text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    insert into public.auditoria (tabla, registro_id, accion, antes, despues, motivo, usuario_id)
    values (tg_table_name, coalesce(v_old ->> 'id', v_old ->> 'fecha'), 'eliminar', v_old, null, v_motivo, auth.uid());
    return old;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key = any (public.columnas_no_auditables()) then continue; end if;
    if (v_old -> v_key) is distinct from (v_new -> v_key) then
      v_antes   := v_antes   || jsonb_build_object(v_key, v_old -> v_key);
      v_despues := v_despues || jsonb_build_object(v_key, v_new -> v_key);
    end if;
  end loop;

  if v_despues = '{}'::jsonb then
    return new;
  end if;

  v_accion := coalesce(nullif(current_setting('flota.accion', true), ''), 'update');
  v_id := coalesce(v_new ->> 'id', v_new ->> 'fecha');
  insert into public.auditoria (tabla, registro_id, accion, antes, despues, motivo, usuario_id)
  values (tg_table_name, v_id, v_accion, v_antes, v_despues, v_motivo, auth.uid());
  return new;
end $$;

create trigger viajes_auditoria after update on public.viajes
  for each row execute function public.tg_auditar();
create trigger repostajes_auditoria after update on public.repostajes
  for each row execute function public.tg_auditar();
create trigger mantenimientos_auditoria after update on public.mantenimientos
  for each row execute function public.tg_auditar();
create trigger unidades_auditoria after update on public.unidades
  for each row execute function public.tg_auditar();
create trigger ubicaciones_auditoria after update or delete on public.ubicaciones
  for each row execute function public.tg_auditar();
create trigger precios_auditoria after update on public.precios_combustible
  for each row execute function public.tg_auditar();
create trigger categorias_auditoria after update on public.categorias_mantenimiento
  for each row execute function public.tg_auditar();
create trigger tasas_auditoria after update on public.tasas_bcv
  for each row execute function public.tg_auditar();
create trigger perfiles_auditoria after update on public.perfiles
  for each row execute function public.tg_auditar();
create trigger configuracion_auditoria after update on public.configuracion
  for each row execute function public.tg_auditar();
