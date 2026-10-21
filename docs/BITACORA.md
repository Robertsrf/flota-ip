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

## F9 — Renovación: teléfono, vencimientos, ayuda y seguridad · 20/10/2026 · ✅ en local (versión 0.6.0)

Pedido de Roberts: pasar los tres flujos directores (diseño, ingeniería y seguridad) por todo el sitio, investigar sistemas similares, dejarlo claro y usable en teléfono y PC, y llevar un changelog desde el inicio.

**Diagnóstico (capturas a 390 y 1440 px de cada pantalla, con datos demo)**
- La cabina del chofer ya estaba bien resuelta. El problema estaba en la oficina usada desde el teléfono: cada fila de tabla ocupaba 8 renglones de "rótulo: valor" (Viajes medía 9,8 pantallas de alto; Combustible 12,7) y los filtros ocupaban la primera pantalla antes de cualquier número.
- Errores: en el teléfono no se podía editar ni eliminar ubicaciones, precios ni categorías, ni dar un PIN nuevo (la columna de acciones estaba oculta); en escritorio "Nuevo PIN" abría dos hojas; la tabla de Viajes no cabía en 1440 px; todas las hojas compartían el mismo id de título.
- La revisión decía "el chofer dejó una novedad" sin mostrarla.
- Seguridad: la compresión de fotos descargaba su web worker desde cdn.jsdelivr.net; no había CSP; las funciones devolvían mensajes internos; `vite` 8.3.2 con un aviso alto (solo servidor de desarrollo en Windows).

**Investigación:** Fleetio Go (ficha por unidad, cola única de revisión), Simply Fleet (viajes y gastos del chofer, recordatorios por km), patrones de tablas en móvil, Keep a Changelog 2.0 y la guía oficial de Supabase autoalojado. Ver `docs/INVESTIGACION.md`, sección 8.

**Qué se hizo**
- Tabla con renglón compacto en teléfono y tableta (hasta 1024 px): título y cifra principal arriba, datos clave abajo, sin datos vacíos. Viajes bajó de 9,8 a 4,5 pantallas; Combustible de 12,7 a 6,4; Mantenimiento de 7,2 a 4,3.
- `PanelFiltros`: en el teléfono, un botón con el resumen que abre una hoja. Buscador de viajes siempre visible. Calidad y estado en una columna (la tabla cabe en 1440 px).
- Catálogos y usuarios: la fila abre la ficha; eliminar, reactivar y "Nuevo PIN" dentro.
- Explicación de cada indicador al tocar su nombre. Primeros pasos para la base vacía. Pantallas de Ayuda y Novedades (lee `CHANGELOG.md`). Versión en la barra lateral.
- Fase 2 adelantada (Roberts la pidió en esta fase): migración 08 con recordatorios de servicio y documentos con vencimiento, alertas `servicio` y `documento`, trigger que marca hecho el servicio al aprobarse un gasto de su categoría, pantalla Vencimientos, pestaña en la ficha de la unidad y aviso en la cabina.
- Revisión: muestra el texto de la novedad, "Dar por revisada" en la fila, grupos de vencimientos, lo urgente primero.
- Seguridad: CSP en el build (`scripts/csp.mjs`), sin worker de CDN, `vite` 8.3.3, funciones con errores genéricos, CORS por `ORIGENES_APP`, largos máximos y comparación del secreto en tiempo constante.
- Documentación: `CHANGELOG.md` desde la 0.1.0 con su regla en `CLAUDE.md`, `docs/MIGRACION_VPS.md`, guía de puesta en marcha, manual del chofer, `DESIGN.md`.

**Estado de las pruebas:** 85 Vitest (antes 62: 16 de vencimientos, 4 de CSP y 3 del changelog nuevas) y 15 Playwright (antes 11: vencimientos y oficina desde el teléfono) en verde; TypeScript y ESLint sin errores; `npm audit` sin vulnerabilidades; la app compilada recorrida con la CSP sin ningún bloqueo.

**0.6.1 (mismo día):** la revisión automática de seguridad marcó que las fotos de documentos personales se subían a `comprobantes`, que lee y lista cualquier usuario activo. Migración 09: bucket `documentos` con lectura atada a la RLS de la tabla, subida solo de la oficina y restricción `documentos_archivo_ck` sobre la ruta; el emulador local aplica la misma regla. Comprobado contra el servidor local: el dueño y la gerencia abren el certificado; otro chofer no puede abrirlo ni subir. 1 prueba SQL nueva.

**Incidente:** al reiniciarse la sesión, el archivo de la rama `version-0.6.0` quedó con bytes nulos (git no encontraba `HEAD`). Se restauró desde el reflog al último commit (`0fee573`), `git fsck` quedó limpio y ningún archivo de trabajo tenía daños.

**Falta (con Roberts):** lo mismo de F8 (repo, Supabase, secrets, primer superusuario, teléfono real) más cargar los recordatorios y documentos reales. Logo de IP.
