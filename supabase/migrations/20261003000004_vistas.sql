-- =====================================================================
-- Flota IP · Vistas y consultas del dashboard
-- Atribución temporal (sección 7.2): un viaje cuenta en el mes de su
-- llegada; una carga ligada a un viaje cerrado, en el mes de esa
-- llegada; una carga suelta, en el de su fecha; un gasto, en el de su
-- fecha. Agregados siempre ponderados (Σ km ÷ Σ L), nunca promedio de
-- ratios.
-- Gasto en combustible = lo pagado en cargas (cada carga una sola vez).
-- Costo del viaje = litros consumidos × precio ponderado (sección 8.3).
-- =====================================================================

-- ----- Listados con nombres --------------------------------------------
create view public.v_unidades with (security_invoker = true) as
select
  u.*,
  public.nombre_unidad(u.id)        as nombre,
  ch.nombre                         as chofer_habitual_nombre,
  public.lectura_actual(u.id)       as lectura_actual,
  va.id                             as viaje_abierto_id,
  va.folio                          as viaje_abierto_folio,
  va.salida_at                      as viaje_abierto_salida_at,
  va.km_salida                      as viaje_abierto_km_salida,
  vch.nombre                        as viaje_abierto_chofer,
  vd.nombre                         as viaje_abierto_destino,
  ne.litros                         as nivel_estimado_l,
  ne.fuente                         as nivel_estimado_fuente,
  ne.base_fecha                     as nivel_base_fecha
from public.unidades u
left join public.perfiles ch   on ch.id = u.chofer_habitual_id
left join public.viajes va     on va.unidad_id = u.id and va.estado = 'en_curso'
left join public.perfiles vch  on vch.id = va.chofer_id
left join public.ubicaciones vd on vd.id = va.destino_id
left join lateral public.nivel_estimado(u.id) ne on true;

create view public.v_viajes with (security_invoker = true) as
select
  v.*,
  public.folio_txt('V', v.folio)                                   as folio_txt,
  u.tipo                                                           as unidad_tipo,
  u.placa,
  u.alias,
  public.nombre_unidad(u.id)                                       as unidad_nombre,
  u.capacidad_tanque_l,
  u.combustible,
  ch.nombre                                                        as chofer_nombre,
  o.nombre                                                         as origen_nombre,
  d.nombre                                                         as destino_nombre,
  p.paradas_ids,
  p.paradas_nombres,
  p.ruta,
  (v.salida_at at time zone 'America/Caracas')::date               as fecha_salida,
  (v.llegada_at at time zone 'America/Caracas')::date              as fecha_llegada,
  date_trunc('month', (v.llegada_at at time zone 'America/Caracas'))::date as mes,
  coalesce(c.cargas, 0)                                            as cargas,
  coalesce(c.litros_cargados, 0)                                   as litros_cargados,
  coalesce(c.monto_cargado, 0)                                     as monto_cargado
from public.viajes v
join public.unidades u      on u.id = v.unidad_id
join public.perfiles ch     on ch.id = v.chofer_id
left join public.ubicaciones o on o.id = v.origen_id
join public.ubicaciones d   on d.id = v.destino_id
left join lateral (
  select array_agg(vp.ubicacion_id order by vp.orden)         as paradas_ids,
         array_agg(l.nombre order by vp.orden)                as paradas_nombres,
         string_agg(l.nombre, ' – ' order by vp.orden)        as ruta
  from public.viaje_paradas vp join public.ubicaciones l on l.id = vp.ubicacion_id
  where vp.viaje_id = v.id
) p on true
left join lateral (
  select count(*)::int as cargas, sum(r.litros) as litros_cargados, sum(r.monto_usd) as monto_cargado
  from public.repostajes r where r.viaje_id = v.id and not r.anulado
) c on true;

create view public.v_repostajes with (security_invoker = true) as
select
  r.*,
  public.folio_txt('R', r.folio)                                   as folio_txt,
  u.tipo                                                           as unidad_tipo,
  public.nombre_unidad(u.id)                                       as unidad_nombre,
  u.capacidad_tanque_l,
  u.medidor,
  ch.nombre                                                        as chofer_nombre,
  case when v.id is not null then public.folio_txt('V', v.folio) end as viaje_folio_txt,
  p.etiqueta                                                       as precio_etiqueta,
  (r.fecha at time zone 'America/Caracas')::date                   as fecha_local,
  (case when v.estado = 'cerrado' then v.llegada_at else r.fecha end at time zone 'America/Caracas')::date as fecha_gasto,
  cr.nombre                                                        as registrado_por_nombre
