# Bitácora

## F0 — Investigación y opciones · 03/10/2026 · 🛑 esperando a Roberts

**Qué se hizo**
- Instalación de las skills de diseño y pruebas que faltaban (impeccable, frontend-design, webapp-testing).
- `PRODUCT.md` con el contexto del producto para las skills de diseño (supuestos marcados).
- Investigación de 11 productos (Fleetio, Simply Fleet, Drivvo, Fuelly, Fuelio, AUTOsist, Whip Around, Fleet Complete, TuFlota, Vecon, SmartReport) y de guías de dashboard y formularios de campo → `docs/INVESTIGACION.md`.
- Verificaciones técnicas: formato real de la API de tasa BCV, límites de Supabase gratuito, GitHub Pages con repo privado, Netlify, Cloudflare Pages, Background Sync en Safari, peso de ECharts.
- `docs/OPCIONES.md`: 2 navegaciones con wireframes, 3 direcciones visuales, 2 variantes del botón En ruta, D1–D10 con recomendación, ajustes M1–M5 al modelo y preguntas abiertas.
- Página visual de opciones `docs/opciones-visuales.html` (paletas, tipografías, pantalla del chofer y del dashboard por dirección, modo oscuro y demo del botón En ruta), verificada con capturas en 360 y 1440 px y con el detector de impeccable.
- Nuevos requisitos recibidos durante la fase (plantas eléctricas y superusuario) incorporados como D9, D10, M1 y M5.

**Qué se decidió:** ver `docs/DECISIONES.md` (001–010).

**Qué falta (lo decide Roberts en el checkpoint)**
- Navegación, dirección visual, variante del botón En ruta.
- D1–D10 y M1–M5.
- Preguntas abiertas 1–14 (en especial: GitHub Pro y plan de Supabase, datos de las plantas y quién será superusuario).

**Siguiente fase (F1), una vez aprobado:** repo remoto en GitHub, Vite + TS + Tailwind, proyecto Supabase enlazado, migraciones con los ajustes aprobados, RLS por rol con pruebas, seed, tipos generados, `CLAUDE.md`, CI.
