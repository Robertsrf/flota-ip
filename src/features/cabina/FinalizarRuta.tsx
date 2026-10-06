import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CabeceraCabina } from '@/app/DisenoCabina';
import { useAvisos } from '@/components/avisos';
import { AreaTexto, Boton, Campo, EntradaNumero, Segmentado } from '@/components/controles';
import { AvisoAlerta, Calidad, Cargando, MensajeError } from '@/components/datos';
import { CampoFoto } from '@/components/estructura';
import { Hoja } from '@/components/hoja';
import { calcularViaje } from '@/lib/consumo';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { comprimirFoto } from '@/lib/fotos';
import { km as fKm, kml, leerNumero, litros as fLitros, num, usd, usdKm } from '@/lib/formato';
import { baseLocal, descartar, encolar } from '@/lib/offline/cola';
import { useSesion } from '@/lib/sesion';
import { useAhora, useConfiguracion } from '@/lib/ganchos';
import { useCargasViaje, useEstadoCabina, usePrecios, useUltimoPrecio } from './datos';
import { nivelElegido, PantallaTarea, SelectorNivel, SelectorPrecio, type OpcionNivel } from './piezas';

/** Horas transcurridas desde una fecha (fuera del render) */
function horasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function FinalizarRuta() {
  const { abierto, cargando } = useEstadoCabina();
  const { sesion } = useSesion();
  const { data: precios = [] } = usePrecios();
  const { data: ultimo } = useUltimoPrecio(abierto?.unidad_id);
  const { data: cargas = [] } = useCargasViaje(abierto?.pendiente ? null : abierto?.id);
  const { data: cfg } = useConfiguracion();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const qc = useQueryClient();

  const [kmTexto, setKmTexto] = useState('');
  const [reposto, setReposto] = useState<'si' | 'no'>('si');
  const [litrosTexto, setLitrosTexto] = useState('');
  const [precioId, setPrecioId] = useState<string | null>(null);
  const [lleno, setLleno] = useState<'si' | 'no'>('si');
  const [aguja, setAguja] = useState<OpcionNivel | null>(null);
  const [agujaLitros, setAgujaLitros] = useState('');
  const [notas, setNotas] = useState('');
  const [recibo, setRecibo] = useState<Blob | null>(null);
  const [fotoTablero, setFotoTablero] = useState<Blob | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarLargo, setConfirmarLargo] = useState(false);

  const precioElegido = precioId ?? precios.find((p) => p.id === ultimo?.precio_id)?.id ?? precios[0]?.id ?? null;
  const precio = precios.find((p) => p.id === precioElegido);
  const ahora = useAhora(60_000);
  const kmLlegada = leerNumero(kmTexto, 'entero');
  const litros = leerNumero(litrosTexto);
  const capacidad = abierto?.capacidad ?? 0;
  const agujaL = nivelElegido(aguja, capacidad, agujaLitros);

  const vista = useMemo(() => {
    if (!abierto) return null;
    const previas = cargas.map((c) => ({ litros: Number(c.litros), precio: Number(c.precio_usd_litro) }));
    const cierre = reposto === 'si' && litros && precio ? [{ litros, precio: Number(precio.precio_usd_litro), cierre: true, lleno: lleno === 'si' }] : [];
    return calcularViaje({
      capacidad,
      litrosSalida: abierto.litros_salida,
      fuenteSalida: abierto.fuente as 'lleno',
      kmSalida: abierto.km_salida,
      kmLlegada,
      cargas: [...previas, ...cierre],
      aguja: reposto === 'si' && lleno === 'si' ? null : agujaL,
      precioRespaldo: ultimo ? Number(ultimo.precio_usd_litro) : null,
    });
  }, [abierto, cargas, reposto, litros, precio, lleno, agujaL, kmLlegada, capacidad, ultimo]);

  if (cargando) return <Cargando />;
  if (!abierto) return <Navigate to="/cabina" replace />;

  const validar = () => {
    const err: Record<string, string> = {};
    const maxCarga = Math.max(abierto.km_salida, ...cargas.map((c) => Number(c.lectura_medidor ?? 0)));
    if (kmLlegada === null) err.km = 'Escribe el km del tablero al llegar.';
    else if (kmLlegada <= abierto.km_salida)
      err.km = `El km de llegada (${num(kmLlegada)}) ${kmLlegada === abierto.km_salida ? 'es igual que' : 'es menor que'} el de salida (${num(abierto.km_salida)}). Revísalo en el tablero.`;
    else if (kmLlegada < maxCarga) err.km = `El km de llegada (${num(kmLlegada)}) es menor que el de una carga de esta ruta (${num(maxCarga)}).`;
    if (reposto === 'si') {
      if (litros === null || litros <= 0) err.litros = 'Escribe los litros del recibo.';
      else if (litros > capacidad * 1.05) err.litros = `La carga de ${num(litros, 2)} L supera la capacidad del tanque (${num(capacidad)} L). Revisa el recibo.`;
      if (!precio) err.precio = 'Elige el precio por litro.';
      if (lleno === 'no' && aguja === null) err.aguja = 'Indica dónde quedó la aguja después de cargar.';
    } else if (aguja === null) {
      err.aguja = 'Indica dónde quedó la aguja al llegar.';
    }
    if ((aguja === 'otro') && (agujaL === null || agujaL > capacidad)) err.aguja = `Escribe los litros (máximo ${num(capacidad)} L).`;
    if (vista?.error && !err.km) err.resumen = vista.error;
    setErrores(err);
    return Object.keys(err).length === 0;
  };

  const intentar = (e?: FormEvent) => {
    e?.preventDefault();
    if (!validar()) return;
    const horas = horasDesde(abierto.salida_at);
    const recorrido = (kmLlegada ?? 0) - abierto.km_salida;
    if (recorrido > Number(cfg?.viaje_max_km ?? 1500) || horas > Number(cfg?.viaje_max_h ?? 72)) {
      setConfirmarLargo(true);
      return;
    }
    void enviar();
  };

  const enviar = async () => {
    setConfirmarLargo(false);
    setEnviando(true);
    setErrorServidor(null);
    const id = `fin-${abierto.id}`;
    const fotos = [];
    if (recibo && reposto === 'si') fotos.push({ campo: 'p_recibo', blob: await comprimirFoto(recibo) });
    if (fotoTablero) fotos.push({ campo: 'p_foto', blob: await comprimirFoto(fotoTablero) });
    try {
      const resultado = await encolar({
        id,
        tipo: 'finalizar_viaje',
        usuario: sesion!.user.id,
        resumen: `finalizar la ruta a ${abierto.ruta}`,
        args: {
          p_viaje_id: abierto.id,
          p_llegada_at: new Date().toISOString(),
          p_km_llegada: kmLlegada,
          p_reposto: reposto === 'si',
          p_repostaje_id: reposto === 'si' ? crypto.randomUUID() : null,
          p_litros: reposto === 'si' ? litros : null,
          p_precio_id: reposto === 'si' ? precioElegido : null,
          p_tanque_lleno: reposto === 'si' ? lleno === 'si' : true,
          p_litros_aguja: reposto === 'si' && lleno === 'si' ? null : agujaL,
          p_notas: notas.trim() || null,
        },
        fotos,
      });
      if (resultado === 'rechazado') {
        const p = await baseLocal.pendientes.get(id);
        setErrorServidor({ mensaje: p?.error ?? 'No se pudo finalizar la ruta.', ayuda: p?.ayuda, deRed: false, rechazado: true });
        await descartar(id);
        return;
      }
      await qc.invalidateQueries();
      avisos.ok(resultado === 'enviado' ? 'Ruta finalizada' : 'Ruta finalizada en el teléfono; se envía al volver la señal');
      navegar(`/cabina/resumen/${abierto.id}`, { replace: true, state: { vista, ruta: abierto.ruta, pendiente: resultado !== 'enviado' } });
    } catch (x) {
      setErrorServidor(traducirError(x));
    } finally {
      setEnviando(false);
    }
  };

  const recorrido = kmLlegada !== null && kmLlegada > abierto.km_salida ? kmLlegada - abierto.km_salida : null;

  return (
    <form onSubmit={intentar} noValidate className="flex flex-1 flex-col">
      <PantallaTarea
        cabecera={
          <CabeceraCabina volver={{ a: '/cabina', texto: 'Volver' }}>
            <h1 className="mt-3 text-3xl font-black">Finalizar ruta</h1>
            <p className="mt-1 text-lg font-bold">{abierto.ruta}</p>
            <p className="cifra text-base font-semibold">
              {abierto.placa}, salió en el km {num(abierto.km_salida)}
            </p>
          </CabeceraCabina>
        }
        accion={
          <Boton type="submit" variante="principal" tamano="xl" bloque cargando={enviando}>
            Finalizar ruta
          </Boton>
        }
      >
        <Campo etiqueta="Km de llegada" error={errores.km} ayuda={recorrido !== null ? `Recorrido: ${fKm(recorrido)}` : `Salió en el km ${num(abierto.km_salida)}`}>
          {(p) => <EntradaNumero {...p} grande unidad="km" value={kmTexto} onChange={(e) => setKmTexto(e.target.value)} autoFocus />}
        </Campo>

        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">¿Repostaste al llegar?</span>
          <Segmentado
            etiqueta="¿Repostaste al llegar?"
            grande
            valor={reposto}
            alCambiar={setReposto}
            opciones={[
              { valor: 'si', etiqueta: 'Sí' },
              { valor: 'no', etiqueta: 'No' },
            ]}
          />
        </div>

        {reposto === 'si' ? (
          <>
            <Campo etiqueta="Litros cargados" error={errores.litros}>
              {(p) => <EntradaNumero {...p} grande unidad="L" value={litrosTexto} onChange={(e) => setLitrosTexto(e.target.value)} />}
            </Campo>
            <SelectorPrecio precios={precios} valor={precioElegido} alCambiar={setPrecioId} error={errores.precio} />
            <div className="flex flex-col gap-2">
              <span className="text-base font-bold">¿Llenaste el tanque?</span>
              <Segmentado
                etiqueta="¿Llenaste el tanque?"
                grande
                valor={lleno}
                alCambiar={setLleno}
                opciones={[
                  { valor: 'si', etiqueta: 'Sí' },
                  { valor: 'no', etiqueta: 'No' },
                ]}
              />
            </div>
            {lleno === 'no' && (
              <SelectorNivel
                etiqueta="Aguja después de cargar"
                capacidad={capacidad}
                sinLleno
                conNoSe
                valor={aguja}
                alCambiar={setAguja}
                litros={agujaLitros}
                alCambiarLitros={setAgujaLitros}
                error={errores.aguja}
              />
            )}
            <CampoFoto etiqueta="Foto del recibo" archivo={recibo} alCambiar={setRecibo} id="foto-recibo" />
          </>
        ) : (
          <SelectorNivel
            etiqueta="Aguja al llegar"
            capacidad={capacidad}
            sinLleno
            conNoSe
            valor={aguja}
            alCambiar={setAguja}
            litros={agujaLitros}
            alCambiarLitros={setAgujaLitros}
            error={errores.aguja}
          />
        )}

        <Campo etiqueta="¿Algo que flota deba saber?" opcional ayuda="Una falla, un ruido, una multa. Flota lo ve en la revisión.">
          {(p) => <AreaTexto {...p} value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />}
        </Campo>
        <CampoFoto etiqueta="Foto del tablero" archivo={fotoTablero} alCambiar={setFotoTablero} id="foto-llegada" />

        {vista && recorrido !== null && (
          <section aria-label="Resumen antes de confirmar" className="rounded-xl border-2 border-tinta p-4">
            <h2 className="text-base font-bold">Así queda la ruta</h2>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="cifra text-4xl font-black">{vista.rendimiento !== null ? num(vista.rendimiento, 2) : '—'}</span>
              <span className="text-lg font-bold">km/L</span>
            </div>
            <dl className="cifra mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-base">
              <div><dt className="text-sm text-tinta-2">Recorrido</dt><dd className="font-bold">{fKm(vista.km)}</dd></div>
              <div><dt className="text-sm text-tinta-2">Consumo</dt><dd className="font-bold">{fLitros(vista.litros)}</dd></div>
              <div><dt className="text-sm text-tinta-2">Costo</dt><dd className="font-bold">{usd(vista.costo)}</dd></div>
              <div><dt className="text-sm text-tinta-2">Costo por km</dt><dd className="font-bold">{usdKm(vista.costoKm)}</dd></div>
            </dl>
            <div className="mt-3">
              <Calidad valor={vista.calidad} />
            </div>
            {vista.calidad === 'incompleto' && !vista.error && (
              <p className="mt-2 text-sm text-tinta-2">Sin el nivel al llegar no se puede calcular el consumo. Igual se registran los km.</p>
            )}
            {vista.rendimiento !== null && <p className="sr-only">Rendimiento {kml(vista.rendimiento)}</p>}
          </section>
        )}
        {errores.resumen && <MensajeError error={{ mensaje: errores.resumen, deRed: false, rechazado: true }} />}
        {errorServidor && <MensajeError error={errorServidor} />}
      </PantallaTarea>

      <Hoja
        abierta={confirmarLargo}
        alCerrar={() => setConfirmarLargo(false)}
        titulo="¿Seguro que es correcto?"
        pie={
          <>
            <Boton onClick={() => setConfirmarLargo(false)}>Revisar</Boton>
            <Boton variante="principal" onClick={() => void enviar()}>
              Sí, finalizar
            </Boton>
          </>
        }
      >
        <AvisoAlerta>
          Esta ruta tiene {recorrido !== null ? fKm(recorrido) : '—'} y lleva{' '}
          {num((ahora.getTime() - new Date(abierto.salida_at).getTime()) / 3_600_000, 0)} h abierta. Es más de lo normal; revisa el km del tablero antes de finalizar.
        </AvisoAlerta>
      </Hoja>
    </form>
  );
}