from public.repostajes r
join public.unidades u               on u.id = r.unidad_id
left join public.perfiles ch         on ch.id = r.chofer_id
left join public.viajes v            on v.id = r.viaje_id
left join public.precios_combustible p on p.id = r.precio_id
left join public.perfiles cr         on cr.id = r.created_by;

create view public.v_mantenimientos with (security_invoker = true) as
select
  m.*,
  public.folio_txt('M', m.folio)    as folio_txt,
  u.tipo                            as unidad_tipo,
  public.nombre_unidad(u.id)        as unidad_nombre,
  c.nombre                          as categoria_nombre,
  cr.nombre                         as registrado_por_nombre,
  cr.rol                            as registrado_por_rol,
  rv.nombre                         as revisado_por_nombre
from public.mantenimientos m
join public.unidades u                     on u.id = m.unidad_id
join public.categorias_mantenimiento c     on c.id = m.categoria_id
left join public.perfiles cr               on cr.id = m.created_by
left join public.perfiles rv               on rv.id = m.revisado_por;

create view public.v_auditoria with (security_invoker = true) as
select a.*, p.nombre as usuario_nombre
from public.auditoria a
left join public.perfiles p on p.id = a.usuario_id;

-- ----- Ciclos lleno-a-lleno (sección 8.6) --------------------------------
-- km = diferencia de lectura entre dos cargas llenas consecutivas;
-- litros = cargas del tramo (parciales + la llena que lo cierra).
-- Un ciclo con una carga marcada "carga anterior omitida" no es válido.
create view public.v_ciclos_combustible with (security_invoker = true) as
with ev as (
  select u.id as unidad_id, u.lectura_inicial as lectura, u.fecha_alta::timestamptz as fecha,
         0::numeric as litros, (u.combustible_inicial_l = u.capacidad_tanque_l) as lleno,
         false as omitida, 0 as orden
    from public.unidades u
   where u.medidor <> 'ninguno'
  union all
  select r.unidad_id, r.lectura_medidor, r.fecha, r.litros, r.tanque_lleno, r.carga_previa_omitida, 1
    from public.repostajes r
    join public.unidades u on u.id = r.unidad_id
   where not r.anulado and r.lectura_medidor is not null and u.medidor <> 'ninguno'
),
num as (
  select ev.*,
         coalesce(sum(case when ev.lleno then 1 else 0 end) over (
           partition by ev.unidad_id order by ev.lectura, ev.fecha, ev.orden
           rows between unbounded preceding and 1 preceding), 0) as grupo,
         sum(case when ev.lleno then 1 else 0 end) over (
           partition by ev.unidad_id order by ev.lectura, ev.fecha, ev.orden
           rows between unbounded preceding and current row) as n_lleno
  from ev
),
inicio as (
  select unidad_id, n_lleno as ciclo, lectura as lectura_inicio, fecha as fecha_inicio
  from num where lleno
),
cuerpo as (
  select unidad_id, grupo as ciclo, sum(litros) as litros, bool_or(omitida) as omitida, count(*)::int as cargas,
         max(lectura) filter (where lleno) as lectura_fin, max(fecha) filter (where lleno) as fecha_fin,
         bool_or(lleno) as cerrado
  from num where grupo >= 1
  group by unidad_id, grupo
)
select
  c.unidad_id,
  c.ciclo,
  i.lectura_inicio,
  c.lectura_fin,
  i.fecha_inicio,
  c.fecha_fin,
  c.lectura_fin - i.lectura_inicio                                     as distancia,
  c.litros,
  c.cargas,
  case when c.litros > 0 and c.lectura_fin > i.lectura_inicio
       then round((c.lectura_fin - i.lectura_inicio) / c.litros, 2) end as rendimiento,
  case when c.lectura_fin > i.lectura_inicio
       then round(c.litros / (c.lectura_fin - i.lectura_inicio) * 100, 2) end as litros_100,
  date_trunc('month', (c.fecha_fin at time zone 'America/Caracas'))::date as mes,
  c.omitida                                                            as invalido
from cuerpo c
join inicio i on i.unidad_id = c.unidad_id and i.ciclo = c.ciclo
where c.cerrado;

