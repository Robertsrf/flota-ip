# Flota IP

Control de flota y combustible para **Distribuidora y Suministros IP** (Venezuela). Los choferes registran desde el teléfono cada ruta, carga de combustible y gasto, aun sin señal; la oficina ve cuánto se gasta, cuánto rinde cada camión y qué se desvía. Incluye las plantas eléctricas que consumen el mismo combustible.

- **Cabina del chofer:** iniciar y finalizar ruta con paradas, repostajes, gastos (pendientes de aprobación), historial. Funciona sin conexión (cola local que se envía sola).
- **Oficina:** dashboard con KPI, rutas en curso, alertas y gráficos; camiones y plantas; viajes; combustible; mantenimiento; bandeja de revisión; catálogos; usuarios. Exporta a CSV y Excel.
- **Cálculo en el servidor:** litros consumidos por viaje (nivel al salir + cargas − nivel al llegar), rendimiento, costo por viaje y por km, con la calidad del dato (exacto, estimado, incompleto). Montos en USD; Bs solo como referencia con la tasa BCV del día.
- **Vencimientos:** recordatorios de servicio por km o fecha (cambio de aceite, cauchos) y documentos con fecha de vencimiento (póliza RCV, permisos, licencias). Avisan antes y se marcan hechos solos al aprobarse el gasto.
- **Fácil de entender:** cada cifra se explica al tocar su nombre; pantalla de Ayuda por rol y Novedades con todas las versiones (`CHANGELOG.md`).
- **Nada se borra:** los registros se anulan con motivo y toda corrección queda auditada.

## Tecnología

Vite + React + TypeScript, Tailwind CSS, TanStack Query, ECharts, Dexie (PWA sin conexión) · Supabase (Postgres con RLS, Auth, Storage, Edge Functions, Realtime) · GitHub Pages.

## Desarrollo local (sin Docker)

Requiere Node 22.

```
npm ci
cp .env.local.example .env.local
npm run dev:local
```

Levanta un backend local que imita Supabase sobre PGlite (Postgres en WebAssembly) con las migraciones reales y datos de demostración, y la app en http://127.0.0.1:5173. Usuarios demo: `demo.flota` / `demo1234` (oficina) y `demo.pedro` / `123456` (chofer).

```
npm run typecheck && npm run lint
npm test            # motor de cálculo, RLS por rol y casos T1–T14 sobre PGlite
npm run test:e2e    # flujos completos con Playwright
```

## Documentación

- [`CLAUDE.md`](CLAUDE.md): guía operativa (comandos, convenciones, reglas de cálculo, roles).
- [`CHANGELOG.md`](CHANGELOG.md): todas las versiones, de la más nueva a la más vieja.
- [`docs/PUESTA_EN_MARCHA.md`](docs/PUESTA_EN_MARCHA.md): GitHub, Supabase, secrets y respaldos.
- [`docs/MIGRACION_VPS.md`](docs/MIGRACION_VPS.md): mudanza a un servidor propio con dominio.
- [`docs/MANUAL_CHOFER.md`](docs/MANUAL_CHOFER.md): manual de una página para choferes.
- [`docs/DECISIONES.md`](docs/DECISIONES.md) y [`docs/BITACORA.md`](docs/BITACORA.md): decisiones y avance por fase.
- [`DESIGN.md`](DESIGN.md): sistema visual "Señal vial".

## Seguridad

Este repositorio es público. Nunca contiene claves, `.env`, volcados de la base ni fotos reales. En el navegador solo se usa la llave pública de Supabase; la llave secreta vive únicamente en los secrets de las Edge Functions. Los respaldos se guardan cifrados con [age](https://age-encryption.org).

---

Desarrollado por Emory Studios para Distribuidora y Suministros IP.
