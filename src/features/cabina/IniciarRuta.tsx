import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CabeceraCabina } from '@/app/DisenoCabina';
import { useAvisos } from '@/components/avisos';
import { Boton, Campo, EntradaNumero } from '@/components/controles';
import { AvisoAlerta, Cargando, MensajeError } from '@/components/datos';
import { CampoFoto } from '@/components/estructura';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { comprimirFoto } from '@/lib/fotos';
import { km as fKm, leerNumero, num } from '@/lib/formato';
import { baseLocal, descartar, encolar } from '@/lib/offline/cola';
import { useSesion } from '@/lib/sesion';
import { useCamiones, useDestinos, useDestinosRecientes, useEstadoCabina, useSugerenciaNivel } from './datos';
import { nivelElegido, PantallaTarea, SelectorDestinos, SelectorNivel, type OpcionNivel } from './piezas';

export function IniciarRuta() {
  const [params] = useSearchParams();
  const { sesion } = useSesion();
  const { abierto, cargando } = useEstadoCabina();
  const { data: camiones = [] } = useCamiones();
  const { data: destinos = [] } = useDestinos();
  const { data: recientes = [] } = useDestinosRecientes();
  const unidad = camiones.find((c) => c.id === params.get('unidad'));
  const avisos = useAvisos();
  const navegar = useNavigate();
  const qc = useQueryClient();

  const [paradas, setParadas] = useState<string[]>([]);
  const [kmEscrito, setKmTexto] = useState<string | null>(null);
  const [nivelTocado, setNivel] = useState<OpcionNivel | null>(null);
  const [litrosTexto, setLitrosTexto] = useState('');
  const [foto, setFoto] = useState<Blob | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);

  const lectura = Number(unidad?.lectura_actual ?? 0);
  const kmTexto = kmEscrito ?? (unidad ? String(Math.round(lectura)) : '');

  const km = leerNumero(kmTexto, 'entero');
  const { data: sugerencia } = useSugerenciaNivel(unidad?.id, km);
  const heredado = sugerencia?.fuente === 'heredado';
  const nivel: OpcionNivel | null = nivelTocado ?? (heredado ? 'lleno' : null);

  const capacidad = Number(unidad?.capacidad_tanque_l ?? 0);
  const diferencia = km !== null ? km - lectura : null;
  const nombres = useMemo(() => new Map(destinos.map((d) => [d.id, d.nombre])), [destinos]);

  if (!cargando && abierto) return <Navigate to="/cabina" replace />;
  if (!unidad) {
    return (
      <>
        <CabeceraCabina volver={{ a: '/cabina', texto: 'Cancelar' }} />
        <div className="p-4">{camiones.length ? <Navigate to="/cabina" replace /> : <Cargando />}</div>
      </>
    );
  }

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    const err: Record<string, string> = {};
    if (!paradas.length) err.paradas = 'Elige el destino.';
    if (km === null) err.km = 'Escribe el km del tablero.';
    else if (km < lectura) err.km = `El km de salida (${num(km)}) es menor que el último km conocido del camión (${num(lectura)}). Revisa el tablero.`;
    const litros = nivelElegido(nivel, capacidad, litrosTexto);
    if (nivel === null) err.nivel = 'Indica cuánto combustible tiene al salir.';
    else if (litros === null || litros < 0) err.nivel = 'Escribe los litros que tiene el tanque.';
    else if (litros > capacidad) err.nivel = `El nivel (${num(litros)} L) no puede superar la capacidad del tanque (${num(capacidad)} L).`;
    setErrores(err);
    if (Object.keys(err).length) return;

    setEnviando(true);
    setErrorServidor(null);
    const id = crypto.randomUUID();
    const fuente = nivel === 'lleno' ? (heredado ? 'heredado' : 'lleno') : nivel === 'otro' ? 'litros' : 'aguja';
    const salida = new Date().toISOString();
    const ruta = paradas.map((p) => nombres.get(p) ?? '').join(' – ');
    try {
      const resultado = await encolar({
        id,
        tipo: 'iniciar_viaje',
        usuario: sesion!.user.id,
        resumen: `iniciar ruta a ${ruta}`,
        args: {
          p_id: id,
          p_unidad_id: unidad.id,
          p_paradas: paradas,
          p_salida_at: salida,
          p_km_salida: km,
          p_litros_salida: litros,
          p_fuente_nivel: fuente,
        },
        fotos: foto ? [{ campo: 'p_foto', blob: await comprimirFoto(foto) }] : [],
        extra: {
          unidad_id: unidad.id,
          unidad_nombre: unidad.nombre ?? unidad.placa,
          placa: unidad.placa,
          capacidad,
          ruta,
          paradas: paradas.map((p) => nombres.get(p) ?? ''),
          salida_at: salida,
          km_salida: km,
          litros_salida: litros,
          fuente,
        },
      });
      if (resultado === 'rechazado') {
        const p = await baseLocal.pendientes.get(id);
        setErrorServidor({ mensaje: p?.error ?? 'No se pudo iniciar la ruta.', ayuda: p?.ayuda, deRed: false, rechazado: true });
        await descartar(id);
        return;
      }
      await qc.invalidateQueries();
      avisos.ok(resultado === 'enviado' ? 'Ruta iniciada' : 'Ruta guardada en el teléfono; se envía al volver la señal', {
        texto: 'Deshacer',
        alHacer: () => void deshacer(id),
      });
      navegar('/cabina', { replace: true });
    } catch (x) {
      setErrorServidor(traducirError(x));
    } finally {
      setEnviando(false);
    }
  };

  const deshacer = async (id: string) => {
    const pendiente = await baseLocal.pendientes.get(id);
    if (pendiente) {
      await descartar(id);
    } else {
      await encolar({
        id: `anular-${id}`,
        tipo: 'anular_registro',
        usuario: sesion!.user.id,
        resumen: 'deshacer el inicio de la ruta',
        args: { p_tabla: 'viajes', p_id: id, p_motivo: 'Deshecho por el chofer' },
        fotos: [],
      });
    }
    await qc.invalidateQueries();
    avisos.mostrar('Inicio de ruta deshecho');
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-1 flex-col">
      <PantallaTarea
        cabecera={
          <CabeceraCabina volver={{ a: '/cabina', texto: 'Cancelar' }}>
            <h1 className="mt-3 text-3xl font-black">Iniciar ruta</h1>
            <p className="mt-1 text-lg font-bold">
              {unidad.placa} <span className="font-semibold opacity-90">{unidad.alias}</span>
            </p>
          </CabeceraCabina>
        }
        accion={
          <Boton type="submit" variante="principal" tamano="xl" bloque cargando={enviando}>
            Iniciar ruta
          </Boton>
        }
      >
        <SelectorDestinos destinos={destinos} recientes={recientes} elegidos={paradas} alCambiar={setParadas} error={errores.paradas} />

        <Campo
          etiqueta="Km de salida"
          error={errores.km}
          ayuda={
            diferencia === null ? `Último km conocido: ${fKm(lectura)}` : diferencia === 0 ? 'Igual al último registro del camión.' : `${diferencia > 0 ? '+' : ''}${num(diferencia)} km desde el último registro (${fKm(lectura)})`
          }
        >
          {(p) => <EntradaNumero {...p} grande unidad="km" value={kmTexto} onChange={(e) => setKmTexto(e.target.value)} />}
        </Campo>
        {diferencia !== null && diferencia > 5 && !errores.km && (
          <AvisoAlerta titulo="Hay km sin ruta registrada">
            El tablero marca {num(diferencia)} km más que el último registro. Puedes seguir; flota lo verá en la revisión.
          </AvisoAlerta>
        )}

        <SelectorNivel
          etiqueta="Combustible al salir"
          capacidad={capacidad}
          valor={nivel}
          alCambiar={setNivel}
          litros={litrosTexto}
          alCambiarLitros={setLitrosTexto}
          detalleLleno={heredado ? 'último repostaje' : undefined}
          error={errores.nivel}
        />
        {sugerencia && (
          <p className="-mt-3 text-sm text-tinta-2">{sugerencia.descripcion}</p>
        )}

        <CampoFoto etiqueta="Foto del tablero" archivo={foto} alCambiar={setFoto} id="foto-salida" />
        {errorServidor && <MensajeError error={errorServidor} />}
      </PantallaTarea>
    </form>
  );
}
