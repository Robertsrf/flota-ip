-- =====================================================================
-- Elimina los datos de DEMOSTRACIÓN antes de la entrega (handoff, F8).
-- Borra: unidades DEMO y todo lo suyo, usuarios demo.*, ubicaciones
-- creadas por el superusuario demo y tasas con fuente 'DEMO'.
-- Es la ÚNICA excepción a "nunca borrar datos operativos": son datos
-- ficticios. Correr en el SQL Editor con un usuario administrador.
-- =====================================================================

begin;

create temp table demo_unidades on commit drop as
  select id from public.unidades where placa like 'DEMO-%' or alias like '%DEMO%';

create temp table demo_usuarios on commit drop as
  select id from auth.users where email like 'demo.%@usuarios.flota-ip.invalid';

delete from public.auditoria a
 where a.registro_id in (select id::text from public.viajes where unidad_id in (select id from demo_unidades))
    or a.registro_id in (select id::text from public.repostajes where unidad_id in (select id from demo_unidades))
    or a.registro_id in (select id::text from public.mantenimientos where unidad_id in (select id from demo_unidades))
    or a.registro_id in (select id::text from demo_unidades)
    or a.registro_id in (select id::text from public.recordatorios_servicio where unidad_id in (select id from demo_unidades))
    or a.registro_id in (select id::text from public.documentos
                          where unidad_id in (select id from demo_unidades) or persona_id in (select id from demo_usuarios))
    or a.usuario_id in (select id from demo_usuarios);

delete from public.recordatorios_servicio where unidad_id in (select id from demo_unidades);
delete from public.documentos
 where unidad_id in (select id from demo_unidades) or persona_id in (select id from demo_usuarios);
delete from public.repostajes where unidad_id in (select id from demo_unidades);
delete from public.mantenimientos where unidad_id in (select id from demo_unidades);
delete from public.viaje_paradas where viaje_id in (select id from public.viajes where unidad_id in (select id from demo_unidades));
delete from public.viajes where unidad_id in (select id from demo_unidades);
delete from public.unidades where id in (select id from demo_unidades);

delete from public.ubicaciones u
 where u.created_by in (select id from demo_usuarios)
   and not exists (select 1 from public.viajes v where v.origen_id = u.id or v.destino_id = u.id)
   and not exists (select 1 from public.viaje_paradas p where p.ubicacion_id = u.id);

delete from public.tasas_bcv where fuente = 'DEMO' or created_by in (select id from demo_usuarios);

delete from auth.users where id in (select id from demo_usuarios);  -- perfiles se borran en cascada

commit;

-- Verificación: todo debe dar 0
select (select count(*) from public.unidades where placa like 'DEMO-%' or alias like '%DEMO%') as unidades_demo,
       (select count(*) from auth.users where email like 'demo.%@usuarios.flota-ip.invalid') as usuarios_demo,
       (select count(*) from public.tasas_bcv where fuente = 'DEMO') as tasas_demo;
