import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { useAvisos } from '@/components/avisos';
import { Boton } from '@/components/controles';
import { Cargando, EstadoVacio, MensajeError, Rombo } from '@/components/datos';
import { EncabezadoPagina, Seccion } from '@/components/estructura';
import { ConfirmarConMotivo } from '@/components/hoja';
import { rpc, type Alerta, type Viaje } from '@/lib/api';
import { exigir, traducirError } from '@/lib/errores';
import { fechaHora } from '@/lib/formato';
import { supabase } from '@/lib/supabase';
import { useTiempoReal } from '@/lib/tiempoReal';
import { enlaceAlerta, useAlertas } from '@/features/dashboard/datos';
import { ListaPorAprobar, usePendientesAprobacion } from '@/features/mantenimiento/Mantenimiento';
import { FinalizarOficina } from '@/features/registros/FormulariosOficina';

// Lo urgente primero: rutas abiertas y papeles o servicios vencidos, luego lo que se desvía
const GRUPOS: { tipo: string; titulo: string; ayuda: string }[] = [
  { tipo: 'ruta_abierta', titulo: 'Rutas abiertas mucho tiempo', ayuda: 'El chofer no la finalizó. Pregúntale los datos o ciérrala con lo que sepas.' },
  { tipo: 'documento', titulo: 'Documentos vencidos o por vencer', ayuda: 'Renuévalos en Vencimientos antes de la fecha: un camión sin póliza al día no debería salir.' },
  { tipo: 'servicio', titulo: 'Servicios por hacer', ayuda: 'Tocan por km o por fecha. Al aprobar el gasto de su categoría se marcan hechos solos; si no, márcalos en Vencimientos.' },
  { tipo: 'revisar', titulo: 'Rutas para revisar', ayuda: 'Destino "Otro", novedades del chofer o rendimiento fuera del rango del camión. Léelas y dalas por revisadas.' },
  { tipo: 'consumo_anomalo', titulo: 'Consumo anómalo', ayuda: 'El viaje rindió mucho menos que el promedio del camión en 90 días.' },
  { tipo: 'km_sin_ruta', titulo: 'Km sin ruta registrada', ayuda: 'El tablero avanzó entre una llegada y la siguiente salida sin ruta.' },
  { tipo: 'viaje_incompleto', titulo: 'Rutas sin datos de combustible', ayuda: 'Falta el nivel al llegar: corrige la ruta si el chofer sabe la aguja.' },
  { tipo: 'divergencia', titulo: 'Divergencia de cálculo', ayuda: 'En el mes, los viajes y los ciclos lleno a lleno dan rendimientos distintos.' },
];

const SOLO_FECHA = new Set(['servicio', 'documento']);
const CLASE_ENLACE = 'inline-flex min-h-10 items-center rounded-lg border-2 border-tinta px-3 text-sm font-bold hover:bg-superficie-2';

function useViaje(id: string | null) {
  return useQuery({
    queryKey: ['viajes', id],
    enabled: Boolean(id),
    queryFn: async () => exigir(await supabase.from('v_viajes').select('*').eq('id', id!).single()) as Viaje,
  });
}

function AlertaFila({ a, alFinalizar, alRevisar }: { a: Alerta; alFinalizar: (id: string) => void; alRevisar: (a: Alerta) => void }) {
  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 bg-superficie p-3 md:flex-row md:items-center md:justify-between ${a.severidad === 'alta' ? 'border-peligro' : 'border-linea'}`}>
      <div className="flex items-start gap-3">
        <Rombo />
        <div>
          <p className="text-base">{a.mensaje}</p>
          {/* Los vencimientos ya dicen la fecha en el mensaje */}
          {!SOLO_FECHA.has(a.tipo ?? '') && <p className="cifra text-sm text-tinta-2">{fechaHora(a.fecha)}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 pl-9 md:pl-0">
        {a.tipo === 'ruta_abierta' && a.viaje_id && (
          <Boton variante="principal" tamano="sm" onClick={() => alFinalizar(a.viaje_id!)}>Finalizar</Boton>
        )}
        {a.tipo === 'revisar' && a.viaje_id && (
          <Boton variante="principal" tamano="sm" icono={<CheckCheck aria-hidden className="size-4" />} onClick={() => alRevisar(a)}>Dar por revisada</Boton>
        )}
        <Link to={enlaceAlerta(a)} className={CLASE_ENLACE}>
          {a.viaje_id ? 'Ver ruta' : SOLO_FECHA.has(a.tipo ?? '') ? 'Ir a vencimientos' : a.unidad_id ? 'Ver unidad' : 'Ver detalle'}
        </Link>
      </div>
    </li>
  );
}

export function Revision() {
  useTiempoReal();
  const alertas = useAlertas();
  const pendientes = usePendientesAprobacion();
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [finalizarId, setFinalizarId] = useState<string | null>(null);
  const [revisando, setRevisando] = useState<Alerta | null>(null);
  const viaje = useViaje(finalizarId);
  const asuntos = (alertas.data ?? []).filter((a) => a.tipo !== 'gasto_pendiente');
  const total = asuntos.length + (pendientes.data?.length ?? 0);

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
          const lista = asuntos
            .filter((a) => a.tipo === g.tipo)
            .sort((p, q) => Number(q.severidad === 'alta') - Number(p.severidad === 'alta'));
          if (!lista.length) return null;
          return (
            <Seccion key={g.tipo} titulo={`${g.titulo} (${lista.length})`} id={g.tipo}>
              <p className="-mt-2 text-sm text-tinta-2">{g.ayuda}</p>
              <ul className="flex flex-col gap-2">
                {lista.map((a) => <AlertaFila key={a.id} a={a} alFinalizar={setFinalizarId} alRevisar={setRevisando} />)}
              </ul>
            </Seccion>
          );
        })
      )}
      {!alertas.isLoading && asuntos.length === 0 && (
        <EstadoVacio titulo="Sin alertas">No hay rutas abiertas de más, consumos raros, datos incompletos ni vencimientos cerca.</EstadoVacio>
      )}
      {finalizarId && viaje.data && <FinalizarOficina viaje={viaje.data} abierta alCerrar={() => setFinalizarId(null)} />}
      <ConfirmarConMotivo
        abierta={revisando !== null}
        alCerrar={() => setRevisando(null)}
        titulo="Dar por revisada"
        descripcion={revisando?.mensaje ?? undefined}
        etiquetaMotivo="¿Qué se revisó o corrigió?"
        textoAccion="Dar por revisada"
        alConfirmar={async (nota) => {
          await rpc('marcar_revisado', { p_viaje_id: revisando!.viaje_id!, p_nota: nota });
          await qc.invalidateQueries();
          avisos.ok('Ruta revisada');
        }}
      />
    </div>
  );
}
