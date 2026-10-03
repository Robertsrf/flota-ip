# Opciones para decidir — checkpoint de la Fase 0 🛑

**Para:** Roberts Flores · **Fecha:** 03/10/2026
Este documento reúne todo lo que necesito que decidas antes de escribir código. Para cada punto doy mi recomendación. Las cifras de los wireframes son ilustrativas (salen de los casos T1–T10), no datos de IP.

**Lo que tienes que elegir:**

1. Estructura de navegación: **N1** o **N2** (sección 1).
2. Dirección visual: **A**, **B** o **C** (sección 2). La versión visual está en `docs/opciones-visuales.html` (ábrela en el navegador: tiene modo oscuro por dirección y la demo del botón En ruta).
3. Botón "En ruta": variante **A** o **B** (sección 3).
4. Decisiones **D1–D10** (sección 4). D9 y D10 son nuevas: salen de tu mensaje del 03/10 sobre las plantas eléctricas y el superusuario.
5. Ajustes al modelo de datos **M1–M5** (sección 5).
6. Preguntas abiertas (sección 6).

---

## 1. Estructura de navegación

Las dos opciones cubren los cuatro roles. Lo que cambia es si el chofer tiene barra de navegación y cómo se organiza la oficina.

**Común a ambas:** el chofer aterriza en **su inicio** (su camión y su ruta); flota, consulta y superusuario aterrizan en el **dashboard**. El handoff pedía confirmar esto en la Fase 0. Recomiendo que sea así: el chofer abre la app para hacer algo, no para mirar.

### N1 — Una sola estructura para todos

Barra lateral en escritorio y barra inferior en móvil, con las secciones filtradas por rol.

- **Chofer (móvil):** barra inferior con 3 destinos: Mi ruta · Dashboard · Historial.
- **Oficina (escritorio):** barra lateral fija: Dashboard, Camiones y plantas, Viajes, Combustible, Mantenimiento, Revisión, Catálogos, Usuarios.
- **Oficina (móvil):** barra inferior con 5 destinos: Dashboard · Unidades · Registrar · Revisión · Más.

**Inicio del chofer — N1 (360 px)**

```
SIN RUTA ABIERTA                      CON RUTA ABIERTA
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ Flota IP                Pedro│      │ Flota IP                Pedro│
├──────────────────────────────┤      ├──────────────────────────────┤
│ ┌────┐ A12BC3D               │      │ En ruta a Valera             │
│ │foto│ Camión 3 · NPR 2014   │      │ Salió 07:40 · hace 2 h 15 min│
│ └────┘ Disponible            │      │ km de salida 10.000          │
│ km 10.400   Tanque: lleno    │      │ Salió con tanque lleno       │
│ (último repostaje)           │      │                              │
│ Hoy manejo otro camión       │      │                              │
│                              │      │                              │
│ ┌──────────────────────────┐ │      │ ┌──────────────────────────┐ │
│ │       Iniciar ruta       │ │64px  │ │      Finalizar ruta      │ │
│ └──────────────────────────┘ │      │ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │      │ ┌──────────────────────────┐ │
│ │   Registrar repostaje    │ │48px  │ │   Registrar repostaje    │ │
│ └──────────────────────────┘ │      │ └──────────────────────────┘ │
│                              │      │                              │
│ Última ruta: Valera          │      │ Sin señal: 1 registro        │
│ 400 km · 5,00 km/L · $48,00  │      │ esperando envío              │
│ Exacto                       │      │                              │
├──────────────────────────────┤      ├──────────────────────────────┤
│ Mi ruta | Dashboard | Historial     │ Mi ruta | Dashboard | Historial
└──────────────────────────────┘      └──────────────────────────────┘
```

**Dashboard global — N1 (1440 px)**

