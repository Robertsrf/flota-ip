# Paso a paso: mover Flota IP a otra PC, subirlo a GitHub y conectarlo a Supabase

Guía para hacerlo de corrido, en orden, sin depender de nadie. Tiempo estimado: 1 h 30 min.
El detalle y los "por qué" de cada paso están en [`docs/PUESTA_EN_MARCHA.md`](docs/PUESTA_EN_MARCHA.md).

**Antes de empezar, ten a mano:** tu cuenta de GitHub, tu cuenta de Supabase y un lugar seguro **fuera de esta carpeta** para anotar claves (un gestor de contraseñas o un documento privado).

## Hoja de datos (cópiala a tu lugar seguro y llénala a medida que avanzas)

> No la llenes dentro de este archivo ni de esta carpeta: el repositorio es público.

| Dato | Dónde sale | Valor |
|---|---|---|
| Usuario de GitHub | tu cuenta | |
| Project ref de Supabase | Parte 4, paso 2 | |
| Project URL (`https://<ref>.supabase.co`) | Parte 4, paso 2 | |
| Llave pública (`sb_publishable_…` o `anon`) | Parte 4, paso 2 | |
| Contraseña de la base de datos | Parte 4, paso 1 | |
| Cadena del Session pooler | Parte 4, paso 2 | |
| Access token de Supabase | Parte 4, paso 2 | |
| CRON_SECRET (cadena aleatoria) | Parte 4, paso 4 | |
| Clave pública de age (`age1…`) | Parte 5, paso 1 | |
| Usuario y contraseña del superusuario | Parte 4, paso 7 | |

---

## Parte 1 · En esta PC, antes de mover la carpeta

**1. Une el trabajo a la rama principal.** Abre una terminal (PowerShell o Git Bash) dentro de la carpeta del proyecto:

```
git checkout main
git merge --ff-only version-0.6.0
git log --oneline -1
```

La última línea debe empezar con un código y decir `0.6.1: archivos de documentos en un bucket privado propio` (o un commit posterior).

**2. Empaca el proyecto en un solo archivo** (trae todo el historial y las etiquetas de versión, y nada de lo que se regenera):

```
git bundle create ..\flota-ip.bundle --all
git bundle verify ..\flota-ip.bundle
```

Debe decir `is okay`. Copia el archivo `flota-ip.bundle` (queda en la carpeta de arriba) a una memoria USB o a tu nube y llévalo a la otra PC.

> **Alternativa:** copiar la carpeta completa, **incluida la carpeta oculta `.git`**, pero sin `node_modules`, `dist`, `.local-db`, `.local-db-e2e`, `.local-storage`, `test-results` ni `playwright-report` (se regeneran solos y pesan mucho). Si eliges esto, en la Parte 2 sáltate el `git clone` y entra directo a la carpeta copiada.

---

## Parte 2 · Preparar la otra PC

**1. Instala** (una sola vez):

| Programa | Dónde | Para qué |
|---|---|---|
| Git | https://git-scm.com | Subir a GitHub |
| Node.js **22 LTS** | https://nodejs.org | Instalar y compilar el proyecto |
| age | `winget install FiloSottile.age` | Llave de los respaldos cifrados |
| GitHub CLI (opcional) | `winget install GitHub.cli` | Cargar secrets desde la terminal |

Cierra y abre la terminal, y comprueba:

```
git --version
node --version      # debe decir v22.algo
age --version
```

**2. Dile a Git quién eres** (si es una PC nueva):

```
git config --global user.name "Roberts Flores"
git config --global user.email "<tu correo de GitHub>"
```

**3. Saca el proyecto del paquete** (cambia la ruta por donde dejaste el archivo):

```
git clone -b main C:\ruta\donde\esta\flota-ip.bundle flota-ip
cd flota-ip
git remote remove origin
git tag
```

`git tag` debe listar de `v0.1.0` a `v0.6.1`.

**4. Instala las dependencias y comprueba que todo está sano:**

```
npm ci
npm run typecheck
npm test
```

`npm test` debe terminar con **86 passed**.

**5. (Opcional) Míralo funcionando en esta PC** con los datos de demostración:

```
Copy-Item .env.local.example .env.local
npm run dev:local
```

Abre http://127.0.0.1:5173 y entra con `demo.flota` / `demo1234` (oficina) o `demo.pedro` / `123456` (chofer). Para salir, `Ctrl + C` en la terminal. Estos datos demo nunca llegan a Supabase.

---

## Parte 3 · Subir a GitHub

**1. Crea el repositorio:** en github.com → New repository.
- Nombre: `flota-ip`
- **Public** (sin GitHub Pro, Pages solo funciona con repos públicos)
- **Sin** README, sin .gitignore y sin licencia (ya existen).

**2. Revisa que no se cuele nada privado:**

```
git status
git ls-files | Select-String "\.env"
```

`git status` debe decir que no hay cambios. La segunda línea solo puede mostrar `.env.example` y `.env.local.example`. (En Git Bash: `git ls-files | grep .env`.)

**3. Súbelo con su historial y sus versiones:**

