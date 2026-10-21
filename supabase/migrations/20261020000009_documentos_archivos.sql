-- =====================================================================
-- Flota IP · Archivos de documentos en su propio bucket (versión 0.6.1)
--
-- La foto o el PDF de un documento (licencia, certificado médico) no
-- puede vivir en "comprobantes", que lee y lista cualquier usuario
-- activo: otro chofer vería el certificado médico de un compañero.
-- El bucket "documentos" guarda cada archivo en <documento_id>/<archivo>
-- y solo deja leerlo a la oficina o a quien puede ver ese documento
-- (la política consulta public.documentos con su propia RLS).
-- =====================================================================

-- La ruta del archivo tiene que ser de este documento: nadie puede
-- apuntar un documento al archivo de otro.
alter table public.documentos
  add constraint documentos_archivo_ck
  check (archivo_path is null or archivo_path ~ ('^' || id::text || '/[A-Za-z0-9._-]{1,80}$'));

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'storage' and c.relname = 'buckets') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('documentos', 'documentos', false, 5242880,
            array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;

    -- La oficina lo ve todo (también al subir, antes de que exista la fila);
    -- los demás, solo los archivos de documentos que la RLS les deja ver
    execute $p$
      create policy "documentos: leer quien ve el documento" on storage.objects for select to authenticated
      using (bucket_id = 'documentos'
             and (public.es_oficina()
                  or exists (select 1 from public.documentos d
                              where d.id::text = (storage.foldername(name))[1])))
    $p$;
    execute $p$
      create policy "documentos: subir oficina" on storage.objects for insert to authenticated
      with check (bucket_id = 'documentos' and public.es_oficina())
    $p$;
    execute $p$
      create policy "documentos: reemplazar oficina" on storage.objects for update to authenticated
      using (bucket_id = 'documentos' and public.es_oficina())
      with check (bucket_id = 'documentos' and public.es_oficina())
    $p$;
  end if;
end $$;
