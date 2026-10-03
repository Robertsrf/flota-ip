-- =====================================================================
-- Flota IP · Motor de cálculo y funciones de escritura (RPC)
-- Toda escritura de viajes, repostajes y gastos pasa por aquí, en una
-- sola transacción. Errores de negocio: errcode P0001 con mensaje listo
-- para mostrar; permisos: errcode 42501.
-- =====================================================================

-- ----- Identidad y permisos ------------------------------------------
create function public.rol_actual() returns public.rol_usuario
language sql stable security definer set search_path = '' as $$
  select p.rol from public.perfiles p where p.id = auth.uid() and p.activo
$$;

create function public.es_oficina() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.rol_actual() in ('superusuario', 'flota'), false)
$$;

create function public.es_superusuario() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.rol_actual() = 'superusuario', false)
$$;

create function public.exigir_rol(p_roles public.rol_usuario[], p_mensaje text) returns public.rol_usuario
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rol public.rol_usuario := public.rol_actual();
begin
  if v_rol is null or not (v_rol = any (p_roles)) then
    raise exception using errcode = '42501', message = p_mensaje;
  end if;
  return v_rol;
end $$;

-- ----- Formatos para mensajes ----------------------------------------
create function public.folio_txt(p_prefijo text, p_folio int) returns text
language sql immutable as $$
  select p_prefijo || '-' || lpad(p_folio::text, 4, '0')
$$;

