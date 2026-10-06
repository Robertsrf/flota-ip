# Puesta en marcha

Pasos para pasar de lo construido en local a producción: repo público en GitHub, proyecto Supabase (plan gratuito), GitHub Pages y respaldos. Se hacen una sola vez, en este orden. Tiempo estimado: 1 hora.

## 0. Qué hace falta antes de empezar

| Qué | Quién | Para qué |
|---|---|---|
| Cuenta de GitHub | Roberts | Repo público `flota-ip` y GitHub Pages |
| Cuenta de Supabase | Roberts | Proyecto gratuito |
| Nombre y usuario del superusuario de IP | Roberts | Segundo superusuario (D10) |
| Logo de IP (SVG, ideal con versión blanca) | Roberts | Reemplaza los íconos provisionales (`npm run icons`) |
| Sede y destinos reales | Roberts | Los carga él desde Catálogos (D8) |
| `age` instalado (`winget install FiloSottile.age`) | Roberts | Llave de los respaldos cifrados |

**Reglas que no cambian:** la llave secreta de Supabase (`service_role` o `sb_secret_…`) nunca va al repo, a `.env` del frontend ni a los secrets de GitHub; solo existe dentro de Supabase. Nunca se suben `.env`, dumps ni fotos reales.

## 1. Repositorio en GitHub

1. Crear el repo **público** `flota-ip` sin README ni licencia (ya existen en local).
2. Subir:
   ```
   git remote add origin https://github.com/<usuario>/flota-ip.git
   git push -u origin main
   ```
3. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
4. El primer push dispara `CI` (tipos, lint, pruebas, e2e) y `Desplegar en GitHub Pages`. Hasta cargar los secrets del paso 5, el despliegue falla o publica una app que dice "Falta configurar la conexión con Supabase": es normal; se vuelve a correr en el paso 6.

## 2. Proyecto Supabase

1. New project → nombre `flota-ip`, región **East US (North Virginia)** (la de menor latencia desde Venezuela), plan Free. Guardar la contraseña de la base en un gestor de contraseñas.
2. Anotar del panel:
   - **Project ref** (Settings → General).
   - **Project URL** y **llave pública** (`anon` o `sb_publishable_…`) en Settings → API Keys.
   - **Cadena de conexión del Session pooler** (botón Connect → Session pooler, IPv4): `postgresql://postgres.<ref>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres`.
3. Token personal: supabase.com → Account → Access Tokens → Generate (`SUPABASE_ACCESS_TOKEN`).

## 3. Base de datos y funciones

Desde la carpeta del proyecto (la CLI ya viene en `devDependencies`):

```
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push            # aplica las 7 migraciones; el seed demo NO se sube
npx supabase functions deploy admin-usuarios
npx supabase functions deploy tasa-bcv --no-verify-jwt
npx supabase secrets set CRON_SECRET=<cadena aleatoria de 32+ caracteres>
```

- Si el proyecto solo tiene las llaves nuevas (sin `service_role`), agregar también `npx supabase secrets set SUPABASE_SECRET_KEY=<sb_secret_…>`.
- Si se usa otro dominio para los usuarios (ver paso 4), `npx supabase secrets set DOMINIO_USUARIOS=<dominio>`.
- Alternativa sin la CLI local: cargar los secrets del paso 5 y correr a mano el flujo **Aplicar migraciones y funciones en Supabase** (Actions → Run workflow). El `CRON_SECRET` se carga igual en el panel: Edge Functions → Secrets.

Después, en el **SQL Editor**:
1. Abrir `supabase/sql/cron_tasa_bcv.sql`, reemplazar `<REF>` y `<SECRETO>` (el mismo `CRON_SECRET`) y ejecutarlo. Programa la tasa BCV de lunes a viernes a las 09:30 y 17:30 de Caracas.

## 4. Auth y primer superusuario

1. Authentication → Sign In / Providers:
   - **Desactivar** "Allow new users to sign up" (los usuarios los crea flota o el superusuario desde la app).
   - Largo mínimo de contraseña: **6**, sin exigir letras ni símbolos (los choferes usan PIN de 6 dígitos).
2. Authentication → URL Configuration → Site URL: `https://<usuario>.github.io/flota-ip/`.
3. Authentication → Users → Add user → Create new user:
   - Email `<usuario>@usuarios.flota-ip.invalid` (por ejemplo `roberts@usuarios.flota-ip.invalid`), contraseña de 8 caracteres o más, **Auto Confirm User**.
4. SQL Editor: abrir `supabase/sql/primer_superusuario.sql`, reemplazar `<USUARIO>` y `<NOMBRE>`, ejecutar. Debe mostrar una fila con rol `superusuario`.