```
┌──────────────┬───────────────────────────────────────────────────────────────────────┐
│ Flota IP     │ Dashboard                                                             │
│              │ [Este mes ▾] [Todas las unidades ▾] [Todos los choferes ▾]            │
│ Dashboard    │ [Todos los destinos ▾] [Exactos y estimados ▾]       [Exportar ▾]     │
│ Camiones y   ├───────────────────────────────────────────────────────────────────────┤
│  plantas     │ Gasto total   Combustible   Mantenimiento  Km recorridos  km/L   $/km  │
│ Viajes       │ $ 4.812,00    $ 3.390,00    $ 1.422,00     18.240 km      5,21   0,2638│
│ Combustible  │ ▲ 8,2 %       ▲ 3,1 %       ▲ 22,4 %       ▼ 2,0 %        ▼ 4,0 % ▲ 10,4%│
│ Mantenimiento│ vs. mes anterior · combustible incluye plantas ($ 340,00)              │
│ Revisión (3) ├──────────────────────────────────┬────────────────────────────────────┤
│ Catálogos    │ Ahora mismo: 2 en ruta           │ Alertas (3)                        │
│ Usuarios     │ A12BC3D Pedro  Valera     2 h 15 │ Camión 2: 18 % peor que su prom.   │
│              │ B45DE6F Luis   Maracaibo  5 h 02 │ Camión 5: ruta abierta hace 52 h   │
│              │                                  │ Camión 1: 38 km sin ruta           │
│              ├──────────────────────────────────┴────────────────────────────────────┤
│              │ [Gasto mensual: combustible vs.  ] [Rendimiento km/L por camión,      ]│
│              │ [mantenimiento, 12 meses         ] [con línea del promedio de flota   ]│
│              │ [Costo por km por camión         ] [Mantenimiento por categoría       ]│
│              │ [Costo por destino (tabla)       ] [Plantas eléctricas: L, $, L/h     ]│
│              ├───────────────────────────────────────────────────────────────────────┤
│              │ Camiones  Placa   Estado  km actual km período km/L  $/km  Mant.  Alertas│
│              │ Plantas   Nombre  Estado  horas     L período  L/h   $/h   Mant.  Alertas│
└──────────────┴───────────────────────────────────────────────────────────────────────┘
```

**Dashboard global — N1 (360 px):** filtros en una hoja ("Filtros: este mes, todas"); KPIs en grilla de 2 columnas; "Ahora mismo" y "Alertas" como listas; gráficos uno debajo de otro; tabla de camiones como lista de filas de dos líneas; barra inferior.

**Ficha del camión — N1 (1440 px)**

```
┌──────────────┬───────────────────────────────────────────────────────────────────────┐
│ (barra       │ Camiones y plantas / Camión 3                                         │
│  lateral)    │ ┌────────┐ A12BC3D · Camión 3                         Disponible      │
│              │ │  foto  │ Chevrolet NPR 2014 · diésel · tanque 200 L                 │
│              │ └────────┘ Chofer habitual: Pedro Rivas                               │
│              │            km 10.400 · nivel estimado 168 L (estimado)                │
│              │            [Iniciar ruta] [Registrar repostaje] [Registrar gasto]     │
│              │ Resumen | Viajes | Combustible | Mantenimiento | Datos                │
│              │ ─────────────────────────────────────────────────────────────────────  │
│              │ km/L 5,21 (flota 5,05)   $/km 0,1210   Gasto del mes $ 642,00         │
│              │ [Rendimiento por viaje en el tiempo, con su promedio de referencia]    │
│              │ [Gasto mensual apilado          ] [Mantenimiento por categoría   ]    │
└──────────────┴───────────────────────────────────────────────────────────────────────┘
```

La ficha de una **planta eléctrica** usa la misma estructura con horas en vez de km, L/h en vez de km/L, y sin la pestaña Viajes.

### N2 — Cabina y oficina

Dos estructuras distintas, una por contexto de uso.

- **Chofer, "cabina":** sin barra de navegación. La pantalla es la tarea. Arriba a la derecha hay un botón "Dashboard" y un menú con Historial y Salir. Nada que se pueda tocar por accidente junto al botón principal.
- **Oficina:** barra superior con las secciones y pestañas dentro de cada sección. En móvil, barra superior con el título de la sección, botón "Registrar" y menú en hoja.

