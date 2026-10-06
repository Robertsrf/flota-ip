---
name: Flota IP
description: Control de flota y combustible de Distribuidora y Suministros IP, con el lenguaje de la señalización vial venezolana.
colors:
  verde-via: "#0f5b3f"
  verde-via-fuerte: "#0a4530"
  blanco-reflectivo: "#ffffff"
  fondo: "#f4f5f3"
  hombrillo: "#e7eae6"
  asfalto: "#22272b"
  asfalto-suave: "#4d555b"
  linea: "#cdd2cd"
  linea-fuerte: "#8a9299"
  amarillo-preventivo: "#f5c400"
  amarillo-suave: "#fff6cc"
  rojo-pare: "#c1121f"
  rojo-suave: "#fde8ea"
  azul-servicio: "#1f4e8c"
  naranja-obra: "#d4600f"
  marron-turistico: "#7a4b2a"
  ambar-incompleto: "#9a6b00"
  oscuro-fondo: "#121518"
  oscuro-superficie: "#1b1f23"
  oscuro-tinta: "#eef0ee"
  oscuro-verde-acento: "#5cc296"
typography:
  cifra-cabina:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1"
  destino:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 900
    lineHeight: 1.05
  titulo-pagina:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  seccion:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.4
  kpi:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.25
    fontFeature: "\"tnum\" 1"
  cuerpo:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  etiqueta:
    fontFamily: "Overpass Variable, Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  insignia: "4px"
  control: "8px"
  panel: "12px"
  cabina-escritorio: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  boton-principal:
    backgroundColor: "{colors.verde-via}"
    textColor: "{colors.blanco-reflectivo}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
  boton-principal-hover:
    backgroundColor: "{colors.verde-via-fuerte}"
  boton-cabina:
    backgroundColor: "{colors.verde-via}"
    textColor: "{colors.blanco-reflectivo}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "72px"
  boton-secundario:
    backgroundColor: "{colors.blanco-reflectivo}"
    textColor: "{colors.asfalto}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
  boton-peligro:
    backgroundColor: "{colors.rojo-pare}"
    textColor: "{colors.blanco-reflectivo}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
  entrada:
    backgroundColor: "{colors.blanco-reflectivo}"
    textColor: "{colors.asfalto}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  entrada-cabina:
    backgroundColor: "{colors.blanco-reflectivo}"
    textColor: "{colors.asfalto}"
    rounded: "{rounded.control}"
    height: "64px"
  panel:
    backgroundColor: "{colors.blanco-reflectivo}"
    textColor: "{colors.asfalto}"
    rounded: "{rounded.panel}"
    padding: "16px"
  panel-senal:
    backgroundColor: "{colors.verde-via}"
    textColor: "{colors.blanco-reflectivo}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    width: "288px"
  etiqueta-alerta:
    backgroundColor: "{colors.amarillo-preventivo}"
    textColor: "{colors.asfalto}"
    rounded: "{rounded.insignia}"
    padding: "2px 8px"
---

# Design System: Flota IP

## Overview

**Creative North Star: "Señal vial"**

Flota IP habla el idioma que el chofer ya lee a 80 km/h: el de las señales de la carretera. El estado "en ruta" es un panel verde de destino con su filete blanco interior; las alertas son el rombo amarillo preventivo; lo destructivo es el rojo de pare. Roberts eligió esta dirección en el checkpoint F0 (03/10/2026, semilla `5ae8474e`) entre tres propuestas, y descartó a propósito el tablero SaaS gris de tarjetas idénticas.

Dos densidades conviven. La **cabina** del chofer (teléfono, pleno sol, prisa) muestra una sola tarea por pantalla, con una cifra grande, botones de 72 px en la zona del pulgar y contraste por encima de AA. La **oficina** (escritorio) es densa y ordenada: KPI con ▲/▼, el pórtico "Ahora mismo", alertas, gráficos con su tabla equivalente y tablas ordenables. Todo es plano y legible: la profundidad viene de bordes de 2 px y de la tonalidad, no de sombras.

