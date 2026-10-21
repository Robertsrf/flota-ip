import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useAvisos } from '@/components/avisos';
import { Boton } from '@/components/controles';
import { Dato, EstadoVacio, Etiqueta } from '@/components/datos';
import { VerFoto } from '@/components/estructura';
import { ConfirmarConMotivo, Hoja } from '@/components/hoja';
import { Tabla, type Columna } from '@/components/tabla';
import { rpc, type Ciclo, type Gasto, type Repostaje } from '@/lib/api';
import { bs, fecha, fechaHora, kml, litros as fLitros, num, tasa, usd } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { useCategorias, usePrecios } from '@/features/cabina/datos';
import { AccionesRegistro, HistorialAuditoria } from './Acciones';
import { camposGasto, camposRepostaje } from './campos';
import { useUnidadesLista } from './datosComunes';

// ----- Repostajes ------------------------------------------------------------------------------
export function TablaRepostajes({ filas, cargando, mostrarUnidad = true, nombreExport = 'repostajes', titulo }: {
  filas: Repostaje[]; cargando?: boolean; mostrarUnidad?: boolean; nombreExport?: string; titulo?: string;
}) {
  const [elegido, setElegido] = useState<Repostaje | null>(null);
  const columnas: Columna<Repostaje>[] = [
    { id: 'folio', titulo: 'Folio', celda: (r) => <span className={`font-bold ${r.anulado ? 'line-through' : ''}`}>{r.folio_txt}</span>, movilCelda: (r) => <span className={r.anulado ? 'line-through' : ''}>{r.folio_txt}</span>, orden: (r) => r.folio, exportar: { valor: (r) => r.folio_txt } },
    { id: 'fecha', titulo: 'Fecha', movil: 'principal', celda: (r) => fechaHora(r.fecha), orden: (r) => r.fecha, exportar: { valor: (r) => r.fecha, tipo: 'fechaHora' } },
    ...(mostrarUnidad ? [{ id: 'unidad', titulo: 'Unidad', celda: (r: Repostaje) => r.unidad_nombre, movilCelda: (r: Repostaje) => r.unidad_nombre, orden: (r: Repostaje) => r.unidad_nombre, exportar: { valor: (r: Repostaje) => r.unidad_nombre } }] : []),
    { id: 'lectura', titulo: 'Km / h', alinear: 'der', movil: 'oculta', celda: (r) => num(r.lectura_medidor), orden: (r) => Number(r.lectura_medidor ?? -1), exportar: { valor: (r) => r.lectura_medidor, tipo: 'entero', titulo: 'Lectura (km u horas)' } },
    { id: 'litros', titulo: 'Litros', alinear: 'der', movilCelda: (r) => `${fLitros(r.litros)} a $ ${num(r.precio_usd_litro, 2)}`, celda: (r) => num(r.litros, 2), orden: (r) => Number(r.litros), exportar: { valor: (r) => r.litros, tipo: 'litros' } },
    { id: 'precio', titulo: 'Precio/L', alinear: 'der', movil: 'oculta', celda: (r) => `$ ${num(r.precio_usd_litro, 2)}`, orden: (r) => Number(r.precio_usd_litro), exportar: { valor: (r) => r.precio_usd_litro, tipo: 'decimal', titulo: 'Precio por litro (USD)' } },
    { id: 'monto', titulo: 'Monto', alinear: 'der', movil: 'derecha', celda: (r) => usd(r.monto_usd), orden: (r) => Number(r.monto_usd), exportar: { valor: (r) => r.monto_usd, tipo: 'usd', titulo: 'Monto' } },
    { id: 'lleno', titulo: 'Tanque', movilCelda: (r) => (r.tanque_lleno ? 'Llenó' : 'Parcial'), celda: (r) => (r.tanque_lleno ? 'Lleno' : 'Parcial'), orden: (r) => (r.tanque_lleno ? 1 : 0), exportar: { valor: (r) => (r.tanque_lleno ? 'lleno' : 'parcial'), titulo: 'Tanque' } },
    { id: 'viaje', titulo: 'Ruta', movil: 'oculta', celda: (r) => r.viaje_folio_txt ?? 'Suelta', exportar: { valor: (r) => r.viaje_folio_txt ?? '' } },
    { id: 'chofer', titulo: 'Registró', movil: 'oculta', celda: (r) => r.chofer_nombre ?? r.registrado_por_nombre ?? '—', exportar: { valor: (r) => r.registrado_por_nombre } },
    { id: 'estado', titulo: 'Estado', movilCelda: (r) => (r.anulado ? <Etiqueta tono="peligro">Anulada</Etiqueta> : null), celda: (r) => (r.anulado ? <Etiqueta tono="peligro">Anulada</Etiqueta> : r.carga_previa_omitida ? <Etiqueta>Carga anterior omitida</Etiqueta> : ''), exportar: { valor: (r) => (r.anulado ? 'anulada' : '') } },
  ];
  return (
    <>
      <Tabla
        titulo={titulo}
        filas={filas}
        columnas={columnas}
        clave={(r) => r.id!}
        cargando={cargando}
        alElegir={setElegido}
        nombreExport={nombreExport}
        ordenInicial={{ id: 'fecha', dir: 'desc' }}
        vacio={<EstadoVacio titulo="Sin repostajes en este período" />}
      />
      {elegido && <DetalleRepostaje r={elegido} alCerrar={() => setElegido(null)} />}
    </>
  );
}

