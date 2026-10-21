# Migración a un VPS con dominio propio

Plan para cuando Flota IP pase, junto con los otros sistemas, de GitHub Pages + Supabase en la nube a un servidor propio (VPS) con su dominio. Se hace en dos etapas independientes: primero la app (riesgo casi nulo) y, solo si hace falta, después la base. Escrito el 20/10/2026 con la documentación vigente de Supabase; revisarla otra vez antes de empezar.

## Qué cambia y qué no

| | GitHub Pages + Supabase nube (hoy) | Etapa 1: app en el VPS | Etapa 2: todo en el VPS |
|---|---|---|---|
| Dónde se sirve la app | `https://<usuario>.github.io/flota-ip/` | `https://flota.<dominio>` | igual que la etapa 1 |
| Base, usuarios, fotos, funciones | Supabase nube (plan gratuito) | Supabase nube | Supabase autoalojado en Docker |
| Cabeceras de seguridad | solo la CSP en `<meta>` | cabeceras completas (HSTS, `frame-ancestors`) | igual |
| Se pausa a los 7 días sin uso | sí | sí | no |
| Respaldos | `respaldo.yml` (semanal, cifrado) | igual | `pg_dump` cifrado en el VPS + copia fuera del VPS |

El código no cambia: la app ya lee la dirección de Supabase y la ruta base de variables (`VITE_SUPABASE_URL`, `VITE_BASE`), y la CSP se arma sola con esa dirección al compilar.

## Antes de mover nada (las dos etapas)

1. **Cola sin enviar.** Cada teléfono guarda lo que registra sin señal en su navegador, y ese almacenamiento es por dominio: lo que quede pendiente en `github.io` no pasa al dominio nuevo. Antes del cambio, cada chofer abre la app con señal y confirma que no dice "Pendiente de envío".
2. **Avisar a los choferes** que van a reinstalar la app desde el dominio nuevo y a entrar otra vez con su usuario y PIN (no cambian).
3. **Respaldo fresco:** correr a mano el flujo "Respaldo semanal y mantener activo" y probar que abre (ver `PUESTA_EN_MARCHA.md`, paso 6).
4. Anotar en `CHANGELOG.md` la migración como una versión propia.

## Etapa 1 · La app en el VPS (Supabase sigue en la nube)