**Key Characteristics:**
- Verde vía como estructura (barra lateral, cabecera de la cabina, paneles del pórtico), nunca como decoración.
- Amarillo solo para alertas; si no hay nada que revisar, no hay amarillo en pantalla.
- Overpass en todo, con cifras tabulares; peso 900 para la única cifra grande de cada pantalla.
- Bordes de 2 px visibles al sol; cero degradados.
- Cada cifra lleva su unidad y su calidad (exacto / estimado / incompleto) con ícono y texto.

## Colors

Paleta tomada de la señalización vial: verde de destino, blanco reflectivo, asfalto, hombrillo, y tres colores de señal con un solo significado cada uno.

### Primary
- **Verde vía** (`verde-via`): estructura y acción principal. Barra lateral, cabecera de la cabina, paneles del pórtico, botón principal, números de parada. Sobre él, texto blanco (8,1:1). El activo o presionado usa **verde vía fuerte** (`verde-via-fuerte`).

### Secondary
- **Azul servicio** (`azul-servicio`): todo lo de combustible (series de gráficos, módulo). Es también el anillo de foco sobre fondos claros y el color de la calidad "estimado".
- **Naranja obra** (`naranja-obra`): mantenimiento.
- **Marrón turístico** (`marron-turistico`): plantas eléctricas.

### Tertiary
- **Amarillo preventivo** (`amarillo-preventivo`): exclusivo de alertas (rombo, insignia "Revisar", conteo de la bandeja, selección de texto). Su fondo suave es `amarillo-suave`.
- **Rojo pare** (`rojo-pare`): acciones destructivas, errores y variaciones desfavorables (▲ del gasto). Fondo suave `rojo-suave`.
- **Ámbar incompleto** (`ambar-incompleto`): calidad "incompleto" (4,7:1 sobre blanco; el amarillo puro no alcanza AA como texto).

### Neutral
- **Blanco reflectivo** (`blanco-reflectivo`): superficie de paneles, campos y la cabina.
- **Fondo** (`fondo`): campo de la página en la oficina; separa los paneles blancos sin sombra.
- **Hombrillo** (`hombrillo`): superficies secundarias, filas en hover, campos deshabilitados.
- **Asfalto** (`asfalto`): tinta principal (15:1) y viga del pórtico. **Asfalto suave** (`asfalto-suave`) para texto secundario (7,6:1).
- **Línea** (`linea`) y **línea fuerte** (`linea-fuerte`): bordes de paneles y de campos.
- **Modo oscuro:** `oscuro-fondo`, `oscuro-superficie`, `oscuro-tinta`; el verde se mantiene en la estructura y como texto pasa a `oscuro-verde-acento` (7,6:1). Los tokens viven en `src/styles/index.css` (`:root` y `.dark`).

### Named Rules
**The Amarillo Solo Alerta Rule.** El amarillo preventivo significa "mira esto". Usarlo como acento, en un gráfico o en un botón lo gasta.

**The Un Color Un Módulo Rule.** Azul es combustible, naranja es mantenimiento, marrón es plantas, en cada gráfico, tabla y leyenda. Nunca se reasignan.

**The Foco Blanco Sobre Verde Rule.** Dentro de zonas verdes (`.panel-senal`, `.sobre-via`) el anillo de foco es blanco: el azul sobre el verde da 1:1.

## Typography

**Display Font:** Overpass Variable (autoalojada con `@fontsource-variable/overpass`)
**Body Font:** Overpass Variable
**Label/Mono Font:** la misma; no hay monoespaciada.

**Character:** Overpass desciende de Highway Gothic, la letra de las señales viales. Una sola familia en varios pesos: 900 para la cifra que manda, 800 para títulos, 700 para etiquetas y botones, 400 para el cuerpo. Las cifras son tabulares (`tnum`) en toda la app para que las columnas cuadren.

