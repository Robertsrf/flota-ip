# Bitácora

## F0 — Investigación y opciones · 03/10/2026 · ✅ aprobada

**Qué se hizo**
- Instalación de las skills de diseño y pruebas que faltaban (impeccable, frontend-design, webapp-testing).
- `PRODUCT.md` con el contexto del producto para las skills de diseño (supuestos marcados).
- Investigación de 11 productos (Fleetio, Simply Fleet, Drivvo, Fuelly, Fuelio, AUTOsist, Whip Around, Fleet Complete, TuFlota, Vecon, SmartReport) y de guías de dashboard y formularios de campo → `docs/INVESTIGACION.md`.
- Verificaciones técnicas: formato real de la API de tasa BCV, límites de Supabase gratuito, GitHub Pages con repo privado, Netlify, Cloudflare Pages, Background Sync en Safari, peso de ECharts.
- `docs/OPCIONES.md`: 2 navegaciones con wireframes, 3 direcciones visuales, 2 variantes del botón En ruta, D1–D10 con recomendación, ajustes M1–M5 al modelo y preguntas abiertas.
- Página visual de opciones `docs/opciones-visuales.html` (paletas, tipografías, pantalla del chofer y del dashboard por dirección, modo oscuro y demo del botón En ruta), verificada con capturas en 360 y 1440 px y con el detector de impeccable.
- Nuevos requisitos recibidos durante la fase (plantas eléctricas y superusuario) incorporados como D9, D10, M1 y M5.

**Qué se decidió:** ver `docs/DECISIONES.md` (tabla del checkpoint y supuestos 001–012).

**Checkpoint:** Roberts respondió todas las opciones el 03/10/2026 (9 tandas de preguntas). Resultado y consecuencias en `docs/DECISIONES.md`. `PRODUCT.md` actualizado.

**Pendiente de Roberts (no bloquea el inicio de la F1):** archivo del logo de IP, nombre de la persona de IP que será superusuario, acceso al proyecto de Supabase y creación del repo público en GitHub.

**Siguiente fase (F1):** repo remoto público en GitHub, Vite + TS + Tailwind, proyecto Supabase enlazado, migraciones con los ajustes aprobados, RLS por rol con pruebas, seed, tipos generados, `CLAUDE.md`, CI.

> Desde aquí Roberts pidió construir todo de corrido y revisar al final: los checkpoints de F1, F4 y F6 se resuelven en la prueba conjunta (supuesto 013). Sin Docker ni proyecto Supabase, todo se desarrolló y probó sobre PGlite con las migraciones reales (supuesto 014).

## F1 — Esquema, motor, RLS y seed · 03/10/2026 · ✅ en local

**Qué se hizo**
- Migraciones: tipos, `unidades` (camiones y plantas), catálogos, viajes con paradas, repostajes, tasas BCV, mantenimientos con aprobación, configuración y auditoría por trigger (solo columnas cambiadas, con motivo).
- Motor `recalcular_viaje` (sección 8) y RPC: iniciar y finalizar ruta, repostar, registrar y revisar gastos, anular, restaurar, corregir con motivo, eliminar o archivar ubicaciones, dar por revisada.
- RLS por rol (superusuario, flota, chofer, consulta); `anon` sin acceso.
- Vistas y RPC del dashboard: KPI ponderados, resumen por unidad, costo por destino y por ruta, ciclos lleno a lleno, alertas.
- Seed demo de 3 meses generado con las RPC reales; generador de tipos desde las migraciones.
- Pruebas: 45 SQL (T1–T14 y RLS por rol) y 14 unitarias.

## F2–F4 — Armazón, sesión, cabina y offline · 03/10/2026 · ✅ en local

**Qué se hizo**
- Servidor local sin Docker (PGlite + REST, Auth, Storage y Functions) para usar la app real.
- Dirección "Señal vial": tokens claro y oscuro, Overpass, el pórtico.
- Sesión con usuario + PIN, roles y bloqueo temporal tras 5 intentos.
- Cabina: iniciar ruta con paradas, nivel heredado y Deshacer; finalizar con vista previa del motor; repostaje; gasto; historial. Cola offline en IndexedDB (D4 nivel 2).
- Oficina: barra lateral y barra inferior por rol. Dashboard con filtros en la URL, KPI con ▲/▼, "Ahora mismo", alertas y 6 gráficos con tabla equivalente.

## F3, F5 y F6 — Pantallas de oficina y funciones · 06/10/2026 · ✅ en local

**Qué se hizo**
- Camiones y plantas (lista, alta con foto, ficha con pestañas), viajes (lista, filtros, detalle con auditoría y acciones), combustible, mantenimiento con aprobación, bandeja de revisión, catálogos, usuarios y mi cuenta. Corrección con motivo e historial de auditoría.
- Edge Functions `admin-usuarios` y `tasa-bcv` (ve.dolarapi.com o manual; respeta tasas manuales). SQL para programar la tasa con pg_cron y Vault. T9 en verde.
- Exportación a CSV y Excel en todas las tablas.

## F7 — PWA, accesibilidad y acabado · 06/10/2026 · ✅ en local

**Qué se hizo**
- PWA instalable con íconos provisionales; gráficos y Excel fuera del precache (1,1 MB menos).
- Pruebas de punta a punta con Playwright contra el servidor local: flujos del chofer, sin señal, oficina y permisos (11).
- Revisión de acabado del diseño (impeccable) con capturas a 360 y 1440 px: placa que no se parte, cifra y unidad unidas, encabezados sin antetítulo, raya del promedio detrás de las barras, foco visible sobre verde, contraste AA verificado en claro y oscuro. Veredicto: listo para usar; queda abierto el logo de IP.
- `DESIGN.md` y `.impeccable/design.json` con el sistema construido.

## F8 — QA, seguridad, documentación y despliegue · 06/10/2026 · 🛑 entrega pendiente

**Qué se hizo**
- CI (tipos, lint, Vitest, build y e2e), despliegue a GitHub Pages desde `main`, flujo manual para migraciones y funciones, respaldo semanal cifrado y consulta para que el proyecto no se pause.
- Seguridad: una sola lista blanca de funciones ejecutables (migración 07). Los privilegios por defecto de Supabase dejaban llamar funciones internas a cualquier usuario autenticado (supuesto 026).
- El chofer corrige su ruta desde el resumen durante la ventana configurable.
- `CLAUDE.md`, `README.md`, `docs/PUESTA_EN_MARCHA.md`, `docs/MANUAL_CHOFER.md` (con capturas), `supabase/sql/primer_superusuario.sql`.
- Limpieza demo verificada: `limpiar_demo.sql` deja 0 registros demo y conserva los precios.

**Estado de las pruebas:** 62 Vitest (motor, RLS, T1–T14, lista blanca de funciones, formato y consumo) y 11 Playwright en verde; TypeScript y ESLint sin errores; detector de impeccable sin hallazgos.

**Falta (con Roberts):** crear el repo público y el proyecto Supabase, cargar secrets, primer superusuario, sede y destinos reales, prueba en un teléfono real y prueba del respaldo (`docs/PUESTA_EN_MARCHA.md`). Logo de IP y nombre del superusuario de IP.
