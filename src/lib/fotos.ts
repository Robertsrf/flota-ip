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
      // Su web worker descarga la librería desde un CDN: falla sin señal y lo bloquea la CSP
      useWebWorker: false,
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

/**
 * Ruta del archivo de un documento: documentos/<documento_id>/archivo.jpg. Va en su propio bucket
 * porque una licencia o un certificado médico solo lo ven su dueño y la oficina (migración 09).
 */
export function rutaDocumento(documentoId: string, tipo = 'image/jpeg'): string {
  return `${documentoId}/archivo.${tipo === 'application/pdf' ? 'pdf' : 'jpg'}`;
}

export type Bucket = 'comprobantes' | 'unidades' | 'documentos';

/** Sube (o reemplaza) un archivo; reintentar con la misma ruta no duplica nada. */
export async function subirArchivo(bucket: Bucket, ruta: string, datos: Blob): Promise<string> {
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
export async function urlFirmada(bucket: Bucket, ruta: string | null | undefined): Promise<string | null> {
  if (!ruta) return null;
  const clave = `${bucket}/${ruta}`;
  const c = cacheUrls.get(clave);
  if (c && c.vence > Date.now()) return c.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(ruta, 3600);
  if (error || !data) return null;
  cacheUrls.set(clave, { url: data.signedUrl, vence: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
