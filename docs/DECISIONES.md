# Decisiones y supuestos

Registro de lo que se asumió o decidió sin bloquear el trabajo (handoff, sección 0.8). Estado: **propuesta** (espera el checkpoint), **aprobada**, **descartada**.

| # | Fecha | Decisión o supuesto | Motivo | Estado |
|---|---|---|---|---|
| 001 | 03/10/2026 | Se instalaron a nivel de usuario las skills `impeccable` (pbakaus), `frontend-design` y `webapp-testing` (anthropics/skills). `ui-ux-pro-max` ya estaba instalada. Su buscador local necesita Python, que no está instalado: se consultó su referencia estática | Sección 3 del handoff | aprobada |
| 002 | 03/10/2026 | `PRODUCT.md` (contexto de `impeccable teach`) se escribió a partir de las secciones 1, 2, 9, 10 y 11 del handoff, **sin la entrevista** que pide la skill. Los supuestos van marcados **[por confirmar]** y el checkpoint F0 hace de ronda de aprobación | El handoff fija la fuente de `teach` y manda llevar las dudas al checkpoint | propuesta |
| 003 | 03/10/2026 | Las direcciones visuales salieron del proceso `impeccable concept-seed` (modo operar, semilla `5ae8474e`). No se abrió la página de decisión interactiva de la skill: las opciones se presentan en `docs/OPCIONES.md` y en `docs/opciones-visuales.html` | El handoff pide presentar en `OPCIONES.md` y esperar a Roberts | aprobada |
| 004 | 03/10/2026 | Nuevo requisito de Roberts (03/10): **2 plantas eléctricas** que consumen el mismo combustible. Propuesta D9 / M1: tabla `unidades` con `tipo` y `medidor` (km / horas / ninguno); las plantas no hacen viajes; métricas L/h y $/h, separadas del km/L de la flota | Mensaje de Roberts durante la F0 | propuesta |
| 005 | 03/10/2026 | Nuevo requisito de Roberts (03/10): **superusuario** capaz de modificar cualquier valor y de agregar unidades y choferes. Propuesta D10 / M5: el rol `admin` pasa a `superusuario`, con motivo y auditoría obligatorios y sin editar a mano las cifras calculadas | Mensaje de Roberts; sección 0.7 del handoff (nunca borrar, siempre auditar) | propuesta |
| 006 | 03/10/2026 | Tasa BCV: mapear `bs_por_usd = promedio` y `fecha = fechaActualizacion` convertida a `America/Caracas`. `compra` y `venta` vienen en `null` y no se usan | Respuesta real de `ve.dolarapi.com` verificada el 03/10/2026 | aprobada (se implementa en F5) |
| 007 | 03/10/2026 | Propuesta M2: bandera `carga_previa_omitida` en `repostajes` para cortar el ciclo lleno-a-lleno cuando faltó una carga | Patrón común: Fleetio, Simply Fleet, Drivvo | propuesta |
| 008 | 03/10/2026 | Propuesta M3: folio legible por registro (V-0142…), además del uuid generado en el cliente | Soporte telefónico; idempotencia intacta | propuesta |
| 009 | 03/10/2026 | Repositorio git local creado en `main`. **No** se creó el repo remoto en GitHub: es parte de la F1 y depende de D1 | Fase 0 solo produce documentos | aprobada |
| 010 | 03/10/2026 | `docs/HANDOFF.md` es copia exacta de `HANDOFF_Flota_IP.md` (737 líneas). Se guardó en la F0 en vez de la F1 para que el repo sea autosuficiente desde el primer commit | Sección 0.3 del handoff | aprobada |
