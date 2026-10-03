import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CabeceraCabina } from '@/app/DisenoCabina';
import { Calidad, Cargando, EstadoVacio, Etiqueta } from '@/components/datos';
import type { Gasto, Viaje } from '@/lib/api';
import { exigir } from '@/lib/errores';
import { bs, fecha, km as fKm, kml, usd } from '@/lib/formato';
import { usePendientes } from '@/lib/offline/cola';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';

const ESTADO_GASTO = { pendiente: 'Por aprobar', aprobado: 'Aprobado', rechazado: 'Rechazado' } as const;

export function Historial() {
  const { sesion } = useSesion();
  const uid = sesion?.user.id;
  const pendientes = usePendientes(uid);
  const viajes = useQuery({
    queryKey: ['viajes', 'mios', uid],
    enabled: Boolean(uid),
    queryFn: async () =>
      exigir(await supabase.from('v_viajes').select('*').eq('chofer_id', uid!).order('salida_at', { ascending: false }).limit(30)) as Viaje[],
  });
  const gastos = useQuery({
    queryKey: ['gastos', 'mios', uid],
    enabled: Boolean(uid),
    queryFn: async () =>
      exigir(await supabase.from('v_mantenimientos').select('*').eq('created_by', uid!).order('created_at', { ascending: false }).limit(20)) as Gasto[],
  });

  return (
    <>
      <CabeceraCabina volver={{ a: '/cabina', texto: 'Cabina' }}>
        <h1 className="mt-3 text-3xl font-black">Mis registros</h1>
      </CabeceraCabina>
      <div className="flex flex-col gap-6 px-4 pb-8 pt-5">
        {pendientes.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold">En el teléfono</h2>
            <ul className="flex flex-col gap-2">
              {pendientes.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border-2 border-linea p-3">
                  <span className="first-letter:uppercase">{p.resumen}</span>
                  <Etiqueta tono={p.estado === 'error' ? 'peligro' : 'alerta'}>{p.estado === 'error' ? 'Rechazado' : 'Esperando señal'}</Etiqueta>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">Mis rutas</h2>
          {viajes.isLoading ? (
            <Cargando />
          ) : !viajes.data?.length ? (
            <EstadoVacio titulo="Aún no tienes rutas">Inicia la primera desde la cabina.</EstadoVacio>
          ) : (
            <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-xl border-2 border-linea">
              {viajes.data.map((v) => (
                <li key={v.id}>
                  <Link to={v.estado === 'en_curso' ? '/cabina' : `/cabina/resumen/${v.id}`} className="block px-4 py-3 hover:bg-superficie-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-bold">{v.ruta}</span>
                      <span className="cifra text-sm text-tinta-2">{fecha(v.salida_at)}</span>
                    </div>
                    <div className="cifra mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span>{v.placa}</span>
                      {v.estado === 'en_curso' ? (
                        <Etiqueta tono="via">En ruta</Etiqueta>
                      ) : v.estado === 'anulado' ? (
                        <Etiqueta tono="peligro">Anulada</Etiqueta>
                      ) : (
                        <>
                          <span>{fKm(v.km_recorridos)}</span>
                          <span>{kml(v.rendimiento_kml)}</span>
                          <span>{usd(v.costo_combustible_usd)}</span>
                          <Calidad valor={v.calidad} compacta />
                        </>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">Mis gastos</h2>
          {gastos.isLoading ? (
            <Cargando />
          ) : !gastos.data?.length ? (
            <EstadoVacio titulo="No has registrado gastos" />
          ) : (
            <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-xl border-2 border-linea">
              {gastos.data.map((g) => (
                <li key={g.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{g.categoria_nombre}</span>
                    <Etiqueta tono={g.estado_aprobacion === 'rechazado' ? 'peligro' : g.estado_aprobacion === 'pendiente' ? 'alerta' : 'via'}>
                      {ESTADO_GASTO[g.estado_aprobacion ?? 'pendiente']}
                    </Etiqueta>
                  </div>
                  <p className="cifra mt-1 text-sm">
                    {fecha(g.fecha)} · {g.moneda === 'VES' ? `${bs(g.monto)} (${usd(g.monto_usd)})` : usd(g.monto)}
                  </p>
                  {g.rechazo_motivo && <p className="mt-1 text-sm text-peligro">Motivo: {g.rechazo_motivo}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
