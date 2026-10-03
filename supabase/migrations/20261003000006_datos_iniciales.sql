-- =====================================================================
-- Flota IP · Datos iniciales de producción (Anexo A del handoff)
-- Los destinos reales los carga Roberts desde la app; aquí solo va la
-- ubicación de sistema "Otro" (D8).
-- =====================================================================

insert into public.configuracion (id) values (true) on conflict (id) do nothing;

insert into public.precios_combustible (etiqueta, precio_usd_litro, orden) values
  ('$0,50', 0.500, 1),
  ('$0,60', 0.600, 2);

insert into public.categorias_mantenimiento (nombre, orden) values
  ('Cauchos', 1), ('Repuestos', 2), ('Mano de obra', 3), ('Pintura', 4),
  ('Lavado', 5), ('Aceite', 6), ('Filtros', 7),
  ('Frenos', 8), ('Batería', 9), ('Sistema eléctrico', 10), ('Latonería', 11),
  ('Otros', 99);

insert into public.ubicaciones (nombre, tipo, es_sistema)
values ('Otro (indicar en la nota)', 'otro', true);