function DetalleRepostaje({ r, alCerrar }: { r: Repostaje; alCerrar: () => void }) {
  const { esOficina, esSuper } = useSesion();
  const { data: precios = [] } = usePrecios();
  return (
    <Hoja abierta alCerrar={alCerrar} titulo={`Repostaje ${r.folio_txt}`} descripcion={`${r.unidad_nombre}, ${fechaHora(r.fecha)}`} ancho="ancho">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato etiqueta="Litros">{fLitros(r.litros)}</Dato>
        <Dato etiqueta="Precio por litro">$ {num(r.precio_usd_litro, 3)}</Dato>
        <Dato etiqueta="Monto">{usd(r.monto_usd)}</Dato>
        <Dato etiqueta="Tanque">{r.tanque_lleno ? 'Lleno' : 'Parcial'}</Dato>
        <Dato etiqueta="Km u horas">{num(r.lectura_medidor)}</Dato>
        <Dato etiqueta="Ruta">{r.viaje_id ? <Link className="underline underline-offset-4" to={`/viajes/${r.viaje_id}`}>{r.viaje_folio_txt}</Link> : 'Carga suelta'}</Dato>
        <Dato etiqueta="Estación">{r.estacion ?? '—'}</Dato>
        <Dato etiqueta="Registró">{r.registrado_por_nombre ?? '—'}</Dato>
      </div>
      {r.anulado && <p className="mt-3 font-bold text-peligro">Anulada. Motivo: {r.anulado_motivo}</p>}
      {r.notas && <p className="mt-3 text-base">{r.notas}</p>}
      <div className="mt-4"><VerFoto ruta={r.recibo_path} etiqueta="Recibo" /></div>
      <div className="mt-4">
        <AccionesRegistro
          tabla="repostajes"
          registro={r as unknown as Record<string, unknown>}
          campos={camposRepostaje(esOficina, precios)}
          puedeCorregir={esOficina}
          puedeAnular={esOficina}
          puedeRestaurar={esSuper}
          nombre="la carga"
        />
      </div>
      {esOficina && (
        <div className="mt-6">
          <h3 className="mb-2 text-base font-extrabold">Historial de cambios</h3>
          <HistorialAuditoria tabla="repostajes" registroId={r.id!} />
        </div>
      )}
    </Hoja>
  );
}

// ----- Gastos de mantenimiento -------------------------------------------------------------------------
const ESTADO: Record<string, { texto: string; tono: 'neutro' | 'alerta' | 'peligro' | 'via' }> = {
  pendiente: { texto: 'Por aprobar', tono: 'alerta' },
  aprobado: { texto: 'Aprobado', tono: 'via' },
  rechazado: { texto: 'Rechazado', tono: 'peligro' },
};

