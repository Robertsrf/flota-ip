import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAvisos } from '@/components/avisos';
import { AreaTexto, Boton, Campo, Casilla, Entrada, EntradaNumero, Segmentado, Seleccion } from '@/components/controles';
import { MensajeError } from '@/components/datos';
import { CampoFoto } from '@/components/estructura';
import { Hoja } from '@/components/hoja';
import { rpc, type Viaje } from '@/lib/api';
import { redondear } from '@/lib/consumo';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { comprimirFoto, rutaComprobante, subirArchivo } from '@/lib/fotos';
import { aDatetimeLocal, desdeDatetimeLocal, fecha, hoyIso, leerNumero, num, usd } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { useCategorias, usePrecios } from '@/features/cabina/datos';
import { nivelElegido, SelectorNivel, type OpcionNivel } from '@/features/cabina/piezas';
import { etiquetaUnidad, useUnidadesLista } from './datosComunes';

async function subirSiHay(uid: string, id: string, campo: string, archivo: Blob | null): Promise<string | null> {
  if (!archivo) return null;
  const blob = await comprimirFoto(archivo);
  return subirArchivo('comprobantes', rutaComprobante(uid, id, campo, blob.type), blob);
}

// ----- Repostaje (oficina: camiones y plantas) ------------------------------------------------
export function FormRepostajeOficina({ abierta, alCerrar, unidadFija }: { abierta: boolean; alCerrar: () => void; unidadFija?: string }) {
  const { data: unidades = [] } = useUnidadesLista();
  const { data: precios = [] } = usePrecios();
  const { sesion } = useSesion();
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [unidadId, setUnidadId] = useState(unidadFija ?? '');
  const [fechaTexto, setFecha] = useState(() => aDatetimeLocal());
  const [lecturaTexto, setLectura] = useState('');
  const [litrosTexto, setLitros] = useState('');
  const [precioId, setPrecioId] = useState<string | null>(null);
  const [lleno, setLleno] = useState<'si' | 'no'>('si');
  const [omitida, setOmitida] = useState(false);
  const [estacion, setEstacion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const [recibo, setRecibo] = useState<Blob | null>(null);
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);

  const unidad = unidades.find((u) => u.id === unidadId);
  const precio = precios.find((p) => p.id === (precioId ?? precios[0]?.id));
  const litros = leerNumero(litrosTexto);
  const sinMedidor = unidad?.medidor === 'ninguno';

  const guardar = async () => {
    if (!unidad) return setError({ mensaje: 'Elige la unidad.', deRed: false, rechazado: true });
    if (litros === null || litros <= 0) return setError({ mensaje: 'Escribe los litros cargados.', deRed: false, rechazado: true });
    if (!sinMedidor && leerNumero(lecturaTexto, 'entero') === null) {
      return setError({ mensaje: unidad.medidor === 'km' ? 'Escribe el km del tablero.' : 'Escribe las horas del horómetro.', deRed: false, rechazado: true });
    }
    setEnviando(true);
    setError(null);
    const id = crypto.randomUUID();
    try {
      const reciboRuta = await subirSiHay(sesion!.user.id, id, 'p_recibo', recibo);
      await rpc('registrar_repostaje', {
        p_id: id,
        p_unidad_id: unidad.id,
        p_fecha: desdeDatetimeLocal(fechaTexto),
        p_lectura: sinMedidor ? null : leerNumero(lecturaTexto, 'entero'),
        p_litros: litros,
        p_precio_id: precio?.id ?? null,
        p_tanque_lleno: lleno === 'si',
        p_estacion: estacion.trim() || null,
        p_recibo: reciboRuta,
        p_carga_previa_omitida: omitida,
        p_motivo: motivo.trim() || null,
      });
      await qc.invalidateQueries();
      avisos.ok('Repostaje registrado');
      alCerrar();
    } catch (e) {
      const t = traducirError(e);
      if (t.detalle === 'KM_MENOR_ACTUAL') setPedirMotivo(true);
      setError(t);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja
      abierta={abierta}
      alCerrar={alCerrar}
      titulo="Registrar repostaje"
      ancho="ancho"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={enviando} onClick={() => void guardar()}>
            Registrar repostaje
          </Boton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {!unidadFija && (
          <Campo etiqueta="Unidad">
            {(p) => (
              <Seleccion {...p} value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
                <option value="">Elige un camión o planta</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.tipo === 'planta' ? `Planta: ${u.alias}` : etiquetaUnidad(u)}
                  </option>
                ))}
              </Seleccion>
            )}
          </Campo>
        )}
        <Campo etiqueta="Fecha y hora">{(p) => <Entrada {...p} type="datetime-local" value={fechaTexto} onChange={(e) => setFecha(e.target.value)} />}</Campo>
        {!sinMedidor && (
          <Campo etiqueta={unidad?.medidor === 'horas' ? 'Horómetro' : 'Km del tablero'}>
            {(p) => <EntradaNumero {...p} unidad={unidad?.medidor === 'horas' ? 'h' : 'km'} value={lecturaTexto} onChange={(e) => setLectura(e.target.value)} />}
          </Campo>
        )}
        <Campo etiqueta="Litros cargados" ayuda={litros && precio ? `Total: ${usd(redondear(litros * Number(precio.precio_usd_litro), 2))}` : undefined}>
          {(p) => <EntradaNumero {...p} unidad="L" value={litrosTexto} onChange={(e) => setLitros(e.target.value)} />}
        </Campo>
        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">Precio por litro</span>
          <Segmentado
            etiqueta="Precio por litro"
            valor={precio?.id ?? null}
            alCambiar={setPrecioId}
            opciones={precios.map((p) => ({ valor: p.id, etiqueta: usd(p.precio_usd_litro) }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">¿Llenó el tanque?</span>
          <Segmentado etiqueta="¿Llenó el tanque?" valor={lleno} alCambiar={setLleno} opciones={[{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }]} />
        </div>
        <Campo etiqueta="Estación o proveedor" opcional>{(p) => <Entrada {...p} value={estacion} onChange={(e) => setEstacion(e.target.value)} />}</Campo>
        {!sinMedidor && (
          <div className="md:col-span-2">
            <Casilla
              etiqueta="Faltó registrar la carga anterior (no calcular el ciclo lleno a lleno que la incluye)"
              checked={omitida}
              onChange={setOmitida}
            />
          </div>
        )}
        <CampoFoto etiqueta="Foto del recibo" archivo={recibo} alCambiar={setRecibo} id="recibo-oficina" />
        {pedirMotivo && (
          <Campo etiqueta="Motivo para registrar un km menor" className="md:col-span-2">
            {(p) => <AreaTexto {...p} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
        )}
      </div>
      {error && <MensajeError error={error} className="mt-4" />}
    </Hoja>
  );
}

// ----- Gasto de mantenimiento (oficina) -------------------------------------------------------------
export function FormGastoOficina({ abierta, alCerrar, unidadFija }: { abierta: boolean; alCerrar: () => void; unidadFija?: string }) {
  const { data: unidades = [] } = useUnidadesLista();
  const { data: categorias = [] } = useCategorias();
  const { sesion } = useSesion();
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [unidadId, setUnidadId] = useState(unidadFija ?? '');
  const [categoria, setCategoria] = useState('');
  const [fechaGasto, setFechaGasto] = useState(() => hoyIso());
  const [lecturaTexto, setLectura] = useState('');
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [montoTexto, setMonto] = useState('');
  const [tasaEscrita, setTasa] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [factura, setFactura] = useState<Blob | null>(null);
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data: tasaFecha } = useQuery({
    queryKey: ['tasa', fechaGasto],
    enabled: moneda === 'VES' && Boolean(fechaGasto),
    queryFn: async () => (await rpc('tasa_para_fecha', { p_fecha: fechaGasto }))[0] ?? null,
  });
  const tasaTexto = tasaEscrita ?? (tasaFecha ? String(tasaFecha.bs_por_usd).replace('.', ',') : '');
  const unidad = unidades.find((u) => u.id === unidadId);
  const monto = leerNumero(montoTexto);
  const tasa = leerNumero(tasaTexto);
  const enUsd = moneda === 'USD' ? monto : monto && tasa ? redondear(monto / tasa, 2) : null;

  const guardar = async () => {
    if (!unidad) return setError({ mensaje: 'Elige la unidad.', deRed: false, rechazado: true });
    if (!categoria) return setError({ mensaje: 'Elige la categoría.', deRed: false, rechazado: true });
    if (monto === null || monto <= 0) return setError({ mensaje: 'Escribe el monto.', deRed: false, rechazado: true });
    if (moneda === 'VES' && (tasa === null || tasa <= 0)) return setError({ mensaje: 'Escribe la tasa BCV.', deRed: false, rechazado: true });
    setEnviando(true);
    setError(null);
    const id = crypto.randomUUID();
    try {
      const ruta = await subirSiHay(sesion!.user.id, id, 'p_factura', factura);
      await rpc('registrar_mantenimiento', {
        p_id: id,
        p_unidad_id: unidad.id,
        p_categoria_id: categoria,
        p_fecha: fechaGasto,
        p_moneda: moneda,
        p_monto: monto,
        p_bs_por_usd: moneda === 'VES' ? tasa : null,
        p_lectura: leerNumero(lecturaTexto, 'entero'),
        p_descripcion: descripcion.trim() || null,
        p_proveedor: proveedor.trim() || null,
        p_factura: ruta,
      });
      await qc.invalidateQueries();
      avisos.ok('Gasto registrado');
      alCerrar();
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja
      abierta={abierta}
      alCerrar={alCerrar}
      titulo="Registrar gasto de mantenimiento"
      ancho="ancho"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={enviando} onClick={() => void guardar()}>
            Registrar gasto
          </Boton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {!unidadFija && (
          <Campo etiqueta="Unidad">
            {(p) => (
              <Seleccion {...p} value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
                <option value="">Elige un camión o planta</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.tipo === 'planta' ? `Planta: ${u.alias}` : etiquetaUnidad(u)}
                  </option>
                ))}
              </Seleccion>
            )}
          </Campo>
        )}
        <Campo etiqueta="Categoría">
          {(p) => (
            <Seleccion {...p} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Elige una categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Fecha">{(p) => <Entrada {...p} type="date" max={hoyIso()} value={fechaGasto} onChange={(e) => setFechaGasto(e.target.value)} />}</Campo>
        <Campo etiqueta={unidad?.medidor === 'horas' ? 'Horómetro' : 'Km del tablero'} opcional>
          {(p) => <EntradaNumero {...p} unidad={unidad?.medidor === 'horas' ? 'h' : 'km'} value={lecturaTexto} onChange={(e) => setLectura(e.target.value)} disabled={unidad?.medidor === 'ninguno'} />}
        </Campo>
        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">Moneda</span>
          <Segmentado etiqueta="Moneda" valor={moneda} alCambiar={setMoneda} opciones={[{ valor: 'USD', etiqueta: '$ Dólares' }, { valor: 'VES', etiqueta: 'Bs Bolívares' }]} />
        </div>
        <Campo etiqueta="Monto" ayuda={moneda === 'VES' && enUsd !== null ? `Equivale a ${usd(enUsd)}` : undefined}>
          {(p) => <EntradaNumero {...p} unidad={moneda === 'USD' ? '$' : 'Bs'} value={montoTexto} onChange={(e) => setMonto(e.target.value)} />}
        </Campo>
        {moneda === 'VES' && (
          <Campo etiqueta="Tasa BCV (Bs por $)" ayuda={tasaFecha ? `Tasa del ${fecha(tasaFecha.fecha)}${tasaFecha.manual ? ' (manual)' : ''}. Cámbiala si la factura usa otra.` : 'No hay tasa para esa fecha: escríbela.'}>
            {(p) => <EntradaNumero {...p} unidad="Bs/$" value={tasaTexto} onChange={(e) => setTasa(e.target.value)} />}
          </Campo>
        )}
        <Campo etiqueta="Proveedor o taller" opcional>{(p) => <Entrada {...p} value={proveedor} onChange={(e) => setProveedor(e.target.value)} />}</Campo>
        <Campo etiqueta="Descripción" opcional className="md:col-span-2">
          {(p) => <AreaTexto {...p} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />}
        </Campo>
        <CampoFoto etiqueta="Foto de la factura" archivo={factura} alCambiar={setFactura} id="factura-oficina" />
      </div>
      {error && <MensajeError error={error} className="mt-4" />}
    </Hoja>
  );
}

