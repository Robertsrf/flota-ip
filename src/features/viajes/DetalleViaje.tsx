import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Flag } from 'lucide-react';
import { useAvisos } from '@/components/avisos';
import { Boton } from '@/components/controles';
import { AvisoAlerta, Calidad, Cargando, Dato, EstadoVacio, MensajeError } from '@/components/datos';
import { EncabezadoPagina, Panel, Seccion, VerFoto } from '@/components/estructura';
import { ConfirmarConMotivo } from '@/components/hoja';
import { rpc, type Repostaje, type Viaje } from '@/lib/api';
import { exigir, traducirError } from '@/lib/errores';
import { duracion, fechaHora, km as fKm, l100, litros as fLitros, num, usd, usdKm } from '@/lib/formato';
import { useAhora, useDentroDeVentana } from '@/lib/ganchos';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';
import { usePrecios } from '@/features/cabina/datos';
import { AccionesRegistro, HistorialAuditoria } from '@/features/registros/Acciones';
import { camposRepostaje, camposViaje } from '@/features/registros/campos';
import { useChoferes } from '@/features/registros/datosComunes';
import { FinalizarOficina } from '@/features/registros/FormulariosOficina';
import { EstadoViaje } from './ListaViajes';

const MOTIVOS: Record<string, string> = {
  rendimiento_fuera_rango: 'El rendimiento está fuera del rango del camión.',
  consumo_no_positivo: 'Con los datos corregidos el consumo no da positivo.',
  nivel_imposible: 'El nivel de combustible indicado es imposible.',
  destino_otro: 'El chofer eligió "Otro" como destino: revisa la nota y corrige el destino.',
  novedad_chofer: 'El chofer dejó una novedad.',
};

const FUENTE: Record<string, string> = {
  lleno: 'tanque lleno',
  heredado: 'tanque lleno (heredado del último repostaje)',
  aguja: 'lectura de la aguja',
  litros: 'litros declarados',
};

