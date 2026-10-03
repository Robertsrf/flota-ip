-- =====================================================================
-- Imitación mínima de lo que Supabase trae de fábrica, para correr las
-- migraciones reales en PGlite (pruebas y servidor local sin Docker).
-- NO es una migración: nunca se aplica en Supabase.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

-- Privilegios por defecto de Supabase en public (las migraciones los recortan)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                      uuid primary key default gen_random_uuid(),
  instance_id             uuid,
  aud                     text default 'authenticated',
  role                    text default 'authenticated',
  email                   text unique,
  encrypted_password      text,
  email_confirmed_at      timestamptz,
  raw_app_meta_data       jsonb default '{}'::jsonb,
  raw_user_meta_data      jsonb default '{}'::jsonb,
  confirmation_token      text default '',
  recovery_token          text default '',
  email_change_token_new  text default '',
  email_change            text default '',
  banned_until            timestamptz,
  last_sign_in_at         timestamptz,
  is_sso_user             boolean not null default false,
  deleted_at              timestamptz,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create table auth.identities (
  id               uuid primary key default gen_random_uuid(),
  provider_id      text not null,
  user_id          uuid not null references auth.users (id) on delete cascade,
  identity_data    jsonb not null,
  provider         text not null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Igual que en Supabase: el usuario sale de los claims del JWT de la petición
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;

create function auth.role() returns text
language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))
$$;

create function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

create publication supabase_realtime;
