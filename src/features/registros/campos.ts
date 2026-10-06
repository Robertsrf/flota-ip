import type { CampoCorreccion } from './Acciones';

const FUENTES = [
  { valor: 'lleno', texto: 'Lleno' },
  { valor: 'heredado', texto: 'Lleno (heredado)' },
  { valor: 'aguja', texto: 'Aguja' },
  { valor: 'litros', texto: 'Litros declarados' },
];

/** Campos de un viaje que se pueden corregir (D10: datos de entrada, nunca cifras calculadas) */
export function camposViaje(oficina: boolean, choferes: { id: string; nombre: string }[]): CampoCorreccion[] {
  const comunes: CampoCorreccion[] = [
    { clave: 'km_salida', etiqueta: 'Km de salida', tipo: 'numero', unidad: 'km' },
    { clave: 'km_llegada', etiqueta: 'Km de llegada', tipo: 'numero', unidad: 'km' },
    { clave: 'litros_salida', etiqueta: 'Litros al salir', tipo: 'numero', unidad: 'L' },
    { clave: 'fuente_nivel_salida', etiqueta: 'Cómo se midió el nivel al salir', tipo: 'seleccion', opciones: FUENTES },
    { clave: 'litros_llegada_aguja', etiqueta: 'Litros al llegar (aguja)', tipo: 'numero', unidad: 'L' },
    { clave: 'notas', etiqueta: 'Notas', tipo: 'largo' },
  ];
  if (!oficina) return comunes;
  return [
    { clave: 'salida_at', etiqueta: 'Salida', tipo: 'fechahora' },
    { clave: 'llegada_at', etiqueta: 'Llegada', tipo: 'fechahora' },
    ...comunes.slice(0, 5),
    { clave: 'chofer_id', etiqueta: 'Chofer', tipo: 'seleccion', opciones: choferes.map((c) => ({ valor: c.id, texto: c.nombre })) },
    comunes[5],
  ];
}

export function camposRepostaje(oficina: boolean, precios: { id: string; etiqueta: string }[]): CampoCorreccion[] {
  const base: CampoCorreccion[] = [
    { clave: 'lectura_medidor', etiqueta: 'Km u horas', tipo: 'numero' },
    { clave: 'litros', etiqueta: 'Litros', tipo: 'numero', unidad: 'L' },
    { clave: 'precio_id', etiqueta: 'Precio elegido', tipo: 'seleccion', opciones: precios.map((p) => ({ valor: p.id, texto: p.etiqueta })) },
    { clave: 'tanque_lleno', etiqueta: '¿Tanque lleno?', tipo: 'booleano' },
    { clave: 'estacion', etiqueta: 'Estación', tipo: 'texto' },
    { clave: 'notas', etiqueta: 'Notas', tipo: 'largo' },
  ];
  if (!oficina) return base;
  return [
    { clave: 'fecha', etiqueta: 'Fecha y hora', tipo: 'fechahora' },
    ...base.slice(0, 3),
    { clave: 'precio_usd_litro', etiqueta: 'Precio por litro copiado ($)', tipo: 'numero', unidad: '$/L' },
    base[3],
    { clave: 'carga_previa_omitida', etiqueta: '¿Faltó registrar la carga anterior?', tipo: 'booleano' },
    ...base.slice(4),
  ];
}

export function camposGasto(unidades: { id: string; placa: string | null; alias: string | null }[], categorias: { id: string; nombre: string }[]): CampoCorreccion[] {
  return [
    { clave: 'unidad_id', etiqueta: 'Unidad', tipo: 'seleccion', opciones: unidades.map((u) => ({ valor: u.id, texto: u.placa ?? u.alias ?? '' })) },
    { clave: 'categoria_id', etiqueta: 'Categoría', tipo: 'seleccion', opciones: categorias.map((c) => ({ valor: c.id, texto: c.nombre })) },
    { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha' },
    { clave: 'lectura_medidor', etiqueta: 'Km u horas', tipo: 'numero' },
    { clave: 'moneda', etiqueta: 'Moneda', tipo: 'seleccion', opciones: [{ valor: 'USD', texto: 'Dólares' }, { valor: 'VES', texto: 'Bolívares' }] },
    { clave: 'monto', etiqueta: 'Monto', tipo: 'numero' },
    { clave: 'bs_por_usd', etiqueta: 'Tasa BCV (Bs por $)', tipo: 'numero' },
    { clave: 'proveedor', etiqueta: 'Proveedor', tipo: 'texto' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'largo' },
  ];
}