-- ----- Indicadores por unidad y mes --------------------------------------
create view public.v_kpi_unidad_mes with (security_invoker = true) as
with vj as (
  select v.unidad_id,
         date_trunc('month', (v.llegada_at at time zone 'America/Caracas'))::date as mes,
         count(*)::int                                                              as viajes,
         sum(v.km_recorridos)                                                       as km_total,
         sum(v.km_recorridos)         filter (where v.calidad in ('exacto', 'estimado')) as km,
         sum(v.litros_consumidos)     filter (where v.calidad in ('exacto', 'estimado')) as litros,
         sum(v.costo_combustible_usd) filter (where v.calidad in ('exacto', 'estimado')) as costo_viajes,
         sum(v.km_recorridos)         filter (where v.calidad = 'exacto')               as km_exacto,
         sum(v.litros_consumidos)     filter (where v.calidad = 'exacto')               as litros_exacto,
         sum(v.costo_combustible_usd) filter (where v.calidad = 'exacto')               as costo_exacto
  from public.viajes v
  where v.estado = 'cerrado'
  group by 1, 2
),
rp as (
  select r.unidad_id,
         date_trunc('month', ((case when v.estado = 'cerrado' then v.llegada_at else r.fecha end)
                              at time zone 'America/Caracas'))::date as mes,
         count(*)::int     as cargas,
         sum(r.litros)     as litros_cargados,
         sum(r.monto_usd)  as gasto_comb
  from public.repostajes r
  left join public.viajes v on v.id = r.viaje_id
  where not r.anulado
  group by 1, 2
),
mt as (
  select m.unidad_id, date_trunc('month', m.fecha)::date as mes, sum(m.monto_usd) as gasto_mant
  from public.mantenimientos m
  where not m.anulado and m.estado_aprobacion = 'aprobado'
  group by 1, 2
),
llaves as (
  select unidad_id, mes from vj union select unidad_id, mes from rp union select unidad_id, mes from mt
)
select
  k.unidad_id,
  u.tipo,
  public.nombre_unidad(k.unidad_id)                                     as unidad_nombre,
  k.mes,
  coalesce(vj.viajes, 0)                                                as viajes,
  coalesce(vj.km_total, 0)                                              as km_total,
  coalesce(vj.km, 0)                                                    as km,
  coalesce(vj.litros, 0)                                                as litros,
  coalesce(vj.costo_viajes, 0)                                          as costo_viajes,
  case when vj.litros > 0 then round(vj.km / vj.litros, 2) end          as rendimiento,
  case when vj.km > 0 then round(vj.litros / vj.km * 100, 2) end        as litros_100km,
  case when vj.km > 0 then round(vj.costo_viajes / vj.km, 4) end        as costo_km_comb,
  coalesce(vj.km_exacto, 0)                                             as km_exacto,
  coalesce(vj.litros_exacto, 0)                                         as litros_exacto,
  coalesce(vj.costo_exacto, 0)                                          as costo_exacto,
  coalesce(rp.cargas, 0)                                                as cargas,
  coalesce(rp.litros_cargados, 0)                                       as litros_cargados,
  coalesce(rp.gasto_comb, 0)                                            as gasto_comb,
  coalesce(mt.gasto_mant, 0)                                            as gasto_mant,
  coalesce(rp.gasto_comb, 0) + coalesce(mt.gasto_mant, 0)               as gasto_total,
  case when vj.km_total > 0
       then round((coalesce(rp.gasto_comb, 0) + coalesce(mt.gasto_mant, 0)) / vj.km_total, 4) end as costo_km_total
from llaves k
join public.unidades u on u.id = k.unidad_id
left join vj on vj.unidad_id = k.unidad_id and vj.mes = k.mes
left join rp on rp.unidad_id = k.unidad_id and rp.mes = k.mes
left join mt on mt.unidad_id = k.unidad_id and mt.mes = k.mes;

create view public.v_kpi_flota_mes with (security_invoker = true) as
select
  mes,
  sum(viajes)::int                                                            as viajes,
  sum(km_total)                                                               as km_total,
  sum(km)                                                                     as km,
  sum(litros)                                                                 as litros,
  sum(costo_viajes)                                                           as costo_viajes,
  case when sum(litros) > 0 then round(sum(km) / sum(litros), 2) end          as rendimiento,
  case when sum(km) > 0 then round(sum(litros) / sum(km) * 100, 2) end        as litros_100km,
  case when sum(km) > 0 then round(sum(costo_viajes) / sum(km), 4) end        as costo_km_comb,
  sum(gasto_comb)                                                             as gasto_comb,
  coalesce(sum(gasto_comb) filter (where tipo = 'camion'), 0)                 as gasto_comb_camiones,
  coalesce(sum(gasto_comb) filter (where tipo = 'planta'), 0)                 as gasto_comb_plantas,
  coalesce(sum(litros_cargados) filter (where tipo = 'planta'), 0)            as litros_plantas,
  sum(gasto_mant)                                                             as gasto_mant,
  sum(gasto_total)                                                            as gasto_total,
  case when sum(km_total) > 0
       then round(coalesce(sum(gasto_total) filter (where tipo = 'camion'), 0) / sum(km_total), 4) end as costo_km_total