**Inicio del chofer — N2 (360 px)**

```
┌──────────────────────────────┐
│ Pedro               Dashboard│   ← sin barra inferior
├──────────────────────────────┤
│                              │
│  A12BC3D · Camión 3          │
│  Disponible · km 10.400      │
│  Tanque lleno (último        │
│  repostaje)                  │
│                              │
│                              │
│                              │
│ ┌──────────────────────────┐ │
│ │                          │ │
│ │       Iniciar ruta       │ │   72 px, en la zona del pulgar
│ │                          │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │   Registrar repostaje    │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**Dashboard global — N2 (1440 px)**

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Flota IP  Dashboard  Unidades  Viajes  Combustible  Mantenimiento  Revisión (3)  ⋯ │
├────────────────────────────────────────────────────────────────────────────────────┤
│ [Este mes ▾] [Todas ▾] [Todos ▾] [Todos ▾] [Exactos y estimados ▾]   [Exportar ▾]  │
│ Gasto total  Combustible  Mantenimiento  Km recorridos  km/L   $/km                │
│ (misma grilla de KPIs, "Ahora mismo", alertas, gráficos y tablas que N1,           │
│  a todo el ancho: 12 columnas útiles en vez de 10)                                 │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Ficha del camión — N2:** igual que en N1, pero a todo el ancho, con la ruta de migas bajo la barra superior.

### Comparación y recomendación

| | N1 — Una sola estructura | N2 — Cabina y oficina |
|---|---|---|
| Chofer | Barra inferior de 3 destinos, familiar | Sin barra: la acción domina, nada que tocar por error |
| Oficina | Barra lateral: escala a 8 secciones, la más conocida en paneles de gestión | Barra superior: más ancho para gráficos, se aprieta con 8 secciones |
| Costo de construcción | Un solo layout con variantes | Dos layouts |

**Recomendación: la cabina de N2 para el chofer y la barra lateral de N1 para la oficina.** El chofer casi no navega: entra, inicia o cierra la ruta y se va, y una barra inferior solo agrega toques accidentales a pleno sol. La oficina sí navega entre 8 secciones, y la barra lateral las aguanta sin apretarse. El costo de dos layouts es bajo: la cabina es una sola pantalla con un menú.

---

## 2. Direcciones visuales

Las tres comparten la base que exige el handoff: contraste AA (verificado abajo), modo oscuro, numerales tabulares, la calidad del dato con ícono + texto, áreas táctiles ≥ 48 px y nada de los clichés listados en la sección 11. Cada una concentra la audacia en **un solo elemento** (su "firma") y deja lo demás sobrio.

Para no caer en lo que toda app de flota ya hace, las generé con el proceso de `impeccable` en modo "operar". Primero listé siete referencias del mundo del cliente, ordenadas por cuánto resuenan: señalización vial, guía vial con cuadro de distancias, ticket de estación, reportes de IP, pizarra de despacho, talonario de guías y tablero del camión. Después dejé que el sorteo eligiera la dirección principal (A) y comparé seis "retadores" externos (sección 2.4). **A** es la que asignó el sorteo, **B** es mi favorita y **C** es la más familiar, anclada al azul de IP.

### A — Ticket sellado

**Idea:** el papel térmico del ticket de la estación y el sello húmedo de la oficina venezolana. Cada viaje cerrado "imprime" su ticket y queda sellado con su calidad.

| Color | Hex | Rol |
|---|---|---|
| Papel térmico | `#F3F4F1` | Fondo (frío; no es el crema de las plantillas) |
| Tinta térmica | `#1D2026` | Texto y cifras · 14,8:1 |
| Gris de copia | `#5A606B` | Texto secundario · 5,7:1 |
| Sello morado | `#4B3BA6` | Acción principal, foco, enlaces, sello "Estimado" · 7,7:1 |
| Sello rojo | `#B3261E` | Anulado, errores, bloqueos · 5,9:1 |
| Verde surtidor | `#1E6B47` | Sello "Exacto", confirmaciones · 5,9:1 |

