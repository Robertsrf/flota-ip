-- =====================================================================
-- Flota IP · Seguridad: RLS y privilegios
-- Lectura: todo usuario autenticado y activo ve toda la flota (sección 6).
-- Escritura de datos operativos (viajes, repostajes, gastos): solo por
-- las funciones RPC. Catálogos y unidades: flota y superusuario.
-- anon no ve nada.
-- =====================================================================

alter table public.perfiles                  enable row level security;
alter table public.unidades                  enable row level security;
alter table public.ubicaciones               enable row level security;
alter table public.precios_combustible       enable row level security;
alter table public.categorias_mantenimiento  enable row level security;
alter table public.configuracion             enable row level security;
alter table public.viajes                    enable row level security;
alter table public.viaje_paradas             enable row level security;
alter table public.repostajes                enable row level security;
alter table public.tasas_bcv                 enable row level security;
alter table public.mantenimientos            enable row level security;
alter table public.auditoria                 enable row level security;

-- ----- Privilegios de tabla --------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.unidades, public.ubicaciones, public.precios_combustible,
                        public.categorias_mantenimiento, public.tasas_bcv to authenticated;
grant update on public.configuracion, public.perfiles to authenticated;

-- ----- Lectura ----------------------------------------------------------
-- Un usuario desactivado conserva su sesión hasta que expira; rol_actual()
-- devuelve null para él y así pierde el acceso de inmediato.
create policy perfiles_select on public.perfiles for select to authenticated
  using (public.rol_actual() is not null or id = auth.uid());
create policy unidades_select on public.unidades for select to authenticated
  using (public.rol_actual() is not null);
create policy ubicaciones_select on public.ubicaciones for select to authenticated
  using (public.rol_actual() is not null);
create policy precios_select on public.precios_combustible for select to authenticated
  using (public.rol_actual() is not null);
create policy categorias_select on public.categorias_mantenimiento for select to authenticated
  using (public.rol_actual() is not null);
create policy configuracion_select on public.configuracion for select to authenticated
  using (public.rol_actual() is not null);
create policy viajes_select on public.viajes for select to authenticated
  using (public.rol_actual() is not null);
create policy viaje_paradas_select on public.viaje_paradas for select to authenticated
  using (public.rol_actual() is not null);
create policy repostajes_select on public.repostajes for select to authenticated
  using (public.rol_actual() is not null);
create policy tasas_select on public.tasas_bcv for select to authenticated
  using (public.rol_actual() is not null);
create policy mantenimientos_select on public.mantenimientos for select to authenticated
  using (public.rol_actual() is not null);
create policy auditoria_select on public.auditoria for select to authenticated
  using (public.es_oficina());

-- ----- Escritura directa (catálogos, unidades, tasas) --------------------
create policy unidades_insert on public.unidades for insert to authenticated
  with check (public.es_oficina());
create policy unidades_update on public.unidades for update to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

create policy ubicaciones_insert on public.ubicaciones for insert to authenticated
  with check (public.es_oficina() and not es_sistema);
create policy ubicaciones_update on public.ubicaciones for update to authenticated
  using (public.es_oficina() and not es_sistema) with check (public.es_oficina() and not es_sistema);

create policy precios_insert on public.precios_combustible for insert to authenticated
  with check (public.es_oficina());
create policy precios_update on public.precios_combustible for update to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

create policy categorias_insert on public.categorias_mantenimiento for insert to authenticated
  with check (public.es_oficina());
create policy categorias_update on public.categorias_mantenimiento for update to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

create policy tasas_insert on public.tasas_bcv for insert to authenticated
  with check (public.es_oficina());
create policy tasas_update on public.tasas_bcv for update to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

create policy configuracion_update on public.configuracion for update to authenticated
  using (public.es_superusuario()) with check (public.es_superusuario());

-- Nombre y teléfono los cambia el superusuario; rol y estado, la función
-- admin-usuarios (llave de servicio).
create policy perfiles_update on public.perfiles for update to authenticated
  using (public.es_superusuario()) with check (public.es_superusuario());

-- Un perfil no puede cambiar su propio rol ni activarse por esta vía
create function public.tg_perfil_protegido() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' and (new.rol is distinct from old.rol or new.activo is distinct from old.activo
                                         or new.usuario is distinct from old.usuario) then
    raise exception using errcode = '42501',
      message = 'El rol, el usuario y el estado se cambian desde la pantalla de usuarios.';
  end if;
  return new;
end $$;

create trigger perfiles_protegido before update on public.perfiles
  for each row execute function public.tg_perfil_protegido();
