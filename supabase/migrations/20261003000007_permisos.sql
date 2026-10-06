-- =====================================================================
-- Flota IP · Permisos de ejecución de funciones (única lista blanca)
--
-- En Supabase los privilegios por defecto dan EXECUTE a anon y
-- authenticated en toda función nueva del esquema public. Sin esto,
-- cualquier usuario autenticado podría llamar por la API funciones
-- internas como recalcular_viaje (security definer) o modo_sistema.
--
-- Regla: todo cerrado; authenticated ejecuta solo lo que el cliente
-- llama (RPC) y lo que la RLS y las vistas necesitan. anon, nada.
-- Los triggers no necesitan EXECUTE al dispararse.
-- Toda migración futura que cree funciones debe repetir este bloque
-- o agregar sus propios grant: los privilegios por defecto quedan cerrados.
-- =====================================================================

-- Funciones futuras: cerradas desde que se crean
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

do $$
declare
  f record;
  v_cliente constant text[] := array[
    -- Identidad y rol (políticas RLS y Storage)
    'rol_actual', 'es_oficina', 'es_superusuario', 'unidad_permitida_chofer',
    -- Formato (vistas security_invoker)
    'fmt_num', 'folio_txt', 'fecha_txt', 'nombre_unidad', 'hoy_caracas',
    -- Consultas de la cabina y los formularios
    'lectura_actual', 'sugerir_nivel_salida', 'nivel_estimado', 'tasa_para_fecha', 'contexto_cabina',
    -- Escrituras (RPC con validación y auditoría)
    'iniciar_viaje', 'registrar_repostaje', 'finalizar_viaje', 'registrar_mantenimiento', 'revisar_gasto',
    'anular_registro', 'restaurar_registro', 'corregir_registro', 'eliminar_ubicacion', 'marcar_revisado',
    -- Dashboard
    'resumen_unidades', 'kpis_periodo', 'costo_por_destino', 'costo_por_ruta'];
begin
  for f in
    select p.oid::regprocedure as firma, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
    execute format('grant execute on function %s to service_role', f.firma);
    if f.proname = any (v_cliente) then
      execute format('grant execute on function %s to authenticated', f.firma);
    end if;
  end loop;
end $$;
