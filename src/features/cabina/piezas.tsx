import { useMemo, useState, type ReactNode } from 'react';
import { MapPin, Plus, Search, X } from 'lucide-react';
import { Hoja } from '@/components/hoja';
import { Boton, Campo, EntradaNumero, Entrada, Segmentado } from '@/components/controles';
import type { Precio, Ubicacion, Unidad } from '@/lib/api';
import { km as fKm, leerNumero, litros as fLitros, usd } from '@/lib/formato';
import { cuartos } from '@/lib/consumo';

/** Pantalla de un solo trabajo: cabecera, contenido y botón en la zona del pulgar */
export function PantallaTarea({ cabecera, children, accion }: { cabecera: ReactNode; children: ReactNode; accion: ReactNode }) {
  return (
    <>
      {cabecera}
      <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-5">{children}</div>
      <div className="zona-segura-abajo sticky bottom-0 z-10 border-t-2 border-linea bg-superficie px-4 pt-3">{accion}</div>
    </>
  );
}

// ----- Destinos (paradas en orden) -------------------------------------------------------------
export function SelectorDestinos({
  destinos, recientes, elegidos, alCambiar, error,
}: { destinos: Ubicacion[]; recientes: string[]; elegidos: string[]; alCambiar: (ids: string[]) => void; error?: string | null }) {
  const [abierta, setAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const porId = useMemo(() => new Map(destinos.map((d) => [d.id, d])), [destinos]);
  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    const candidatos = destinos.filter((d) => d.tipo !== 'sede' && (!t || d.nombre.toLowerCase().includes(t) || (d.municipio ?? '').toLowerCase().includes(t)));
    const rank = (d: Ubicacion) => (d.es_sistema ? 9999 : recientes.includes(d.id) ? recientes.indexOf(d.id) : 1000);
    return candidatos.sort((a, b) => rank(a) - rank(b) || a.nombre.localeCompare(b.nombre, 'es'));
  }, [destinos, recientes, busqueda]);

  const agregar = (id: string) => {
    alCambiar([...elegidos, id]);
    setAbierta(false);
    setBusqueda('');
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-bold" id="destinos-etiqueta">
        {elegidos.length > 1 ? 'Paradas en orden' : 'Destino'}
      </span>
      {elegidos.length > 0 && (
        <ol aria-labelledby="destinos-etiqueta" className="flex flex-col gap-2">
          {elegidos.map((id, i) => (
            <li key={`${id}-${i}`} className="flex items-center gap-3 rounded-lg border-2 border-tinta bg-superficie px-3 py-2">
              <span className="cifra grid size-8 shrink-0 place-items-center rounded bg-via text-sm font-black text-via-tinta">{i + 1}</span>
              <span className="flex-1 text-lg font-bold">{porId.get(id)?.nombre ?? 'Destino'}</span>
              <button
                type="button"
                onClick={() => alCambiar(elegidos.filter((_, j) => j !== i))}
                aria-label={`Quitar ${porId.get(id)?.nombre ?? 'destino'}`}
                className="grid size-11 place-items-center rounded-lg hover:bg-superficie-2"
              >
                <X aria-hidden className="size-5" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <Boton
        tamano="lg"
        bloque
        onClick={() => setAbierta(true)}
        icono={elegidos.length ? <Plus aria-hidden className="size-5" /> : <MapPin aria-hidden className="size-5" />}
        className={error ? 'border-peligro' : ''}
        aria-describedby={error ? 'destinos-error' : undefined}
      >
        {elegidos.length ? 'Agregar otra parada' : 'Elegir destino'}
      </Boton>
      {error && (
        <p id="destinos-error" role="alert" className="text-sm font-semibold text-peligro">
          {error}
        </p>
      )}
      <Hoja abierta={abierta} alCerrar={() => setAbierta(false)} titulo={elegidos.length ? 'Siguiente parada' : '¿A dónde vas?'}>
        <div className="relative mb-3">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta-2" />
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar destino"
            aria-label="Buscar destino"
            className="pl-10"
            autoFocus
          />
        </div>
        <ul className="flex flex-col gap-2">
          {lista.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => agregar(d.id)}
                className="flex min-h-14 w-full items-center justify-between gap-2 rounded-lg border-2 border-linea px-4 text-left hover:border-tinta hover:bg-superficie-2"
              >
                <span className="text-lg font-bold">{d.nombre}</span>
                <span className="text-sm text-tinta-2">{d.es_sistema ? 'Escribe cuál en la nota' : [d.municipio, d.estado_ve].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
          {lista.length === 0 && (
            <li className="rounded-lg border-2 border-dashed border-linea-fuerte p-4 text-base text-tinta-2">
              No hay destinos con ese nombre. Elige "Otro" y escríbelo en la nota; flota lo agrega a la lista.
            </li>
          )}
        </ul>
      </Hoja>
    </div>
  );
}

// ----- Nivel de combustible (D6: lleno, cuartos o litros) ---------------------------------------
export type OpcionNivel = 'lleno' | '0.75' | '0.5' | '0.25' | 'otro' | 'nose';

export function nivelElegido(op: OpcionNivel | null, capacidad: number, litrosTexto: string): number | null {
  if (op === null || op === 'nose') return null;
  if (op === 'lleno') return capacidad;
  if (op === 'otro') return leerNumero(litrosTexto);
  return cuartos(capacidad, Number(op) as 0.25 | 0.5 | 0.75);
}

export function SelectorNivel({
  etiqueta, capacidad, valor, alCambiar, litros, alCambiarLitros, sinLleno, conNoSe, detalleLleno, error,
}: {
  etiqueta: string;
  capacidad: number;
  valor: OpcionNivel | null;
  alCambiar: (v: OpcionNivel) => void;
  litros: string;
  alCambiarLitros: (v: string) => void;
  sinLleno?: boolean;
  conNoSe?: boolean;
  detalleLleno?: string;
  error?: string | null;
}) {
  const opciones = [
    ...(sinLleno ? [] : [{ valor: 'lleno' as const, etiqueta: 'Lleno', detalle: detalleLleno ?? fLitros(capacidad, 0) }]),
    { valor: '0.75' as const, etiqueta: '3/4', detalle: fLitros(cuartos(capacidad, 0.75), 0) },
    { valor: '0.5' as const, etiqueta: '1/2', detalle: fLitros(cuartos(capacidad, 0.5), 0) },
    { valor: '0.25' as const, etiqueta: '1/4', detalle: fLitros(cuartos(capacidad, 0.25), 0) },
    { valor: 'otro' as const, etiqueta: 'Otro', detalle: 'litros' },
    ...(conNoSe ? [{ valor: 'nose' as const, etiqueta: 'No sé', detalle: 'sin dato' }] : []),
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-bold">{etiqueta}</span>
      <Segmentado etiqueta={etiqueta} opciones={opciones} valor={valor} alCambiar={alCambiar} grande columnas={3} error={Boolean(error)} />
      {valor === 'otro' && (
        <Campo etiqueta="Litros en el tanque" ayuda={`Capacidad del tanque: ${fLitros(capacidad, 0)}`}>
          {(p) => <EntradaNumero {...p} grande unidad="L" value={litros} onChange={(e) => alCambiarLitros(e.target.value)} autoFocus />}
        </Campo>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectorPrecio({ precios, valor, alCambiar, error }: { precios: Precio[]; valor: string | null; alCambiar: (id: string) => void; error?: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-bold">Precio por litro</span>
      <Segmentado
        etiqueta="Precio por litro"
        grande
        valor={valor}
        alCambiar={alCambiar}
        error={Boolean(error)}
        opciones={precios.map((p) => ({ valor: p.id, etiqueta: usd(p.precio_usd_litro), detalle: 'por litro' }))}
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

/** Tarjeta del camión en la cabina. El título y la placa forman el h1 ("Hoy manejas DEMO-002"). */
export function FichaCamion({ titulo, unidad, accion }: { titulo: string; unidad: Unidad; accion?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-3">
        <h1>
          <span className="block text-base font-semibold">{titulo}</span>
          <span className="mt-2 block whitespace-nowrap text-5xl font-black leading-none tracking-tight">{unidad.placa}</span>
        </h1>
        {accion}
      </div>
      <p className="text-lg font-bold">
        {unidad.alias}
        {unidad.modelo ? `, ${unidad.marca ?? ''} ${unidad.modelo}`.trimEnd() : ''}
      </p>
      <p className="cifra text-base font-semibold">
        {fKm(unidad.lectura_actual)} • tanque {fLitros(unidad.capacidad_tanque_l, 0)}
        {unidad.nivel_estimado_l !== null && <> • nivel {unidad.nivel_estimado_fuente === 'exacto' ? '' : 'aprox. '}{fLitros(unidad.nivel_estimado_l, 0)}</>}
      </p>
    </div>
  );
}