Modo oscuro: fondo `#15171B`, texto `#ECEDE8`, morado `#A99CF0`, rojo `#F2867D`, verde `#6CC79A` (todos ≥ 7:1).

**Tipografía:** *Atkinson Hyperlegible Next* para toda la interfaz y las cifras. La diseñó el Braille Institute para baja visión y diferencia 0/O, 1/l/I, 5/S y 8/B, que es justo lo que se confunde al leer placas y odómetros a pleno sol. *Atkinson Hyperlegible Mono* **solo dentro del ticket**, como la voz de la impresora.

**Layout:** alineado a la izquierda. En el móvil del chofer el ticket es una columna angosta centrada (máx. 380 px). En escritorio se abre como panel lateral desde cualquier fila de viaje.

**Firma: el ticket sellado.** Al finalizar la ruta, el resumen aparece como un ticket: folio (V-0142), km de salida y de llegada, litros × precio, TOTAL, km/L y L/100 km, con borde dentado de papel arrancado. Encima, un sello girado −4° que dice "Exacto" (verde), "Estimado" (morado) o "Anulado" (rojo). El mismo ticket se ve en el detalle del viaje y en la ficha del camión (último viaje).

**Principios:**
1. Tinta negra para lo esencial. *(Aporte del retador "campo de datos en blanco y negro":)* en las pantallas del chofer, km, litros y montos van en tinta pura; nada de grises en cifras que se leen al sol.
2. El sello solo habla de estados: calidad, anulado, revisar. Nunca decora.
3. *(Aporte del retador "catálogo con números de serie":)* todo registro lleva un folio corto (V-0142, R-0311, M-0058) para hablar de él por teléfono.
4. *(Aporte de la "consola oscura":)* "Anular" vive aislado, con espacio vacío alrededor, nunca junto a "Guardar".
5. El ticket es el único elemento con borde dentado y tipografía mono; el resto de la app es sobrio.

**Riesgo honesto:** si el ticket se usa en más sitios de los indicados, la app se vuelve disfraz. La disciplina está en limitarlo al viaje.

### B — Señal vial (mi recomendación)

**Idea:** la señalización de la carretera venezolana. El verde de las señales de destino, el amarillo preventivo, el blanco reflectivo y el asfalto. El chofer lee estas señales todos los días, y la gerencia reconoce el mundo de la flota sin que nadie se lo explique.

| Color | Hex | Rol |
|---|---|---|
| Verde vía | `#0F5B3F` | Estructura: barra lateral, encabezado de cabina, paneles "en ruta"; texto blanco encima 8,1:1 |
| Blanco reflectivo | `#FFFFFF` | Fondo del contenido |
| Asfalto | `#22272B` | Texto y cifras · 15,1:1 |
| Hombrillo | `#E7EAE6` | Superficies secundarias, filas alternas, campos (asfalto encima 12,4:1) |
| Amarillo preventivo | `#F5C400` | **Solo alertas y "revisar"**, siempre con texto asfalto (9,2:1) |
| Rojo pare | `#C1121F` | Errores, anular, bloqueos · 6,2:1 |

Modo oscuro: fondo asfalto `#16191C`, superficies `#22272B`, verde vía aclarado `#3FA37A` para acentos, amarillo y rojo sin cambio de tono.

**Tipografía:** *Overpass*, una sola familia para todo. Es la versión libre de la Highway Gothic, la letra de las señales de carretera de toda América. Tiene numerales tabulares y pesos del 300 al 900: fina para tablas densas, 800 para la cifra principal de cada pantalla.

**Layout:** barra lateral verde en escritorio. En la cabina del chofer, un encabezado verde que cambia de mensaje según el estado. Contenido sobre blanco, tablas densas y alineadas, KPIs en una fila.