export function DetalleViaje() {
  const { id } = useParams();
  const { esOficina, esSuper, perfil } = useSesion();
  const { data: choferes = [] } = useChoferes();
  const { data: precios = [] } = usePrecios();
  const ahora = useAhora();
  const dentroDeVentana = useDentroDeVentana();
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [finalizar, setFinalizar] = useState(false);
  const [revisado, setRevisado] = useState(false);

  const viaje = useQuery({
    queryKey: ['viajes', id],
    queryFn: async () => exigir(await supabase.from('v_viajes').select('*').eq('id', id!).single()) as Viaje,
  });
  const cargas = useQuery({
    queryKey: ['repostajes', 'viaje', id, 'detalle'],
    queryFn: async () => exigir(await supabase.from('v_repostajes').select('*').eq('viaje_id', id!).order('fecha')) as Repostaje[],
  });

  if (viaje.isLoading) return <Cargando />;
  if (viaje.error || !viaje.data) return <MensajeError error={traducirError(viaje.error)} />;
  const v = viaje.data;
  const propio = v.created_by === perfil?.id;
  const enVentana = propio && dentroDeVentana(v.created_at);
  const puedeCambiar = esOficina || enVentana;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        volver={{ a: '/viajes', texto: 'Viajes' }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {v.ruta} <EstadoViaje v={v} />
          </span>
        }
        descripcion={`${v.folio_txt}, ${v.placa} ${v.alias ?? ''}, con ${v.chofer_nombre}`}
        acciones={
          <div className="flex flex-wrap gap-2">
            {esOficina && v.estado === 'en_curso' && (
              <Boton variante="principal" icono={<Flag aria-hidden className="size-4" />} onClick={() => setFinalizar(true)}>
                Finalizar ruta
              </Boton>
            )}
            {esOficina && v.revisar && v.estado !== 'anulado' && (
              <Boton icono={<CheckCheck aria-hidden className="size-4" />} onClick={() => setRevisado(true)}>
                Dar por revisada
              </Boton>
            )}
            <AccionesRegistro
              tabla="viajes"
              registro={v as unknown as Record<string, unknown>}
              campos={camposViaje(esOficina, choferes)}
              puedeCorregir={puedeCambiar}
              puedeAnular={puedeCambiar}
              puedeRestaurar={esSuper}
              nombre="la ruta"
            />
          </div>
        }
      />

      {v.estado === 'anulado' && <MensajeError error={{ mensaje: 'Esta ruta está anulada y no entra en los cálculos.', ayuda: v.anulado_motivo ? `Motivo: ${v.anulado_motivo}` : undefined, deRed: false, rechazado: true }} />}
      {v.revisar && v.estado !== 'anulado' && (
        <AvisoAlerta titulo="Para revisar">
          <ul className="list-disc pl-5">
            {(v.revisar_motivos ?? []).map((m) => <li key={m}>{MOTIVOS[m] ?? m}</li>)}
          </ul>
        </AvisoAlerta>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <h2 className="text-lg font-extrabold">Salida</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Dato etiqueta="Fecha y hora">{fechaHora(v.salida_at)}</Dato>
            <Dato etiqueta="Km">{num(v.km_salida)}</Dato>
            <Dato etiqueta="Combustible">{fLitros(v.litros_salida, 0)}</Dato>
            <Dato etiqueta="Origen">{v.origen_nombre ?? '—'}</Dato>
          </div>
          <p className="mt-2 text-sm text-tinta-2">Nivel medido por {FUENTE[v.fuente_nivel_salida ?? ''] ?? v.fuente_nivel_salida}.</p>
          {v.foto_odometro_salida && <div className="mt-3"><VerFoto ruta={v.foto_odometro_salida} etiqueta="Foto del tablero al salir" /></div>}
        </Panel>
        <Panel>
          <h2 className="text-lg font-extrabold">Llegada</h2>
          {v.estado === 'en_curso' ? (
            <p className="mt-3 text-base">En ruta desde hace {duracion(v.salida_at!, ahora)}.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Dato etiqueta="Fecha y hora">{fechaHora(v.llegada_at)}</Dato>
                <Dato etiqueta="Km">{num(v.km_llegada)}</Dato>
                <Dato etiqueta="Aguja al llegar">{v.litros_llegada_aguja == null ? '—' : fLitros(v.litros_llegada_aguja, 0)}</Dato>
                <Dato etiqueta="Duración">{v.llegada_at ? duracion(v.salida_at!, new Date(v.llegada_at)) : '—'}</Dato>
              </div>
              {v.foto_odometro_llegada && <div className="mt-3"><VerFoto ruta={v.foto_odometro_llegada} etiqueta="Foto del tablero al llegar" /></div>}
            </>
          )}
        </Panel>
        <Panel>
          <h2 className="text-lg font-extrabold">Resultado</h2>
          {v.estado !== 'cerrado' ? (
            <p className="mt-3 text-base text-tinta-2">Se calcula al finalizar la ruta.</p>
          ) : (
            <>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="cifra text-4xl font-black">{v.rendimiento_kml == null ? '—' : num(v.rendimiento_kml, 2)}</span>
                <span className="text-lg font-bold">km/L</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Dato etiqueta="Recorrido">{fKm(v.km_recorridos)}</Dato>
                <Dato etiqueta="Consumo">{fLitros(v.litros_consumidos)}</Dato>
                <Dato etiqueta="Costo">{usd(v.costo_combustible_usd)}</Dato>
                <Dato etiqueta="Costo por km">{usdKm(v.costo_km_usd)}</Dato>
                <Dato etiqueta="L/100 km">{l100(v.litros_100km)}</Dato>
                <Dato etiqueta="Precio promedio">{v.precio_promedio_usd == null ? '—' : `$ ${num(v.precio_promedio_usd, 4)}/L`}</Dato>
              </div>
              <div className="mt-3"><Calidad valor={v.calidad} /></div>
            </>
          )}
        </Panel>
      </div>

      {v.paradas_nombres && v.paradas_nombres.length > 1 && (
        <Seccion titulo="Paradas">
          <ol className="flex flex-wrap gap-2">
            {v.paradas_nombres.map((p, i) => (
              <li key={`${p}-${i}`} className="flex items-center gap-2 rounded-lg border-2 border-linea bg-superficie px-3 py-2">
                <span className="cifra grid size-7 place-items-center rounded bg-via text-sm font-black text-via-tinta">{i + 1}</span> {p}
              </li>
            ))}
          </ol>
        </Seccion>
      )}

      {v.notas && (
        <Seccion titulo="Notas y novedades">
          <Panel><p className="whitespace-pre-line text-base">{v.notas}</p></Panel>
        </Seccion>
      )}

      <Seccion titulo={`Cargas de combustible (${cargas.data?.length ?? 0})`}>
        {cargas.isLoading ? (
          <Cargando />
        ) : !cargas.data?.length ? (
          <EstadoVacio titulo="Sin cargas en esta ruta">{v.estado === 'cerrado' ? 'El costo se calculó con el precio de la última carga del camión.' : undefined}</EstadoVacio>
        ) : (
          <ul className="flex flex-col gap-2">
            {cargas.data.map((c) => (
              <li key={c.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-linea bg-superficie p-3 ${c.anulado ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-4">
                  {c.recibo_path && <VerFoto ruta={c.recibo_path} etiqueta="Recibo" />}
                  <div>
                    <p className="font-bold">
                      {c.folio_txt} {c.es_cierre_viaje ? 'Carga de cierre' : 'Carga en ruta'}
                      {c.anulado && <span className="ml-2 text-peligro">Anulada</span>}
                    </p>
                    <p className="cifra text-sm text-tinta-2">
                      {fechaHora(c.fecha)}, km {num(c.lectura_medidor)}, {fLitros(c.litros)} a {usd(c.precio_usd_litro)} = {usd(c.monto_usd)}, {c.tanque_lleno ? 'llenó' : 'parcial'}
                    </p>
                  </div>
                </div>
                <AccionesRegistro
                  tabla="repostajes"
                  registro={c as unknown as Record<string, unknown>}
                  campos={camposRepostaje(esOficina, precios)}
                  puedeCorregir={esOficina || (c.created_by === perfil?.id && dentroDeVentana(c.created_at))}
                  puedeAnular={esOficina}
                  puedeRestaurar={esSuper}
                  nombre="la carga"
                />
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {esOficina && (
        <Seccion titulo="Historial de cambios">
          <HistorialAuditoria tabla="viajes" registroId={v.id!} />
        </Seccion>
      )}

      {finalizar && <FinalizarOficina viaje={v} abierta={finalizar} alCerrar={() => setFinalizar(false)} />}
      <ConfirmarConMotivo
        abierta={revisado}
        alCerrar={() => setRevisado(false)}
        titulo="Dar por revisada"
        etiquetaMotivo="¿Qué se revisó o corrigió?"
        textoAccion="Dar por revisada"
        alConfirmar={async (nota) => {
          await rpc('marcar_revisado', { p_viaje_id: v.id!, p_nota: nota });
          await qc.invalidateQueries();
          avisos.ok('Ruta revisada');
        }}
      />
    </div>
  );
}