1. **DNS:** un registro `A` (y `AAAA` si hay IPv6) de `flota.<dominio>` a la IP del VPS.
2. **Compilar** con la ruta base en la raíz:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<llave pública>
   VITE_BASE=/
   npm ci && npm run build      # deja todo en dist/
   ```
   Se puede compilar en GitHub Actions y copiar `dist/` al VPS por SSH (secrets `VPS_HOST`, `VPS_USUARIO` y una llave SSH de solo despliegue), o compilar en el propio VPS con `git pull`.
3. **Servidor web.** Caddy saca y renueva solo el certificado HTTPS. Ejemplo para `/etc/caddy/Caddyfile`:
   ```
   flota.<dominio> {
     root * /srv/flota-ip
     encode zstd gzip
     header {
       Strict-Transport-Security "max-age=31536000; includeSubDomains"
       X-Content-Type-Options "nosniff"
       X-Frame-Options "DENY"
       Referrer-Policy "strict-origin-when-cross-origin"
       Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=(), usb=()"
       # La CSP principal va en el <meta> del index.html; aquí solo lo que un <meta> no puede decir
       Content-Security-Policy "frame-ancestors 'none'"
       -Server
     }
     @inmutables path /assets/*
     header @inmutables Cache-Control "public, max-age=31536000, immutable"
     @siempreNuevos path /index.html /sw.js /registerSW.js /manifest.webmanifest
     header @siempreNuevos Cache-Control "no-cache"
     try_files {path} /index.html
     file_server
   }
   ```
   Con Nginx es lo mismo: `add_header` para cada cabecera, `try_files $uri /index.html;` y el certificado con certbot.
4. **Supabase:**
   - Authentication → URL Configuration → Site URL: `https://flota.<dominio>`.
   - Funciones: `npx supabase secrets set ORIGENES_APP=https://flota.<dominio>` (y el de GitHub Pages, separado por coma, mientras convivan).
5. **Probar** en el dominio nuevo la lista del paso 6 de `PUESTA_EN_MARCHA.md` (entrar, ruta con modo avión, dashboard) y revisar en la consola del navegador que no haya avisos de *Content Security Policy*. Comprobar las cabeceras en https://securityheaders.com.
6. **Cerrar GitHub Pages:** cuando todos usen el dominio nuevo, cambiar `deploy.yml` para que despliegue al VPS (o desactivarlo) y publicar en Pages una sola página que diga a dónde se mudó la app. El repo puede seguir público o pasar a privado (ya no hace falta GitHub Pro).

## Etapa 2 · Supabase autoalojado (opcional)

Conviene cuando el plan gratuito queda corto (500 MB de base, 1 GB de fotos, pausa a los 7 días) o para tener todo junto. A cambio, el mantenimiento, las actualizaciones y los respaldos pasan a ser trabajo propio.

**Requisitos del VPS** (documentación de Supabase): mínimo 4 GB de RAM, 2 núcleos y 40 GB de disco SSD; recomendado 8 GB, 4 núcleos y 80 GB. Docker y Docker Compose. La pila incluye Studio, el gateway de la API, Auth, PostgREST, Realtime, Storage, imgproxy, postgres-meta, Postgres, Edge Runtime (funciones) y Supavisor.

1. **Instalar** siguiendo la guía oficial (`supabase.com/docs/guides/self-hosting/docker`): generar todas las llaves y secretos con su script **antes** del primer `docker compose up`, y poner `SITE_URL=https://flota.<dominio>`, `API_EXTERNAL_URL` y `SUPABASE_PUBLIC_URL=https://api.<dominio>`. Usar la misma versión mayor de Postgres que el proyecto en la nube.
2. **Proxy HTTPS** para la API en Caddy:
   ```
   api.<dominio> {
     reverse_proxy localhost:8000
   }
   ```
   No exponer a internet el puerto 5432 ni Studio; entrar a Studio por un túnel SSH.
3. **Copiar la base** (guía oficial "Restore a Platform Project to Self-Hosted"):
   ```
   supabase db dump --db-url "<cadena de la nube>" -f roles.sql --role-only
   supabase db dump --db-url "<cadena de la nube>" -f schema.sql
   supabase db dump --db-url "<cadena de la nube>" -f data.sql --use-copy --data-only
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file roles.sql --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql --dbname "<cadena del VPS>"
   ```
   Probar primero en una instancia de prueba. Los usuarios y sus claves (`auth.users`) vienen en el volcado: los choferes conservan su PIN, pero todas las sesiones se cierran porque cambian las llaves.
4. **Lo que el volcado no trae:**
   - **Fotos** de los buckets `unidades`, `comprobantes` y `documentos`: copiarlas aparte (por la API S3 de Storage con una herramienta como rclone, o con un script que baje y suba cada archivo) y comparar el conteo de archivos.
   - **Funciones** `admin-usuarios` y `tasa-bcv`: copiar `supabase/functions/*` a `volumes/functions/` y cargar sus secretos (`CRON_SECRET`, `DOMINIO_USUARIOS`, `ORIGENES_APP`).
   - **Tasa BCV programada:** confirmar que `pg_cron` y `pg_net` existen (`select * from pg_extension;`) y volver a correr `supabase/sql/cron_tasa_bcv.sql` con la dirección nueva.
5. **Verificar** con conteos en los dos lados (`viajes`, `repostajes`, `mantenimientos`, `auth.users`, archivos) y correr la lista del paso 6 de `PUESTA_EN_MARCHA.md`.
6. **Cambiar la app** a la API nueva: compilar con `VITE_SUPABASE_URL=https://api.<dominio>` y la llave pública nueva. La CSP se actualiza sola.
7. **Respaldos:** `respaldo.yml` sirve igual cambiando el secret `SUPABASE_DB_URL` (si el puerto se abre solo a la IP de GitHub no es práctico; mejor un `pg_dump` cifrado con age por cron en el VPS, copiado fuera del VPS). Probar una restauración completa al menos una vez por trimestre. La consulta "para que no se pause" ya no hace falta.
8. Dejar el proyecto de la nube en pausa (no borrarlo) durante un mes como respaldo.
