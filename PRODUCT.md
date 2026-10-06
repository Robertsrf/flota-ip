# Product

<!-- impeccable:product-schema 1 -->

> Fuente: `docs/HANDOFF.md` (secciones 1, 2, 9, 10 y 11) y las respuestas de Roberts Flores en el checkpoint de la Fase 0 (03/10/2026, ver `docs/DECISIONES.md`).

## Platform

web (SPA instalable como PWA; el chofer la usa en el teléfono, la oficina en escritorio)

## Stack

Fijado por el handoff y el checkpoint F0: Vite + React + TypeScript, Tailwind CSS v4 con componentes propios, Supabase (plan gratuito: Postgres, Auth, Storage, Edge Functions, Realtime), TanStack Query, ECharts, vite-plugin-pwa + Dexie. Hosting en GitHub Pages desde un repo público.

## Users

- **Choferes.** Inician y cierran rutas y registran repostajes y gastos desde el teléfono, en la cabina o en la bomba, a pleno sol, con prisa y con señal irregular. **Rotan de camión con frecuencia.** Entran con usuario + PIN (muchos no usan correo). Su trabajo: dejar constancia de salida, paradas, llegada, cargas y gastos en segundos, y volver a manejar.
- **Flota (administración de flota).** Escritorio primero. Aprueba los gastos que registran los choferes, registra mantenimiento y las cargas de las plantas, gestiona unidades, ubicaciones y precios, da de alta choferes, corrige registros y revisa lo marcado como dudoso.
- **Consulta (dirección / gerencia).** Entra a ver el dashboard. Quiere respuestas rápidas: cuánto se gastó, qué camión consume de más, qué ruta sale cara.
- **Superusuario** (antes "admin"). Roberts y una persona de IP. Corrige cualquier dato de entrada, da de alta camiones, plantas, choferes y usuarios, asigna roles y maneja los catálogos. Siempre con motivo y auditoría.

## Product Purpose

Distribuidora y Suministros IP (desechables y repostería; Trujillo, Mérida y Zulia) no tiene control centralizado del costo de su flota de **6 a 10 camiones** ni de sus **2 plantas eléctricas**, que consumen el mismo combustible. El sistema registra cada ruta (con sus paradas) y cada carga, y calcula por viaje y por camión km recorridos, litros consumidos, km/L, L/100 km, costo del viaje y costo por km, más el gasto de mantenimiento. Las plantas no tienen horómetro: se controlan por litros y costo del período, sin mezclarse con el km/L de los camiones. Éxito = la dirección sabe en segundos cuánto cuesta cada ruta, cuánto rinde realmente cada camión y cuánto se va en mantenimiento y en plantas, con cifras que cuadran al centavo.

## Positioning

El **viaje** es la unidad principal: el chofer marca salida, paradas y llegada, y el cálculo combina el nivel del tanque al salir, las cargas del trayecto y el nivel al llegar (lleno-a-lleno con bandera de parcial y de carga omitida). Las apps del sector parten de la carga de combustible o del GPS. Aquí cada cifra lleva su **calidad** (exacto / estimado / incompleto) y nunca se mezclan Bs y USD sin etiqueta.

## Operating Context

- Zona horaria `America/Caracas`; formato `es-VE` (`10.400 km`, `$ 48,00`, `Bs 1.234,56`, `dd/mm/aaaa`).
- Moneda base USD; el mantenimiento se paga en Bs o en $ y se convierte con la tasa BCV del día (`ve.dolarapi.com`, campo `promedio`), editable.
- Combustible mixto (gasolina y diésel). Precio en **USD por litro**, elegido en cada carga entre $0,50 y $0,60 (valen para ambos combustibles).
- Todas las rutas salen de la misma sede y recorren uno o varios destinos. Carreteras andinas y zulianas; recibos de estación en papel; fotos opcionales.
- Las plantas se abastecen con bidones comprados en la estación; flota registra esas cargas.
- Roberts ya entrega a IP reportes con azul marino `#1B2A4A` y variaciones ▲/▼ contra el período anterior.

## Capabilities and Constraints

- Roles: superusuario, flota, chofer, consulta. Todos ven el dashboard; el chofer aterriza en su cabina.
- Unidades: camiones (medidor en km, hacen viajes) y plantas (sin medidor, sin viajes).
- Gastos registrados por choferes: pendientes hasta que flota los aprueba.
- Nunca se borran datos operativos: se anulan con motivo y queda auditoría. Una ubicación sin uso sí puede borrarse; con uso, se archiva.
- Cálculo oficial en Postgres; el cliente solo muestra una vista previa.
- Sin señal: iniciar y finalizar ruta, repostar y registrar gastos funcionan en cola local (nivel 2).
- Repo público: nada de claves, datos ni fotos reales en el repositorio.
- Fuera de alcance: GPS en tiempo real, telemetría, nómina, facturación, inventario de repuestos o de combustible.
- Sin datos históricos: se arranca de cero.

## Brand Commitments

- Nombre: **Flota IP**, con el logo de Distribuidora y Suministros IP (archivo pendiente).
- Interfaz en español venezolano llano, voz activa, mayúscula solo al inicio. El botón dice lo que hace y el aviso usa la misma palabra ("Finalizar ruta" → "Ruta finalizada").
- Errores con los números involucrados y cómo corregirlo, sin disculpas.

## Evidence on Hand

- No hay datos reales todavía ni lista de destinos: Roberts cargará la sede y los destinos desde la app.
- Solo existen los casos de prueba T1–T14 del handoff. No inventar camiones, choferes, destinos ni cifras presentadas como reales: todo dato demo va marcado (`DEMO-001`…) y se elimina antes de la entrega.

## Product Principles

1. **Los números son el producto.** Cada cifra lleva su unidad y su calidad; los agregados son ponderados, nunca promedio de ratios.
2. **Una tarea por pantalla para el chofer.** Valores prellenados, teclado numérico, botones grandes, nada que teclear si se puede tocar.
3. **Respuesta antes que exploración para la gerencia.** Lo que se desvía (≥ 10–15 %) se ve primero; el detalle está a un clic.
4. **Nada se pierde ni se esconde.** Anular en vez de borrar; marcar en vez de rechazar cuando el dato es dudoso pero posible.
5. **USD manda, Bs acompaña.** Nunca un total mezclado.

## Accessibility & Inclusion

Contraste AA (más alto en las pantallas del chofer por uso a pleno sol), áreas táctiles ≥ 48 px, foco visible, `prefers-reduced-motion`, modo oscuro, responsive desde 360 px, calidad del dato con ícono + texto (nunca solo color).