```
git remote add origin https://github.com/<tu-usuario>/flota-ip.git
git push -u origin main
git push origin --tags
```

**4. Activa GitHub Pages:** en el repo → Settings → Pages → Build and deployment → Source: **GitHub Actions**.

**5. Qué esperar:** el push dispara dos flujos en la pestaña Actions.
- **CI** (tipos, lint, pruebas, compilación y recorridos completos): debe quedar en verde.
- **Desplegar en GitHub Pages**: va a fallar o a publicar una página que dice "Falta configurar la conexión con Supabase". Es normal; se arregla en la Parte 6.

---

## Parte 4 · Supabase

**1. Crea el proyecto:** supabase.com → New project.
- Nombre: `flota-ip`
- Región: **East US (North Virginia)** (la más rápida desde Venezuela)
- Plan: Free
- Contraseña de la base: genera una fuerte y anótala en la hoja de datos.

**2. Anota los datos del proyecto:**
- **Project ref:** Settings → General.
- **Project URL** y **llave pública** (`sb_publishable_…` o `anon`): Settings → API Keys.
- **Cadena del Session pooler:** botón **Connect** → Session pooler (IPv4). Se ve así: `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<región>.pooler.supabase.com:5432/postgres`. Reemplaza `[YOUR-PASSWORD]` por la contraseña de la base.
- **Access token:** tu avatar → Account → Access Tokens → Generate new token.

**3. Crea la base y sube las funciones** desde la carpeta del proyecto en la otra PC (la herramienta de Supabase ya viene con el proyecto, no hay que instalarla):

```
npx supabase login
npx supabase link --project-ref <REF>
npx supabase db push
npx supabase functions deploy admin-usuarios
npx supabase functions deploy tasa-bcv --no-verify-jwt
```

- `link` y `db push` piden la contraseña de la base.
- `db push` aplica las **9 migraciones** (tablas, cálculos, permisos, vencimientos). Los datos de demostración **no** se suben.
- Si `functions deploy` pide Docker, repite esos dos comandos agregando `--use-api` al final. Si aun así falla, termina la Parte 5 y corre en GitHub el flujo **Aplicar migraciones y funciones en Supabase** (Actions → ese flujo → Run workflow → `solo-funciones`).

**4. Carga los secretos de las funciones.** Primero genera una cadena aleatoria para el `CRON_SECRET` (en PowerShell):

```
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

Anótala y cárgala, junto con la dirección desde la que se usará la app:

```
npx supabase secrets set CRON_SECRET=<la-cadena-generada>
npx supabase secrets set ORIGENES_APP=https://<tu-usuario>.github.io
```

- `ORIGENES_APP` va **exacto**: en minúsculas, con `https://`, sin `/flota-ip` y sin barra al final.
- Solo si en Settings → API Keys **no** existe la llave `service_role` (pestaña de llaves heredadas o *legacy*), carga también la llave secreta: `npx supabase secrets set SUPABASE_SECRET_KEY=<sb_secret_…>`. Esa llave **nunca** va a GitHub ni al código.

**5. Programa la tasa BCV automática:** en Supabase → SQL Editor → New query. Pega el contenido de `supabase/sql/cron_tasa_bcv.sql`, reemplaza `<REF>` por tu project ref y `<SECRETO>` por el mismo `CRON_SECRET`, y dale Run.

**6. Configura el inicio de sesión:** Authentication.
- Sign In / Providers → Email: **desactiva** "Allow new users to sign up" (los usuarios se crean desde la app).
- Largo mínimo de contraseña: **6** y sin exigir letras ni símbolos (los choferes usan un PIN de 6 dígitos).
- URL Configuration → Site URL: `https://<tu-usuario>.github.io/flota-ip/`

**7. Crea tu superusuario:**
1. Authentication → Users → Add user → Create new user.
   - Email: `<usuario>@usuarios.flota-ip.invalid` (por ejemplo `roberts@usuarios.flota-ip.invalid`). Es un correo inventado: nunca recibe nada.
   - Contraseña: 8 caracteres o más.
   - Marca **Auto Confirm User**.
2. SQL Editor → New query → pega `supabase/sql/primer_superusuario.sql`, reemplaza `<USUARIO>` (por ejemplo `roberts`) y `<NOMBRE>` (por ejemplo `Roberts Flores`) y dale Run. Debe mostrar una fila con rol `superusuario`.

> Si Supabase no acepta el dominio `.invalid`, sigue la nota "Dominio de usuarios" de `docs/PUESTA_EN_MARCHA.md` (paso 4).

---

## Parte 5 · Secrets en GitHub

**1. Crea la llave de los respaldos** (en la otra PC, en una carpeta **fuera** del proyecto):

```
age-keygen -o C:\ruta\segura\flota-ip-respaldo.txt
```

- Muestra en pantalla la **clave pública** (`age1…`): esa va a GitHub.
- El archivo `flota-ip-respaldo.txt` es la **clave privada**: guárdala en tu gestor de contraseñas o en una memoria USB. Sin ella no se pueden abrir los respaldos; con ella, cualquiera puede. Nunca la subas.

