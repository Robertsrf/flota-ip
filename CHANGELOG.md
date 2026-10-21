# Novedades de Flota IP

Todas las versiones del sistema, de la más nueva a la más vieja. Se lee también dentro de la app, en **Novedades**.

- Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Tipos de cambio: Agregado, Cambiado, Corregido, Eliminado, Obsoleto y Seguridad.
- Versiones: `0.x` mientras se construye; la `1.0.0` será la primera puesta en marcha con datos reales. Cada versión lleva su fecha (AAAA-MM-DD) y su etiqueta de git (`v0.6.0`).
- Cómo se mantiene: todo cambio entra en "Sin publicar" el mismo día que se hace. Al cerrar una versión, esa sección pasa a llamarse como la versión, con su fecha, y se sube el número en `package.json`.

## [Sin publicar]

### Agregado

- `PASO_A_PASO_PUBLICAR.md`: guía en orden para mover el proyecto a otra computadora, subirlo a GitHub, conectarlo a Supabase y cerrar la versión 1.0.0.

### Corregido

- Al crear un usuario que ya existe, la pantalla Usuarios avisa "Ya hay un usuario con ese correo." en vez de mostrar un error inesperado.
- Los usuarios de flota, consulta o superusuario creados desde la pantalla Usuarios quedaban como choferes en Supabase. Ahora reciben el rol elegido.

## [0.6.1] - 2026-10-20 - Fotos de documentos protegidas

### Seguridad

- Las fotos y PDF de los documentos (licencias, certificados médicos, pólizas) se guardan aparte de los recibos y solo los abren la oficina y quien puede ver ese documento. Antes quedaban junto a los recibos, que cualquier usuario puede abrir: otro chofer habría podido ver el certificado médico de un compañero.
- Un documento solo puede llevar un archivo de su propia carpeta.

## [0.6.0] - 2026-10-20 - Más fácil en el teléfono, vencimientos y ayuda

### Agregado

- **Vencimientos**: recordatorios de servicio por km o por fecha (cambio de aceite, filtros, cauchos). Avisan cuando falta poco y cuando ya se pasó. Se marcan hechos solos al aprobarse un gasto de su categoría para esa unidad, o a mano con "Marcar hecho".
- **Vencimientos**: documentos con fecha de vencimiento de los camiones (póliza RCV, permiso de circulación) y de las personas (licencia, certificado médico), con foto o PDF. "Renovar" guarda el anterior en el historial.
- Los servicios y documentos vencidos o por vencer aparecen en el dashboard, en la revisión y en una pestaña nueva de la ficha de cada unidad. El chofer ve en su cabina los de su camión y los suyos.
- **Ayuda** dentro de la app: qué significa cada cifra y cómo se calcula, guía para cada tipo de usuario y preguntas frecuentes.
- **Novedades** dentro de la app: esta lista, con la versión que tienes instalada.
- **Primeros pasos** en el dashboard para arrancar con la base vacía: sede, destinos, camiones, choferes, vencimientos y primera ruta. Se oculta sola al completarse.
- Cada indicador del dashboard se explica al tocar su nombre.
- La revisión muestra lo que escribió el chofer en su novedad sin abrir la ruta, y deja darla por revisada ahí mismo.

### Cambiado

- Listas en el teléfono y la tableta: cada fila ocupa dos o tres renglones, con la cifra principal a la derecha, en vez de ocho renglones de "rótulo: valor". La lista de viajes del mes pasó de casi 10 pantallas de alto a menos de 5.
- Filtros en el teléfono: un solo botón con el resumen ("Este mes • DEMO-001") que abre la hoja de filtros. Los números quedan arriba, sin desplazarse.
- Viajes: el buscador queda siempre a la vista, y la calidad y el estado van en una sola columna para que la tabla quepa completa en una pantalla de escritorio.
- Catálogos y usuarios: tocar una fila abre su ficha; eliminar, reactivar y "Nuevo PIN" están dentro de ella.
- Dashboard: las alertas urgentes van primero. En el teléfono se ven tres y las demás en la revisión.

### Corregido