**Firma: el pórtico.** El estado "en ruta" se dibuja como una señal de destino verde: "Valera · salió 07:40 · hace 2 h 15 min · km 10.000". En la cabina del chofer es el panel que domina la pantalla mientras la ruta está abierta. En el dashboard, "Ahora mismo" es un pórtico: una fila de señales verdes, una por camión en ruta, que se actualiza en tiempo real.

**Principios:**
1. *(Aporte del retador "señalética amarilla de aeropuerto":)* el amarillo se reserva para alertas y nada más. En la cabina, solo la próxima decisión y la cifra principal en tamaño monumental.
2. *(Aporte del "manual con pestañas de color":)* cada módulo tiene un color fijo en gráficos y pestañas (combustible, mantenimiento, plantas) y nunca cambia de pantalla a pantalla.
3. *(Aporte del "feed vertical a pantalla completa":)* el chofer ve un paso por pantalla, y el siguiente ya está cargado.
4. El verde es estructura, no "éxito". La confirmación usa ícono y texto ("Ruta finalizada"), no un verde más.
5. Sin flechas decorativas: una flecha solo aparece donde indica dirección real.

**Riesgo honesto:** es la dirección más "temática". Mal ejecutada parece una app del ministerio de transporte. Y el verde de estructura obliga a disciplina para que no compita con el verde de los gráficos. Es mi favorita porque es la que el chofer entiende sin aprender nada y la que nadie más en la categoría tiene.

### C — Informe IP

**Idea:** continuidad con los reportes que la dirección de IP ya conoce: el azul marino `#1B2A4A`, las variaciones ▲/▼ y la tabla limpia. La audacia va en un solo elemento: la aguja de combustible convertida en gráfico de rendimiento.

| Color | Hex | Rol |
|---|---|---|
| Azul IP | `#1B2A4A` | Barra lateral, encabezados, botón principal; texto blanco encima 14,2:1 |
| Niebla andina | `#F3F5F8` | Fondo |
| Tinta | `#172033` | Texto y cifras · 14,9:1 |
| Gris acero | `#5B6577` | Texto secundario · 5,4:1 |
| Ámbar aguja | `#B07A12` | **Solo la aguja** y la marca del valor actual (elemento gráfico, 3,4:1 sobre niebla; no se usa para texto) |
| Verde ▲ / Rojo ▼ | `#1D7A4E` / `#B8322A` | Variaciones contra el período anterior, como en los reportes · 4,9:1 / 5,5:1 |

Modo oscuro: fondo `#0F1729`, superficies `#1B2A4A`, texto `#E8ECF3`, ámbar `#E0A93B`.

**Tipografía:** *Archivo*, de Omnibus-Type (Buenos Aires). Es una grotesca latinoamericana pensada para tablas y datos, con eje de ancho variable: normal en la interfaz, angosta en tablas densas. Una sola familia.

**Layout:** barra lateral azul, fondo niebla, KPIs con su ▲/▼ en la primera fila, gráficos en grilla de 2 columnas y tabla de unidades al pie. Es el layout que la dirección ya sabe leer.

**Firma: la regla de rendimiento.** Cada camión tiene una regla horizontal entre su mínimo y su máximo razonable de km/L (los campos `rendimiento_min_kml` y `rendimiento_max_kml`). Sobre ella van una franja con su promedio de 90 días, una marca con el promedio de la flota y la aguja ámbar en el km/L del período. Aparece en la tabla de camiones y en la cabecera de la ficha. Es un gráfico de bala con el lenguaje del indicador de combustible del tablero: se lee de un vistazo si el camión rinde como siempre o se salió de su rango.

**Principios:**
1. Cero curva de aprendizaje para la dirección: mismos colores y misma convención ▲/▼ de los reportes de IP.
2. El ámbar existe solo en la aguja. Si aparece en otro lado, deja de significar algo.
3. *(Aporte de la "consola oscura":)* acciones destructivas aisladas.
4. Tablas primero, gráficos como apoyo: cada gráfico tiene su tabla equivalente.

**Riesgo honesto:** es la más cercana a lo que ya hacen Fleetio y compañía. Funciona, pero se distingue poco, y la "regla" es lo único memorable. Elígela si la prioridad es continuidad con los reportes por encima de la identidad propia.

