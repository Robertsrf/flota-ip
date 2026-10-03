import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CabeceraCabina } from '@/app/DisenoCabina';
import { useAvisos } from '@/components/avisos';
import { AreaTexto, Boton, Campo, Entrada, EntradaNumero, Segmentado } from '@/components/controles';
import { Cargando, EstadoVacio, MensajeError } from '@/components/datos';
import { CampoFoto } from '@/components/estructura';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { comprimirFoto } from '@/lib/fotos';
import { fecha, hoyIso, leerNumero, num, usd } from '@/lib/formato';
import { redondear } from '@/lib/consumo';
import { baseLocal, descartar, encolar } from '@/lib/offline/cola';
import { useSesion } from '@/lib/sesion';
import { useCategorias, useEstadoCabina, useTasaHoy, useUnidad } from './datos';
import { PantallaTarea } from './piezas';

export function RegistrarGasto() {
  const { abierto, ultimaUnidadId, cargando } = useEstadoCabina();
  const unidadId = abierto?.unidad_id ?? ultimaUnidadId;
  const { data: unidad } = useUnidad(unidadId);
  const { data: categorias = [] } = useCategorias();
  const { data: tasaHoy } = useTasaHoy();
  const { sesion } = useSesion();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const qc = useQueryClient();

  const [categoria, setCategoria] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [montoTexto, setMontoTexto] = useState('');
  const [tasaEscrita, setTasaTexto] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [factura, setFactura] = useState<Blob | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);

  const tasaTexto = tasaEscrita ?? (tasaHoy ? num(tasaHoy.bs_por_usd, 2) : '');

  if (cargando) return <Cargando />;
  if (!unidadId) {
    return (
      <>
        <CabeceraCabina volver={{ a: '/cabina', texto: 'Cancelar' }} />
        <div className="p-4">
          <EstadoVacio titulo="Primero inicia una ruta">Los gastos se registran en el camión de tu ruta o en el último que manejaste.</EstadoVacio>
        </div>
      </>
    );
  }
  if (!unidad) return <Cargando />;

  const monto = leerNumero(montoTexto);
  const tasa = leerNumero(tasaTexto);
  const enUsd = moneda === 'USD' ? monto : monto && tasa ? redondear(monto / tasa, 2) : null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!categoria) err.categoria = 'Elige la categoría.';
    if (monto === null || monto <= 0) err.monto = 'Escribe el monto.';
    if (moneda === 'VES' && (tasa === null || tasa <= 0)) err.tasa = 'Escribe la tasa BCV del día.';
    setErrores(err);
    if (Object.keys(err).length) return;

    setEnviando(true);
    setErrorServidor(null);
    const id = crypto.randomUUID();
    try {
      const r = await encolar({
        id,
        tipo: 'registrar_mantenimiento',
        usuario: sesion!.user.id,
        resumen: `gasto de ${moneda === 'USD' ? usd(monto) : `Bs ${num(monto, 2)}`} en ${unidad.placa}`,
        args: {
          p_id: id,
          p_unidad_id: unidad.id,
          p_categoria_id: categoria,
          p_fecha: hoyIso(),
          p_moneda: moneda,
          p_monto: monto,
          p_bs_por_usd: moneda === 'VES' ? tasa : null,
          p_descripcion: descripcion.trim() || null,
          p_proveedor: proveedor.trim() || null,
        },
        fotos: factura ? [{ campo: 'p_factura', blob: await comprimirFoto(factura) }] : [],
      });
      if (r === 'rechazado') {
        const p = await baseLocal.pendientes.get(id);
        setErrorServidor({ mensaje: p?.error ?? 'No se pudo registrar.', ayuda: p?.ayuda, deRed: false, rechazado: true });
        await descartar(id);
        return;
      }
      await qc.invalidateQueries();
      avisos.ok(r === 'enviado' ? 'Gasto enviado: flota lo aprueba antes de sumarlo' : 'Gasto guardado en el teléfono; se envía al volver la señal');
      navegar('/cabina', { replace: true });
    } catch (x) {
      setErrorServidor(traducirError(x));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-1 flex-col">
      <PantallaTarea
        cabecera={
          <CabeceraCabina volver={{ a: '/cabina', texto: 'Cancelar' }}>
            <h1 className="mt-3 text-3xl font-black">Registrar gasto</h1>
            <p className="mt-1 text-lg font-bold">
              {unidad.placa} <span className="font-semibold opacity-90">{unidad.alias}</span>
            </p>
          </CabeceraCabina>
        }
        accion={
          <Boton type="submit" variante="principal" tamano="xl" bloque cargando={enviando}>
            Enviar gasto a flota
          </Boton>
        }
      >
        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">Categoría</span>
          <Segmentado
            etiqueta="Categoría"
            columnas={2}
            valor={categoria}
            alCambiar={setCategoria}
            error={Boolean(errores.categoria)}
            opciones={categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          />
          {errores.categoria && (
            <p role="alert" className="text-sm font-semibold text-peligro">
              {errores.categoria}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">Moneda</span>
          <Segmentado
            etiqueta="Moneda"
            grande
            valor={moneda}
            alCambiar={setMoneda}
            opciones={[
              { valor: 'USD', etiqueta: '$ Dólares' },
              { valor: 'VES', etiqueta: 'Bs Bolívares' },
            ]}
          />
        </div>
        <Campo etiqueta="Monto" error={errores.monto} ayuda={moneda === 'VES' && enUsd !== null ? `Equivale a ${usd(enUsd)}` : undefined}>
          {(p) => <EntradaNumero {...p} grande unidad={moneda === 'USD' ? '$' : 'Bs'} value={montoTexto} onChange={(e) => setMontoTexto(e.target.value)} />}
        </Campo>
        {moneda === 'VES' && (
          <Campo
            etiqueta="Tasa BCV (Bs por $)"
            error={errores.tasa}
            ayuda={tasaHoy ? `Tasa del ${fecha(tasaHoy.fecha)}. Cámbiala si el recibo usa otra.` : 'No hay tasa cargada: escríbela.'}
          >
            {(p) => <EntradaNumero {...p} unidad="Bs/$" value={tasaTexto} onChange={(e) => setTasaTexto(e.target.value)} />}
          </Campo>
        )}
        <Campo etiqueta="¿Qué se hizo?" opcional>
          {(p) => <AreaTexto {...p} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />}
        </Campo>
        <Campo etiqueta="Proveedor o taller" opcional>
          {(p) => <Entrada {...p} value={proveedor} onChange={(e) => setProveedor(e.target.value)} />}
        </Campo>
        <CampoFoto etiqueta="Foto de la factura" archivo={factura} alCambiar={setFactura} id="foto-factura" />
        {errorServidor && <MensajeError error={errorServidor} />}
      </PantallaTarea>
    </form>
  );
}
