import { useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CabeceraCabina } from '@/app/DisenoCabina';
import { PencilLine } from 'lucide-react';
import { BotonEnlace } from '@/components/controles';
import { Calidad, Cargando, Etiqueta } from '@/components/datos';
import type { ResultadoViaje } from '@/lib/consumo';
import { fecha, hora, km as fKm, litros as fLitros, num, usd, usdKm } from '@/lib/formato';
import { useDentroDeVentana } from '@/lib/ganchos';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';
import type { Viaje } from '@/lib/api';

interface EstadoNavegacion {
  vista?: ResultadoViaje;
  ruta?: string;
  pendiente?: boolean;
}

export function ResumenRuta() {
  const { id } = useParams();
  const estado = (useLocation().state ?? {}) as EstadoNavegacion;
  const { perfil } = useSesion();
  const dentroDeVentana = useDentroDeVentana();
  const { data: viaje, isLoading } = useQuery({
    queryKey: ['viajes', id],
    queryFn: async () => (await supabase.from('v_viajes').select('*').eq('id', id!).maybeSingle()).data as Viaje | null,
  });

  if (isLoading) return <Cargando />;

  const oficial = viaje && viaje.estado === 'cerrado';
  const v = estado.vista;
  const datos = oficial
    ? {
        rend: viaje.rendimiento_kml, km: viaje.km_recorridos, litros: viaje.litros_consumidos, costo: viaje.costo_combustible_usd,
        costoKm: viaje.costo_km_usd, calidad: viaje.calidad,
      }
    : { rend: v?.rendimiento ?? null, km: v?.km ?? null, litros: v?.litros ?? null, costo: v?.costo ?? null, costoKm: v?.costoKm ?? null, calidad: v?.calidad ?? null };

  return (
    <>
      <CabeceraCabina volver={{ a: '/cabina', texto: 'Cabina' }}>
        <h1 className="mt-3">
          <span className="block text-base font-semibold">Ruta finalizada</span>
          <span className="mt-1 block text-3xl font-extrabold leading-tight break-words">{viaje?.ruta ?? estado.ruta ?? 'Ruta'}</span>
        </h1>
        {viaje?.llegada_at && (
          <p className="cifra mt-2 text-base font-semibold">
            {fecha(viaje.salida_at)}, de {hora(viaje.salida_at)} a {hora(viaje.llegada_at)}
          </p>
        )}
      </CabeceraCabina>
      <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {viaje?.folio_txt && <Etiqueta>{viaje.folio_txt}</Etiqueta>}
          {!oficial && <Etiqueta tono="alerta">{estado.pendiente ? 'Pendiente de envío: cifras de la vista previa' : 'Vista previa'}</Etiqueta>}
        </div>
        <div>
          <p className="text-base font-bold text-tinta-2">Rendimiento</p>
          <p className="flex items-baseline gap-2">
            <span className="cifra text-6xl font-black leading-none">{datos.rend !== null ? num(datos.rend, 2) : '—'}</span>
            <span className="text-2xl font-extrabold">km/L</span>
          </p>
        </div>
        <dl className="cifra grid grid-cols-2 gap-px overflow-hidden rounded-xl border-2 border-linea bg-linea text-lg">
          <div className="bg-superficie p-3"><dt className="text-sm text-tinta-2">Recorrido</dt><dd className="font-extrabold">{fKm(datos.km)}</dd></div>
          <div className="bg-superficie p-3"><dt className="text-sm text-tinta-2">Consumo</dt><dd className="font-extrabold">{fLitros(datos.litros)}</dd></div>
          <div className="bg-superficie p-3"><dt className="text-sm text-tinta-2">Costo del viaje</dt><dd className="font-extrabold">{usd(datos.costo)}</dd></div>
          <div className="bg-superficie p-3"><dt className="text-sm text-tinta-2">Costo por km</dt><dd className="font-extrabold">{usdKm(datos.costoKm)}</dd></div>
        </dl>
        <Calidad valor={datos.calidad} />
      </div>
      <div className="zona-segura-abajo sticky bottom-0 flex flex-col gap-2 border-t-2 border-linea bg-superficie px-4 pt-3">
        <BotonEnlace to="/cabina" variante="principal" tamano="xl" bloque>
          Listo
        </BotonEnlace>
        {/* El chofer corrige lo suyo mientras siga abierta la ventana (30 min por defecto) */}
        {viaje && viaje.created_by === perfil?.id && dentroDeVentana(viaje.created_at) && (
          <BotonEnlace to={`/viajes/${viaje.id}`} tamano="lg" bloque icono={<PencilLine aria-hidden className="size-5" />}>
            Corregir datos
          </BotonEnlace>
        )}
      </div>
    </>
  );
}
