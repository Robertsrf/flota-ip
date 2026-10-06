-- =====================================================================
-- Programar la tasa BCV con pg_cron (correr UNA vez en el SQL Editor del
-- proyecto, después de desplegar la función tasa-bcv). No es migración
-- porque lleva datos propios del proyecto.
--
-- 1) Reemplaza <REF> por el ref del proyecto y <SECRETO> por el mismo
--    valor que pusiste en el secret CRON_SECRET de las Edge Functions:
--      supabase secrets set CRON_SECRET=<SECRETO>
-- 2) Ejecuta este archivo.
-- Horario: días hábiles a las 09:30 y 17:30 de Caracas (13:30 y 21:30 UTC).
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select vault.create_secret('https://<REF>.supabase.co', 'flota_project_url');
select vault.create_secret('<SECRETO>', 'flota_cron_secret');

select cron.schedule(
  'flota-tasa-bcv',
  '30 13,21 * * 1-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'flota_project_url') || '/functions/v1/tasa-bcv',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'flota_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- Ver las ejecuciones:   select * from cron.job_run_details order by start_time desc limit 10;
-- Quitar la tarea:        select cron.unschedule('flota-tasa-bcv');
