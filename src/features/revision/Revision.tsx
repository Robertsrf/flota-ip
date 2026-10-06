import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Boton } from '@/components/controles';
import { Cargando, EstadoVacio, MensajeError, Rombo } from '@/components/datos';
import { EncabezadoPagina, Seccion } from '@/components/estructura';
import type { Alerta, Viaje } from '@/lib/api';
import { exigir, traducirError } from '@/lib/errores';
import { fechaHora } from '@/lib/formato';
import { supabase } from '@/lib/supabase';
import { useTiempoReal } from '@/lib/tiempoReal';
import { useAlertas } from '@/features/dashboard/datos';
import { ListaPorAprobar, usePendientesAprobacion } from '@/features/mantenimiento/Mantenimiento';
import { FinalizarOficina } from '@/features/registros/FormulariosOficina';

const GRUPOS: { tipo: string; titulo: string; ayuda: string }[] = [
  { tipo: 'ruta_abierta', titulo: 'Rutas abiertas mucho tiempo', ayuda: 'El chofer no la finalizó. Pregúntale los datos o ciérrala con lo que sepas.' },
  { tipo: 'revisar', titulo: 'Rutas para revisar', ayuda: 'Destino "Otro", novedades del chofer o rendimiento fuera del rango del camión.' },
  { tipo: 'consumo_anomalo', titulo: 'Consumo anómalo', ayuda: 'El viaje rindió mucho menos que el promedio del camión en 90 días.' },
  { tipo: 'km_sin_ruta', titulo: 'Km sin ruta registrada', ayuda: 'El tablero avanzó entre una llegada y la siguiente salida sin ruta.' },
  { tipo: 'viaje_incompleto', titulo: 'Rutas sin datos de combustible', ayuda: 'Falta el nivel al llegar: corrige la ruta si el chofer sabe la aguja.' },
  { tipo: 'divergencia', titulo: 'Divergencia de cálculo', ayuda: 'En el mes, los viajes y los ciclos lleno a lleno dan rendimientos distintos.' },
];

function useViaje(id: string | null) {
  return useQuery({
    queryKey: ['viajes', id],
    enabled: Boolean(id),
    queryFn: async () => exigir(await supabase.from('v_viajes').select('*').eq('id', id!).single()) as Viaje,
  });
}

function AlertaFila({ a, alFinalizar }: { a: Alerta; alFinalizar?: (id: string) => void }) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border-2 border-linea bg-superficie p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <Rombo />
        <div>
          <p className="text-base">{a.mensaje}</p>
          <p className="cifra text-sm text-tinta-2">{fechaHora(a.fecha)}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {a.tipo === 'ruta_abierta' && a.viaje_id && alFinalizar && (
          <Boton variante="principal" tamano="sm" onClick={() => alFinalizar(a.viaje_id!)}>Finalizar</Boton>
        )}
        {a.viaje_id ? (
          <Link to={`/viajes/${a.viaje_id}`} className="inline-flex min-h-10 items-center rounded-lg border-2 border-tinta px-3 text-sm font-bold">Ver ruta</Link>
        ) : a.unidad_id ? (
          <Link to={`/unidades/${a.unidad_id}?pestana=combustible`} className="inline-flex min-h-10 items-center rounded-lg border-2 border-tinta px-3 text-sm font-bold">Ver unidad</Link>
        ) : null}
      </div>
    </li>
  );
}

export function Revision() {
  useTiempoReal();
  const alertas = useAlertas();
  const pendientes = usePendientesAprobacion();
  const [finalizarId, setFinalizarId] = useState<string | null>(null);
  const viaje = useViaje(finalizarId);
  const total = (alertas.data ?? []).filter((a) => a.tipo !== 'gasto_pendiente').length + (pendientes.data?.length ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Revisión"
        descripcion={total === 0 ? 'Nada pendiente: todo cuadra.' : `${total} ${total === 1 ? 'asunto' : 'asuntos'} por atender. Lo urgente va primero.`}
      />
      {alertas.error && <MensajeError error={traducirError(alertas.error)} />}
      <Seccion titulo={`Gastos por aprobar (${pendientes.data?.length ?? 0})`} id="aprobar">
        {pendientes.isLoading ? <Cargando /> : <ListaPorAprobar gastos={pendientes.data ?? []} />}
      </Seccion>
      {alertas.isLoading ? (
        <Cargando />
      ) : (
        GRUPOS.map((g) => {
          const lista = (alertas.data ?? []).filter((a) => a.tipo === g.tipo);
          if (!lista.length) return null;
          return (
            <Seccion key={g.tipo} titulo={`${g.titulo} (${lista.length})`} id={g.tipo}>
              <p className="-mt-2 text-sm text-tinta-2">{g.ayuda}</p>
              <ul className="flex flex-col gap-2">
                {lista.map((a) => <AlertaFila key={a.id} a={a} alFinalizar={setFinalizarId} />)}
              </ul>
            </Seccion>
          );
        })
      )}
      {!alertas.isLoading && (alertas.data ?? []).filter((a) => a.tipo !== 'gasto_pendiente').length === 0 && (
        <EstadoVacio titulo="Sin alertas">No hay rutas abiertas de más, consumos raros ni datos incompletos.</EstadoVacio>
      )}
      {finalizarId && viaje.data && <FinalizarOficina viaje={viaje.data} abierta alCerrar={() => setFinalizarId(null)} />}
    </div>
  );
}