### 2.4 Retadores evaluados (resumen)

| Retador | Veredicto | Qué se quedó |
|---|---|---|
| Señalética amarilla de aeropuerto | Competitivo: gana en claridad para el chofer, pierde en identificación (los choferes de IP no viven en aeropuertos) | En B: amarillo solo para alertas; en móvil, solo la próxima decisión con la cifra en grande |
| Consola oscura de desarrollador | Descartado (fondo oscuro ilegible al sol; la gerencia no se identifica) | En A, B y C: lo destructivo aislado con espacio vacío |
| Campo de datos en blanco y negro | Descartado (abstracto) | En A: tinta pura para las cifras del chofer |
| Manual con pestañas de color por sección | Descartado | En B: un color fijo por módulo |
| Feed vertical a pantalla completa | Descartado | En B: un paso por pantalla para el chofer |
| Catálogo con números de serie | Descartado | En A: folio corto por registro (y propuesto para todas, ajuste M3) |

**La salida estándar:** si prefieres el estándar de la categoría (gris neutro con un acento azul, como Fleetio), también es una opción válida. Dímelo y la ejecuto sin ironía, tomando como vara de calidad dos o tres productos que elijas.

---

## 3. El botón "En ruta"

En ambas variantes: encender exige destino, km y combustible; apagar exige km de llegada y el dato de combustible. Área táctil ≥ 48 px (la acción principal a 64–72 px), confirmación clara y **"Deshacer" durante 10 segundos** después de iniciar (anula el viaje recién creado con motivo "Deshecho por el chofer" y queda en auditoría).

### Variante A — Interruptor en la tarjeta del camión

```
┌──────────────────────────────┐
│ ┌────┐ A12BC3D · Camión 3    │
│ │foto│ km 10.400             │
│ └────┘                       │
│                              │
│  En ruta        ( ○━━━━━ )   │  ← toca: abre la hoja "Iniciar ruta"
│                              │     (destino, km, combustible); al
└──────────────────────────────┘     confirmar, el interruptor queda encendido
```

- **A favor:** el estado se lee de un vistazo; es literalmente lo que pediste ("un botón que activa cada chofer").
- **En contra:** un interruptor promete efecto inmediato y aquí abre un formulario, así que rompe la expectativa. Además, "encendido" es ambiguo ("¿estoy en ruta o puedo salir?") y el control es pequeño para usarlo con prisa.

### Variante B — Botón de acción a todo el ancho, estado aparte

```
DISPONIBLE                              EN RUTA
┌──────────────────────────────┐       ┌──────────────────────────────┐
│ ● Disponible · km 10.400     │       │ ● En ruta a Valera           │
│                              │       │   desde 07:40 (2 h 15 min)   │
│ ┌──────────────────────────┐ │       │ ┌──────────────────────────┐ │
│ │       Iniciar ruta       │ │       │ │      Finalizar ruta      │ │
│ └──────────────────────────┘ │       │ └──────────────────────────┘ │
│   color de acción principal  │       │   contraste invertido        │
└──────────────────────────────┘       └──────────────────────────────┘
```

- **A favor:** el botón dice lo que hace ("Iniciar ruta" → aviso "Ruta iniciada"); objetivo grande en la zona del pulgar; el estado tiene su propio lugar, con texto y no solo color.
- **En contra:** ocupa más espacio que un interruptor (en la cabina de N2 sobra).

**Recomendación: variante B.** Cumple la idea de "un botón que acciona el chofer" sin la ambigüedad del interruptor, y encaja con las tres direcciones visuales (en B es el pórtico; en A, el botón que imprime el ticket).

---

## 4. Decisiones D1–D10

