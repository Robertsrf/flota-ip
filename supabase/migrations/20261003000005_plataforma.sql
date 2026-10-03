-- =====================================================================
-- Flota IP · Storage y Realtime (solo existen en Supabase; en el entorno
-- local de pruebas estos bloques no hacen nada)
-- Rutas de archivos: comprobantes/<uid>/<registro>-<campo>.jpg
--                    unidades/<unidad_id>/foto-<marca>.jpg
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'storage' and c.relname = 'buckets') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('unidades', 'unidades', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
           ('comprobantes', 'comprobantes', false, 5242880,
            array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;

    execute $p$
      create policy "unidades: leer autenticados" on storage.objects for select to authenticated
      using (bucket_id = 'unidades' and public.rol_actual() is not null)
    $p$;
    execute $p$
      create policy "unidades: subir oficina" on storage.objects for insert to authenticated
      with check (bucket_id = 'unidades' and public.es_oficina())
    $p$;
    execute $p$
      create policy "unidades: reemplazar oficina" on storage.objects for update to authenticated
      using (bucket_id = 'unidades' and public.es_oficina())
      with check (bucket_id = 'unidades' and public.es_oficina())
    $p$;

    execute $p$
      create policy "comprobantes: leer autenticados" on storage.objects for select to authenticated
      using (bucket_id = 'comprobantes' and public.rol_actual() is not null)
    $p$;
    execute $p$
      create policy "comprobantes: subir propios" on storage.objects for insert to authenticated
      with check (bucket_id = 'comprobantes'
                  and public.rol_actual() in ('superusuario', 'flota', 'chofer')
                  and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy "comprobantes: reemplazar propios" on storage.objects for update to authenticated
      using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  end if;
end $$;

-- Realtime: el estado "en ruta" se ve al instante para todos
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.viajes, public.unidades;
  end if;
end $$;