export function TablaGastos({ filas, cargando, mostrarUnidad = true, nombreExport = 'mantenimiento', titulo }: {
  filas: Gasto[]; cargando?: boolean; mostrarUnidad?: boolean; nombreExport?: string; titulo?: string;
}) {
  const [elegido, setElegido] = useState<Gasto | null>(null);
  const columnas: Columna<Gasto>[] = [
    { id: 'folio', titulo: 'Folio', celda: (g) => <span className={`font-bold ${g.anulado ? 'line-through' : ''}`}>{g.folio_txt}</span>, movilCelda: (g) => <span className={g.anulado ? 'line-through' : ''}>{g.folio_txt}</span>, orden: (g) => g.folio, exportar: { valor: (g) => g.folio_txt } },
    { id: 'fecha', titulo: 'Fecha', movilCelda: (g) => fecha(g.fecha), celda: (g) => fecha(g.fecha), orden: (g) => g.fecha, exportar: { valor: (g) => g.fecha, tipo: 'fecha' } },
    ...(mostrarUnidad ? [{ id: 'unidad', titulo: 'Unidad', movilCelda: (g: Gasto) => g.unidad_nombre, celda: (g: Gasto) => g.unidad_nombre, orden: (g: Gasto) => g.unidad_nombre, exportar: { valor: (g: Gasto) => g.unidad_nombre } }] : []),
    { id: 'cat', titulo: 'Categoría', movil: 'principal', celda: (g) => g.categoria_nombre, orden: (g) => g.categoria_nombre, exportar: { valor: (g) => g.categoria_nombre } },
    { id: 'desc', titulo: 'Descripción', movil: 'oculta', envolver: true, celda: (g) => <span className="line-clamp-1">{g.descripcion ?? '—'}</span>, exportar: { valor: (g) => g.descripcion } },
    { id: 'original', titulo: 'Monto original', alinear: 'der', movilCelda: (g) => (g.moneda === 'VES' ? `Pagado en ${bs(g.monto)}` : null), celda: (g) => (g.moneda === 'VES' ? bs(g.monto) : usd(g.monto)), orden: (g) => Number(g.monto_usd), exportar: { valor: (g) => g.moneda, titulo: 'Moneda' } },
    { id: 'tasa', titulo: 'Tasa', alinear: 'der', movil: 'oculta', celda: (g) => (g.moneda === 'VES' ? num(g.bs_por_usd, 2) : '—'), exportar: { valor: (g) => g.bs_por_usd, tipo: 'decimal', titulo: 'Tasa BCV (Bs por USD)' } },
    { id: 'usd', titulo: 'USD', alinear: 'der', movil: 'derecha', celda: (g) => usd(g.monto_usd), orden: (g) => Number(g.monto_usd), exportar: { valor: (g) => g.monto_usd, tipo: 'usd', titulo: 'Monto' } },
    { id: 'bs', titulo: 'Bs', alinear: 'der', movil: 'oculta', celda: (g) => (g.monto_bs == null ? '—' : num(g.monto_bs, 2)), exportar: { valor: (g) => g.monto_bs, tipo: 'bs', titulo: 'Monto' } },
    {
      id: 'estado', titulo: 'Estado',
      movilCelda: (g) =>
        g.anulado ? <Etiqueta tono="peligro">Anulado</Etiqueta> : g.estado_aprobacion === 'aprobado' ? null : (
          <Etiqueta tono={ESTADO[g.estado_aprobacion ?? 'aprobado'].tono}>{ESTADO[g.estado_aprobacion ?? 'aprobado'].texto}</Etiqueta>
        ),
      celda: (g) => (g.anulado ? <Etiqueta tono="peligro">Anulado</Etiqueta> : <Etiqueta tono={ESTADO[g.estado_aprobacion ?? 'aprobado'].tono}>{ESTADO[g.estado_aprobacion ?? 'aprobado'].texto}</Etiqueta>),
      orden: (g) => g.estado_aprobacion, exportar: { valor: (g) => (g.anulado ? 'anulado' : g.estado_aprobacion) },
    },
  ];
  return (
    <>
      <Tabla
        titulo={titulo}
        filas={filas}
        columnas={columnas}
        clave={(g) => g.id!}
        cargando={cargando}
        alElegir={setElegido}
        nombreExport={nombreExport}
        ordenInicial={{ id: 'fecha', dir: 'desc' }}
        vacio={<EstadoVacio titulo="Sin gastos en este período" />}
      />
      {elegido && <DetalleGasto g={elegido} alCerrar={() => setElegido(null)} />}
    </>
  );
}