// ----- Finalizar una ruta olvidada (flota) --------------------------------------------------------------
export function FinalizarOficina({ viaje, abierta, alCerrar }: { viaje: Viaje; abierta: boolean; alCerrar: () => void }) {
  const { data: precios = [] } = usePrecios();
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [llegada, setLlegada] = useState(() => aDatetimeLocal());
  const [kmTexto, setKm] = useState('');
  const [reposto, setReposto] = useState<'si' | 'no'>('no');
  const [litrosTexto, setLitros] = useState('');
  const [precioId, setPrecioId] = useState<string | null>(null);
  const [lleno, setLleno] = useState<'si' | 'no'>('si');
  const [aguja, setAguja] = useState<OpcionNivel | null>(null);
  const [agujaLitros, setAgujaLitros] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);
  const capacidad = Number(viaje.capacidad_tanque_l ?? 0);
  const precio = precios.find((p) => p.id === (precioId ?? precios[0]?.id));

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await rpc('finalizar_viaje', {
        p_viaje_id: viaje.id!,
        p_llegada_at: desdeDatetimeLocal(llegada),
        p_km_llegada: leerNumero(kmTexto, 'entero'),
        p_reposto: reposto === 'si',
        p_repostaje_id: reposto === 'si' ? crypto.randomUUID() : null,
        p_litros: reposto === 'si' ? leerNumero(litrosTexto) : null,
        p_precio_id: reposto === 'si' ? (precio?.id ?? null) : null,
        p_tanque_lleno: reposto === 'si' ? lleno === 'si' : true,
        p_litros_aguja: reposto === 'si' && lleno === 'si' ? null : nivelElegido(aguja, capacidad, agujaLitros),
        p_notas: notas.trim() || null,
      });
      await qc.invalidateQueries();
      avisos.ok('Ruta finalizada');
      alCerrar();
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja
      abierta={abierta}
      alCerrar={alCerrar}
      titulo={`Finalizar la ruta ${viaje.folio_txt ?? ''}`}
      descripcion={`${viaje.placa} con ${viaje.chofer_nombre}; salió en el km ${num(viaje.km_salida)}.`}
      ancho="ancho"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={enviando} onClick={() => void guardar()}>
            Finalizar ruta
          </Boton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta="Llegada">{(p) => <Entrada {...p} type="datetime-local" value={llegada} onChange={(e) => setLlegada(e.target.value)} />}</Campo>
        <Campo etiqueta="Km de llegada">{(p) => <EntradaNumero {...p} unidad="km" value={kmTexto} onChange={(e) => setKm(e.target.value)} />}</Campo>
        <div className="flex flex-col gap-2 md:col-span-2">
          <span className="text-base font-bold">¿Repostó al llegar?</span>
          <Segmentado etiqueta="¿Repostó al llegar?" valor={reposto} alCambiar={setReposto} opciones={[{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }]} />
        </div>
        {reposto === 'si' && (
          <>
            <Campo etiqueta="Litros">{(p) => <EntradaNumero {...p} unidad="L" value={litrosTexto} onChange={(e) => setLitros(e.target.value)} />}</Campo>
            <div className="flex flex-col gap-2">
              <span className="text-base font-bold">Precio por litro</span>
              <Segmentado etiqueta="Precio por litro" valor={precio?.id ?? null} alCambiar={setPrecioId} opciones={precios.map((p) => ({ valor: p.id, etiqueta: `$ ${num(p.precio_usd_litro, 2)}` }))} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-base font-bold">¿Llenó el tanque?</span>
              <Segmentado etiqueta="¿Llenó el tanque?" valor={lleno} alCambiar={setLleno} opciones={[{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }]} />
            </div>
          </>
        )}
        {(reposto === 'no' || lleno === 'no') && (
          <div className="md:col-span-2">
            <SelectorNivel etiqueta="Nivel al llegar" capacidad={capacidad} sinLleno conNoSe valor={aguja} alCambiar={setAguja} litros={agujaLitros} alCambiarLitros={setAgujaLitros} />
          </div>
        )}
        <Campo etiqueta="Nota" opcional ayuda="Una nota aquí también manda la ruta a la bandeja de revisión." className="md:col-span-2">{(p) => <AreaTexto {...p} value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />}</Campo>
      </div>
      {error && <MensajeError error={error} className="mt-4" />}
    </Hoja>
  );
}