- Desde el teléfono no se podían editar ni eliminar ubicaciones, precios ni categorías, ni darle un PIN nuevo a un chofer: la columna de acciones estaba oculta.
- En escritorio, tocar "Nuevo PIN" abría también la edición del usuario (dos hojas a la vez).

### Seguridad

- El sitio publicado lleva una política de seguridad de contenido (CSP): solo corre el código propio y solo se conecta con el proyecto de Supabase.
- La compresión de fotos ya no descarga código de un servidor externo (además fallaba sin señal).
- Los recordatorios y documentos solo se escriben con funciones que exigen el rol de flota y dejan auditoría. La licencia de un chofer no la ven los demás choferes.

## [0.5.0] - 2026-10-06 - Lista para la puesta en marcha (F8)

### Agregado

- Verificación automática en cada cambio (tipos, lint, pruebas, compilación y flujos completos) y despliegue a GitHub Pages desde `main`.
- Respaldo semanal cifrado de la base y una consulta cada 3 días para que Supabase no pause el proyecto.
- El chofer corrige su ruta desde el resumen mientras dure la ventana de corrección (30 minutos, configurable).
- Guía de puesta en marcha, manual de una página para choferes y script del primer superusuario.

### Cambiado

- Revisión de acabado del diseño a 360 y 1440 px: placa que no se parte, cifra y unidad juntas, foco visible sobre el verde, contraste AA en claro y oscuro.
- La app instalada pesa 1,1 MB menos: los gráficos y el Excel se descargan solo cuando la oficina los usa.

### Seguridad

- Una sola lista blanca de funciones que el cliente puede ejecutar. Antes, por los permisos por defecto de Supabase, cualquier usuario con sesión podía llamar funciones internas del motor.

## [0.4.0] - 2026-10-06 - Pantallas de oficina (F3 a F7)

### Agregado

- Camiones y plantas: lista, alta con foto y ficha con pestañas (resumen, viajes, combustible, mantenimiento y datos).
- Viajes con filtros y detalle con auditoría; combustible; mantenimiento con aprobación de gastos; bandeja de revisión; catálogos; usuarios; mi cuenta.
- Corrección de cualquier dato con motivo e historial de cambios. Exportación a CSV y Excel en todas las tablas.
- Tasa BCV automática (ve.dolarapi.com) o manual, y alta de usuarios desde la app (funciones en el servidor).
- Pruebas de punta a punta: flujos del chofer, sin señal, oficina y permisos.

## [0.3.0] - 2026-10-03 - Cabina del chofer y dashboard (F2 a F4)

### Agregado

- Entrada con usuario y PIN de 6 dígitos (choferes) o contraseña (oficina), con bloqueo temporal tras 5 intentos.
- Cabina del chofer: iniciar ruta con paradas y nivel heredado, finalizar con vista previa del cálculo, repostar, registrar gastos e historial. Botón "Deshacer" de 10 segundos.
- Sin señal: lo que registra el chofer se guarda en el teléfono y se envía solo al volver la conexión.
- App instalable en el teléfono (PWA), con aviso cuando hay una versión nueva.
- Dashboard con filtros, indicadores con ▲/▼, "Ahora mismo" (camiones en ruta), alertas y gráficos con su tabla equivalente.
- Dirección visual "Señal vial", con modo claro y oscuro.

## [0.2.0] - 2026-10-03 - Base de datos y motor de cálculo (F1)

### Agregado

- Unidades (camiones y plantas), destinos, precios, categorías, viajes con paradas, repostajes, tasas BCV, mantenimiento con aprobación y auditoría de cada corrección.
- Motor de cálculo en el servidor: km, litros consumidos, km/L, L/100 km, costo del viaje y costo por km, con la calidad del dato (exacto, estimado o incompleto).
- Permisos por rol (superusuario, flota, chofer y consulta) en todas las tablas.
- Datos de demostración y pruebas de los casos T1 a T14 del handoff.

## [0.1.0] - 2026-10-03 - Investigación y decisiones (F0)

### Agregado

- Investigación de 11 sistemas de flota y combustible, opciones de diseño y decisiones aprobadas por Roberts Flores (navegación, dirección visual, PIN, modo sin señal, plantas eléctricas y superusuario).