### Hierarchy
- **Cifra de cabina** (900, 48 px, interlineado 1): la placa del camión en la cabina. Una por pantalla.
- **Destino** (900, 44 px, 1,05): el destino de la ruta abierta ("En ruta a / Mérida"). En el pórtico, 24 px.
- **Título de página** (800, 24 px en móvil / 30 px en escritorio): el `h1` de cada pantalla de oficina y de las tareas del chofer.
- **Sección** (800, 18 px): `h2` de secciones y paneles.
- **KPI** (800, 24 px, tabular): valores de la fila de indicadores.
- **Cuerpo** (400, 16 px, 1,5): textos y celdas. Nunca menos de 16 px en campos (evita el zoom de iOS).
- **Etiqueta** (700, 14 px): rótulos de campos, insignias, cabeceras de tabla.

### Named Rules
**The Una Cifra Grande Rule.** Cada pantalla tiene una sola cifra en peso 900. Si dos compiten, una baja a 800.

**The Cifra Con Unidad Rule.** Cifra y unidad van unidas por un espacio de no separación (`formato.ts`): "$ 0,1057/km" nunca se parte en dos líneas.

## Layout

- **Cabina** (chofer): una columna, máximo 576 px de ancho, centrada y con borde en pantallas grandes. Cabecera verde a todo el ancho con la frase de estado como `h1`; contenido sobre blanco; acciones fijas abajo (`zona-segura-abajo`), principal de 72 px y dos secundarias de 56 px en dos columnas.
- **Oficina**: barra lateral verde de 240 px desde `md` (768 px); por debajo, cabecera verde arriba y barra de navegación inferior. Contenido con 16 px de margen en móvil y 24–32 px en escritorio.
- **Rejillas**: KPI en 2 columnas en móvil y hasta 6 en `xl`; filtros en 2 / 3 / 5 columnas; gráficos en 1 columna en móvil y 2 en `lg`.
- **Tablas**: en móvil cada fila pasa a lista de pares rótulo–valor; en escritorio, celdas sin cortes salvo las columnas marcadas `envolver`.
- **Ritmo**: múltiplos de 4 px; separación habitual de 12–16 px entre bloques y 24 px entre secciones. Áreas táctiles de 48 px como mínimo.

## Elevation & Depth

Plano por defecto. La separación viene de bordes de 2 px (`linea`) y de la tonalidad (paneles blancos sobre `fondo`). Hay una sola sombra suave (`--sombra`, `0 1px 2px` + `0 4px 12px` al 6 %), reservada para lo que flota sobre el contenido: los avisos al pie. El panel de señal se separa con su filete interior: `box-shadow: inset 0 0 0 2px verde, inset 0 0 0 4px blanco 90 %`.

### Named Rules
**The Borde Antes Que Sombra Rule.** Al sol las sombras desaparecen; un borde de 2 px no. Lo que está en el flujo de la página lleva solo borde; la sombra se suma únicamente a lo que flota encima.

## Shapes

Esquinas suaves y pocas: 8 px en controles (botones, campos, paneles de señal), 12 px en paneles y tarjetas, 4 px en insignias pequeñas, 16 px solo en la esquina superior de la cabina en escritorio. Las formas propias vienen de la vía: el **rombo** preventivo (SVG propio en `datos.tsx`), el **panel de destino** rectangular con filete blanco, la **viga** del pórtico (barra de 8 px en asfalto con dos postes de 4 px por panel) y los números de parada en cuadros verdes de 28–32 px.

## Components

### Buttons
- **Forma:** esquinas de 8 px, borde de 2 px siempre visible, peso 700.
- **Principal:** verde vía con texto blanco; hover y presionado en verde vía fuerte.
- **Secundario:** blanco con borde asfalto; hover en hombrillo.
- **Peligro:** rojo pare con texto blanco; solo para anular, rechazar o borrar.
- **Fantasma:** sin borde, para acciones terciarias dentro de tablas.
- **Sobre verde:** transparente con borde blanco al 80 %, para acciones dentro de la cabecera de la cabina ("Cambiar").
- **Tamaños:** 40 / 48 / 56 / 72 px de alto. La acción principal del chofer siempre es de 72 px y a todo el ancho.
- **Foco:** anillo de 3 px a 2 px del borde, azul servicio (blanco dentro de zonas verdes).

