-- =====================================================================
-- Flota IP · Datos de DEMOSTRACIÓN (solo desarrollo)
-- 3 camiones DEMO, 2 plantas DEMO, 3 choferes y 3 usuarios de oficina,
-- desde el 01/07/2026 hasta ayer. Todo se registra llamando a las mismas
-- funciones de la app, así que las cifras salen del motor real.
-- Usuarios (entrar con usuario y clave):
--   demo.super / demo1234     demo.flota / demo1234     demo.gerencia / demo1234
--   demo.pedro / 123456       demo.luis / 123456        demo.carlos / 123456
-- Se eliminan con supabase/sql/limpiar_demo.sql antes de la entrega.
-- =====================================================================

create function pg_temp.usuario_demo(p_usuario text, p_clave text, p_nombre text, p_rol text) returns uuid
language plpgsql as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := p_usuario || '@usuarios.flota-ip.invalid';
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
          jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'rol', p_rol),
          jsonb_build_object('nombre', p_nombre, 'usuario', p_usuario), now(), now(), '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end $$;

create function pg_temp.como(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;

do $$
declare
  v_super    uuid;
  v_flota    uuid;
  v_ger      uuid;
  v_choferes uuid[];
  v_sede     uuid;
  v_dest     record;
  v_rutas    jsonb;
  v_ruta     jsonb;
  v_p050     uuid;
  v_p060     uuid;
  v_precio   uuid;
  v_cat      jsonb := '{}'::jsonb;
  v_camiones uuid[];
  v_plantas  uuid[];
  v_cap      numeric[] := array[200, 160, 250];
  v_kml      numeric[] := array[5.2, 6.0, 4.4];
  v_km       numeric[] := array[84210, 61530, 112870];
  v_lleno    boolean[] := array[true, true, true];
  v_nivel    numeric[] := array[200, 160, 250];
  v_inicio   date := date '2026-07-01';
  v_fin      date := public.hoy_caracas() - 1;
  d          date;
  i          int;
  k          int;
  v_viaje    uuid;
  v_chofer   uuid;
  v_paradas  uuid[];
  v_dist     numeric;
  v_rend     numeric;
  v_usados   numeric;
  v_mid      numeric;
  v_antes    numeric;
  v_fuente   text;
  v_salida   timestamptz;
  v_llegada  timestamptz;
  v_olvidada boolean := false;
  v_tasa     numeric;
  v_ultimo   uuid;
begin
  perform setseed(0.42);

  -- Personas
  v_super := pg_temp.usuario_demo('demo.super', 'demo1234', 'Roberts (demo)', 'superusuario');
  v_flota := pg_temp.usuario_demo('demo.flota', 'demo1234', 'Ana Flota (demo)', 'flota');
  v_ger   := pg_temp.usuario_demo('demo.gerencia', 'demo1234', 'Gerencia (demo)', 'consulta');
  v_choferes := array[
    pg_temp.usuario_demo('demo.pedro', '123456', 'Pedro Rivas (demo)', 'chofer'),
    pg_temp.usuario_demo('demo.luis', '123456', 'Luis Mora (demo)', 'chofer'),
    pg_temp.usuario_demo('demo.carlos', '123456', 'Carlos Peña (demo)', 'chofer')];

  -- Ubicaciones de ejemplo (distancia aproximada desde la sede, solo para generar km)
  insert into public.ubicaciones (nombre, estado_ve, municipio, tipo, created_by)
  values ('Sede DEMO', 'Trujillo', 'Valera', 'sede', v_super) returning id into v_sede;
  create temp table demo_destinos (nombre text, estado_ve text, municipio text, km numeric, id uuid) on commit drop;
  insert into demo_destinos values
    ('Trujillo', 'Trujillo', 'Trujillo', 35, null),
    ('Boconó', 'Trujillo', 'Boconó', 95, null),
    ('Mérida', 'Mérida', 'Libertador', 160, null),
    ('El Vigía', 'Mérida', 'Alberto Adriani', 175, null),
    ('Maracaibo', 'Zulia', 'Maracaibo', 260, null),
    ('Cabimas', 'Zulia', 'Cabimas', 215, null),
    ('Ciudad Ojeda', 'Zulia', 'Lagunillas', 195, null);
  for v_dest in select * from demo_destinos loop
    insert into public.ubicaciones (nombre, estado_ve, municipio, tipo, created_by)
    values (v_dest.nombre, v_dest.estado_ve, v_dest.municipio, 'cliente', v_super)
    returning id into v_ultimo;
    update demo_destinos set id = v_ultimo where demo_destinos.nombre = v_dest.nombre;
  end loop;

  -- Rutas típicas: una o dos paradas
  select jsonb_agg(r) into v_rutas from (
    select jsonb_build_object('p', jsonb_build_array(id), 'km', km * 2 + 15) as r from demo_destinos
    union all
    select jsonb_build_object('p', jsonb_build_array(a.id, b.id), 'km', greatest(a.km, b.km) * 2 + 40)
      from demo_destinos a join demo_destinos b
        on (a.nombre, b.nombre) in (('Trujillo', 'Boconó'), ('Mérida', 'El Vigía'), ('Cabimas', 'Maracaibo'),
                                    ('Ciudad Ojeda', 'Cabimas'))
  ) x;

  select id into v_p050 from public.precios_combustible where precio_usd_litro = 0.5;
  select id into v_p060 from public.precios_combustible where precio_usd_litro = 0.6;
  select jsonb_object_agg(nombre, id) into v_cat from public.categorias_mantenimiento;

  -- Unidades
  insert into public.unidades (tipo, placa, alias, marca, modelo, anio, combustible, capacidad_tanque_l,
                               lectura_inicial, combustible_inicial_l, fecha_alta, chofer_habitual_id,
                               rendimiento_min, rendimiento_max, created_by)
  values ('camion', 'DEMO-001', 'Camión 1', 'Chevrolet', 'NPR', 2014, 'diesel', 200, v_km[1], 200, '2026-06-25', v_choferes[1], 3.5, 8, v_super),
         ('camion', 'DEMO-002', 'Camión 2', 'Ford', 'Cargo 815', 2011, 'gasolina', 160, v_km[2], 160, '2026-06-25', v_choferes[2], 4, 9, v_super),
         ('camion', 'DEMO-003', 'Camión 3', 'Iveco', 'Daily 70', 2017, 'diesel', 250, v_km[3], 250, '2026-06-25', v_choferes[3], 3, 7, v_super);
  select array_agg(id order by placa) into v_camiones from public.unidades where placa like 'DEMO-%';
  insert into public.unidades (tipo, alias, marca, modelo, combustible, medidor, capacidad_tanque_l,
                               lectura_inicial, combustible_inicial_l, fecha_alta, created_by)
  values ('planta', 'Planta sede DEMO', 'Perkins', '60 kVA', 'diesel', 'ninguno', 120, null, 120, '2026-06-25', v_super),
         ('planta', 'Planta almacén DEMO', 'Honda', 'EU7000', 'gasolina', 'ninguno', 25, null, 25, '2026-06-25', v_super);
  select array_agg(id order by capacidad_tanque_l desc) into v_plantas from public.unidades where tipo = 'planta' and alias like '%DEMO%';

  -- Tasas BCV de demostración (días hábiles), de ~600 a ~860 Bs/USD
  insert into public.tasas_bcv (fecha, bs_por_usd, fuente, manual)
  select g::date, round(600 + 260 * ((g::date - v_inicio)::numeric / greatest(v_fin - v_inicio, 1)) + (random()::numeric - 0.5) * 4, 4),
         'DEMO', false
    from generate_series(v_inicio, v_fin, interval '1 day') g
   where extract(isodow from g) < 6;

  -- Rutas día por día
  d := v_inicio;
  while d <= v_fin loop
    if extract(isodow from d) < 7 then
      for i in 1..3 loop
        continue when i = 3 and d >= v_fin - 2;   -- el Camión 3 queda con la ruta olvidada
        continue when random()::numeric < 0.38;

        -- Choferes rotan entre camiones; Carlos queda con la ruta olvidada
        k := ((d - v_inicio) + i) % 3 + 1;
        v_chofer := v_choferes[k];
        continue when exists (select 1 from public.viajes where chofer_id = v_chofer and estado = 'en_curso');

        v_ruta := v_rutas -> floor(random()::numeric * jsonb_array_length(v_rutas))::int;
        v_paradas := array(select jsonb_array_elements_text(v_ruta -> 'p')::uuid);
        v_dist := round((v_ruta ->> 'km')::numeric * (0.95 + random()::numeric * 0.1));

        -- Km sin ruta registrada (alerta) una vez en septiembre
        if i = 1 and d = date '2026-09-15' then v_km[i] := v_km[i] + 45; end if;

        v_rend := v_kml[i] * (0.94 + random()::numeric * 0.12);
        -- Consumo anómalo del Camión 2 en los últimos 10 días
        if i = 2 and d > v_fin - 7 and random()::numeric < 0.5 then v_rend := v_kml[i] * 0.72; end if;
        v_usados := round(v_dist / v_rend, 2);

        v_salida := (d + time '06:30' + (random() * interval '2 hours')) at time zone 'America/Caracas';
        v_llegada := v_salida + make_interval(mins => (v_dist / 45 * 60)::int + 30);

        if v_lleno[i] then v_fuente := 'heredado'; else v_fuente := 'aguja'; end if;
        v_viaje := gen_random_uuid();
        perform pg_temp.como(v_chofer);

        perform public.iniciar_viaje(v_viaje, v_camiones[i], v_paradas, v_salida, v_km[i], v_nivel[i], v_fuente, v_sede);

        v_mid := 0;
        if v_dist > 350 and random()::numeric < 0.6 then
          v_mid := round(v_usados * 0.45, 0);
          v_precio := case when random()::numeric < 0.5 then v_p050 else v_p060 end;
          perform public.registrar_repostaje(gen_random_uuid(), v_camiones[i], v_salida + (v_llegada - v_salida) / 2,
                                             v_km[i] + round(v_dist * 0.5), v_mid, v_precio, false, 'Estación en ruta');
        end if;

        v_antes := v_nivel[i] + v_mid - v_usados;
        if v_antes < 10 then  -- nunca se queda sin combustible en la demo
          v_antes := 10;
        end if;
        v_precio := case when random()::numeric < 0.55 then v_p060 else v_p050 end;

        if random()::numeric < 0.84 or v_antes < v_cap[i] / 2 or v_usados < v_cap[i] / 3 then
          perform public.finalizar_viaje(v_viaje, v_llegada, v_km[i] + v_dist, true, gen_random_uuid(),
                                         round(v_cap[i] - v_antes, 2), v_precio, true, null, null, null,
                                         case when random()::numeric < 0.04 then 'Ruido en la suspensión trasera' end);
          v_lleno[i] := true;
          v_nivel[i] := v_cap[i];
        else
          v_antes := floor(v_antes / (v_cap[i] / 4)) * (v_cap[i] / 4);  -- leído en la aguja por cuartos
          perform public.finalizar_viaje(v_viaje, v_llegada, v_km[i] + v_dist, false, null, null, null, true, v_antes);
          v_lleno[i] := false;
          v_nivel[i] := v_antes;
        end if;
        v_km[i] := v_km[i] + v_dist;
      end loop;
    end if;

    -- Plantas: carga semanal en bidones (flota)
    if extract(isodow from d) = 1 then
      perform pg_temp.como(v_flota);
      perform public.registrar_repostaje(gen_random_uuid(), v_plantas[1], (d + time '09:00') at time zone 'America/Caracas',
                                         null, round(35 + random()::numeric * 30, 2), v_p050, true, 'Bidones');
      perform public.registrar_repostaje(gen_random_uuid(), v_plantas[2], (d + time '09:30') at time zone 'America/Caracas',
                                         null, round(10 + random()::numeric * 10, 2), v_p060, random()::numeric < 0.7, 'Bidones');
    end if;

    -- Mantenimiento registrado por flota
    perform pg_temp.como(v_flota);
    if extract(day from d) = 3 then
      for i in 1..3 loop
        perform public.registrar_mantenimiento(gen_random_uuid(), v_camiones[i], (v_cat ->> 'Aceite')::uuid, d, 'USD',
                                               round(45 + random()::numeric * 20, 2), null, null, 'Cambio de aceite y filtro', 'Lubricantes El Llano');
      end loop;
    end if;
    if extract(day from d) in (8, 22) and extract(isodow from d) < 6 then
      select bs_por_usd into v_tasa from public.tasa_para_fecha(d);
      for i in 1..3 loop
        perform public.registrar_mantenimiento(gen_random_uuid(), v_camiones[i], (v_cat ->> 'Lavado')::uuid, d, 'VES',
                                               round(v_tasa * (6 + random()::numeric * 3), 2), v_tasa, null, 'Lavado y engrase', 'Autolavado La Vega');
      end loop;
    end if;
    if d in (date '2026-07-17', date '2026-08-20', date '2026-09-24') then
      select bs_por_usd into v_tasa from public.tasa_para_fecha(d);
      perform public.registrar_mantenimiento(gen_random_uuid(), v_camiones[1 + (extract(month from d)::int % 3)],
                                             (v_cat ->> 'Cauchos')::uuid, d, 'VES', round(v_tasa * (380 + random()::numeric * 120), 2),
                                             v_tasa, null, 'Dos cauchos delanteros', 'Cauchos Zulia');
      perform public.registrar_mantenimiento(gen_random_uuid(), v_camiones[1 + ((extract(month from d)::int + 1) % 3)],
                                             (v_cat ->> 'Repuestos')::uuid, d, 'USD', round(80 + random()::numeric * 140, 2),
                                             null, null, 'Pastillas y bandas de freno', 'Repuestos Andinos');
      perform public.registrar_mantenimiento(gen_random_uuid(), v_plantas[1], (v_cat ->> 'Filtros')::uuid, d, 'USD',
                                             round(25 + random()::numeric * 15, 2), null, null, 'Filtros de aire y gasoil', 'Repuestos Andinos');
    end if;
    d := d + 1;
  end loop;

  -- Gastos de choferes: dos pendientes y uno rechazado
  for k in 1..2 loop
    select unidad_id into v_ultimo from public.viajes
     where chofer_id = v_choferes[k] and estado <> 'anulado' order by salida_at desc limit 1;
    perform pg_temp.como(v_choferes[k]);
    perform public.registrar_mantenimiento(gen_random_uuid(), v_ultimo, (v_cat ->> 'Lavado')::uuid, v_fin, 'USD',
                                           12 + k * 3, null, null, 'Lavado en ruta', 'Autolavado Mérida');
  end loop;
  select unidad_id into v_ultimo from public.viajes
   where chofer_id = v_choferes[1] and estado <> 'anulado' order by salida_at desc limit 1;
  perform pg_temp.como(v_choferes[1]);
  perform public.registrar_mantenimiento(gen_random_uuid(), v_ultimo, (v_cat ->> 'Otros')::uuid, v_fin - 3, 'USD',
                                         30, null, null, 'Peaje y estacionamiento', null);
  perform pg_temp.como(v_flota);
  perform public.revisar_gasto(m.id, false, 'Los peajes no son mantenimiento')
     from public.mantenimientos m where m.descripcion = 'Peaje y estacionamiento';

  -- Ruta olvidada: el Camión 3 salió hace 60 h con Carlos y nadie la cerró
  perform pg_temp.como(v_choferes[3]);
  perform public.iniciar_viaje(gen_random_uuid(), v_camiones[3],
                               array[(select id from demo_destinos where nombre = 'Maracaibo')],
                               now() - interval '60 hours', v_km[3], v_nivel[3],
                               case when v_lleno[3] then 'heredado' else 'aguja' end, v_sede);
  v_olvidada := true;

  -- Una ruta en curso hoy para ver "Ahora mismo"
  if (now() at time zone 'America/Caracas')::time > time '07:30' then
    select v_choferes[x] into v_chofer from generate_series(1, 2) x
     where not exists (select 1 from public.viajes where chofer_id = v_choferes[x] and estado = 'en_curso')
     limit 1;
    if v_chofer is not null then
      perform pg_temp.como(v_chofer);
      perform public.iniciar_viaje(gen_random_uuid(), v_camiones[1], array[(select id from demo_destinos where nombre = 'Mérida')],
                                   ((public.hoy_caracas() + time '07:30') at time zone 'America/Caracas'),
                                   v_km[1], v_nivel[1], case when v_lleno[1] then 'heredado' else 'aguja' end, v_sede);
    end if;
  end if;

  -- Recordatorios de servicio: uno por vencer, uno al día, uno pasado y el de una planta
  perform pg_temp.como(v_flota);
  perform public.guardar_recordatorio(gen_random_uuid(), v_camiones[1], 'Cambio de aceite', (v_cat ->> 'Aceite')::uuid,
                                      5000, 120, 500, 15, public.lectura_actual(v_camiones[1]) - 4650, v_fin - 70, null, true);
  perform public.guardar_recordatorio(gen_random_uuid(), v_camiones[2], 'Rotación de cauchos', (v_cat ->> 'Cauchos')::uuid,
                                      10000, null, 800, 15, public.lectura_actual(v_camiones[2]) - 3000, v_fin - 40, null, true);
  perform public.guardar_recordatorio(gen_random_uuid(), v_camiones[3], 'Cambio de aceite', (v_cat ->> 'Aceite')::uuid,
                                      5000, 120, 500, 15, public.lectura_actual(v_camiones[3]) - 5200, v_fin - 60, null, true);
  perform public.guardar_recordatorio(gen_random_uuid(), v_plantas[1], 'Servicio de la planta', (v_cat ->> 'Filtros')::uuid,
                                      null, 90, 0, 15, null, v_fin - 84, null, true);

  -- Documentos: póliza por vencer, póliza al día, permiso vencido, licencia y certificado médico
  perform public.guardar_documento(gen_random_uuid(), v_camiones[1], null, 'Póliza RCV', public.hoy_caracas() + 9,
                                   'RCV-DEMO-001', 'Seguros DEMO', 15, null, null, true);
  perform public.guardar_documento(gen_random_uuid(), v_camiones[2], null, 'Póliza RCV', public.hoy_caracas() + 160,
                                   'RCV-DEMO-002', 'Seguros DEMO', 15, null, null, true);
  perform public.guardar_documento(gen_random_uuid(), v_camiones[3], null, 'Permiso de circulación', public.hoy_caracas() - 4,
                                   null, null, 15, null, null, true);
  perform public.guardar_documento(gen_random_uuid(), null, v_choferes[1], 'Licencia de conducir', public.hoy_caracas() + 400,
                                   null, null, 30, null, null, true);
  perform public.guardar_documento(gen_random_uuid(), null, v_choferes[2], 'Certificado médico', public.hoy_caracas() + 20,
                                   null, null, 30, null, null, true);

  perform set_config('request.jwt.claims', '', true);
end $$;
