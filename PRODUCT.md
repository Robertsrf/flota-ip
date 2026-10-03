# Product

<!-- impeccable:product-schema 1 -->

> Fuente: `docs/HANDOFF.md` (secciones 1, 2, 9, 10 y 11), escrito por Roberts Flores el 03/10/2026.
> Los puntos marcados **[por confirmar]** se infirieron del handoff y se validan en el checkpoint de la Fase 0.

## Platform

web (SPA instalable como PWA; el chofer la usa en el teléfono, la gerencia en escritorio)

## Stack

Fijado por el handoff (sección 5): Vite + React + TypeScript, Tailwind CSS v4 con primitivas de shadcn/ui personalizadas, Supabase (Postgres, Auth, Storage, Edge Functions, Realtime), TanStack Query, React Hook Form + Zod, ECharts **[D2 por confirmar]**, vite-plugin-pwa + Dexie. Hosting según D1 **[por confirmar]**.

## Users

- **Choferes.** Inician y cierran rutas y registran repostajes desde el teléfono, en la cabina o en la bomba, a pleno sol, con prisa y con señal irregular. Muchos no usan correo **[por confirmar, pregunta 4]**. Su trabajo: dejar constancia de salida, llegada y carga en segundos y volver a manejar.
- **Administración de flota.** Escritorio primero. Registra mantenimiento, gestiona camiones, ubicaciones y precios, corrige registros y revisa lo marcado como dudoso.
- **Dirección / gerencia (consulta).** Entra a ver el dashboard. Quiere respuestas rápidas: cuánto se gastó, qué camión consume de más, qué ruta sale cara.
- **Superusuario** (antes "admin"; pedido por Roberts el 03/10/2026). Puede corregir cualquier dato de entrada, dar de alta camiones, plantas y choferes, y asignar roles. Siempre con motivo y auditoría. Quién lo será **[por confirmar, pregunta 13]**.

## Product Purpose

Distribuidora y Suministros IP (desechables y repostería; Trujillo, Mérida y Zulia) no tiene control centralizado del costo de su flota de camiones ni de sus **2 plantas eléctricas**, que consumen el mismo combustible. Las plantas no hacen viajes: se miden por horas (L/h, $/h) si tienen horómetro **[por confirmar, pregunta 11]** y nunca se mezclan con el km/L de los camiones. El sistema registra cada viaje y cada carga de combustible y calcula, por viaje y por camión, km recorridos, litros consumidos, km/L, L/100 km, costo del viaje y costo por km, más el gasto de mantenimiento. Éxito = la dirección sabe en segundos cuánto cuesta cada ruta, cuánto rinde realmente cada camión y cuánto se va en mantenimiento, con cifras que cuadran al centavo.

## Positioning

El **viaje** es la unidad principal: el chofer marca salida y llegada, y el cálculo combina el nivel del tanque al salir, las cargas del trayecto y el nivel al llegar (método lleno-a-lleno con bandera de parcial). Las apps del sector parten de la carga de combustible o del GPS. Aquí cada cifra lleva su **calidad** (exacto / estimado / incompleto) y nunca se mezclan Bs y USD sin etiqueta.

## Operating Context

- Zona horaria `America/Caracas`; formato `es-VE` (`10.400 km`, `$ 48,00`, `Bs 1.234,56`, `dd/mm/aaaa`).
- Moneda base USD; Bs solo como referencia, convertido con la tasa BCV del día (`ve.dolarapi.com`, campo `promedio`).
- Precio del combustible elegido en cada carga entre dos valores de catálogo ($0,50 y $0,60 por litro **[unidad por confirmar, pregunta 2]**).
- Rutas por carretera andina y zuliana; recibos de estación en papel; odómetro analógico o digital según el camión.
- Roberts ya entrega a IP reportes y dashboards con azul marino `#1B2A4A` y variaciones ▲/▼ contra el período anterior; la dirección conoce ese lenguaje.

## Capabilities and Constraints

- Roles: superusuario (antes admin), flota, chofer, consulta. Todos ven el dashboard.
- Unidades que consumen combustible: camiones (medidor en km, hacen viajes) y plantas eléctricas (medidor en horas o sin medidor, sin viajes) **[modelo D9 por confirmar]**.
- Nunca se borran datos operativos: se anulan con motivo y queda auditoría.
- Cálculo oficial en Postgres; el cliente solo muestra una vista previa.
- Offline: al menos reintentos; cola offline en los flujos del chofer según D4 **[por confirmar]**.
- Fuera de alcance: GPS en tiempo real, telemetría, nómina, facturación, inventario de repuestos.
- Indecisos: número de camiones y choferes, lista real de destinos, paradas múltiples, obligatoriedad de fotos, nombre final ("Flota IP" es provisional).

## Brand Commitments

- Interfaz en español venezolano llano, voz activa, mayúscula solo al inicio. El botón dice lo que hace y el aviso usa la misma palabra ("Finalizar ruta" → "Ruta finalizada").
- Errores con los números involucrados y cómo corregirlo, sin disculpas.
- Uso de la identidad de IP (logo, azul marino) **[por confirmar, pregunta 8]**.

## Evidence on Hand

- No hay datos reales todavía. Solo existen los casos de prueba T1–T14 y los datos de ejemplo del Anexo A del handoff.
- No inventar camiones, choferes, destinos ni cifras presentadas como reales: todo dato demo va marcado (`DEMO-001`…) y se elimina antes de la entrega.

## Product Principles

1. **Los números son el producto.** Cada cifra lleva su unidad y su calidad; los agregados son ponderados, nunca promedio de ratios.
2. **Una tarea por pantalla para el chofer.** Valores prellenados, teclado numérico, botones grandes, nada que teclear si se puede tocar.
3. **Respuesta antes que exploración para la gerencia.** Lo que se desvía (≥ 10–15 %) se ve primero; el detalle está a un clic.
4. **Nada se pierde ni se esconde.** Anular en vez de borrar; marcar en vez de rechazar cuando el dato es dudoso pero posible.
5. **USD manda, Bs acompaña.** Nunca un total mezclado.

## Accessibility & Inclusion

Contraste AA (más alto en las pantallas del chofer por uso a pleno sol), áreas táctiles ≥ 48 px, foco visible, `prefers-reduced-motion`, modo oscuro, responsive desde 360 px, calidad del dato con ícono + texto (nunca solo color).
