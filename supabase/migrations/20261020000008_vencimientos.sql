-- =====================================================================
-- Flota IP · Recordatorios de servicio y documentos con vencimiento
-- (Fase 2 del handoff, adelantada el 20/10/2026 a pedido de Roberts)
--
-- Recordatorio: un servicio que toca cada X km y/o cada Y días
-- (p. ej. cambio de aceite cada 5.000 km o cada 90 días). Avisa cuando
-- falta poco y cuando ya se pasó. Se reinicia solo al aprobarse un gasto
-- de su misma categoría en esa unidad, o a mano con "Marcar hecho".
--
-- Documento: papel de una unidad (póliza RCV, permiso) o de una persona
-- (licencia, certificado médico) con fecha de vencimiento. Renovar
-- archiva el anterior y crea uno nuevo: el historial no se pierde.
--
-- Escrituras solo por RPC (flota y superusuario). Lectura: todo usuario
-- activo, salvo los documentos de personas, que el chofer ve solo si
-- son suyos.
-- =====================================================================

-- ----- Tablas ----------------------------------------------------------
create table public.recordatorios_servicio (
  id            uuid primary key default gen_random_uuid(),
  unidad_id     uuid not null references public.unidades (id),
  nombre        text not null check (length(trim(nombre)) > 0),
  categoria_id  uuid references public.categorias_mantenimiento (id),
  cada_km       numeric(8, 1) check (cada_km > 0),
  cada_dias     int check (cada_dias > 0),
  aviso_km      numeric(8, 1) not null default 500 check (aviso_km >= 0),
  aviso_dias    int not null default 15 check (aviso_dias >= 0),
  ultimo_km     numeric(10, 1) check (ultimo_km >= 0),
  ultima_fecha  date not null default public.hoy_caracas(),
  notas         text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  constraint recordatorios_frecuencia_ck check (cada_km is not null or cada_dias is not null),
  constraint recordatorios_km_ck check (cada_km is null or ultimo_km is not null)
);
create index recordatorios_unidad_ix on public.recordatorios_servicio (unidad_id) where activo;
create trigger recordatorios_updated_at before update on public.recordatorios_servicio
  for each row execute function public.tg_updated_at();
create trigger recordatorios_auditoria after update on public.recordatorios_servicio
  for each row execute function public.tg_auditar();