| ID | Decisión | Recomendación final | Por qué | Qué necesito de ti |
|---|---|---|---|---|
| D1 | Hosting del frontend | **GitHub Pages** si tu cuenta tiene **GitHub Pro**; si no, **Cloudflare Pages** | GitHub Pages desde un repo privado exige Pro. Cloudflare Pages: repos privados gratis, 500 builds/mes, transferencia sin límite, fallback de SPA con `_redirects` y previews por rama. Netlify queda tercero: desde 2025 cobra en créditos (≈ 20 deploys a producción al mes en el plan gratis) | Tu plan de GitHub |
| D2 | Librería de gráficos | **ECharts** con importación modular | Consistencia con el dashboard IP; buen rendimiento con series largas; tema oscuro; patrones de relleno (`aria.decal`) para no depender del color; con `echarts/core` pesa lo mismo que Recharts | — |
| D3 | Login de choferes | **Usuario + PIN de 6 dígitos** (correo sintético interno, nunca se envía nada). Flota, consulta y superusuario con correo + contraseña | Muchos choferes no usan correo. Supabase exige 6 caracteres mínimo. Bloqueo temporal tras 5 intentos fallidos. Una sola pantalla de entrada que acepta usuario o correo | — |
| D4 | Offline | **Nivel 2 en los flujos del chofer** (iniciar, finalizar, repostar, con fotos en cola); nivel 1 en lo demás | En carretera la señal falla. Los `id` ya se generan en el cliente, así que reenviar no duplica (T12). Safari no tiene Background Sync: la cola se vacía al abrir la app y con `online`/`visibilitychange`. La capa de cola se usa desde la F4 y se completa en la F7 | — |
| D5 | Precio para el costo del viaje | **Promedio ponderado** de las cargas del viaje | Equivale a lo pagado cuando sale lleno y llega llenando. Respaldo en cadena: cargas del viaje → última carga de la unidad → precio activo de menor orden del catálogo, marcado `estimado` | — |
| D6 | Nivel de combustible al salir | **Ambos:** "Lleno" (o heredado) por defecto, cuartos como atajo, litros si se saben | Un toque en el caso normal; precisión cuando existe | — |
| D7 | ¿Choferes registran mantenimiento? | **No.** Dejan una **novedad** en la nota al finalizar la ruta (texto + foto opcional), que aparece en la bandeja de revisión | Evita gastos duplicados o mal categorizados. Una tabla propia de novedades queda para la Fase 2 | — |
| D8 | ¿Quién crea ubicaciones? | **Solo flota y superusuario.** El catálogo trae "Otro (indicar en la nota)": el viaje queda marcado para revisar y flota le asigna el destino correcto | Evita "Mcbo" vs. "Maracaibo" sin bloquear al chofer en la calle | — |
| **D9** | **Plantas eléctricas** (nuevo) | **Una sola tabla `unidades`** con `tipo` (`camion` / `planta`) y `medidor` (`km` / `horas` / `ninguno`) | Las plantas comparten combustible, precios, repostajes, ciclos lleno-a-lleno (por horas en vez de km), mantenimiento y auditoría. Lo que cambia: no hacen viajes; su rendimiento es **L/h** y **$/h**; **nunca** entran en el km/L ni el $/km de la flota; el dashboard les da su propio bloque. Si no tienen horómetro, solo se mide litros y costo por período. Descarté tablas separadas (duplica lógica y pantallas) y tratarlas como camión con km = horas (confunde todo) | Preguntas 11 y 12 |
| **D10** | **Superusuario** (nuevo) | **El rol `admin` pasa a llamarse `superusuario`** y se asigna a ti y a la persona que IP designe. Puede: crear y editar camiones, plantas y cualquier unidad; crear choferes y usuarios y asignar roles; corregir **cualquier dato de entrada** de cualquier registro (km, horas, litros, precio copiado, tasa, fechas, chofer, destino), incluso de viajes cerrados; anular y restaurar; editar catálogos y umbrales de alertas | Lo que pediste cabe en el rol que ya existía, con los poderes escritos. Un quinto rol "por encima" de admin agrega complejidad sin ganar nada. **Límites que propongo mantener:** cada cambio pide motivo y queda en auditoría (lo exige el handoff); las cifras calculadas (km/L, costo) no se editan a mano, se corrige el dato de origen y el sistema recalcula; nada operativo se borra | Pregunta 13 |