export function BotonesAprobacion({ g, alTerminar }: { g: Gasto; alTerminar?: () => void }) {
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [rechazar, setRechazar] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Boton
        variante="principal"
        icono={<Check aria-hidden className="size-4" />}
        cargando={aprobando}
        onClick={async () => {
          setAprobando(true);
          try {
            await rpc('revisar_gasto', { p_id: g.id!, p_aprobar: true });
            await qc.invalidateQueries();
            avisos.ok(`Gasto ${g.folio_txt} aprobado`);
            alTerminar?.();
          } catch {
            avisos.error('No se pudo aprobar el gasto.');
          } finally {
            setAprobando(false);
          }
        }}
      >
        Aprobar
      </Boton>
      <Boton icono={<X aria-hidden className="size-4" />} onClick={() => setRechazar(true)}>
        Rechazar
      </Boton>
      <ConfirmarConMotivo
        abierta={rechazar}
        alCerrar={() => setRechazar(false)}
        titulo={`Rechazar el gasto ${g.folio_txt}`}
        descripcion="El chofer verá el motivo en su historial."
        etiquetaMotivo="¿Por qué se rechaza?"
        textoAccion="Rechazar"
        peligro
        alConfirmar={async (motivo) => {
          await rpc('revisar_gasto', { p_id: g.id!, p_aprobar: false, p_motivo: motivo });
          await qc.invalidateQueries();
          avisos.ok(`Gasto ${g.folio_txt} rechazado`);
          alTerminar?.();
        }}
      />
    </div>
  );
}

function DetalleGasto({ g, alCerrar }: { g: Gasto; alCerrar: () => void }) {
  const { esOficina, esSuper } = useSesion();
  const { data: unidades = [] } = useUnidadesLista();
  const { data: categorias = [] } = useCategorias();
  return (
    <Hoja abierta alCerrar={alCerrar} titulo={`Gasto ${g.folio_txt}`} descripcion={`${g.unidad_nombre}, ${fecha(g.fecha)}`} ancho="ancho">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato etiqueta="Categoría">{g.categoria_nombre}</Dato>
        <Dato etiqueta="Monto original">{g.moneda === 'VES' ? bs(g.monto) : usd(g.monto)}</Dato>
        <Dato etiqueta="En dólares">{usd(g.monto_usd)}</Dato>
        <Dato etiqueta="Tasa BCV">{g.moneda === 'VES' ? tasa(g.bs_por_usd) : '—'}</Dato>
        <Dato etiqueta="Proveedor">{g.proveedor ?? '—'}</Dato>
        <Dato etiqueta="Km u horas">{num(g.lectura_medidor)}</Dato>
        <Dato etiqueta="Registró">{`${g.registrado_por_nombre ?? '—'}${g.registrado_por_rol === 'chofer' ? ' (chofer)' : ''}`}</Dato>
        <Dato etiqueta="Estado">{g.anulado ? 'Anulado' : ESTADO[g.estado_aprobacion ?? 'aprobado'].texto}</Dato>
      </div>
      {g.descripcion && <p className="mt-3 text-base">{g.descripcion}</p>}
      {g.rechazo_motivo && <p className="mt-3 font-semibold text-peligro">Motivo del rechazo: {g.rechazo_motivo}</p>}
      {g.anulado && <p className="mt-3 font-bold text-peligro">Anulado. Motivo: {g.anulado_motivo}</p>}
      <div className="mt-4"><VerFoto ruta={g.factura_path} etiqueta="Factura" /></div>
      <div className="mt-4 flex flex-wrap gap-4">
        {esOficina && g.estado_aprobacion === 'pendiente' && !g.anulado && <BotonesAprobacion g={g} alTerminar={alCerrar} />}
        <AccionesRegistro
          tabla="mantenimientos"
          registro={g as unknown as Record<string, unknown>}
          campos={camposGasto(unidades, categorias)}
          puedeCorregir={esOficina}
          puedeAnular={esOficina}
          puedeRestaurar={esSuper}
          nombre="el gasto"
        />
      </div>
      {esOficina && (
        <div className="mt-6">
          <h3 className="mb-2 text-base font-extrabold">Historial de cambios</h3>
          <HistorialAuditoria tabla="mantenimientos" registroId={g.id!} />
        </div>
      )}
    </Hoja>
  );
}

