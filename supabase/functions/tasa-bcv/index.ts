// tasa-bcv: guarda la tasa oficial del día desde ve.dolarapi.com (sección 7.4).
// La llama pg_cron (encabezado x-cron-secret) o un usuario de oficina con su
// sesión. Formato verificado el 03/10/2026:
//   { moneda: "USD", fuente: "oficial", promedio: 866.5612, fechaActualizacion: "2026-10-02T00:00:00-04:00", compra: null, venta: null }
// Si la API falla no se bloquea nada: la app pide la tasa a mano.
import { clienteServicio, cors, errorInterno, mismoSecreto, perfilQueLlama, respuesta } from '../_compartido/http.ts';

const API = 'https://ve.dolarapi.com/v1/dolares/oficial';

function fechaCaracas(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(iso));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return respuesta(req, 405, { error: 'Método no permitido.' });

  const servicio = clienteServicio();
  const secreto = Deno.env.get('CRON_SECRET');
  const porCron = mismoSecreto(req.headers.get('x-cron-secret'), secreto);
  let usuario: string | null = null;
  if (!porCron) {
    const quien = await perfilQueLlama(req, servicio);
    if (!quien || (quien.rol !== 'superusuario' && quien.rol !== 'flota')) {
      return respuesta(req, 403, { error: 'Solo flota puede actualizar la tasa.' });
    }
    usuario = quien.id;
  }

  const cuerpo = await req.json().catch(() => ({})) as { manual?: number; fecha?: string };
  if (cuerpo.manual) {
    const valor = Number(cuerpo.manual);
    const fecha = String(cuerpo.fecha ?? '');
    if (!(valor > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return respuesta(req, 400, { error: 'Indica la fecha (AAAA-MM-DD) y una tasa mayor que cero.' });
    if (fecha > fechaCaracas(new Date().toISOString())) return respuesta(req, 400, { error: 'La fecha de la tasa no puede estar en el futuro.' });
    const { error } = await servicio.from('tasas_bcv').upsert(
      { fecha, bs_por_usd: valor, fuente: 'manual', manual: true, created_by: usuario, capturada_at: new Date().toISOString() },
      { onConflict: 'fecha' },
    );
    if (error) return errorInterno(req, error);
    return respuesta(req, 200, { fecha, bs_por_usd: valor, fuente: 'manual' });
  }

  try {
    const r = await fetch(API, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`la API respondió ${r.status}`);
    const datos = await r.json() as { promedio?: number; fechaActualizacion?: string };
    const valor = Number(datos.promedio);
    if (!(valor > 0) || !datos.fechaActualizacion) throw new Error('la respuesta no trae promedio ni fecha');
    const fecha = fechaCaracas(datos.fechaActualizacion);
    // Una tasa escrita a mano para ese día no se pisa
    const { data: existente } = await servicio.from('tasas_bcv').select('manual').eq('fecha', fecha).maybeSingle();
    if (existente?.manual) return respuesta(req, 200, { fecha, bs_por_usd: valor, fuente: 'manual existente', sin_cambios: true });
    const { error } = await servicio.from('tasas_bcv').upsert(
      { fecha, bs_por_usd: valor, fuente: 've.dolarapi.com', manual: false, capturada_at: new Date().toISOString() },
      { onConflict: 'fecha' },
    );
    if (error) throw new Error(error.message);
    return respuesta(req, 200, { fecha, bs_por_usd: valor, fuente: 've.dolarapi.com' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido';
    return respuesta(req, 502, { error: `No se pudo consultar la tasa BCV (${msg}). Escríbela a mano.` });
  }
});