---

## 5. Ajustes propuestos al modelo de datos (se aplican en la F1 si los apruebas)

| ID | Ajuste | Origen |
|---|---|---|
| M1 | `vehiculos` → **`unidades`** con `tipo unidad_tipo ('camion','planta')` y `medidor tipo_medidor ('km','horas','ninguno')`. `km_inicial` → `lectura_inicial`; en `repostajes` y `mantenimientos`, `km_odometro` → `lectura_medidor`. `viajes` conserva `km_salida`/`km_llegada` y la RPC valida que la unidad sea camión. El bucket `vehiculos` pasa a `unidades`. Vistas de KPI separadas para plantas (`v_kpi_planta_mes`: litros, $, horas, L/h, $/h) | D9 |
| M2 | `repostajes.carga_previa_omitida boolean default false` (solo flota/superusuario): corta el ciclo lleno-a-lleno cuando faltó registrar una carga, en vez de inflar el consumo | Fleetio "Reset usage", Simply Fleet, Drivvo |
| M3 | **Folio legible** por registro (`V-0142`, `R-0311`, `M-0058`) con secuencia del servidor. El `id` uuid generado en el cliente se mantiene para la idempotencia; mientras un registro espera en la cola offline se muestra "pendiente" | Dirección A, útil en las tres |
| M4 | Ubicación de sistema "Otro (indicar en la nota)", `tipo = 'otro'`, que marca el viaje como `revisar` | D8 |
| M5 | `rol_usuario`: `'admin'` → `'superusuario'`; matriz de permisos actualizada en `CLAUDE.md`; política RLS de edición total para superusuario siempre pasando por funciones que exigen motivo y escriben auditoría | D10 |

---

## 6. Preguntas abiertas

**Del handoff (sección 15):**

1. ¿Cuántos camiones y choferes hay? ¿Cada chofer tiene camión fijo o rotan?
2. ¿Todos usan gasolina o hay diésel? Confirmar que $0,50 y $0,60 son **USD por litro**.
3. Lista real de destinos/ubicaciones, y si el origen es siempre la sede (¿cuál?).
4. ¿Los choferes tienen correo o se usa usuario + PIN? (recomiendo PIN, D3)
5. ¿Quién registra el mantenimiento? ¿Se paga en Bs, en $ o en ambos?
6. ¿Una ruta tiene un solo destino o recorre varios clientes (paradas)?
7. ¿Se exige foto del odómetro y del recibo, o es opcional?
8. Nombre del sistema ("Flota IP" es provisional) y si se usa la identidad de IP (logo, azul marino).
9. Hosting (D1: ¿tienes GitHub Pro?) y **plan de Supabase**. Recomiendo **Pro** para producción: el gratuito se pausa tras 7 días sin uso y no tiene respaldos automáticos. Si arrancamos en gratuito, agrego un respaldo semanal programado.
10. ¿Hay histórico (Excel o cuaderno) de combustible o mantenimiento para importar?

**Nuevas (plantas eléctricas y superusuario):**

11. Las 2 plantas: ¿tienen **horómetro**? Marca/modelo, capacidad del tanque, ¿dónde están (sede, almacén)? ¿Gasolina o diésel?
12. ¿Cómo se abastecen las plantas (con bidones desde la estación, desde un tanque propio) y **quién registra** esas cargas? ¿Aplican los mismos precios de $0,50 / $0,60?
13. ¿**Quién** será el superusuario? ¿Tú y una persona de IP? ¿Flota también debe poder crear choferes, o solo el superusuario?
14. "Modificar cualquier valor": confirmo que se refiere a los datos de entrada y no a las cifras calculadas (recomiendo que el sistema siempre recalcule).

**Elecciones de este documento:** navegación (N1 / N2 / mixta recomendada), dirección visual (A / B / C / estándar), botón En ruta (A / B), D1–D10 y M1–M5.