from public.v_kpi_unidad_mes
group by mes;

create view public.v_mant_categoria_mes with (security_invoker = true) as
select m.unidad_id, u.tipo, m.categoria_id, c.nombre as categoria, date_trunc('month', m.fecha)::date as mes,
       count(*)::int as gastos, sum(m.monto_usd) as monto_usd
from public.mantenimientos m
join public.unidades u on u.id = m.unidad_id
join public.categorias_mantenimiento c on c.id = m.categoria_id
where not m.anulado and m.estado_aprobacion = 'aprobado'
group by m.unidad_id, u.tipo, m.categoria_id, c.nombre, date_trunc('month', m.fecha);

-- ----- Alertas (sección 10.3) --------------------------------------------
create view public.v_alertas with (security_invoker = true) as
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
                          when 'novedad_chofer' then 'el chofer dejó una novedad'
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
) t (tipo, severidad, unidad_id, viaje_id, registro_id, fecha, mensaje);

-- ----- Consultas con filtros de período ----------------------------------
create function public.resumen_unidades(
  p_desde        date,
  p_hasta        date,
  p_unidad       uuid default null,
  p_chofer       uuid default null,
  p_destino      uuid default null,
  p_solo_exactos boolean default false
) returns table (
  unidad_id           uuid,
  tipo                public.tipo_unidad,
  nombre              text,
  placa               text,
  alias               text,
  estado              public.estado_unidad,
  viajes              int,
  km_total            numeric,
  km                  numeric,
  litros              numeric,
  costo_viajes        numeric,
  rendimiento         numeric,
  litros_100km        numeric,
  costo_km_comb       numeric,
  cargas              int,
  litros_cargados     numeric,
  gasto_comb          numeric,
  gasto_mant          numeric,
  gasto_total         numeric,
  costo_km_total      numeric,
  viajes_incompletos  int
)
language sql stable set search_path = '' as $$
  with u as (
    select * from public.unidades x where p_unidad is null or x.id = p_unidad
  ),
  vj as (
    select v.*,
           case when p_solo_exactos then v.calidad = 'exacto' else v.calidad in ('exacto', 'estimado') end as ok
    from public.viajes v
    where v.estado = 'cerrado'
      and (v.llegada_at at time zone 'America/Caracas')::date between p_desde and p_hasta
      and (p_chofer is null or v.chofer_id = p_chofer)
      and (p_destino is null or exists (select 1 from public.viaje_paradas vp
                                         where vp.viaje_id = v.id and vp.ubicacion_id = p_destino))
  ),
  tv as (
    select vj.unidad_id,
           count(*)::int                                          as viajes,
           sum(vj.km_recorridos)                                  as km_total,
           sum(vj.km_recorridos) filter (where vj.ok)             as km,
           sum(vj.litros_consumidos) filter (where vj.ok)         as litros,
           sum(vj.costo_combustible_usd) filter (where vj.ok)     as costo,
           count(*) filter (where vj.calidad = 'incompleto')::int as incompletos
    from vj group by vj.unidad_id
  ),
  rp as (
    select r.unidad_id, count(*)::int as cargas, sum(r.litros) as litros_cargados, sum(r.monto_usd) as gasto
    from public.repostajes r
    left join public.viajes v on v.id = r.viaje_id
    where not r.anulado
      and ((case when v.estado = 'cerrado' then v.llegada_at else r.fecha end) at time zone 'America/Caracas')::date
          between p_desde and p_hasta
      and (p_chofer is null or r.chofer_id = p_chofer or v.chofer_id = p_chofer)
      and (p_destino is null or exists (select 1 from public.viaje_paradas vp
                                         where vp.viaje_id = r.viaje_id and vp.ubicacion_id = p_destino))
    group by r.unidad_id
  ),
  mt as (
    select m.unidad_id, sum(m.monto_usd) as gasto
    from public.mantenimientos m
    where not m.anulado and m.estado_aprobacion = 'aprobado'
      and m.fecha between p_desde and p_hasta
      and p_chofer is null and p_destino is null
    group by m.unidad_id
  )
  select
    u.id, u.tipo, public.nombre_unidad(u.id), u.placa, u.alias, u.estado,
    coalesce(tv.viajes, 0),
    coalesce(tv.km_total, 0),
    coalesce(tv.km, 0),
    coalesce(tv.litros, 0),
    coalesce(tv.costo, 0),
    case when tv.litros > 0 then round(tv.km / tv.litros, 2) end,
    case when tv.km > 0 then round(tv.litros / tv.km * 100, 2) end,
    case when tv.km > 0 then round(tv.costo / tv.km, 4) end,
    coalesce(rp.cargas, 0),
    coalesce(rp.litros_cargados, 0),
    coalesce(rp.gasto, 0),
    case when p_chofer is null and p_destino is null then coalesce(mt.gasto, 0) end,
    coalesce(rp.gasto, 0) + coalesce(mt.gasto, 0),
    case when tv.km_total > 0 then round((coalesce(rp.gasto, 0) + coalesce(mt.gasto, 0)) / tv.km_total, 4) end,
    coalesce(tv.incompletos, 0)
  from u
  left join tv on tv.unidad_id = u.id
  left join rp on rp.unidad_id = u.id
  left join mt on mt.unidad_id = u.id
  order by u.tipo, public.nombre_unidad(u.id)