**2. Carga los secrets:** repo → Settings → Secrets and variables → Actions → New repository secret. Uno por uno:

| Nombre exacto | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Llave **pública** (nunca la secreta) |
| `SUPABASE_ACCESS_TOKEN` | Access token |
| `SUPABASE_DB_PASSWORD` | Contraseña de la base |
| `SUPABASE_PROJECT_REF` | Project ref |
| `SUPABASE_DB_URL` | Cadena del Session pooler, con la contraseña puesta |
| `RESPALDO_CLAVE_PUBLICA` | Clave pública de age (`age1…`) |

Con GitHub CLI también se puede: `gh auth login` y luego `gh secret set VITE_SUPABASE_URL` (te pide el valor), y así con cada uno.

---

## Parte 6 · Publicar y probar

**1. Publica:** repo → Actions → **Desplegar en GitHub Pages** → Run workflow. Al terminar, la app queda en `https://<tu-usuario>.github.io/flota-ip/`.

**2. Prueba en este orden:**
- [ ] Entra con tu superusuario.
- [ ] Abre la consola del navegador (F12 → Consola): no debe haber avisos de *Content Security Policy*.
- [ ] El dashboard muestra **Primeros pasos**. Síguelos:
  - [ ] Catálogos → Ubicaciones: la **sede** (tipo Sede) y los destinos.
  - [ ] Catálogos → Precios ($0,50 y $0,60) y Categorías: revísalos.
  - [ ] Catálogos → Tasa BCV → "Consultar BCV ahora": trae la tasa del día.
  - [ ] Camiones y plantas: los camiones reales (placa, tanque y km actual) y las 2 plantas (sin medidor).
  - [ ] Usuarios: el superusuario de IP, los usuarios de flota y gerencia, y los choferes con su PIN.
  - [ ] Vencimientos: el cambio de aceite de cada camión, su póliza RCV y la licencia de cada chofer.
- [ ] En un teléfono: entra como chofer, instala la app (Android: menú de Chrome → Instalar app; iPhone: Safari → Compartir → Agregar a inicio), inicia una ruta, pon el teléfono en modo avión, finalízala con un repostaje y quita el modo avión: debe enviarse sola.
- [ ] En el dashboard, la ruta aparece en "Ahora mismo" mientras está abierta y con su costo al cerrarla.
- [ ] Anula esa ruta de prueba con un motivo (no se borra; queda en el historial).
- [ ] Respaldo: Actions → **Respaldo semanal y mantener activo** → Run workflow (con "Hacer el respaldo ahora"). Descarga el archivo que genera y comprueba que abre:
  ```
  age -d -i C:\ruta\segura\flota-ip-respaldo.txt flota-ip-<fecha>.dump.age > respaldo.dump
  ```
  Si tienes PostgreSQL instalado, `pg_restore --list respaldo.dump` lista su contenido.

---

## Parte 7 · Cerrar la versión 1.0.0

Cuando todo lo anterior funcione con datos reales:

1. En `CHANGELOG.md`, cambia `## [Sin publicar]` por `## [1.0.0] - AAAA-MM-DD - Puesta en marcha` (con la fecha de ese día), anota debajo lo que se hizo y agrega arriba un `## [Sin publicar]` vacío.
2. Sube la versión y guarda:
   ```
   npm version 1.0.0 --no-git-tag-version
   npm test
   git add -A
   git commit -m "1.0.0: puesta en marcha"
   git tag -a v1.0.0 -m "1.0.0 - Puesta en marcha"
   git push
   git push origin --tags
   ```
   La app mostrará "Versión 1.0.0" en la barra lateral y en Novedades.

---

## Si algo falla

| Qué ves | Qué revisar |
|---|---|
| CI en rojo | Abre el flujo en Actions y lee el paso que falló; en la PC, `npm test` debe pasar. |
| La app dice "Falta configurar la conexión con Supabase" | Faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`; cárgalos y vuelve a correr el despliegue. |
| La página de GitHub da 404 | Settings → Pages → Source debe ser **GitHub Actions**; espera a que termine el despliegue. |
| No deja entrar | El usuario existe en Authentication → Users con **Auto Confirm**, y corriste `primer_superusuario.sql` con el mismo usuario. |
| Error al crear usuarios desde la app | Están desplegadas las funciones (Edge Functions en Supabase) y `ORIGENES_APP` es exactamente `https://<tu-usuario>.github.io`. |
| La tasa BCV no se actualiza sola | Corriste `cron_tasa_bcv.sql` con el mismo `CRON_SECRET`; mientras tanto, cárgala a mano en Catálogos. |
| Avisos de *Content Security Policy* en la consola | `VITE_SUPABASE_URL` debe ser `https://<ref>.supabase.co`; corrígelo y vuelve a desplegar. |
| Pasaron 2 meses sin cambios | GitHub apaga los flujos programados de repos públicos: reactívalos en Actions (el respaldo y el "mantener activo"). |

**Reglas que no cambian:** la llave secreta de Supabase nunca va a GitHub ni al código; nunca se suben `.env`, respaldos sin cifrar ni fotos reales; todo cambio se anota en `CHANGELOG.md` el mismo día.