// ----- Ciclos lleno a lleno ----------------------------------------------------------------------------
export function TablaCiclos({ filas, cargando, nombres }: { filas: Ciclo[]; cargando?: boolean; nombres?: Map<string, string> }) {
  const columnas: Columna<Ciclo>[] = [
    ...(nombres ? [{ id: 'unidad', titulo: 'Camión', movilCelda: (c: Ciclo) => nombres.get(c.unidad_id ?? '') ?? '—', celda: (c: Ciclo) => nombres.get(c.unidad_id ?? '') ?? '—', orden: (c: Ciclo) => nombres.get(c.unidad_id ?? ''), exportar: { valor: (c: Ciclo) => nombres.get(c.unidad_id ?? '') } }] : []),
    { id: 'fin', titulo: 'Cierra', movil: 'principal', celda: (c) => fecha(c.fecha_fin), orden: (c) => c.fecha_fin, exportar: { valor: (c) => c.fecha_fin, tipo: 'fecha', titulo: 'Fecha de cierre' } },
    { id: 'tramo', titulo: 'Tramo (km)', movilCelda: (c) => `km ${num(c.lectura_inicio)} a ${num(c.lectura_fin)}`, celda: (c) => `${num(c.lectura_inicio)} a ${num(c.lectura_fin)}`, exportar: { valor: (c) => `${c.lectura_inicio}-${c.lectura_fin}`, titulo: 'Tramo' } },
    { id: 'dist', titulo: 'Distancia', alinear: 'der', movil: 'oculta', celda: (c) => num(c.distancia), orden: (c) => Number(c.distancia), exportar: { valor: (c) => c.distancia, tipo: 'km', titulo: 'Distancia' } },
    { id: 'litros', titulo: 'Litros', alinear: 'der', movilCelda: (c) => `${num(c.distancia)} km con ${fLitros(c.litros)}`, celda: (c) => num(c.litros, 2), orden: (c) => Number(c.litros), exportar: { valor: (c) => c.litros, tipo: 'litros' } },
    { id: 'cargas', titulo: 'Cargas', alinear: 'der', movil: 'oculta', celda: (c) => num(c.cargas), exportar: { valor: (c) => c.cargas, tipo: 'entero' } },
    { id: 'rend', titulo: 'km/L', alinear: 'der', movil: 'derecha', movilCelda: (c) => (c.invalido ? 'No válido' : kml(c.rendimiento)), celda: (c) => (c.invalido ? 'No válido' : num(c.rendimiento, 2)), orden: (c) => Number(c.rendimiento ?? -1), exportar: { valor: (c) => (c.invalido ? null : c.rendimiento), tipo: 'kml' } },
  ];
  return (
    <Tabla
      filas={filas}
      columnas={columnas}
      clave={(c) => `${c.unidad_id}-${c.ciclo}`}
      cargando={cargando}
      nombreExport="ciclos-lleno-a-lleno"
      ordenInicial={{ id: 'fin', dir: 'desc' }}
      vacio={<EstadoVacio titulo="Aún no hay ciclos completos">Un ciclo se cierra entre dos cargas con el tanque lleno.</EstadoVacio>}
    />
  );
}