$$;

-- KPIs de la flota para un período: suma ponderada del resumen por unidad
create function public.kpis_periodo(
  p_desde        date,
  p_hasta        date,
  p_unidad       uuid default null,
  p_chofer       uuid default null,
  p_destino      uuid default null,
  p_solo_exactos boolean default false
) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'viajes',              coalesce(sum(r.viajes), 0),
    'km_total',            coalesce(sum(r.km_total) filter (where r.tipo = 'camion'), 0),
    'km',                  coalesce(sum(r.km), 0),
    'litros',              coalesce(sum(r.litros), 0),
    'costo_viajes',        coalesce(sum(r.costo_viajes), 0),
    'rendimiento',         case when sum(r.litros) > 0 then round(sum(r.km) / sum(r.litros), 2) end,
    'litros_100km',        case when sum(r.km) > 0 then round(sum(r.litros) / sum(r.km) * 100, 2) end,
    'costo_km_comb',       case when sum(r.km) > 0 then round(sum(r.costo_viajes) / sum(r.km), 4) end,
    'gasto_comb',          coalesce(sum(r.gasto_comb), 0),
    'gasto_comb_camiones', coalesce(sum(r.gasto_comb) filter (where r.tipo = 'camion'), 0),
    'gasto_comb_plantas',  coalesce(sum(r.gasto_comb) filter (where r.tipo = 'planta'), 0),
    'litros_plantas',      coalesce(sum(r.litros_cargados) filter (where r.tipo = 'planta'), 0),
    'gasto_mant',          case when p_chofer is null and p_destino is null then coalesce(sum(r.gasto_mant), 0) end,
    'gasto_total',         coalesce(sum(r.gasto_total), 0),
    'costo_km_total',      case when sum(r.km_total) filter (where r.tipo = 'camion') > 0
                                then round(coalesce(sum(r.gasto_total) filter (where r.tipo = 'camion'), 0)
                                           / sum(r.km_total) filter (where r.tipo = 'camion'), 4) end,
    'viajes_incompletos',  coalesce(sum(r.viajes_incompletos), 0)
  )
  from public.resumen_unidades(p_desde, p_hasta, p_unidad, p_chofer, p_destino, p_solo_exactos) r
$$;

-- Costo por destino principal (gráfico 5)
create function public.costo_por_destino(
  p_desde        date,
  p_hasta        date,
  p_unidad       uuid default null,
  p_chofer       uuid default null,
  p_solo_exactos boolean default false
) returns table (
  destino_id   uuid,
  destino      text,
  viajes       int,
  km_prom      numeric,
  litros_prom  numeric,
  costo_prom   numeric,
  rendimiento  numeric,
  costo_total  numeric,
  costo_km     numeric
)
language sql stable set search_path = '' as $$
  with vj as (
    select v.*,
           case when p_solo_exactos then v.calidad = 'exacto' else v.calidad in ('exacto', 'estimado') end as ok
    from public.viajes v
    where v.estado = 'cerrado'
      and (v.llegada_at at time zone 'America/Caracas')::date between p_desde and p_hasta
      and (p_unidad is null or v.unidad_id = p_unidad)
      and (p_chofer is null or v.chofer_id = p_chofer)
  )
  select vj.destino_id, l.nombre,
         count(*)::int,
         round(avg(vj.km_recorridos), 1),
         round(avg(vj.litros_consumidos) filter (where vj.ok), 2),
         round(avg(vj.costo_combustible_usd) filter (where vj.ok), 2),
         case when sum(vj.litros_consumidos) filter (where vj.ok) > 0
              then round(sum(vj.km_recorridos) filter (where vj.ok) / sum(vj.litros_consumidos) filter (where vj.ok), 2) end,
         coalesce(sum(vj.costo_combustible_usd) filter (where vj.ok), 0),
         case when sum(vj.km_recorridos) filter (where vj.ok) > 0
              then round(sum(vj.costo_combustible_usd) filter (where vj.ok) / sum(vj.km_recorridos) filter (where vj.ok), 4) end
  from vj join public.ubicaciones l on l.id = vj.destino_id
  group by vj.destino_id, l.nombre
  order by 8 desc