**Dominio de usuarios.** Es un correo sintético que nunca recibe nada: la app no envía correos (el PIN lo restablece flota). Supabase solo valida el dominio en las operaciones que envían correo, así que `.invalid` debería aceptarse. Si el panel lo rechaza, usar un subdominio propio sin correo configurado (por ejemplo `usuarios.<dominio-de-emory>`) en los tres lugares: la variable `VITE_DOMINIO_USUARIOS` de GitHub, el secret `DOMINIO_USUARIOS` de las funciones y el correo del paso 3.

## 5. Secrets de GitHub

Settings → Secrets and variables → Actions → New repository secret (o con `gh secret set <NOMBRE>`):

| Secret | Valor | Lo usan |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL | despliegue, mantener activo |
| `VITE_SUPABASE_ANON_KEY` | llave **pública** | despliegue, mantener activo |
| `SUPABASE_ACCESS_TOKEN` | token personal | migraciones y funciones (manual) |
| `SUPABASE_DB_PASSWORD` | contraseña de la base | migraciones (manual) |
| `SUPABASE_PROJECT_REF` | project ref | migraciones y funciones (manual) |
| `SUPABASE_DB_URL` | cadena del Session pooler | respaldo semanal |
| `RESPALDO_CLAVE_PUBLICA` | clave pública de age (`age1…`) | respaldo semanal |

Variable opcional (pestaña Variables): `VITE_DOMINIO_USUARIOS`, solo si se cambió el dominio.

**Llave de los respaldos:**
```
age-keygen -o flota-ip-respaldo.txt
```
Imprime la clave pública (`age1…`): esa va al secret. El archivo `flota-ip-respaldo.txt` es la clave privada: se guarda **fuera del repo** (gestor de contraseñas o memoria USB). Sin ella los respaldos no se pueden abrir; con ella, cualquiera puede.

## 6. Primer despliegue y verificación

1. Actions → **Desplegar en GitHub Pages** → Run workflow. La app queda en `https://<usuario>.github.io/flota-ip/`.
2. Lista de comprobación (en este orden):
   - [ ] Entrar con el superusuario.
   - [ ] Catálogos: cargar la sede (tipo sede) y los destinos; revisar precios ($0,50 y $0,60) y categorías.
   - [ ] Catálogos → Tasa BCV: "Consultar BCV ahora" trae la tasa del día.
   - [ ] Camiones y plantas: dar de alta un camión real y las 2 plantas (sin medidor).
   - [ ] Usuarios: crear el superusuario de IP, un usuario de flota y un chofer con PIN.
   - [ ] En un teléfono: entrar como chofer, instalar la app (Agregar a pantalla de inicio), iniciar una ruta, poner el teléfono en modo avión, finalizarla con repostaje y comprobar que se envía al volver la señal.
   - [ ] En el dashboard: ver la ruta en "Ahora mismo" mientras está abierta y su costo al cerrarla.
   - [ ] Anular la ruta de prueba con motivo (queda en la auditoría, no se borra).
   - [ ] Actions → **Respaldo semanal y mantener activo** → Run workflow con "Hacer el respaldo ahora"; descargar el artefacto y abrirlo:
     `age -d -i flota-ip-respaldo.txt flota-ip-<fecha>.dump.age > respaldo.dump` y `pg_restore --list respaldo.dump`.
3. Opcional: regenerar los tipos desde el proyecto real con `SUPABASE_PROJECT_REF=<ref> npm run gen:types:remote` y comprobar que no cambian.

## 7. Operación

- **Cambios de base:** cada cambio es una migración nueva (las aplicadas no se editan). Revisar el CI y correr a mano **Aplicar migraciones y funciones en Supabase**. Nada se aplica a producción automáticamente.
- **Plan gratuito:** el proyecto se pausa tras 7 días sin peticiones; el flujo de respaldo hace una consulta cada 3 días. GitHub desactiva los flujos programados de un repo público tras 60 días sin commits: si no hay cambios en dos meses, reactivarlos en Actions.
- **Respaldos:** cada domingo, cifrados, 90 días en Actions. Restaurar en un proyecto nuevo: `pg_restore --no-owner --dbname "<cadena>" respaldo.dump`.
- **Datos demo:** nunca llegan a producción (`db push` no sube el seed). Si alguna vez se cargaron, `supabase/sql/limpiar_demo.sql` los quita.
- **Límites del plan gratuito:** 500 MB de base, 1 GB de Storage (fotos comprimidas a ~200 KB: unas 5.000), 5 GB de transferencia al mes.
