---
version: 1
slug: "src-app-app-tsx"
primary_target: "src/app/App.tsx"
related_targets: []
---

# Superficie: aplicación Flota IP (cabina del chofer + oficina)

Modo: operar. Audiencia: choferes en la cabina o la bomba (teléfono, sol, prisa, señal irregular); flota y gerencia en escritorio. Tarea: iniciar y cerrar rutas, repostar y registrar gastos en segundos; ver cuánto se gasta, cuánto rinde cada camión y qué se desvía. Restricciones: es-VE, USD manda y Bs acompaña, calidad del dato siempre visible, área táctil ≥ 48 px (acción principal 72 px), AA, modo oscuro, desde 360 px.

## Direction contract

THESIS: El estado "en ruta" es una señal de carretera: cada camión en la vía aparece como un panel verde de destino (el pórtico). Se rechaza el tablero SaaS gris de tarjetas idénticas.

OWN-WORLD: Verde vía #0F5B3F como estructura (barra lateral, cabecera de la cabina, paneles del pórtico con filete blanco interior de 2 px); blanco reflectivo de fondo; asfalto #22272B de tinta; hombrillo #E7EAE6 en superficies secundarias; amarillo preventivo #F5C400 solo para alertas, con el rombo de señal preventiva; rojo pare #C1121F para lo destructivo. Overpass en todo, peso 800 para la única cifra grande de cada pantalla. Colores por módulo tomados de la señalización: azul servicio (combustible), naranja obra (mantenimiento), marrón turístico (plantas).

STORY: El chofer abre la app y ve su camión o su ruta como una señal; toca un solo botón grande y vuelve a manejar. La gerencia ve gasto, rendimiento, quién está en la vía y qué se desvió, sin buscar.

FIRST VIEWPORT: Cabina a 360 px: panel verde a todo el ancho con el destino en 44 px/900 (o la placa del camión si está disponible); debajo, sobre blanco, el camión y su nivel; en la zona del pulgar, botón principal de 72 px y secundario de 52 px. Oficina a 1440 px: barra lateral verde de 240 px; título y filtros; fila de KPI con ▲/▼; el pórtico "Ahora mismo" (paneles colgados de una viga oscura); alertas con rombos amarillos; gráficos y tabla.

FORM: Señal vial, posición 1 de la lista propia (elegida por Roberts en el checkpoint F0); semilla 5ae8474e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
