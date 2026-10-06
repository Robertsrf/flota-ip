-- =====================================================================
-- Primer superusuario (correr UNA vez en el SQL Editor del proyecto)
--
-- Los usuarios se crean desde la app (pantalla Usuarios, función
-- admin-usuarios), pero esa pantalla exige un superusuario. El primero
-- se crea a mano:
--
-- 1) Authentication → Users → Add user → Create new user
--      Email:    <USUARIO>@usuarios.flota-ip.invalid
--      Password: la contraseña de oficina (8 caracteres o más)
--      Marca "Auto Confirm User".
--    El trigger crea su perfil como chofer.
-- 2) Reemplaza <USUARIO> (3 a 32 caracteres: a-z, 0-9, punto, guion) y
--    <NOMBRE> abajo, y ejecuta este archivo. Si usas otro dominio para
--    los usuarios (DOMINIO_USUARIOS), cámbialo también aquí.
-- 3) Entra a la app con <USUARIO> y esa contraseña.
-- =====================================================================

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('rol', 'superusuario'),
       raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                            || jsonb_build_object('nombre', '<NOMBRE>', 'usuario', '<USUARIO>')
 where email = '<USUARIO>@usuarios.flota-ip.invalid';

update public.perfiles
   set rol = 'superusuario', usuario = '<USUARIO>', nombre = '<NOMBRE>', activo = true
 where correo = '<USUARIO>@usuarios.flota-ip.invalid';

-- Debe mostrar una fila con rol superusuario
select id, usuario, nombre, rol, activo from public.perfiles where rol = 'superusuario';