create function public.nombre_unidad(p_unidad uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
           when u.placa is not null and nullif(trim(u.alias), '') is not null then trim(u.alias) || ' (' || u.placa || ')'
           else coalesce(u.placa, trim(u.alias))
         end
  from public.unidades u where u.id = p_unidad
$$;

create function public.fecha_txt(p_ts timestamptz) returns text
language sql immutable as $$
  select to_char(p_ts at time zone 'America/Caracas', 'DD/MM/YYYY HH24:MI')
$$;

-- ----- Lecturas y nivel de combustible -------------------------------
-- Último km (u horas) conocido: máximo entre el alta, viajes, cargas y
-- gastos no anulados.
create function public.lectura_actual(p_unidad uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select greatest(
    (select u.lectura_inicial from public.unidades u where u.id = p_unidad),
    (select max(greatest(v.km_salida, coalesce(v.km_llegada, v.km_salida)))
       from public.viajes v where v.unidad_id = p_unidad and v.estado <> 'anulado'),
    (select max(r.lectura_medidor) from public.repostajes r where r.unidad_id = p_unidad and not r.anulado),
    (select max(m.lectura_medidor) from public.mantenimientos m
      where m.unidad_id = p_unidad and not m.anulado and m.estado_aprobacion <> 'rechazado')
  )
$$;

-- Eventos que fijan el nivel del tanque, del más reciente al más viejo.
create function public.eventos_nivel(p_unidad uuid)
returns table (lectura numeric, ts timestamptz, prioridad int, nivel numeric, lleno boolean, origen text, folio int)
language sql stable security definer set search_path = '' as $$
  with u as (select * from public.unidades where id = p_unidad),
  cierre as (
    select r.viaje_id, bool_or(r.tanque_lleno) as lleno
    from public.repostajes r
    where r.unidad_id = p_unidad and r.es_cierre_viaje and not r.anulado
    group by r.viaje_id
  )
  select * from (
    select u.lectura_inicial, u.fecha_alta::timestamptz, 3, u.combustible_inicial_l,
           u.combustible_inicial_l = u.capacidad_tanque_l, 'alta', null::int
      from u
    union all
    select r.lectura_medidor, r.fecha, 2,
           case when r.tanque_lleno then u.capacidad_tanque_l end, r.tanque_lleno, 'repostaje', r.folio
      from public.repostajes r, u
     where r.unidad_id = u.id and not r.anulado
    union all
    select v.km_salida, v.salida_at, 1, v.litros_salida, v.litros_salida = u.capacidad_tanque_l, 'salida', v.folio
      from public.viajes v, u
     where v.unidad_id = u.id and v.estado = 'en_curso'
    union all
    select v.km_llegada, v.llegada_at, 0,
           case when coalesce(c.lleno, false) then u.capacidad_tanque_l else v.litros_llegada_aguja end,
           coalesce(c.lleno, false), 'viaje', v.folio
      from public.viajes v
      cross join u
      left join cierre c on c.viaje_id = v.id
     where v.unidad_id = u.id and v.estado = 'cerrado'
  ) e (lectura, ts, prioridad, nivel, lleno, origen, folio)
  order by e.lectura desc nulls last, e.ts desc, e.prioridad asc
$$;

-- Propuesta de nivel al iniciar una ruta (sección 8.4: nivel heredado)
create function public.sugerir_nivel_salida(p_unidad uuid, p_km numeric)
returns table (fuente text, litros numeric, lectura numeric, descripcion text)
language plpgsql stable security definer set search_path = '' as $$
declare
  u     public.unidades;
  e     record;
  v_tol numeric := coalesce((select c.tolerancia_heredado_km from public.configuracion c where c.id), 5);
begin
  select * into u from public.unidades where id = p_unidad;
  if not found or u.medidor = 'ninguno' then return; end if;
  select * into e from public.eventos_nivel(p_unidad) ev where ev.origen <> 'salida' limit 1;
  if not found or e.nivel is null or e.lectura is null or abs(p_km - e.lectura) > v_tol then return; end if;

  if e.lleno then
    return query select 'heredado'::text, u.capacidad_tanque_l, e.lectura,
      case e.origen
        when 'alta' then 'Tanque lleno (alta del camión)'
        when 'repostaje' then 'Tanque lleno (último repostaje)'
        else 'Tanque lleno (cierre de la ruta ' || public.folio_txt('V', e.folio) || ')'
      end;
  elsif e.origen = 'alta' then
    return query select 'litros'::text, e.nivel, e.lectura,
      'Nivel del alta: ' || public.fmt_num(e.nivel, 0) || ' L';
  elsif e.origen = 'viaje' then
    return query select 'aguja'::text, e.nivel, e.lectura,
      'Nivel al cerrar la ruta ' || public.folio_txt('V', e.folio) || ': ' || public.fmt_num(e.nivel, 0) || ' L';
  end if;
end $$;

-- Nivel estimado actual (ficha del camión): último nivel conocido menos
-- los km recorridos desde entonces por su consumo promedio.
create function public.nivel_estimado(p_unidad uuid)
returns table (litros numeric, fuente text, base_litros numeric, base_lectura numeric, base_fecha timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  u      public.unidades;
  e      record;
  v_lect numeric;
  v_lkm  numeric;
begin
  select * into u from public.unidades where id = p_unidad;
  if not found then return; end if;
  select * into e from public.eventos_nivel(p_unidad) ev where ev.nivel is not null limit 1;
  if not found then return; end if;

  if u.medidor = 'ninguno' or e.lectura is null then
    return query select e.nivel, 'estimado'::text, e.nivel, e.lectura, e.ts;
    return;
  end if;

  v_lect := coalesce(public.lectura_actual(p_unidad), e.lectura);
  if v_lect <= e.lectura then
    return query select e.nivel, case when e.lleno then 'exacto' else 'estimado' end, e.nivel, e.lectura, e.ts;
    return;
  end if;

  select sum(v.litros_consumidos) / nullif(sum(v.km_recorridos), 0) into v_lkm
    from public.viajes v
   where v.unidad_id = p_unidad and v.estado = 'cerrado' and v.calidad in ('exacto', 'estimado')
     and v.llegada_at > now() - interval '90 days';
  if v_lkm is null then
    select sum(v.litros_consumidos) / nullif(sum(v.km_recorridos), 0) into v_lkm
      from public.viajes v
     where v.unidad_id = p_unidad and v.estado = 'cerrado' and v.calidad in ('exacto', 'estimado');
  end if;
  if v_lkm is null then
    return query select null::numeric, 'estimado'::text, e.nivel, e.lectura, e.ts;
    return;
  end if;
  return query select round(greatest(0, least(u.capacidad_tanque_l, e.nivel - (v_lect - e.lectura) * v_lkm)), 0),
                      'estimado'::text, e.nivel, e.lectura, e.ts;
end $$;

-- Camión que un chofer puede usar para cargas y gastos: el de su ruta en
-- curso; sin ruta abierta, el último que manejó o su camión habitual.
create function public.unidad_permitida_chofer(p_unidad uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.viajes v
                  where v.chofer_id = auth.uid() and v.estado = 'en_curso' and v.unidad_id = p_unidad)
      or (not exists (select 1 from public.viajes v where v.chofer_id = auth.uid() and v.estado = 'en_curso')
          and (p_unidad = (select v.unidad_id from public.viajes v
                            where v.chofer_id = auth.uid() and v.estado <> 'anulado'
                            order by v.salida_at desc limit 1)
               or exists (select 1 from public.unidades u where u.id = p_unidad and u.chofer_habitual_id = auth.uid())))
$$;

-- Tasa BCV vigente para una fecha (la de ese día o la última anterior)
create function public.tasa_para_fecha(p_fecha date)
returns table (fecha date, bs_por_usd numeric, manual boolean, fuente text)
language sql stable security definer set search_path = '' as $$
  select t.fecha, t.bs_por_usd, t.manual, t.fuente
  from public.tasas_bcv t where t.fecha <= p_fecha
  order by t.fecha desc limit 1
$$;

-- ----- Motor de cálculo por viaje (sección 8) -------------------------
--   litros_consumidos = L_salida + ΣL_viaje − L_final
--   costo = litros_consumidos × precio ponderado de las cargas del viaje
-- p_estricto = true al finalizar: los datos imposibles se rechazan.
-- p_estricto = false en correcciones: se marca incompleto y "revisar".
create function public.recalcular_viaje(p_viaje_id uuid, p_estricto boolean default false)
returns public.viajes
language plpgsql security definer set search_path = '' as $$
declare
  v          public.viajes;
  u          public.unidades;
  v_cap      numeric;
  v_litros   numeric := 0;
  v_monto    numeric := 0;
  v_cierre   public.repostajes;
  v_final    numeric;
  v_consumo  numeric;
  v_km       numeric;
  v_precio   numeric;
  v_costo    numeric;
  v_rend     numeric;
  v_calidad  public.calidad_calculo;
  v_motivos  text[];
begin
  select * into v from public.viajes where id = p_viaje_id;
  if not found then return null; end if;

  -- Los motivos que no salen del cálculo se conservan
  v_motivos := array(select m from unnest(v.revisar_motivos) m
                      where m not in ('rendimiento_fuera_rango', 'consumo_no_positivo', 'nivel_imposible'));

  if v.estado <> 'cerrado' then
    update public.viajes set
      km_recorridos = null, litros_consumidos = null, rendimiento_kml = null, litros_100km = null,
      precio_promedio_usd = null, costo_combustible_usd = null, costo_km_usd = null, calidad = null,
      revisar_motivos = v_motivos, revisar = cardinality(v_motivos) > 0
    where id = v.id
    returning * into v;
    return v;
  end if;

  select * into u from public.unidades where id = v.unidad_id;
  v_cap := u.capacidad_tanque_l;
  v_km := v.km_llegada - v.km_salida;

  select coalesce(sum(r.litros), 0), coalesce(sum(r.monto_usd), 0)
    into v_litros, v_monto
    from public.repostajes r where r.viaje_id = v.id and not r.anulado;

  select * into v_cierre from public.repostajes r
   where r.viaje_id = v.id and r.es_cierre_viaje and not r.anulado
   order by r.fecha desc, r.created_at desc limit 1;

  v_calidad := case when v.fuente_nivel_salida in ('lleno', 'heredado') then 'exacto' else 'estimado' end;

  if v_cierre.id is not null and v_cierre.tanque_lleno then
    v_final := v_cap;
  elsif v.litros_llegada_aguja is not null then
    v_final := v.litros_llegada_aguja;
    v_calidad := 'estimado';
  else
    v_final := null;
  end if;

  if v_final is not null and v_final > v_cap then
    if p_estricto then
      raise exception using errcode = 'P0001', detail = 'NIVEL_SUPERA_TANQUE',
        message = format('El nivel al llegar (%s L) supera la capacidad del tanque (%s L). Revisa la aguja.',
                         public.fmt_num(v_final, 0), public.fmt_num(v_cap, 0));
    end if;
    v_final := null;
    v_motivos := v_motivos || 'nivel_imposible'::text;
  end if;

  if v_final is null then
    v_calidad := 'incompleto';
  else
    v_consumo := v.litros_salida + v_litros - v_final;
    if v_consumo <= 0 then
      if p_estricto then
        raise exception using errcode = 'P0001', detail = 'CONSUMO_NO_POSITIVO',
          message = format('Con estos datos el consumo da %s L (salida %s L + cargas %s L − llegada %s L). Revisa el nivel al llegar y los litros cargados.',
                           public.fmt_num(v_consumo, 2), public.fmt_num(v.litros_salida, 2),
                           public.fmt_num(v_litros, 2), public.fmt_num(v_final, 2));
      end if;
      v_consumo := null;
      v_calidad := 'incompleto';
      v_motivos := v_motivos || 'consumo_no_positivo'::text;
    end if;
  end if;

  -- Precio (D5): ponderado de las cargas del viaje; sin cargas, la última
  -- carga de la unidad; sin historial, el precio activo de menor orden.
  if v_litros > 0 then
    v_precio := v_monto / v_litros;
  else
    select r.precio_usd_litro into v_precio from public.repostajes r
     where r.unidad_id = v.unidad_id and not r.anulado and r.fecha <= v.llegada_at
     order by r.fecha desc, r.created_at desc limit 1;
    if v_precio is null then
      select p.precio_usd_litro into v_precio from public.precios_combustible p
       where p.activo order by p.orden, p.precio_usd_litro limit 1;
      if v_calidad = 'exacto' then v_calidad := 'estimado'; end if;
    end if;
  end if;

  if v_consumo is not null then
    v_costo := round(v_consumo * v_precio, 2);
    v_rend := round(v_km / v_consumo, 2);
    if v_rend < u.rendimiento_min or v_rend > u.rendimiento_max then
      v_motivos := v_motivos || 'rendimiento_fuera_rango'::text;
    end if;
  end if;

  v_motivos := array(select distinct m from unnest(v_motivos) m order by m);

  update public.viajes set
    km_recorridos         = v_km,
    litros_consumidos     = round(v_consumo, 2),
    rendimiento_kml       = v_rend,
    litros_100km          = case when v_consumo is not null then round(v_consumo / v_km * 100, 2) end,
    precio_promedio_usd   = round(v_precio, 4),
    costo_combustible_usd = v_costo,
    costo_km_usd          = case when v_costo is not null then round(v_costo / v_km, 4) end,
    calidad               = v_calidad,
    revisar_motivos       = v_motivos,
    revisar               = cardinality(v_motivos) > 0
  where id = v.id
  returning * into v;
  return v;
end $$;

-- Recalcular cuando cambian las cargas o los datos de entrada del viaje
create function public.tg_repostaje_recalcula() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.viaje_id is not null and old.viaje_id is distinct from new.viaje_id then
    perform public.recalcular_viaje(old.viaje_id);
  end if;
  if new.viaje_id is not null then
    perform public.recalcular_viaje(new.viaje_id);
  end if;
  return null;
end $$;

create trigger repostajes_recalcula
  after insert or update on public.repostajes
  for each row execute function public.tg_repostaje_recalcula();

create function public.tg_viaje_recalcula() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_viaje(new.id);
  return null;
end $$;

create trigger viajes_recalcula
  after update of km_salida, km_llegada, litros_salida, litros_llegada_aguja, fuente_nivel_salida,
                  unidad_id, estado, llegada_at
  on public.viajes
  for each row when (pg_trigger_depth() < 2)
  execute function public.tg_viaje_recalcula();

-- Si cambian capacidad o rango de rendimiento, se recalculan sus viajes
create function public.tg_unidad_recalcula() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if new.capacidad_tanque_l is distinct from old.capacidad_tanque_l
     or new.rendimiento_min is distinct from old.rendimiento_min
     or new.rendimiento_max is distinct from old.rendimiento_max then
    for v_id in select id from public.viajes where unidad_id = new.id and estado = 'cerrado' loop
      perform public.recalcular_viaje(v_id);
    end loop;
  end if;
  return null;
end $$;

create trigger unidades_recalcula
  after update on public.unidades
  for each row execute function public.tg_unidad_recalcula();

-- Cambios hechos por el propio sistema (estado de la unidad, cierre
-- normal de la ruta) no se auditan: la auditoría es para correcciones.
create function public.modo_sistema(p_activo boolean) returns void
language sql as $$
  select set_config('flota.sistema', case when p_activo then 'on' else 'off' end, true)
$$;

create or replace function public.tg_auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes   jsonb := '{}';
  v_despues jsonb := '{}';
  v_old     jsonb;
  v_new     jsonb;
  v_key     text;
  v_motivo  text := nullif(current_setting('flota.motivo', true), '');
begin
  if coalesce(current_setting('flota.sistema', true), '') = 'on' then
    return coalesce(new, old);
  end if;

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

  insert into public.auditoria (tabla, registro_id, accion, antes, despues, motivo, usuario_id)
  values (tg_table_name, coalesce(v_new ->> 'id', v_new ->> 'fecha'),
          coalesce(nullif(current_setting('flota.accion', true), ''), 'update'),
          v_antes, v_despues, v_motivo, auth.uid());
  return new;
end $$;

-- Prepara motivo y acción para la auditoría de esta transacción
create function public.preparar_auditoria(p_accion text, p_motivo text) returns void
language sql as $$
  select set_config('flota.accion', coalesce(p_accion, ''), true),
         set_config('flota.motivo', coalesce(p_motivo, ''), true)
$$;

-- ----- iniciar_viaje ---------------------------------------------------
create function public.iniciar_viaje(
  p_id             uuid,
  p_unidad_id      uuid,
  p_paradas        uuid[],
  p_salida_at      timestamptz,
  p_km_salida      numeric,
  p_litros_salida  numeric,
  p_fuente_nivel   text,
  p_origen_id      uuid default null,
  p_foto           text default null,
  p_notas          text default null,
  p_chofer_id      uuid default null,
  p_motivo         text default null
) returns public.viajes
language plpgsql security definer set search_path = '' as $$
declare
  v_rol     public.rol_usuario;
  v_uid     uuid := auth.uid();
  v_oficina boolean;
  v         public.viajes;
  v_abierto public.viajes;
  u         public.unidades;
  v_chofer  uuid;
  v_lect    numeric;
  v_destino uuid;
  v_origen  uuid := p_origen_id;
  v_fuente  text := p_fuente_nivel;
  v_litros  numeric := p_litros_salida;
  v_sug     record;
begin
  v_rol := public.exigir_rol(array['superusuario', 'flota', 'chofer']::public.rol_usuario[],
                             'Tu usuario no puede iniciar rutas.');
  v_oficina := v_rol in ('superusuario', 'flota');

  select * into v from public.viajes where id = p_id;
  if found then return v; end if;  -- reenvío desde la cola offline

  v_chofer := coalesce(p_chofer_id, v_uid);
  if v_chofer <> v_uid and not v_oficina then
    raise exception using errcode = '42501', message = 'Solo flota puede iniciar rutas a nombre de otro chofer.';
  end if;
  if not exists (select 1 from public.perfiles p where p.id = v_chofer and p.activo) then
    raise exception using errcode = 'P0001', message = 'El chofer no existe o está inactivo.';
  end if;

  select * into u from public.unidades where id = p_unidad_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'El camión no existe.';
  end if;
  if u.tipo <> 'camion' then
    raise exception using errcode = 'P0001', message = 'Las rutas solo se registran para camiones.';
  end if;

  select * into v_abierto from public.viajes where chofer_id = v_chofer and estado = 'en_curso';
  if found then
    raise exception using errcode = 'P0001', detail = 'RUTA_ABIERTA_CHOFER',
      message = format('Ya hay una ruta abierta para este chofer (%s a %s, desde el %s). Finalízala antes de iniciar otra.',
                       public.folio_txt('V', v_abierto.folio),
                       (select l.nombre from public.ubicaciones l where l.id = v_abierto.destino_id),
                       public.fecha_txt(v_abierto.salida_at));
  end if;

  if u.estado = 'en_ruta' then
    select * into v_abierto from public.viajes where unidad_id = u.id and estado = 'en_curso';
    raise exception using errcode = 'P0001', detail = 'UNIDAD_EN_RUTA',
      message = format('El camión %s ya está en ruta (%s con %s). Elige otro camión.',
                       public.nombre_unidad(u.id), public.folio_txt('V', v_abierto.folio),
                       (select p.nombre from public.perfiles p where p.id = v_abierto.chofer_id));
  elsif u.estado <> 'disponible' then
    raise exception using errcode = 'P0001', detail = 'UNIDAD_NO_DISPONIBLE',
      message = format('El camión %s está %s. Flota debe marcarlo como disponible.',
                       public.nombre_unidad(u.id), case u.estado when 'taller' then 'en taller' else 'inactivo' end);
  end if;

  if p_paradas is null or cardinality(p_paradas) = 0 then
    raise exception using errcode = 'P0001', message = 'Elige al menos un destino.';
  end if;
  if exists (select 1 from unnest(p_paradas) x (id)
               left join public.ubicaciones l on l.id = x.id
              where l.id is null or not l.activo) then
    raise exception using errcode = 'P0001',
      message = 'Uno de los destinos no existe o fue archivado. Actualiza la lista e intenta de nuevo.';
  end if;
  v_destino := p_paradas[cardinality(p_paradas)];

  if v_origen is null then
    select l.id into v_origen from public.ubicaciones l
     where l.tipo = 'sede' and l.activo order by l.created_at limit 1;
  end if;

  if p_salida_at is null or p_salida_at > now() + interval '10 minutes' then
    raise exception using errcode = 'P0001', message = 'La hora de salida no puede estar en el futuro.';
  end if;

  v_lect := public.lectura_actual(u.id);
  if p_km_salida is null then
    raise exception using errcode = 'P0001', message = 'Indica el km de salida.';
  end if;
  if p_km_salida < v_lect then
    if v_oficina and nullif(trim(p_motivo), '') is not null then
      perform public.preparar_auditoria('update', p_motivo);
    else
      raise exception using errcode = 'P0001', detail = 'KM_MENOR_ACTUAL',
        message = format('El km de salida (%s) es menor que el último km conocido del camión (%s). Revisa el tablero.',
                         public.fmt_num(p_km_salida), public.fmt_num(v_lect)),
        hint = case when v_oficina then 'Si el dato es correcto, escribe el motivo para registrarlo.'
                    else 'Si el tablero marca menos, avisa a flota.' end;
    end if;
  end if;

  if v_fuente is null or v_fuente not in ('lleno', 'aguja', 'litros', 'heredado') then
    raise exception using errcode = 'P0001', message = 'Indica el combustible al salir.';
  end if;
  if v_fuente = 'heredado' then
    select * into v_sug from public.sugerir_nivel_salida(u.id, p_km_salida);
    if v_sug.fuente is distinct from 'heredado' then
      v_fuente := 'lleno';  -- el chofer confirmó tanque lleno; no se pudo verificar la herencia
    end if;
  end if;
  if v_fuente in ('lleno', 'heredado') then
    v_litros := u.capacidad_tanque_l;
  end if;
  if v_litros is null or v_litros < 0 or v_litros > u.capacidad_tanque_l then
    raise exception using errcode = 'P0001', detail = 'NIVEL_SUPERA_TANQUE',
      message = format('El nivel de salida (%s L) no puede superar la capacidad del tanque (%s L).',
                       public.fmt_num(coalesce(v_litros, 0), 0), public.fmt_num(u.capacidad_tanque_l, 0));
  end if;

  insert into public.viajes (id, unidad_id, chofer_id, origen_id, destino_id, salida_at, km_salida,
                             litros_salida, fuente_nivel_salida, foto_odometro_salida, notas, created_by)
  values (p_id, u.id, v_chofer, v_origen, v_destino, p_salida_at, p_km_salida,
          v_litros, v_fuente, p_foto, nullif(trim(p_notas), ''), v_uid)
  returning * into v;

  insert into public.viaje_paradas (viaje_id, orden, ubicacion_id)
  select p_id, x.ord, x.id from unnest(p_paradas) with ordinality as x (id, ord);

  if exists (select 1 from unnest(p_paradas) x (id)
               join public.ubicaciones l on l.id = x.id where l.es_sistema) then
    update public.viajes set revisar = true, revisar_motivos = array['destino_otro']
     where id = p_id returning * into v;
  end if;

  perform public.modo_sistema(true);
  update public.unidades set estado = 'en_ruta' where id = u.id;
  perform public.modo_sistema(false);
  return v;
end $$;

-- ----- registrar_repostaje -------------------------------------------
create function public.registrar_repostaje(
  p_id                    uuid,
  p_unidad_id             uuid,
  p_fecha                 timestamptz,
  p_lectura               numeric,
  p_litros                numeric,
  p_precio_id             uuid,
  p_tanque_lleno          boolean default true,
  p_estacion              text default null,
  p_recibo                text default null,
  p_notas                 text default null,
  p_carga_previa_omitida  boolean default false,
  p_motivo                text default null
) returns public.repostajes
language plpgsql security definer set search_path = '' as $$
declare
  v_rol      public.rol_usuario;
  v_uid      uuid := auth.uid();
  v_oficina  boolean;
  r          public.repostajes;
  u          public.unidades;
  v_precio   public.precios_combustible;
  v_viaje    public.viajes;
  v_lect     numeric;
  v_lectura  numeric := p_lectura;
begin
  v_rol := public.exigir_rol(array['superusuario', 'flota', 'chofer']::public.rol_usuario[],
                             'Tu usuario no puede registrar repostajes.');
  v_oficina := v_rol in ('superusuario', 'flota');

  select * into r from public.repostajes where id = p_id;
  if found then return r; end if;

  select * into u from public.unidades where id = p_unidad_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'La unidad no existe.';
  end if;
  if u.tipo = 'planta' and not v_oficina then
    raise exception using errcode = '42501', message = 'Las cargas de las plantas eléctricas las registra flota.';
  end if;
  if not v_oficina and not public.unidad_permitida_chofer(u.id) then
    raise exception using errcode = '42501', detail = 'UNIDAD_NO_PERMITIDA',
      message = format('Solo puedes registrar cargas del camión de tu ruta o del último que manejaste. %s no es uno de ellos.',
                       public.nombre_unidad(u.id));
  end if;

  select * into v_precio from public.precios_combustible where id = p_precio_id;
  if not found or not v_precio.activo then
    raise exception using errcode = 'P0001', message = 'Elige un precio por litro de la lista.';
  end if;
  if p_litros is null or p_litros <= 0 then
    raise exception using errcode = 'P0001', message = 'Indica los litros cargados.';
  end if;
  if p_litros > u.capacidad_tanque_l * 1.05 then
    raise exception using errcode = 'P0001', detail = 'LITROS_SUPERAN_TANQUE',
      message = format('La carga de %s L supera la capacidad del tanque de %s (%s L). Revisa los litros del recibo.',
                       public.fmt_num(p_litros, 2), public.nombre_unidad(u.id), public.fmt_num(u.capacidad_tanque_l, 2));
  end if;
  if coalesce(p_carga_previa_omitida, false) and not v_oficina then
    raise exception using errcode = '42501', message = 'Solo flota puede marcar que faltó registrar una carga anterior.';
  end if;
  if p_fecha is null or p_fecha > now() + interval '10 minutes' then
    raise exception using errcode = 'P0001', message = 'La fecha de la carga no puede estar en el futuro.';
  end if;

  if u.medidor = 'ninguno' then
    v_lectura := null;
  else
    if v_lectura is null then
      raise exception using errcode = 'P0001',
        message = case u.medidor when 'km' then 'Indica el km del tablero.' else 'Indica las horas del horómetro.' end;
    end if;
    v_lect := public.lectura_actual(u.id);
    if v_lectura < v_lect then
      if v_oficina and nullif(trim(p_motivo), '') is not null then
        perform public.preparar_auditoria('update', p_motivo);
      else
        raise exception using errcode = 'P0001', detail = 'KM_MENOR_ACTUAL',
          message = format('El %s (%s) es menor que el último conocido (%s). Revisa el tablero.',
                           case u.medidor when 'km' then 'km' else 'horómetro' end,
                           public.fmt_num(v_lectura), public.fmt_num(v_lect)),
          hint = case when v_oficina then 'Si el dato es correcto, escribe el motivo para registrarlo.' end;
      end if;
    end if;
  end if;

  select * into v_viaje from public.viajes where unidad_id = u.id and estado = 'en_curso';

  insert into public.repostajes (id, unidad_id, viaje_id, chofer_id, fecha, lectura_medidor, litros, precio_id,
                                 precio_usd_litro, tanque_lleno, carga_previa_omitida, estacion, recibo_path,
                                 notas, created_by)
  values (p_id, u.id, v_viaje.id,
          case when v_rol = 'chofer' then v_uid else v_viaje.chofer_id end,
          p_fecha, v_lectura, p_litros, v_precio.id, v_precio.precio_usd_litro,
          coalesce(p_tanque_lleno, true), coalesce(p_carga_previa_omitida, false),
          nullif(trim(p_estacion), ''), p_recibo, nullif(trim(p_notas), ''), v_uid)
  returning * into r;
  return r;
end $$;

-- ----- finalizar_viaje -------------------------------------------------
create function public.finalizar_viaje(
  p_viaje_id      uuid,
  p_llegada_at    timestamptz,
  p_km_llegada    numeric,
  p_reposto       boolean,
  p_repostaje_id  uuid default null,
  p_litros        numeric default null,
  p_precio_id     uuid default null,
  p_tanque_lleno  boolean default true,
  p_litros_aguja  numeric default null,
  p_recibo        text default null,
  p_foto          text default null,
  p_notas         text default null,
  p_estacion      text default null
) returns public.viajes
language plpgsql security definer set search_path = '' as $$
declare
  v_rol      public.rol_usuario;
  v_uid      uuid := auth.uid();
  v_oficina  boolean;
  v          public.viajes;
  u          public.unidades;
  v_precio   public.precios_combustible;
  v_max      numeric;
  v_lleno    boolean := coalesce(p_tanque_lleno, true);
begin
  v_rol := public.exigir_rol(array['superusuario', 'flota', 'chofer']::public.rol_usuario[],
                             'Tu usuario no puede finalizar rutas.');
  v_oficina := v_rol in ('superusuario', 'flota');

  select * into v from public.viajes where id = p_viaje_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'La ruta no existe.';
  end if;
  if v.estado = 'cerrado' then return v; end if;  -- reenvío desde la cola offline
  if v.estado = 'anulado' then
    raise exception using errcode = 'P0001', detail = 'RUTA_ANULADA',
      message = format('La ruta %s fue anulada y no se puede finalizar.', public.folio_txt('V', v.folio));
  end if;
  if v.chofer_id <> v_uid and not v_oficina then
    raise exception using errcode = '42501', message = 'Solo el chofer de la ruta o flota pueden finalizarla.';
  end if;

  select * into u from public.unidades where id = v.unidad_id;

  if p_km_llegada is null then
    raise exception using errcode = 'P0001', message = 'Indica el km de llegada.';
  end if;
  if p_km_llegada <= v.km_salida then
    raise exception using errcode = 'P0001', detail = 'KM_LLEGADA_MENOR',
      message = format('El km de llegada (%s) %s el de salida (%s). Revísalo en el tablero.',
                       public.fmt_num(p_km_llegada),
                       case when p_km_llegada = v.km_salida then 'es igual que' else 'es menor que' end,
                       public.fmt_num(v.km_salida));
  end if;
  select max(r.lectura_medidor) into v_max from public.repostajes r where r.viaje_id = v.id and not r.anulado;
  if v_max is not null and p_km_llegada < v_max then
    raise exception using errcode = 'P0001', detail = 'KM_LLEGADA_MENOR_CARGA',
      message = format('El km de llegada (%s) es menor que el de una carga hecha en esta ruta (%s). Revísalo en el tablero.',
                       public.fmt_num(p_km_llegada), public.fmt_num(v_max));
  end if;
  if p_llegada_at is null or p_llegada_at < v.salida_at then
    raise exception using errcode = 'P0001', message = 'La hora de llegada no puede ser anterior a la de salida.';
  end if;
  if p_llegada_at > now() + interval '10 minutes' then
    raise exception using errcode = 'P0001', message = 'La hora de llegada no puede estar en el futuro.';
  end if;
  if p_litros_aguja is not null and (p_litros_aguja < 0 or p_litros_aguja > u.capacidad_tanque_l) then
    raise exception using errcode = 'P0001', detail = 'NIVEL_SUPERA_TANQUE',
      message = format('El nivel al llegar (%s L) no puede superar la capacidad del tanque (%s L).',
                       public.fmt_num(p_litros_aguja, 0), public.fmt_num(u.capacidad_tanque_l, 0));
  end if;

  if coalesce(p_reposto, false) then
    select * into v_precio from public.precios_combustible where id = p_precio_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'Elige el precio por litro.';
    end if;
    if p_litros is null or p_litros <= 0 then
      raise exception using errcode = 'P0001', message = 'Indica los litros que cargaste.';
    end if;
    if p_litros > u.capacidad_tanque_l * 1.05 then
      raise exception using errcode = 'P0001', detail = 'LITROS_SUPERAN_TANQUE',
        message = format('La carga de %s L supera la capacidad del tanque (%s L). Revisa los litros del recibo.',
                         public.fmt_num(p_litros, 2), public.fmt_num(u.capacidad_tanque_l, 2));
    end if;
    insert into public.repostajes (id, unidad_id, viaje_id, chofer_id, fecha, lectura_medidor, litros, precio_id,
                                   precio_usd_litro, tanque_lleno, es_cierre_viaje, estacion, recibo_path, created_by)
    values (coalesce(p_repostaje_id, gen_random_uuid()), u.id, v.id, v.chofer_id, p_llegada_at, p_km_llegada,
            p_litros, v_precio.id, v_precio.precio_usd_litro, v_lleno, true, nullif(trim(p_estacion), ''),
            p_recibo, v_uid)
    on conflict (id) do nothing;
  end if;

  perform public.modo_sistema(true);
  update public.viajes set
    llegada_at            = p_llegada_at,
    km_llegada            = p_km_llegada,
    litros_llegada_aguja  = case when coalesce(p_reposto, false) and v_lleno then null else p_litros_aguja end,
    estado                = 'cerrado',
    foto_odometro_llegada = coalesce(p_foto, foto_odometro_llegada),
    notas                 = case
                              when nullif(trim(p_notas), '') is null then notas
                              when notas is null then trim(p_notas)
                              else notas || E'\n' || trim(p_notas)
                            end
  where id = v.id;
  update public.unidades set estado = 'disponible' where id = u.id and estado = 'en_ruta';
  perform public.modo_sistema(false);

  v := public.recalcular_viaje(v.id, true);

  if nullif(trim(p_notas), '') is not null then
    update public.viajes
       set revisar = true,
           revisar_motivos = array(select distinct m from unnest(revisar_motivos || 'novedad_chofer'::text) m order by m)
     where id = v.id
    returning * into v;
  end if;
  return v;
end $$;

-- ----- Gastos de mantenimiento ----------------------------------------
create function public.registrar_mantenimiento(
  p_id            uuid,
  p_unidad_id     uuid,
  p_categoria_id  uuid,
  p_fecha         date,
  p_moneda        public.moneda,
  p_monto         numeric,
  p_bs_por_usd    numeric default null,
  p_lectura       numeric default null,
  p_descripcion   text default null,
  p_proveedor     text default null,
  p_factura       text default null
) returns public.mantenimientos
language plpgsql security definer set search_path = '' as $$
declare
  v_rol      public.rol_usuario;
  v_uid      uuid := auth.uid();
  v_oficina  boolean;
  m          public.mantenimientos;
  u          public.unidades;
  v_tasa     numeric := p_bs_por_usd;
begin
  v_rol := public.exigir_rol(array['superusuario', 'flota', 'chofer']::public.rol_usuario[],
                             'Tu usuario no puede registrar gastos.');
  v_oficina := v_rol in ('superusuario', 'flota');

  select * into m from public.mantenimientos where id = p_id;
  if found then return m; end if;

  select * into u from public.unidades where id = p_unidad_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'La unidad no existe.';
  end if;
  if not v_oficina then
    if u.tipo = 'planta' then
      raise exception using errcode = '42501', message = 'Los gastos de las plantas eléctricas los registra flota.';
    end if;
    if not public.unidad_permitida_chofer(u.id) then
      raise exception using errcode = '42501', detail = 'UNIDAD_NO_PERMITIDA',
        message = format('Solo puedes registrar gastos del camión de tu ruta o del último que manejaste. %s no es uno de ellos.',
                         public.nombre_unidad(u.id));
    end if;
  end if;
  if not exists (select 1 from public.categorias_mantenimiento c where c.id = p_categoria_id and c.activo) then
    raise exception using errcode = 'P0001', message = 'Elige una categoría de la lista.';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception using errcode = 'P0001', message = 'Indica el monto del gasto.';
  end if;
  if p_fecha is null or p_fecha > public.hoy_caracas() then
    raise exception using errcode = 'P0001', message = 'La fecha del gasto no puede estar en el futuro.';
  end if;

  if p_moneda = 'VES' then
    if v_tasa is null then
      select t.bs_por_usd into v_tasa from public.tasa_para_fecha(p_fecha) t;
      if v_tasa is null then
        raise exception using errcode = 'P0001', detail = 'SIN_TASA',
          message = format('No hay tasa BCV para el %s. Escríbela a mano.', to_char(p_fecha, 'DD/MM/YYYY'));
      end if;
    elsif v_tasa <= 0 then
      raise exception using errcode = 'P0001', message = 'La tasa debe ser mayor que cero.';
    else
      insert into public.tasas_bcv (fecha, bs_por_usd, fuente, manual, created_by)
      values (p_fecha, v_tasa, 'manual', true, v_uid)
      on conflict (fecha) do nothing;
    end if;
  else
    v_tasa := coalesce(v_tasa, (select t.bs_por_usd from public.tasa_para_fecha(p_fecha) t));
  end if;

  insert into public.mantenimientos (id, unidad_id, categoria_id, fecha, lectura_medidor, descripcion, proveedor,
                                     moneda, monto, bs_por_usd, factura_path, estado_aprobacion,
                                     revisado_por, revisado_at, created_by)
  values (coalesce(p_id, gen_random_uuid()), u.id, p_categoria_id, p_fecha,
          case when u.medidor = 'ninguno' then null else p_lectura end,
          nullif(trim(p_descripcion), ''), nullif(trim(p_proveedor), ''), p_moneda, p_monto, v_tasa, p_factura,
          case when v_oficina then 'aprobado' else 'pendiente' end::public.estado_aprobacion,
          case when v_oficina then v_uid end, case when v_oficina then now() end, v_uid)
  returning * into m;
  return m;
end $$;

create function public.revisar_gasto(p_id uuid, p_aprobar boolean, p_motivo text default null)
returns public.mantenimientos
language plpgsql security definer set search_path = '' as $$
declare
  m public.mantenimientos;
begin
  perform public.exigir_rol(array['superusuario', 'flota']::public.rol_usuario[],
                            'Solo flota puede aprobar o rechazar gastos.');
  select * into m from public.mantenimientos where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'El gasto no existe.';
  end if;
  if m.estado_aprobacion <> 'pendiente' then return m; end if;
  if not p_aprobar and nullif(trim(p_motivo), '') is null then
    raise exception using errcode = 'P0001', message = 'Indica por qué se rechaza el gasto.';
  end if;
  perform public.preparar_auditoria(case when p_aprobar then 'aprobar' else 'rechazar' end, p_motivo);
  update public.mantenimientos set
    estado_aprobacion = case when p_aprobar then 'aprobado' else 'rechazado' end::public.estado_aprobacion,
    revisado_por = auth.uid(),
    revisado_at = now(),
    rechazo_motivo = case when p_aprobar then null else trim(p_motivo) end
  where id = p_id
  returning * into m;
  return m;
end $$;

-- ----- Anular, restaurar, corregir ------------------------------------
create function public.verificar_ventana_chofer(p_creado_por uuid, p_creado_at timestamptz) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_min int := coalesce((select c.ventana_correccion_min from public.configuracion c where c.id), 30);
begin
  if p_creado_por is distinct from auth.uid() or p_creado_at < now() - make_interval(mins => v_min) then
    raise exception using errcode = '42501', detail = 'FUERA_DE_VENTANA',
      message = format('Solo puedes cambiar tus propios registros durante los primeros %s minutos. Pide a flota que lo haga.', v_min);
  end if;
end $$;

create function public.anular_registro(p_tabla text, p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_rol     public.rol_usuario;
  v_oficina boolean;
  v         public.viajes;
  r         public.repostajes;
  m         public.mantenimientos;
begin
  v_rol := public.exigir_rol(array['superusuario', 'flota', 'chofer']::public.rol_usuario[],
                             'Tu usuario no puede anular registros.');
  v_oficina := v_rol in ('superusuario', 'flota');
  if nullif(trim(p_motivo), '') is null then
    raise exception using errcode = 'P0001', message = 'Indica el motivo de la anulación.';
  end if;
  perform public.preparar_auditoria('anular', trim(p_motivo));

  if p_tabla = 'viajes' then
    select * into v from public.viajes where id = p_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'La ruta no existe.'; end if;
    if v.estado = 'anulado' then return; end if;
    if not v_oficina then perform public.verificar_ventana_chofer(v.created_by, v.created_at); end if;
    update public.viajes set estado = 'anulado', anulado_motivo = trim(p_motivo) where id = p_id;
    if v.estado = 'en_curso' then
      perform public.modo_sistema(true);
      update public.unidades set estado = 'disponible' where id = v.unidad_id and estado = 'en_ruta';
      perform public.modo_sistema(false);
    end if;
  elsif p_tabla = 'repostajes' then
    select * into r from public.repostajes where id = p_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'La carga no existe.'; end if;
    if r.anulado then return; end if;
    if not v_oficina then perform public.verificar_ventana_chofer(r.created_by, r.created_at); end if;
    update public.repostajes set anulado = true, anulado_motivo = trim(p_motivo) where id = p_id;
  elsif p_tabla = 'mantenimientos' then
    select * into m from public.mantenimientos where id = p_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'El gasto no existe.'; end if;
    if m.anulado then return; end if;
    if not v_oficina then perform public.verificar_ventana_chofer(m.created_by, m.created_at); end if;
    update public.mantenimientos set anulado = true, anulado_motivo = trim(p_motivo) where id = p_id;
  else
    raise exception using errcode = 'P0001', message = 'Tipo de registro no válido.';
  end if;
  perform public.preparar_auditoria(null, null);
end $$;

create function public.restaurar_registro(p_tabla text, p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.viajes;
begin
  perform public.exigir_rol(array['superusuario']::public.rol_usuario[],
                            'Solo el superusuario puede restaurar registros anulados.');
  if nullif(trim(p_motivo), '') is null then
    raise exception using errcode = 'P0001', message = 'Indica el motivo de la restauración.';
  end if;
  perform public.preparar_auditoria('restaurar', trim(p_motivo));

  if p_tabla = 'viajes' then
    select * into v from public.viajes where id = p_id for update;
    if not found or v.estado <> 'anulado' then return; end if;
    if v.km_llegada is null then
      if exists (select 1 from public.viajes x where x.estado = 'en_curso'
                  and (x.unidad_id = v.unidad_id or x.chofer_id = v.chofer_id)) then
        raise exception using errcode = 'P0001',
          message = 'No se puede restaurar: el camión o el chofer ya tienen otra ruta abierta.';
      end if;
      update public.viajes set estado = 'en_curso', anulado_motivo = null where id = p_id;
      perform public.modo_sistema(true);
      update public.unidades set estado = 'en_ruta' where id = v.unidad_id;
      perform public.modo_sistema(false);
    else
      update public.viajes set estado = 'cerrado', anulado_motivo = null where id = p_id;
    end if;
  elsif p_tabla = 'repostajes' then
    update public.repostajes set anulado = false, anulado_motivo = null where id = p_id and anulado;
  elsif p_tabla = 'mantenimientos' then
    update public.mantenimientos set anulado = false, anulado_motivo = null where id = p_id and anulado;
  else
    raise exception using errcode = 'P0001', message = 'Tipo de registro no válido.';
  end if;
  perform public.preparar_auditoria(null, null);
end $$;

-- Corrección de datos de entrada con motivo. Las cifras calculadas no se
-- editan: se corrige el dato de origen y el sistema recalcula (D10).
create function public.corregir_registro(p_tabla text, p_id uuid, p_cambios jsonb, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_rol        public.rol_usuario;
  v_oficina    boolean;
  v_permitidos text[];
  v_row        jsonb;
  v_key        text;
  v_cols       text[] := '{}';
  v_cambios    jsonb := coalesce(p_cambios, '{}'::jsonb);
  v_paradas    uuid[];
  v_antes      uuid[];
  v_unidad     public.unidades;
  v_res        jsonb;
begin
  v_rol := public.exigir_rol(array['superusuario', 'flota', 'chofer']::public.rol_usuario[],
                             'Tu usuario no puede corregir registros.');
  v_oficina := v_rol in ('superusuario', 'flota');
  if nullif(trim(p_motivo), '') is null then
    raise exception using errcode = 'P0001', message = 'Indica el motivo de la corrección.';
  end if;
  if v_cambios = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'No hay cambios para guardar.';
  end if;

  v_permitidos := case p_tabla
    when 'viajes' then case when v_oficina
      then array['unidad_id', 'chofer_id', 'origen_id', 'salida_at', 'km_salida', 'litros_salida',
                 'fuente_nivel_salida', 'llegada_at', 'km_llegada', 'litros_llegada_aguja', 'notas',
                 'foto_odometro_salida', 'foto_odometro_llegada', 'paradas']
      else array['km_salida', 'litros_salida', 'fuente_nivel_salida', 'km_llegada', 'litros_llegada_aguja',
                 'notas', 'paradas'] end
    when 'repostajes' then case when v_oficina
      then array['fecha', 'lectura_medidor', 'litros', 'precio_id', 'precio_usd_litro', 'tanque_lleno',
                 'carga_previa_omitida', 'estacion', 'notas', 'recibo_path']
      else array['lectura_medidor', 'litros', 'precio_id', 'tanque_lleno', 'estacion', 'notas', 'recibo_path'] end
    when 'mantenimientos' then
      array['unidad_id', 'categoria_id', 'fecha', 'lectura_medidor', 'descripcion', 'proveedor', 'moneda',
            'monto', 'bs_por_usd', 'factura_path']
    else null end;
  if v_permitidos is null then
    raise exception using errcode = 'P0001', message = 'Tipo de registro no válido.';
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', p_tabla) into v_row using p_id;
  if v_row is null then
    raise exception using errcode = 'P0001', message = 'El registro no existe.';
  end if;
  if coalesce((v_row ->> 'anulado')::boolean, false) then
    raise exception using errcode = 'P0001', message = 'No se puede corregir un registro anulado.';
  end if;
  if not v_oficina then
    perform public.verificar_ventana_chofer((v_row ->> 'created_by')::uuid, (v_row ->> 'created_at')::timestamptz);
    if p_tabla = 'mantenimientos' and v_row ->> 'estado_aprobacion' <> 'pendiente' then
      raise exception using errcode = '42501', message = 'El gasto ya fue revisado por flota; pídele la corrección.';
    end if;
  end if;

  for v_key in select jsonb_object_keys(v_cambios) loop
    if not (v_key = any (v_permitidos)) then
      raise exception using errcode = '42501', message = format('El campo "%s" no se puede corregir desde aquí.', v_key);
    end if;
    if v_key <> 'paradas' then v_cols := v_cols || v_key; end if;
  end loop;

  -- Al cambiar el precio elegido se copia de nuevo su valor
  if p_tabla = 'repostajes' and v_cambios ? 'precio_id' and not v_cambios ? 'precio_usd_litro' then
    v_cambios := v_cambios || jsonb_build_object('precio_usd_litro',
      (select p.precio_usd_litro from public.precios_combustible p where p.id = (v_cambios ->> 'precio_id')::uuid));
    v_cols := v_cols || 'precio_usd_litro'::text;
  end if;

  perform public.preparar_auditoria('update', trim(p_motivo));

  if p_tabla = 'viajes' and v_cambios ? 'paradas' then
    v_paradas := array(select jsonb_array_elements_text(v_cambios -> 'paradas')::uuid);
    if cardinality(v_paradas) = 0 then
      raise exception using errcode = 'P0001', message = 'La ruta necesita al menos un destino.';
    end if;
    if exists (select 1 from unnest(v_paradas) x (id) left join public.ubicaciones l on l.id = x.id where l.id is null) then
      raise exception using errcode = 'P0001', message = 'Uno de los destinos no existe.';
    end if;
    v_antes := array(select vp.ubicacion_id from public.viaje_paradas vp where vp.viaje_id = p_id order by vp.orden);
    delete from public.viaje_paradas where viaje_id = p_id;
    insert into public.viaje_paradas (viaje_id, orden, ubicacion_id)
    select p_id, x.ord, x.id from unnest(v_paradas) with ordinality as x (id, ord);
    update public.viajes set destino_id = v_paradas[cardinality(v_paradas)] where id = p_id;
    insert into public.auditoria (tabla, registro_id, accion, antes, despues, motivo, usuario_id)
    values ('viaje_paradas', p_id::text, 'update', jsonb_build_object('paradas', to_jsonb(v_antes)),
            jsonb_build_object('paradas', to_jsonb(v_paradas)), trim(p_motivo), auth.uid());
  end if;

  if p_tabla = 'viajes' and v_cambios ? 'unidad_id' and v_row ->> 'estado' = 'en_curso'
     and (v_cambios ->> 'unidad_id')::uuid <> (v_row ->> 'unidad_id')::uuid then
    select * into v_unidad from public.unidades where id = (v_cambios ->> 'unidad_id')::uuid;
    if not found or v_unidad.tipo <> 'camion' or v_unidad.estado <> 'disponible' then
      raise exception using errcode = 'P0001', message = 'El camión elegido no está disponible.';
    end if;
    perform public.modo_sistema(true);
    update public.unidades set estado = 'disponible' where id = (v_row ->> 'unidad_id')::uuid and estado = 'en_ruta';
    update public.unidades set estado = 'en_ruta' where id = v_unidad.id;
    perform public.modo_sistema(false);
  end if;

  if cardinality(v_cols) > 0 then
    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2',
      p_tabla,
      (select string_agg(format('%I = r.%I', c, c), ', ') from unnest(v_cols) c),
      p_tabla)
    using v_cambios, p_id;
  end if;

  -- Validaciones que dependen de la capacidad del tanque
  if p_tabla = 'repostajes' then
    if exists (select 1 from public.repostajes r join public.unidades u on u.id = r.unidad_id
                where r.id = p_id and r.litros > u.capacidad_tanque_l * 1.05) then
      raise exception using errcode = 'P0001', detail = 'LITROS_SUPERAN_TANQUE',
        message = 'Los litros superan la capacidad del tanque.';
    end if;
  elsif p_tabla = 'viajes' then
    if exists (select 1 from public.viajes v join public.unidades u on u.id = v.unidad_id
                where v.id = p_id and (v.litros_salida > u.capacidad_tanque_l
                                       or v.litros_llegada_aguja > u.capacidad_tanque_l)) then
      raise exception using errcode = 'P0001', detail = 'NIVEL_SUPERA_TANQUE',
        message = 'El nivel indicado supera la capacidad del tanque.';
    end if;
  end if;

  perform public.preparar_auditoria(null, null);
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_tabla) into v_res using p_id;
  return v_res;
end $$;

-- ----- Ubicaciones -------------------------------------------------------
-- "Eliminar": si nunca se usó se borra; si tiene viajes, se archiva.
create function public.eliminar_ubicacion(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  l public.ubicaciones;
begin
  perform public.exigir_rol(array['superusuario', 'flota']::public.rol_usuario[],
                            'Solo flota puede eliminar ubicaciones.');
  select * into l from public.ubicaciones where id = p_id for update;
  if not found then return 'eliminada'; end if;
  if l.es_sistema then
    raise exception using errcode = 'P0001', message = 'Esta ubicación es del sistema y no se puede eliminar.';
  end if;
  if exists (select 1 from public.viajes v where v.origen_id = p_id or v.destino_id = p_id)
     or exists (select 1 from public.viaje_paradas vp where vp.ubicacion_id = p_id) then
    update public.ubicaciones set activo = false where id = p_id;
    return 'archivada';
  end if;
  delete from public.ubicaciones where id = p_id;
  return 'eliminada';
end $$;

-- ----- Bandeja de revisión -------------------------------------------------
-- Flota da por revisada una ruta (destino "Otro", novedad del chofer,
-- rendimiento fuera de rango). Queda en la auditoría con su nota.
create function public.marcar_revisado(p_viaje_id uuid, p_nota text) returns public.viajes
language plpgsql security definer set search_path = '' as $$
declare
  v public.viajes;
begin
  perform public.exigir_rol(array['superusuario', 'flota']::public.rol_usuario[],
                            'Solo flota puede dar por revisada una ruta.');
  if nullif(trim(p_nota), '') is null then
    raise exception using errcode = 'P0001', message = 'Escribe qué se revisó o corrigió.';
  end if;
  select * into v from public.viajes where id = p_viaje_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'La ruta no existe.';
  end if;
  insert into public.auditoria (tabla, registro_id, accion, antes, despues, motivo, usuario_id)
  values ('viajes', v.id::text, 'revisar', jsonb_build_object('revisar_motivos', to_jsonb(v.revisar_motivos)),
          jsonb_build_object('revisar_motivos', '[]'::jsonb), trim(p_nota), auth.uid());
  update public.viajes set revisar = false, revisar_motivos = '{}' where id = v.id returning * into v;
  return v;
end $$;

-- ----- Permisos de ejecución ---------------------------------------------
do $$
declare
  f record;
  v_publicas text[] := array[
    'rol_actual', 'es_oficina', 'es_superusuario', 'fmt_num', 'folio_txt', 'fecha_txt', 'nombre_unidad',
    'hoy_caracas', 'lectura_actual', 'sugerir_nivel_salida', 'nivel_estimado',
    'unidad_permitida_chofer', 'tasa_para_fecha', 'iniciar_viaje', 'registrar_repostaje', 'finalizar_viaje',
    'registrar_mantenimiento', 'revisar_gasto', 'anular_registro', 'restaurar_registro', 'corregir_registro',
    'eliminar_ubicacion', 'marcar_revisado'];
begin
  for f in
    select p.oid::regprocedure as firma, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to service_role', f.firma);
    if f.proname = any (v_publicas) then
      execute format('grant execute on function %s to authenticated', f.firma);
    end if;
  end loop;
end $$;