create table public.documentos (
  id            uuid primary key default gen_random_uuid(),
  unidad_id     uuid references public.unidades (id),
  persona_id    uuid references public.perfiles (id),
  tipo          text not null check (length(trim(tipo)) > 0),
  numero        text,
  emisor        text,
  vence         date not null,
  aviso_dias    int not null default 15 check (aviso_dias between 0 and 365),
  archivo_path  text,
  notas         text,
  activo        boolean not null default true,   -- false: renovado o archivado
  renovado_por  uuid references public.documentos (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  constraint documentos_titular_ck check ((unidad_id is null) <> (persona_id is null))
);
create index documentos_unidad_ix on public.documentos (unidad_id) where activo;
create index documentos_persona_ix on public.documentos (persona_id) where activo;
create trigger documentos_updated_at before update on public.documentos
  for each row execute function public.tg_updated_at();
create trigger documentos_auditoria after update on public.documentos
  for each row execute function public.tg_auditar();

-- ----- Seguridad --------------------------------------------------------
alter table public.recordatorios_servicio enable row level security;
alter table public.documentos             enable row level security;

-- Supabase da todos los privilegios a anon y authenticated en tablas nuevas
revoke all on public.recordatorios_servicio, public.documentos from anon, authenticated, public;
grant select on public.recordatorios_servicio, public.documentos to authenticated;

create policy recordatorios_select on public.recordatorios_servicio for select to authenticated
  using (public.rol_actual() is not null);
-- La licencia o el certificado de un chofer no los ven los demás choferes
create policy documentos_select on public.documentos for select to authenticated
  using (public.rol_actual() is not null
         and (persona_id is null or persona_id = auth.uid() or public.rol_actual() <> 'chofer'));

-- ----- Vistas ------------------------------------------------------------
-- situacion: al_dia, pronto (dentro del aviso), vencido (ya toca) o archivado
create view public.v_recordatorios with (security_invoker = true) as
select
  x.*,
  case
    when not x.activo then 'archivado'
    when x.km_restantes <= 0 or x.dias_restantes <= 0 then 'vencido'
    when x.km_restantes <= x.aviso_km or x.dias_restantes <= x.aviso_dias then 'pronto'
    else 'al_dia'
  end as situacion
from (
  select
    r.*,
    public.nombre_unidad(r.unidad_id)                                    as unidad_nombre,
    u.tipo                                                               as unidad_tipo,
    u.placa,
    u.medidor,
    c.nombre                                                             as categoria_nombre,
    l.lectura                                                            as lectura_actual,
    r.ultimo_km + r.cada_km                                              as proximo_km,
    r.ultimo_km + r.cada_km - l.lectura                                  as km_restantes,
    r.ultima_fecha + r.cada_dias                                         as proxima_fecha,
    (r.ultima_fecha + r.cada_dias) - public.hoy_caracas()                as dias_restantes
  from public.recordatorios_servicio r
  join public.unidades u on u.id = r.unidad_id
  left join public.categorias_mantenimiento c on c.id = r.categoria_id
  cross join lateral (select public.lectura_actual(r.unidad_id) as lectura) l
) x;

create view public.v_documentos with (security_invoker = true) as
select
  d.*,
  public.nombre_unidad(d.unidad_id)                       as unidad_nombre,
  u.placa,
  p.nombre                                                as persona_nombre,
  coalesce(public.nombre_unidad(d.unidad_id), p.nombre)   as titular,
  d.vence - public.hoy_caracas()                          as dias_restantes,
  case
    when not d.activo then 'archivado'
    when d.vence < public.hoy_caracas() then 'vencido'
    when d.vence - public.hoy_caracas() <= d.aviso_dias then 'pronto'
    else 'al_dia'
  end                                                     as situacion
from public.documentos d
left join public.unidades u on u.id = d.unidad_id
left join public.perfiles p on p.id = d.persona_id;

revoke all on public.v_recordatorios, public.v_documentos from anon, public;
grant select on public.v_recordatorios, public.v_documentos to authenticated;

-- ----- Recordatorios: guardar y marcar hecho -----------------------------
create function public.guardar_recordatorio(
  p_id            uuid,
  p_unidad_id     uuid,
  p_nombre        text,
  p_categoria_id  uuid default null,
  p_cada_km       numeric default null,
  p_cada_dias     int default null,
  p_aviso_km      numeric default 500,
  p_aviso_dias    int default 15,
  p_ultimo_km     numeric default null,
  p_ultima_fecha  date default null,
  p_notas         text default null,
  p_activo        boolean default true
) returns public.recordatorios_servicio
language plpgsql security definer set search_path = '' as $$
declare
  u        public.unidades;
  r        public.recordatorios_servicio;
  v_actual numeric;
  v_km     numeric;
  v_fecha  date := coalesce(p_ultima_fecha, public.hoy_caracas());
begin
  perform public.exigir_rol(array['superusuario', 'flota']::public.rol_usuario[],
                            'Solo flota puede programar servicios.');
  select * into u from public.unidades where id = p_unidad_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'La unidad no existe.';
  end if;
  if nullif(trim(p_nombre), '') is null then
    raise exception using errcode = 'P0001', message = 'Escribe qué servicio es (por ejemplo, "Cambio de aceite").';
  end if;
  if p_cada_km is null and p_cada_dias is null then
    raise exception using errcode = 'P0001', message = 'Indica cada cuántos km o cada cuántos días toca el servicio.';
  end if;
  if p_cada_km is not null and u.medidor = 'ninguno' then
    raise exception using errcode = 'P0001',
      message = format('%s no tiene medidor: programa el servicio por días.', public.nombre_unidad(u.id));
  end if;
  if p_cada_km is not null and p_cada_km <= 0 or p_cada_dias is not null and p_cada_dias <= 0 then
    raise exception using errcode = 'P0001', message = 'La frecuencia debe ser mayor que cero.';
  end if;
  if p_cada_km is not null and coalesce(p_aviso_km, 0) >= p_cada_km then
    raise exception using errcode = 'P0001',
      message = format('El aviso (%s km antes) debe ser menor que la frecuencia (cada %s km).',
                       public.fmt_num(p_aviso_km), public.fmt_num(p_cada_km));
  end if;
  if p_cada_dias is not null and coalesce(p_aviso_dias, 0) >= p_cada_dias then
    raise exception using errcode = 'P0001',
      message = format('El aviso (%s días antes) debe ser menor que la frecuencia (cada %s días).',
                       p_aviso_dias, p_cada_dias);
  end if;
  if v_fecha > public.hoy_caracas() then
    raise exception using errcode = 'P0001', message = 'La fecha del último servicio no puede estar en el futuro.';
  end if;
  if p_categoria_id is not null
     and not exists (select 1 from public.categorias_mantenimiento c where c.id = p_categoria_id) then
    raise exception using errcode = 'P0001', message = 'Elige una categoría de la lista.';
  end if;

  v_actual := public.lectura_actual(u.id);
  if p_cada_km is not null then
    v_km := coalesce(p_ultimo_km, v_actual);
    if v_km > v_actual then
      raise exception using errcode = 'P0001',
        message = format('El km del último servicio (%s) es mayor que el último km conocido de %s (%s).',
                         public.fmt_num(v_km), public.nombre_unidad(u.id), public.fmt_num(v_actual));
    end if;
  end if;

  select * into r from public.recordatorios_servicio where id = p_id for update;
  if found then
    update public.recordatorios_servicio set
      unidad_id = u.id, nombre = trim(p_nombre), categoria_id = p_categoria_id,
      cada_km = p_cada_km, cada_dias = p_cada_dias,
      aviso_km = coalesce(p_aviso_km, 0), aviso_dias = coalesce(p_aviso_dias, 0),
      ultimo_km = v_km, ultima_fecha = v_fecha, notas = nullif(trim(p_notas), ''), activo = coalesce(p_activo, true)
    where id = p_id
    returning * into r;
  else
    insert into public.recordatorios_servicio (id, unidad_id, nombre, categoria_id, cada_km, cada_dias, aviso_km,
                                               aviso_dias, ultimo_km, ultima_fecha, notas, activo)
    values (coalesce(p_id, gen_random_uuid()), u.id, trim(p_nombre), p_categoria_id, p_cada_km, p_cada_dias,
            coalesce(p_aviso_km, 0), coalesce(p_aviso_dias, 0), v_km, v_fecha, nullif(trim(p_notas), ''),
            coalesce(p_activo, true))
    returning * into r;
  end if;
  return r;
end $$;

create function public.marcar_servicio_hecho(
  p_id     uuid,
  p_km     numeric default null,
  p_fecha  date default null,
  p_nota   text default null
) returns public.recordatorios_servicio
language plpgsql security definer set search_path = '' as $$
declare
  r       public.recordatorios_servicio;
  v_fecha date := coalesce(p_fecha, public.hoy_caracas());
  v_km    numeric;
begin
  perform public.exigir_rol(array['superusuario', 'flota']::public.rol_usuario[],
                            'Solo flota puede marcar servicios como hechos.');
  select * into r from public.recordatorios_servicio where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'El recordatorio no existe.';
  end if;
  if v_fecha > public.hoy_caracas() then
    raise exception using errcode = 'P0001', message = 'La fecha del servicio no puede estar en el futuro.';
  end if;
  if v_fecha < r.ultima_fecha then
    raise exception using errcode = 'P0001',
      message = format('Este servicio ya se registró el %s, después de la fecha que indicas (%s).',
                       to_char(r.ultima_fecha, 'DD/MM/YYYY'), to_char(v_fecha, 'DD/MM/YYYY'));
  end if;
  if r.cada_km is not null then
    v_km := coalesce(p_km, public.lectura_actual(r.unidad_id));
    if v_km < r.ultimo_km then
      raise exception using errcode = 'P0001',
        message = format('El km del servicio (%s) es menor que el del servicio anterior (%s).',
                         public.fmt_num(v_km), public.fmt_num(r.ultimo_km));
    end if;
  end if;
  perform public.preparar_auditoria('servicio_hecho', coalesce(nullif(trim(p_nota), ''), 'Servicio hecho'));
  update public.recordatorios_servicio set ultima_fecha = v_fecha, ultimo_km = coalesce(v_km, ultimo_km)
   where id = p_id
  returning * into r;
  perform public.preparar_auditoria(null, null);
  return r;
end $$;

-- Un gasto aprobado de la misma categoría y unidad cuenta como el
-- servicio hecho. Si el gasto no trae km y es de esta semana, se usa el
-- último km conocido; si es más viejo, solo se mueve la fecha.
create function public.tg_mantenimiento_cumple_servicio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_accion text := current_setting('flota.accion', true);
  v_motivo text := current_setting('flota.motivo', true);
  v_km     numeric;
begin
  if new.estado_aprobacion <> 'aprobado' or new.anulado then return new; end if;
  if tg_op = 'UPDATE' and old.estado_aprobacion = 'aprobado' and not old.anulado then return new; end if;
  if not exists (select 1 from public.recordatorios_servicio r
                  where r.unidad_id = new.unidad_id and r.categoria_id = new.categoria_id
                    and r.activo and r.ultima_fecha <= new.fecha) then
    return new;
  end if;

  v_km := coalesce(new.lectura_medidor,
                   case when new.fecha >= public.hoy_caracas() - 7 then public.lectura_actual(new.unidad_id) end);
  perform public.preparar_auditoria('servicio_hecho', format('Gasto %s aprobado', public.folio_txt('M', new.folio)));
  update public.recordatorios_servicio r set
    ultima_fecha = new.fecha,
    ultimo_km = case when r.cada_km is null or v_km is null or v_km < r.ultimo_km then r.ultimo_km else v_km end
  where r.unidad_id = new.unidad_id and r.categoria_id = new.categoria_id
    and r.activo and r.ultima_fecha <= new.fecha;
  perform set_config('flota.accion', coalesce(v_accion, ''), true),
          set_config('flota.motivo', coalesce(v_motivo, ''), true);
  return new;
end $$;

create trigger mantenimientos_cumple_servicio
  after insert or update of estado_aprobacion, anulado on public.mantenimientos
  for each row execute function public.tg_mantenimiento_cumple_servicio();

-- ----- Documentos: guardar y renovar ---------------------------------------
create function public.guardar_documento(
  p_id          uuid,
  p_unidad_id   uuid,
  p_persona_id  uuid,
  p_tipo        text,
  p_vence       date,
  p_numero      text default null,
  p_emisor      text default null,
  p_aviso_dias  int default 15,
  p_archivo     text default null,
  p_notas       text default null,
  p_activo      boolean default true
) returns public.documentos
language plpgsql security definer set search_path = '' as $$
declare
  d public.documentos;
begin
  perform public.exigir_rol(array['superusuario', 'flota']::public.rol_usuario[],
                            'Solo flota puede registrar documentos.');
  if (p_unidad_id is null) = (p_persona_id is null) then
    raise exception using errcode = 'P0001', message = 'Indica si el documento es de una unidad o de una persona.';
  end if;
  if p_unidad_id is not null and not exists (select 1 from public.unidades u where u.id = p_unidad_id) then
    raise exception using errcode = 'P0001', message = 'La unidad no existe.';
  end if;
  if p_persona_id is not null and not exists (select 1 from public.perfiles p where p.id = p_persona_id) then
    raise exception using errcode = 'P0001', message = 'La persona no existe.';
  end if;
  if nullif(trim(p_tipo), '') is null then
    raise exception using errcode = 'P0001', message = 'Escribe qué documento es (por ejemplo, "Póliza RCV").';
  end if;
  if p_vence is null then
    raise exception using errcode = 'P0001', message = 'Indica la fecha de vencimiento.';
  end if;
  if p_aviso_dias is null or p_aviso_dias < 0 or p_aviso_dias > 365 then
    raise exception using errcode = 'P0001', message = 'El aviso debe estar entre 0 y 365 días antes.';
  end if;

  select * into d from public.documentos where id = p_id for update;
  if found then
    update public.documentos set
      unidad_id = p_unidad_id, persona_id = p_persona_id, tipo = trim(p_tipo), vence = p_vence,
      numero = nullif(trim(p_numero), ''), emisor = nullif(trim(p_emisor), ''), aviso_dias = p_aviso_dias,
      archivo_path = coalesce(p_archivo, archivo_path), notas = nullif(trim(p_notas), ''),
      activo = coalesce(p_activo, true)
    where id = p_id
    returning * into d;
  else
    insert into public.documentos (id, unidad_id, persona_id, tipo, numero, emisor, vence, aviso_dias,
                                   archivo_path, notas, activo)
    values (coalesce(p_id, gen_random_uuid()), p_unidad_id, p_persona_id, trim(p_tipo), nullif(trim(p_numero), ''),
            nullif(trim(p_emisor), ''), p_vence, p_aviso_dias, p_archivo, nullif(trim(p_notas), ''),
            coalesce(p_activo, true))
    returning * into d;
  end if;
  return d;
end $$;

create function public.renovar_documento(
  p_id        uuid,
  p_nuevo_id  uuid,
  p_vence     date,
  p_numero    text default null,
  p_emisor    text default null,
  p_archivo   text default null
) returns public.documentos
language plpgsql security definer set search_path = '' as $$
declare
  d       public.documentos;
  nuevo   public.documentos;
begin
  perform public.exigir_rol(array['superusuario', 'flota']::public.rol_usuario[],
                            'Solo flota puede renovar documentos.');
  select * into nuevo from public.documentos where id = p_nuevo_id;
  if found then return nuevo; end if;   -- reintento: ya se renovó
  select * into d from public.documentos where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'El documento no existe.';
  end if;
  if not d.activo then
    raise exception using errcode = 'P0001', message = 'Este documento ya fue renovado o archivado.';
  end if;
  if p_vence is null or p_vence <= d.vence then
    raise exception using errcode = 'P0001',
      message = format('La nueva fecha de vencimiento debe ser posterior a la actual (%s).', to_char(d.vence, 'DD/MM/YYYY'));
  end if;

  insert into public.documentos (id, unidad_id, persona_id, tipo, numero, emisor, vence, aviso_dias, archivo_path, notas)
  values (coalesce(p_nuevo_id, gen_random_uuid()), d.unidad_id, d.persona_id, d.tipo,
          coalesce(nullif(trim(p_numero), ''), d.numero), coalesce(nullif(trim(p_emisor), ''), d.emisor),
          p_vence, d.aviso_dias, p_archivo, d.notas)
  returning * into nuevo;

  perform public.preparar_auditoria('renovar', format('Renovado hasta el %s', to_char(p_vence, 'DD/MM/YYYY')));
  update public.documentos set activo = false, renovado_por = nuevo.id where id = d.id;
  perform public.preparar_auditoria(null, null);
  return nuevo;
end $$;

-- ----- Alertas: se agregan servicios y documentos ---------------------------
-- También se muestra la novedad que escribió el chofer, para no tener que
-- abrir la ruta para leerla.
create or replace view public.v_alertas with (security_invoker = true) as
with cfg as (
  select * from public.configuracion where id
),
cerrados as (
  select v.* from public.viajes v where v.estado = 'cerrado'
),
anomalo as (
  select 'consumo_anomalo'::text as tipo, 'alta'::text as severidad, v.unidad_id, v.id as viaje_id,
         v.id as registro_id, v.llegada_at as fecha,
         format('%s rindió %s km/L en la ruta %s: %s %% menos que su promedio de 90 días (%s km/L).',
                public.nombre_unidad(v.unidad_id), public.fmt_num(v.rendimiento_kml, 2),
                public.folio_txt('V', v.folio), public.fmt_num((1 - v.rendimiento_kml / h.prom) * 100, 0),
                public.fmt_num(h.prom, 2)) as mensaje
  from cerrados v
  cross join cfg
  cross join lateral (
    select sum(x.km_recorridos) / nullif(sum(x.litros_consumidos), 0) as prom, count(*) as n
    from public.viajes x
    where x.unidad_id = v.unidad_id and x.estado = 'cerrado' and x.calidad in ('exacto', 'estimado')
      and x.id <> v.id and x.llegada_at < v.llegada_at and x.llegada_at >= v.llegada_at - interval '90 days'
  ) h
  where v.calidad in ('exacto', 'estimado') and v.llegada_at > now() - interval '30 days'
    and h.n >= cfg.min_viajes_promedio and h.prom > 0
    and v.rendimiento_kml <= h.prom * (1 - cfg.umbral_consumo_anomalo_pct / 100)
),
abiertas as (
  select 'ruta_abierta'::text, 'alta'::text, v.unidad_id, v.id, v.id, v.salida_at,
         format('La ruta %s de %s, con %s, lleva %s h abierta.', public.folio_txt('V', v.folio),
                public.nombre_unidad(v.unidad_id), p.nombre,
                public.fmt_num(extract(epoch from now() - v.salida_at)::numeric / 3600, 0))
  from public.viajes v
  cross join cfg
  join public.perfiles p on p.id = v.chofer_id
  where v.estado = 'en_curso' and v.salida_at < now() - make_interval(hours => cfg.umbral_ruta_abierta_h)
),
saltos as (
  select 'km_sin_ruta'::text, 'media'::text, s.unidad_id, s.id, s.id, s.salida_at,
         format('%s: %s km sin ruta registrada entre la llegada de %s (km %s) y la salida de %s (km %s).',
                public.nombre_unidad(s.unidad_id), public.fmt_num(s.km_salida - s.km_prev),
                public.folio_txt('V', s.folio_prev), public.fmt_num(s.km_prev),
                public.folio_txt('V', s.folio), public.fmt_num(s.km_salida))
  from (
    select v.*, lag(v.km_llegada) over w as km_prev, lag(v.folio) over w as folio_prev
    from public.viajes v where v.estado <> 'anulado'
    window w as (partition by v.unidad_id order by v.salida_at)
  ) s
  cross join cfg
  where s.km_prev is not null and s.km_salida - s.km_prev > cfg.umbral_km_sin_ruta
    and s.salida_at > now() - interval '60 days'
),
incompletos as (
  select 'viaje_incompleto'::text, 'media'::text, v.unidad_id, v.id, v.id, v.llegada_at,
         format('La ruta %s de %s no tiene datos de combustible suficientes para calcular su consumo.',
                public.folio_txt('V', v.folio), public.nombre_unidad(v.unidad_id))
  from cerrados v
  where v.calidad = 'incompleto' and v.llegada_at > now() - interval '60 days'
),
divergencia as (
  select 'divergencia'::text, 'media'::text, a.unidad_id, null::uuid, null::uuid,
         (a.mes + interval '1 month' - interval '1 second')::timestamptz,
         format('%s en %s: los viajes dan %s km/L y los ciclos lleno a lleno %s km/L (%s %% de diferencia).',
                public.nombre_unidad(a.unidad_id), to_char(a.mes, 'MM/YYYY'), public.fmt_num(a.rv, 2),
                public.fmt_num(a.rc, 2), public.fmt_num(abs(a.rv - a.rc) / a.rc * 100, 0))
  from (
    select k.unidad_id, k.mes, k.rendimiento as rv,
           (select sum(c.distancia) / nullif(sum(c.litros), 0) from public.v_ciclos_combustible c
             where c.unidad_id = k.unidad_id and c.mes = k.mes and not c.invalido) as rc
    from public.v_kpi_unidad_mes k
    where k.tipo = 'camion' and k.rendimiento is not null and k.mes >= date_trunc('month', now() - interval '3 months')
  ) a
  cross join cfg
  where a.rc > 0 and abs(a.rv - a.rc) / a.rc * 100 > cfg.umbral_divergencia_pct
),
revisar as (
  select 'revisar'::text, 'media'::text, v.unidad_id, v.id, v.id, coalesce(v.llegada_at, v.salida_at),
         format('La ruta %s de %s necesita revisión: %s.', public.folio_txt('V', v.folio),
                public.nombre_unidad(v.unidad_id),
                (select string_agg(case m
                          when 'rendimiento_fuera_rango' then 'rendimiento fuera del rango del camión'
                          when 'consumo_no_positivo' then 'el consumo calculado no es positivo'
                          when 'nivel_imposible' then 'nivel de combustible imposible'
                          when 'destino_otro' then 'destino marcado como "Otro"'
                          when 'novedad_chofer' then
                            case when nullif(trim(v.notas), '') is null then 'el chofer dejó una novedad'
                                 else format('el chofer escribió "%s"',
                                             case when length(trim(v.notas)) > 160
                                                  then left(trim(v.notas), 157) || '…' else trim(v.notas) end)
                            end
                          else m end, '; ' order by m)
                   from unnest(v.revisar_motivos) m))
  from public.viajes v
  where v.revisar and v.estado <> 'anulado' and coalesce(v.llegada_at, v.salida_at) > now() - interval '60 days'
),
pendientes as (
  select 'gasto_pendiente'::text, 'media'::text, m.unidad_id, null::uuid, m.id, m.created_at,
         format('Gasto %s de %s por %s (%s) espera aprobación.', public.folio_txt('M', m.folio),
                public.nombre_unidad(m.unidad_id),
                case when m.moneda = 'USD' then '$ ' || public.fmt_num(m.monto, 2)
                     else 'Bs ' || public.fmt_num(m.monto, 2) end,
                c.nombre)
  from public.mantenimientos m
  join public.categorias_mantenimiento c on c.id = m.categoria_id
  where m.estado_aprobacion = 'pendiente' and not m.anulado
),
servicios as (
  select 'servicio'::text, case when r.situacion = 'vencido' then 'alta' else 'media' end, r.unidad_id, null::uuid, r.id,
         (coalesce(r.proxima_fecha, public.hoy_caracas()) + time '00:00') at time zone 'America/Caracas',
         format('%s de %s: %s.', r.nombre, r.unidad_nombre,
                concat_ws(' y ',
                  case when r.km_restantes < 0 then format('se pasó por %s km (tocaba en el km %s)',
                                                           public.fmt_num(-r.km_restantes), public.fmt_num(r.proximo_km))
                       when r.km_restantes is not null and r.km_restantes <= r.aviso_km
                         then format('faltan %s km (toca en el km %s)', public.fmt_num(r.km_restantes), public.fmt_num(r.proximo_km))
                  end,
                  case when r.dias_restantes < 0 then format('venció hace %s días (%s)', -r.dias_restantes,
                                                             to_char(r.proxima_fecha, 'DD/MM/YYYY'))
                       when r.dias_restantes = 0 then 'toca hoy'
                       when r.dias_restantes is not null and r.dias_restantes <= r.aviso_dias
                         then format('toca en %s días (%s)', r.dias_restantes, to_char(r.proxima_fecha, 'DD/MM/YYYY'))
                  end))
  from public.v_recordatorios r
  where r.situacion in ('pronto', 'vencido')
),
docs as (
  select 'documento'::text, case when d.situacion = 'vencido' then 'alta' else 'media' end, d.unidad_id, null::uuid, d.id,
         (d.vence + time '00:00') at time zone 'America/Caracas',
         case when d.dias_restantes < 0 then format('%s de %s venció el %s (hace %s días).', d.tipo, d.titular,
                                                     to_char(d.vence, 'DD/MM/YYYY'), -d.dias_restantes)
              when d.dias_restantes = 0 then format('%s de %s vence hoy.', d.tipo, d.titular)
              else format('%s de %s vence el %s (en %s días).', d.tipo, d.titular, to_char(d.vence, 'DD/MM/YYYY'),
                          d.dias_restantes) end
  from public.v_documentos d
  where d.situacion in ('pronto', 'vencido')
)
select md5(t.tipo || coalesce(t.registro_id::text, '') || coalesce(t.unidad_id::text, '') || t.fecha::text) as id, t.*
from (
  select * from anomalo
  union all select * from abiertas
  union all select * from saltos
  union all select * from incompletos
  union all select * from divergencia
  union all select * from revisar
  union all select * from pendientes
  union all select * from servicios
  union all select * from docs
) t (tipo, severidad, unidad_id, viaje_id, registro_id, fecha, mensaje);

-- ----- Permisos de ejecución (lista blanca, ver migración 07) -----------------
revoke all on function public.guardar_recordatorio(uuid, uuid, text, uuid, numeric, int, numeric, int, numeric, date, text, boolean),
                       public.marcar_servicio_hecho(uuid, numeric, date, text),
                       public.guardar_documento(uuid, uuid, uuid, text, date, text, text, int, text, text, boolean),
                       public.renovar_documento(uuid, uuid, date, text, text, text),
                       public.tg_mantenimiento_cumple_servicio()
  from public, anon, authenticated;
grant execute on function public.guardar_recordatorio(uuid, uuid, text, uuid, numeric, int, numeric, int, numeric, date, text, boolean),
                          public.marcar_servicio_hecho(uuid, numeric, date, text),
                          public.guardar_documento(uuid, uuid, uuid, text, date, text, text, int, text, text, boolean),
                          public.renovar_documento(uuid, uuid, date, text, text, text)
  to authenticated;
grant execute on function public.guardar_recordatorio(uuid, uuid, text, uuid, numeric, int, numeric, int, numeric, date, text, boolean),
                          public.marcar_servicio_hecho(uuid, numeric, date, text),
                          public.guardar_documento(uuid, uuid, uuid, text, date, text, text, int, text, text, boolean),
                          public.renovar_documento(uuid, uuid, date, text, text, text),
                          public.tg_mantenimiento_cumple_servicio()
  to service_role;
