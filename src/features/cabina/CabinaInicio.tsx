import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Fuel, Receipt, Repeat2 } from 'lucide-react';
import { CabeceraCabina } from '@/app/DisenoCabina';
import { Boton, BotonEnlace } from '@/components/controles';
import { Calidad, Cargando, EstadoVacio, Etiqueta, MensajeError } from '@/components/datos';
import { Hoja } from '@/components/hoja';
import { duracion, hora, km as fKm, kml, litros as fLitros, usd } from '@/lib/formato';
import { traducirError } from '@/lib/errores';
import { useAhora, usePreferenciaLocal } from '@/lib/ganchos';
import { useSesion } from '@/lib/sesion';
import { FichaCamion } from './piezas';
import { useCamiones, useEstadoCabina } from './datos';

export function CabinaInicio() {
  const { abierto, ultimaUnidadId, ultimoViaje, cargando, error } = useEstadoCabina();
  const { data: camiones = [], isLoading: cargandoCamiones } = useCamiones();
  const { perfil } = useSesion();
  const [elegida, setElegida] = usePreferenciaLocal<string>('cabina-unidad', '');
  const [cambiar, setCambiar] = useState(false);
  const ahora = useAhora();
  const navegar = useNavigate();

  if (cargando || cargandoCamiones) {
    return (
      <>
        <CabeceraCabina />
        <div className="p-4">
          <Cargando />
        </div>
      </>
    );
  }

  // ----- En ruta ------------------------------------------------------------------------
  if (abierto) {
    return (
      <>
        <CabeceraCabina>
          <div className="mt-4">
            <p className="text-base font-semibold">En ruta a</p>
            <p className="mt-1 text-[2.75rem] font-black leading-[1.05] break-words">{abierto.ruta || 'Destino'}</p>
            <div className="cifra mt-4 border-t-2 border-white/60 pt-3 text-lg font-bold">
              <p>
                Salió {hora(abierto.salida_at)}, hace {duracion(abierto.salida_at, ahora)}
              </p>
              <p>km de salida {fKm(abierto.km_salida).replace(' km', '')}</p>
            </div>
          </div>
        </CabeceraCabina>
        <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-extrabold">
              {abierto.placa} <span className="font-semibold text-tinta-2">{abierto.unidad_nombre.replace(` (${abierto.placa})`, '')}</span>
            </p>
            {abierto.folio_txt && <Etiqueta>{abierto.folio_txt}</Etiqueta>}
            {abierto.pendiente && <Etiqueta tono="alerta">Pendiente de envío</Etiqueta>}
          </div>
          <p className="cifra text-base">
            Salió con {abierto.fuente === 'lleno' || abierto.fuente === 'heredado' ? 'el tanque lleno' : 'aproximadamente'} ({fLitros(abierto.litros_salida, 0)}).
          </p>
          {abierto.paradas.length > 1 && (
            <ol className="flex flex-col gap-1">
              {abierto.paradas.map((p, i) => (
                <li key={`${p}-${i}`} className="flex items-center gap-2 text-base">
                  <span className="cifra grid size-7 place-items-center rounded bg-via text-sm font-black text-via-tinta">{i + 1}</span> {p}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="zona-segura-abajo sticky bottom-0 flex flex-col gap-2 border-t-2 border-linea bg-superficie px-4 pt-3">
          <BotonEnlace to="/cabina/finalizar" variante="principal" tamano="xl" bloque>
            Finalizar ruta
          </BotonEnlace>
          <div className="grid grid-cols-2 gap-2">
            <BotonEnlace to="/cabina/repostaje" tamano="lg" icono={<Fuel aria-hidden className="size-5" />}>
              Repostaje
            </BotonEnlace>
            <BotonEnlace to="/cabina/gasto" tamano="lg" icono={<Receipt aria-hidden className="size-5" />}>
              Gasto
            </BotonEnlace>
          </div>
        </div>
      </>
    );
  }

  // ----- Disponible ------------------------------------------------------------------------
  const habitual = camiones.find((c) => c.chofer_habitual_id === perfil?.id);
  const unidad =
    camiones.find((c) => c.id === elegida) ??
    camiones.find((c) => c.id === ultimaUnidadId) ??
    habitual ??
    camiones.find((c) => c.estado === 'disponible') ??
    camiones[0];

  if (!unidad) {
    return (
      <>
        <CabeceraCabina />
        <div className="p-4">
          <EstadoVacio titulo="Aún no hay camiones registrados">Flota debe dar de alta los camiones antes de iniciar rutas.</EstadoVacio>
        </div>
      </>
    );
  }

  const ocupado = unidad.estado !== 'disponible';
  return (
    <>
      <CabeceraCabina>
        <div className="mt-4">
          <p className="text-base font-semibold">Hoy manejas</p>
          <div className="mt-2">
            <FichaCamion
              unidad={unidad}
              accion={
                <Boton variante="sobreVia" tamano="md" icono={<Repeat2 aria-hidden className="size-5" />} onClick={() => setCambiar(true)}>
                  Cambiar
                </Boton>
              }
            />
          </div>
        </div>
      </CabeceraCabina>
      <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-5">
        {error && <MensajeError error={traducirError(error)} />}
        {ocupado && (
          <MensajeError
            error={{
              mensaje:
                unidad.estado === 'en_ruta'
                  ? `${unidad.placa} está en ruta con ${unidad.viaje_abierto_chofer ?? 'otro chofer'}.`
                  : `${unidad.placa} está ${unidad.estado === 'taller' ? 'en taller' : 'inactivo'}.`,
              ayuda: 'Elige otro camión con "Cambiar".',
              deRed: false,
              rechazado: true,
            }}
          />
        )}
        {ultimoViaje ? (
          <Link to={`/cabina/resumen/${ultimoViaje.id}`} className="rounded-xl border-2 border-linea p-4 hover:bg-superficie-2">
            <p className="text-sm font-semibold text-tinta-2">Tu última ruta</p>
            <p className="mt-1 text-lg font-bold">{ultimoViaje.ruta}</p>
            <p className="cifra mt-1 text-base">
              {fKm(ultimoViaje.km_recorridos)}, {kml(ultimoViaje.rendimiento_kml)}, {usd(ultimoViaje.costo_combustible_usd)}
            </p>
            <div className="mt-1">
              <Calidad valor={ultimoViaje.calidad} compacta />
            </div>
          </Link>
        ) : (
          <EstadoVacio titulo="Aún no tienes rutas registradas">Cuando salgas, toca "Iniciar ruta". Tarda menos de medio minuto.</EstadoVacio>
        )}
      </div>
      <div className="zona-segura-abajo sticky bottom-0 flex flex-col gap-2 border-t-2 border-linea bg-superficie px-4 pt-3">
        <Boton variante="principal" tamano="xl" bloque disabled={ocupado} onClick={() => navegar(`/cabina/iniciar?unidad=${unidad.id}`)}>
          Iniciar ruta
        </Boton>
        <div className="grid grid-cols-2 gap-2">
          <BotonEnlace to="/cabina/repostaje" tamano="lg" icono={<Fuel aria-hidden className="size-5" />}>
            Repostaje
          </BotonEnlace>
          <BotonEnlace to="/cabina/gasto" tamano="lg" icono={<Receipt aria-hidden className="size-5" />}>
            Gasto
          </BotonEnlace>
        </div>
      </div>

      <Hoja abierta={cambiar} alCerrar={() => setCambiar(false)} titulo="¿Qué camión manejas hoy?">
        <ul className="flex flex-col gap-2">
          {camiones.map((c) => {
            const libre = c.estado === 'disponible';
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!libre}
                  onClick={() => {
                    setElegida(c.id!);
                    setCambiar(false);
                  }}
                  aria-current={c.id === unidad.id || undefined}
                  className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border-2 px-4 text-left disabled:opacity-60
                    ${c.id === unidad.id ? 'border-tinta bg-superficie-2' : 'border-linea hover:border-tinta'}`}
                >
                  <span>
                    <span className="block text-xl font-black">{c.placa}</span>
                    <span className="block text-sm text-tinta-2">{c.alias}</span>
                  </span>
                  <span className="text-right text-sm font-semibold">
                    {libre ? fKm(c.lectura_actual) : c.estado === 'en_ruta' ? `En ruta con ${c.viaje_abierto_chofer ?? 'otro chofer'}` : c.estado === 'taller' ? 'En taller' : 'Inactivo'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Hoja>
    </>
  );
}