### Chips
- **Etiqueta:** borde de 2 px, 14 px en peso 700, esquinas de 6 px. Tonos neutro (estado, folio), vía ("En ruta"), alerta (fondo amarillo: "Por aprobar", "Pendiente de envío") y peligro ("Rechazado").
- **Calidad del dato:** ícono + texto en el color de la calidad (exacto verde, estimado azul, incompleto ámbar). Nunca solo color.

### Cards / Containers
- **Esquinas:** 12 px.
- **Fondo:** blanco reflectivo sobre `fondo`.
- **Sombras:** ninguna (ver Elevation & Depth).
- **Borde:** 2 px `linea`; en hover de elementos enlazados, borde asfalto.
- **Relleno interior:** 12–16 px.

### Inputs / Fields
- **Estilo:** blanco, borde de 2 px `linea-fuerte`, esquinas de 8 px, 48 px de alto (64 px y 24 px de texto en la cabina).
- **Foco:** el borde pasa a azul servicio.
- **Error:** borde rojo pare y mensaje en rojo debajo, con los números involucrados y cómo corregir.
- **Deshabilitado:** fondo hombrillo, texto asfalto suave.
- **Números:** teclado numérico, coma decimal es-VE, unidad visible dentro del campo.

### Navigation
- **Barra lateral (oficina, escritorio):** fondo verde vía, texto blanco 700 de 14 px, ítems de 44 px. El activo es un panel de señal: verde fuerte con filete blanco interior de 2 px. Conteo de la bandeja de revisión en insignia amarilla.
- **Barra inferior (oficina, móvil):** cuatro destinos con ícono y rótulo, más "Más" para el resto.
- **Cabina:** sin barra; cabecera verde con nombre del chofer, acceso al dashboard y menú.

### El pórtico (firma)
Paneles verdes de 288 px colgados de una viga oscura, uno por camión en ruta: arriba quién y en qué camión, al centro el destino en 24 px / 900, abajo desde cuándo, con insignia "Revisar" amarilla si la ruta lleva demasiado abierta. Se desplaza en horizontal si no cabe. En la cabina, la cabecera es la versión a pantalla completa del mismo panel.

## Do's and Don'ts

### Do:
- **Do** usar verde vía para la estructura y la acción principal, y nada más.
- **Do** escribir las cifras con `formato.ts` (es-VE, unidad unida, "—" si no hay dato).
- **Do** mostrar la calidad del dato junto a cada cifra calculada, con ícono y texto.
- **Do** dar a cada gráfico su tabla equivalente ("Ver como tabla") y patrones además de color.
- **Do** mantener 48 px de área táctil mínima y 72 px en la acción principal del chofer.
- **Do** probar cada pantalla nueva a 360 px y a 1440 px, en claro y en oscuro.

### Don't:
- **Don't** usar el amarillo preventivo fuera de alertas.
- **Don't** usar sombras, degradados ni desenfoques como separación o adorno.
- **Don't** poner un rótulo pequeño encima de un título como antetítulo; si el rótulo y el título forman una frase ("En ruta a Mérida"), van juntos en el mismo `h1`.
- **Don't** usar el carácter "·" de Overpass como separador (queda pegado a la palabra siguiente); usar "•".
- **Don't** usar emoji o caracteres sueltos como íconos; los íconos son de lucide-react o SVG propios (el rombo).
- **Don't** mezclar Bs y USD en un total; Bs aparece solo como referencia rotulada.

## Recursos gráficos

- `public/iconos/*.png` y `public/favicon.svg`: generados por `scripts/generar-iconos.mjs` (panel verde con "IP" en Overpass 900, renderizado con Playwright). Son provisionales: se reemplazan cuando llegue el logo de IP (SVG, con versión blanca para la barra verde).
- No hay fotografías ni ilustraciones en la interfaz; las fotos de recibos y odómetros las suben los usuarios y nunca entran al repositorio.