$$;

-- Costo por ruta (secuencia de paradas)
create function public.costo_por_ruta(
  p_desde        date,
  p_hasta        date,
  p_unidad       uuid default null,
  p_chofer       uuid default null,
  p_solo_exactos boolean default false
) returns table (
  ruta         text,
  paradas      int,
  viajes       int,
  km_prom      numeric,
  litros_prom  numeric,
  costo_prom   numeric,
  rendimiento  numeric,
  costo_total  numeric
)
language sql stable set search_path = '' as $$
  with vj as (
    select v.*,
           case when p_solo_exactos then v.calidad = 'exacto' else v.calidad in ('exacto', 'estimado') end as ok,
           (select string_agg(l.nombre, ' – ' order by vp.orden) from public.viaje_paradas vp
              join public.ubicaciones l on l.id = vp.ubicacion_id where vp.viaje_id = v.id) as ruta,
           (select count(*) from public.viaje_paradas vp where vp.viaje_id = v.id)::int as paradas
    from public.viajes v
    where v.estado = 'cerrado'
      and (v.llegada_at at time zone 'America/Caracas')::date between p_desde and p_hasta
      and (p_unidad is null or v.unidad_id = p_unidad)
      and (p_chofer is null or v.chofer_id = p_chofer)
  )
  select vj.ruta, max(vj.paradas), count(*)::int,
         round(avg(vj.km_recorridos), 1),
         round(avg(vj.litros_consumidos) filter (where vj.ok), 2),
         round(avg(vj.costo_combustible_usd) filter (where vj.ok), 2),
         case when sum(vj.litros_consumidos) filter (where vj.ok) > 0
              then round(sum(vj.km_recorridos) filter (where vj.ok) / sum(vj.litros_consumidos) filter (where vj.ok), 2) end,
         coalesce(sum(vj.costo_combustible_usd) filter (where vj.ok), 0)
  from vj
  group by vj.ruta
  order by 8 desc
$$;

-- Datos de la cabina del chofer en una sola llamada
create function public.contexto_cabina() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'viaje_abierto', (select to_jsonb(v) from public.v_viajes v
                       where v.chofer_id = auth.uid() and v.estado = 'en_curso' limit 1),
    'ultima_unidad_id', (select v.unidad_id from public.viajes v
                          where v.chofer_id = auth.uid() and v.estado <> 'anulado'
                          order by v.salida_at desc limit 1),
    'ultimo_viaje', (select to_jsonb(v) from public.v_viajes v
                      where v.chofer_id = auth.uid() and v.estado = 'cerrado'
                      order by v.llegada_at desc limit 1)
  )
$$;

-- Permisos: vistas y consultas solo para usuarios autenticados
revoke all on public.v_unidades, public.v_viajes, public.v_repostajes, public.v_mantenimientos,
              public.v_auditoria, public.v_ciclos_combustible, public.v_kpi_unidad_mes,
              public.v_kpi_flota_mes, public.v_mant_categoria_mes, public.v_alertas from anon, public;
grant select on public.v_unidades, public.v_viajes, public.v_repostajes, public.v_mantenimientos,
                public.v_ciclos_combustible, public.v_kpi_unidad_mes, public.v_kpi_flota_mes,
                public.v_mant_categoria_mes, public.v_alertas to authenticated;
grant select on public.v_auditoria to authenticated;  -- filtrada por la RLS de auditoria

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('resumen_unidades', 'kpis_periodo', 'costo_por_destino', 'costo_por_ruta', 'contexto_cabina')
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated, service_role', f.firma);
  end loop;
end $$;
