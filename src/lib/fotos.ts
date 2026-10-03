import { supabase } from './supabase';

/** Comprime una foto antes de subirla: máx. 1280 px y ~200 KB (los datos móviles son caros). */
export async function comprimirFoto(archivo: File | Blob): Promise<Blob> {
  if (archivo.type === 'application/pdf') return archivo;
  try {
    const { default: comprimir } = await import('browser-image-compression');
    return await comprimir(archivo as File, {
      maxWidthOrHeight: 1280,
      maxSizeMB: 0.2,
      fileType: 'image/jpeg',
      useWebWorker: true,
      initialQuality: 0.8,
    });
  } catch {
    return archivo;
  }
}

/** Ruta de un comprobante: comprobantes/<uid>/<registro>-<campo>.jpg */
export function rutaComprobante(uid: string, registroId: string, campo: string, tipo = 'image/jpeg'): string {
  const ext = tipo === 'application/pdf' ? 'pdf' : 'jpg';
  return `${uid}/${registroId}-${campo.replace(/^p_/, '')}.${ext}`;
}

/** Sube (o reemplaza) un archivo; reintentar con la misma ruta no duplica nada. */
export async function subirArchivo(bucket: 'comprobantes' | 'unidades', ruta: string, datos: Blob): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(ruta, datos, {
    upsert: true,
    contentType: datos.type || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;
  return ruta;
}

const cacheUrls = new Map<string, { url: string; vence: number }>();

/** URL firmada (los buckets son privados). Se guarda en memoria hasta poco antes de vencer. */
export async function urlFirmada(bucket: 'comprobantes' | 'unidades', ruta: string | null | undefined): Promise<string | null> {
  if (!ruta) return null;
  const clave = `${bucket}/${ruta}`;
  const c = cacheUrls.get(clave);
  if (c && c.vence > Date.now()) return c.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(ruta, 3600);
  if (error || !data) return null;
  cacheUrls.set(clave, { url: data.signedUrl, vence: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
