// Traduce errores de Supabase/Postgres a mensajes para la persona que usa la app.
// Los errores de negocio (P0001) ya vienen redactados desde la base.

export interface ErrorApp {
  mensaje: string;
  ayuda?: string;
  codigo?: string;
  detalle?: string;
  /** true si vale la pena reintentar (sin señal, servidor caído) */
  deRed: boolean;
  /** true si la base rechazó el dato: no se reintenta */
  rechazado: boolean;
}

interface ErrorPostgrest {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  name?: string;
}

const RESTRICCIONES: Record<string, string> = {
  viajes_km_llegada_ck: 'El km de llegada debe ser mayor que el de salida.',
  viajes_llegada_ck: 'La llegada no puede ser anterior a la salida.',
  unidades_combustible_inicial_ck: 'El combustible inicial no puede superar la capacidad del tanque.',
  unidades_camion_ck: 'Un camión necesita placa y medidor en km.',
  unidades_lectura_ck: 'Indica la lectura inicial del medidor (o elige "sin medidor").',
  unidades_rango_rendimiento_ck: 'El rendimiento mínimo debe ser menor que el máximo.',
  unidades_nombre_ck: 'Escribe la placa o un nombre para la unidad.',
  unidades_placa_key: 'Ya hay una unidad con esa placa.',
  mantenimientos_tasa_ck: 'Un gasto en bolívares necesita la tasa BCV.',
  ubicaciones_nombre_uq: 'Ya existe una ubicación con ese nombre en ese municipio.',
  categorias_mantenimiento_nombre_key: 'Ya existe una categoría con ese nombre.',
  perfiles_usuario_key: 'Ese usuario ya existe.',
  tasas_bcv_pkey: 'Ya hay una tasa registrada para esa fecha.',
  documentos_archivo_ck: 'El archivo no corresponde a este documento. Vuelve a elegir la foto o el PDF.',
};

export function esErrorDeRed(e: unknown): boolean {
  if (!e) return false;
  const x = e as ErrorPostgrest & { message?: string };
  const msg = (x.message ?? '').toLowerCase();
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    x.name === 'AbortError' ||
    (typeof x.status === 'number' && (x.status === 0 || x.status >= 500))
  );
}

export function traducirError(e: unknown): ErrorApp {
  if (!e) return { mensaje: 'Algo salió mal.', deRed: false, rechazado: false };
  if (esErrorDeRed(e)) {
    return {
      mensaje: 'Sin conexión con el servidor.',
      ayuda: 'Revisa la señal. Lo que registres queda guardado en el teléfono y se envía solo.',
      deRed: true,
      rechazado: false,
    };
  }
  const x = e as ErrorPostgrest;
  const codigo = x.code;
  const base = { codigo, detalle: x.details ?? undefined, deRed: false };

  if (codigo === 'P0001') {
    return { ...base, mensaje: x.message ?? 'Dato no válido.', ayuda: x.hint || undefined, detalle: x.details || undefined, rechazado: true };
  }
  if (codigo === '42501') {
    const propio = x.message && !x.message.startsWith('permission denied') && !x.message.startsWith('new row violates');
    return { ...base, mensaje: propio ? x.message! : 'Tu usuario no tiene permiso para esta acción.', rechazado: true };
  }
  if (codigo === '23505' || codigo === '23514' || codigo === '23503') {
    const restriccion = Object.keys(RESTRICCIONES).find((k) => x.message?.includes(k) || x.details?.includes(k));
    return {
      ...base,
      mensaje: restriccion ? RESTRICCIONES[restriccion] : codigo === '23505' ? 'Ese registro ya existe.' : 'El dato no cumple una regla de la base.',
      rechazado: true,
    };
  }
  if (codigo === 'PGRST116') return { ...base, mensaje: 'No se encontró el registro.', rechazado: true };
  if (codigo === 'PGRST301' || codigo === '401' || x.message?.includes('JWT')) {
    return { ...base, mensaje: 'Tu sesión venció. Vuelve a entrar.', rechazado: true };
  }
  if (x.message === 'Invalid login credentials') {
    return { ...base, mensaje: 'Usuario o clave incorrectos.', rechazado: true };
  }
  return { ...base, mensaje: x.message || 'Algo salió mal.', rechazado: Boolean(codigo) };
}

/** Lanza el error si la respuesta de Supabase lo trae; si no, devuelve los datos */
export function exigir<T>(resp: { data: T | null; error: unknown }): T {
  if (resp.error) throw resp.error;
  return resp.data as T;
}
