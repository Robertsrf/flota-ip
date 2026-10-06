import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Campo, Entrada, Seleccion } from '@/components/controles';
import { Etiqueta, MensajeError, Rombo, TableroKpis, type DatoKpi } from '@/components/datos';
import { EncabezadoPagina, Portico, Seccion, type Senal } from '@/components/estructura';
import { Tabla, type Columna } from '@/components/tabla';
import { nombreUnidad, type Alerta, type CostoDestino, type CostoRuta, type Kpis, type ResumenUnidad } from '@/lib/api';
import { traducirError } from '@/lib/errores';
import { duracion, hora, km as fKm, kml, l100, litros as fLitros, mesCorto, num, usd, usdKm, variacion } from '@/lib/formato';
import { useAhora } from '@/lib/ganchos';
import { useTiempoReal } from '@/lib/tiempoReal';
import { GraficoBarrasH, GraficoCostoKm, GraficoGastoMensual, GraficoTendencia, type MesGasto } from './graficos';
import { mesesDelRango, NOMBRES_PERIODO, ultimos12Meses, type ClavePeriodo } from './periodo';
import {
  useAlertas, useCostoDestino, useCostoRuta, useEnRuta, useFiltros, useKpiMensual, useKpis, useMantCategoria, useOpcionesFiltro, useResumenUnidades,
} from './datos';

const TIPO_ALERTA: Record<string, string> = {
  consumo_anomalo: 'Consumo anómalo',
  ruta_abierta: 'Ruta abierta mucho tiempo',
  km_sin_ruta: 'Km sin ruta',
  viaje_incompleto: 'Sin datos de combustible',
  divergencia: 'Divergencia de cálculo',
  revisar: 'Para revisar',
  gasto_pendiente: 'Gasto por aprobar',
};

export function Dashboard() {
  useTiempoReal();
  const { filtros, periodo, cambiar } = useFiltros();
  const actual = useKpis(filtros, periodo.desde, periodo.hasta);
  const anterior = useKpis(filtros, periodo.antesDesde, periodo.antesHasta);
  const resumen = useResumenUnidades(filtros, periodo.desde, periodo.hasta);
  const meses12 = ultimos12Meses();
  const mensual = useKpiMensual(filtros.unidad, meses12[0]);
  const mesesPeriodo = mesesDelRango(periodo.desde, periodo.hasta);
  const categorias = useMantCategoria(filtros.unidad, mesesPeriodo[0], mesesPeriodo[mesesPeriodo.length - 1]);
  const destinos = useCostoDestino(filtros, periodo.desde, periodo.hasta);
  const rutas = useCostoRuta(filtros, periodo.desde, periodo.hasta);
  const enRuta = useEnRuta();
  const alertas = useAlertas(filtros.unidad);
  const opciones = useOpcionesFiltro();
  const ahora = useAhora();
  const navegar = useNavigate();
  const [verRutas, setVerRutas] = useState(false);

  const k = actual.data;
  const a = anterior.data;
  const conFiltroPersona = Boolean(filtros.chofer || filtros.destino);
  // Sin historia suficiente en el período anterior, el ▲/▼ engaña (p. ej. el primer mes de uso)
  const cmp = (a?.viajes ?? 0) >= 3;

  const kpis: DatoKpi[] = [
    { titulo: 'Gasto total', valor: usd(k?.gasto_total), variacion: variacion(k?.gasto_total, a?.gasto_total, cmp), mejorSiSube: false, nota: conFiltroPersona ? 'Sin mantenimiento (filtro por chofer o destino)' : undefined },
    {
      titulo: 'Combustible', valor: usd(k?.gasto_comb), variacion: variacion(k?.gasto_comb, a?.gasto_comb, cmp), mejorSiSube: false,
      secundario: k && Number(k.gasto_comb_plantas) > 0 ? `Plantas: ${usd(k.gasto_comb_plantas)}` : undefined,
    },
    { titulo: 'Mantenimiento', valor: k?.gasto_mant == null ? '—' : usd(k.gasto_mant), variacion: k?.gasto_mant == null ? undefined : variacion(k.gasto_mant, a?.gasto_mant, cmp), mejorSiSube: false },
    { titulo: 'Km recorridos', valor: fKm(k?.km_total), variacion: variacion(k?.km_total, a?.km_total, cmp), mejorSiSube: true, secundario: k ? `${num(k.viajes)} viajes` : undefined },
    { titulo: 'Rendimiento', valor: kml(k?.rendimiento), variacion: variacion(k?.rendimiento, a?.rendimiento, cmp), mejorSiSube: true, secundario: l100(k?.litros_100km) },
    { titulo: 'Costo por km', valor: usdKm(k?.costo_km_total), variacion: variacion(k?.costo_km_total, a?.costo_km_total, cmp), mejorSiSube: false, secundario: `Solo combustible: ${usdKm(k?.costo_km_comb)}` },
  ];

  // Gasto mensual (12 meses)
  const gastoMensual: MesGasto[] = useMemo(
    () =>
      meses12.map((m) => {
        const filas = (mensual.data ?? []).filter((x) => x.mes === m);
        return {
          mes: m,
          etiqueta: mesCorto(m),
          camiones: filas.filter((x) => x.tipo === 'camion').reduce((s, x) => s + Number(x.gasto_comb ?? 0), 0),
          plantas: filas.filter((x) => x.tipo === 'planta').reduce((s, x) => s + Number(x.gasto_comb ?? 0), 0),
          mantenimiento: filas.reduce((s, x) => s + Number(x.gasto_mant ?? 0), 0),
        };
      }),
    [mensual.data, meses12],
  );

  // Tendencia del rendimiento por camión
  const tendencia = useMemo(() => {
    const camiones = new Map<string, string>();
    for (const x of mensual.data ?? []) if (x.tipo === 'camion' && x.unidad_id) camiones.set(x.unidad_id, x.unidad_nombre ?? '');
    return [...camiones.entries()].map(([id, nombre]) => ({
      nombre: nombre.replace(/^.*\((.*)\)$/, '$1') || nombre,
      valores: meses12.map((m) => {
        const f = (mensual.data ?? []).find((x) => x.unidad_id === id && x.mes === m);
        const kmx = Number(filtros.soloExactos ? f?.km_exacto : f?.km);
        const lx = Number(filtros.soloExactos ? f?.litros_exacto : f?.litros);
        return lx > 0 ? Math.round((kmx / lx) * 100) / 100 : null;
      }),
    }));
  }, [mensual.data, meses12, filtros.soloExactos]);

  const camiones = (resumen.data ?? []).filter((r) => r.tipo === 'camion');
  const plantas = (resumen.data ?? []).filter((r) => r.tipo === 'planta');
  const etiquetaUnidad = (r: ResumenUnidad) => r.placa ?? r.alias ?? r.nombre ?? '';

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of categorias.data ?? []) m.set(x.categoria ?? '', (m.get(x.categoria ?? '') ?? 0) + Number(x.monto_usd ?? 0));
    return [...m.entries()].map(([nombre, valor]) => ({ nombre, valor }));
  }, [categorias.data]);

  const senales: Senal[] = (enRuta.data ?? []).map((u) => ({
    id: u.id!,
    arriba: `${u.viaje_abierto_chofer ?? ''} en ${u.placa}`,
    destino: u.viaje_abierto_destino ?? '—',
    abajo: u.viaje_abierto_salida_at ? `desde ${hora(u.viaje_abierto_salida_at)} (${duracion(u.viaje_abierto_salida_at, ahora)})` : '',
    enlace: u.viaje_abierto_id ? `/viajes/${u.viaje_abierto_id}` : undefined,
    alerta: Boolean(u.viaje_abierto_salida_at && ahora.getTime() - new Date(u.viaje_abierto_salida_at).getTime() > 48 * 3_600_000),
  }));

  const errorCarga = actual.error ?? resumen.error;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Dashboard" descripcion={`${periodo.texto}. Variaciones ${periodo.comparacion}.`} />

      <FiltrosDashboard filtros={filtros} cambiar={cambiar} opciones={opciones.data} />

      {errorCarga && <MensajeError error={traducirError(errorCarga)} />}
      <TableroKpis datos={kpis} cargando={actual.isLoading} />
      {k && k.viajes_incompletos > 0 && (
        <p className="-mt-3 text-sm text-tinta-2">
          {k.viajes_incompletos === 1 ? '1 viaje sin datos de combustible no entra' : `${k.viajes_incompletos} viajes sin datos de combustible no entran`} en el rendimiento ni en el costo por km.
        </p>
      )}

      <Seccion titulo={`Ahora mismo: ${senales.length === 1 ? '1 camión en ruta' : `${senales.length} camiones en ruta`}`} id="ahora-mismo">
        <Portico senales={senales} vacio={<p className="text-base text-tinta-2">Ningún camión está en ruta en este momento.</p>} />
      </Seccion>

      <ListaAlertas alertas={alertas.data ?? []} />

      <div className="grid gap-4 xl:grid-cols-2">
        <GraficoGastoMensual meses={gastoMensual} />
        <GraficoBarrasH
          titulo="Rendimiento por camión"
          descripcion="km/L del período, ponderado. La raya es el promedio de la flota."
          filas={camiones.filter((c) => c.rendimiento != null).map((c) => ({ nombre: etiquetaUnidad(c), valor: Number(c.rendimiento) }))}
          formato={(v) => `${num(v, 2)} km/L`}
          promedio={k?.rendimiento ?? null}
          etiquetaPromedio="Flota"
          columnaValor="km/L"
        />
        <GraficoTendencia meses={meses12.map((m) => ({ mes: m, etiqueta: mesCorto(m) }))} series={tendencia} />
        <GraficoBarrasH
          titulo="Mantenimiento por categoría"
          descripcion="Gastos aprobados del período, en USD."
          filas={porCategoria}
          formato={(v) => `$ ${num(v, 2)}`}
          color="mantenimiento"
          columnaValor="USD"
        />
        <GraficoCostoKm
          filas={camiones
            .filter((c) => Number(c.km_total) > 0)
            .map((c) => ({
              nombre: etiquetaUnidad(c),
              combustible: Number(c.gasto_comb) / Number(c.km_total),
              mantenimiento: Number(c.gasto_mant ?? 0) / Number(c.km_total),
            }))}
        />
        <section className="flex flex-col gap-3 rounded-xl border-2 border-linea bg-superficie p-4" aria-label="Costo por destino">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold">{verRutas ? 'Costo por ruta' : 'Costo por destino'}</h2>
              <p className="text-sm text-tinta-2">{verRutas ? 'Por secuencia de paradas.' : 'Por destino principal (última parada).'}</p>
            </div>
            <div role="group" aria-label="Agrupar por" className="flex rounded-lg border-2 border-linea-fuerte">
              {[
                ['destino', 'Destino'],
                ['ruta', 'Ruta'],
              ].map(([v, t]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={(v === 'ruta') === verRutas}
                  onClick={() => setVerRutas(v === 'ruta')}
                  className={`min-h-10 px-3 text-sm font-bold ${(v === 'ruta') === verRutas ? 'bg-tinta text-superficie' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {verRutas ? <TablaRutas filas={rutas.data ?? []} cargando={rutas.isLoading} /> : <TablaDestinos filas={destinos.data ?? []} cargando={destinos.isLoading} />}
        </section>
      </div>

      <TablaCamiones filas={camiones} cargando={resumen.isLoading} alElegir={(r) => navegar(`/unidades/${r.unidad_id}`)} kpis={k} />
      {plantas.length > 0 && <TablaPlantas filas={plantas} alElegir={(r) => navegar(`/unidades/${r.unidad_id}`)} />}
    </div>
  );
}

// ----- Filtros -------------------------------------------------------------------------------
interface OpcionesFiltro {
  unidades: { id: string; placa: string | null; alias: string | null; tipo: string }[];
  choferes: { id: string; nombre: string }[];
  destinos: { id: string; nombre: string; activo: boolean }[];
}

function FiltrosDashboard({ filtros, cambiar, opciones }: {
  filtros: ReturnType<typeof useFiltros>['filtros'];
  cambiar: ReturnType<typeof useFiltros>['cambiar'];
  opciones?: OpcionesFiltro;
}) {
  return (
    <form aria-label="Filtros del dashboard" className="grid grid-cols-2 gap-3 rounded-xl border-2 border-linea bg-superficie p-3 md:grid-cols-3 xl:grid-cols-6" onSubmit={(e) => e.preventDefault()}>
      <Campo etiqueta="Período">
        {(p) => (
          <Seleccion {...p} value={filtros.periodo} onChange={(e) => cambiar({ periodo: e.target.value as ClavePeriodo })}>
            {(Object.keys(NOMBRES_PERIODO) as ClavePeriodo[]).map((c) => (
              <option key={c} value={c}>
                {NOMBRES_PERIODO[c]}
              </option>
            ))}
          </Seleccion>
        )}
      </Campo>
      {filtros.periodo === 'rango' && (
        <>
          <Campo etiqueta="Desde">
            {(p) => <Entrada {...p} type="date" value={filtros.desde ?? ''} onChange={(e) => cambiar({ desde: e.target.value })} />}
          </Campo>
          <Campo etiqueta="Hasta">
            {(p) => <Entrada {...p} type="date" value={filtros.hasta ?? ''} onChange={(e) => cambiar({ hasta: e.target.value })} />}
          </Campo>
        </>
      )}
      <Campo etiqueta="Unidad">
        {(p) => (
          <Seleccion {...p} value={filtros.unidad ?? ''} onChange={(e) => cambiar({ unidad: e.target.value })}>
            <option value="">Todas</option>
            {opciones?.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.placa ? `${u.placa}${u.alias ? `, ${u.alias}` : ''}` : u.alias}
              </option>
            ))}
          </Seleccion>
        )}
      </Campo>
      <Campo etiqueta="Chofer">
        {(p) => (
          <Seleccion {...p} value={filtros.chofer ?? ''} onChange={(e) => cambiar({ chofer: e.target.value })}>
            <option value="">Todos</option>
            {opciones?.choferes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Seleccion>
        )}
      </Campo>
      <Campo etiqueta="Destino">
        {(p) => (
          <Seleccion {...p} value={filtros.destino ?? ''} onChange={(e) => cambiar({ destino: e.target.value })}>
            <option value="">Todos</option>
            {opciones?.destinos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
                {d.activo ? '' : ' (archivado)'}
              </option>
            ))}
          </Seleccion>
        )}
      </Campo>
      <Campo etiqueta="Calidad del dato">
        {(p) => (
          <Seleccion {...p} value={filtros.soloExactos ? 'exactos' : ''} onChange={(e) => cambiar({ calidad: e.target.value })}>
            <option value="">Exactos y estimados</option>
            <option value="exactos">Solo exactos</option>
          </Seleccion>
        )}
      </Campo>
    </form>
  );
}

// ----- Alertas ----------------------------------------------------------------------------------
function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  const visibles = alertas.filter((x) => x.tipo !== 'gasto_pendiente').slice(0, 6);
  const pendientes = alertas.filter((x) => x.tipo === 'gasto_pendiente').length;
  return (
    <Seccion
      titulo={`Alertas (${alertas.length})`}
      id="alertas"
      acciones={
        <Link to="/revision" className="inline-flex min-h-10 items-center font-bold text-via-acento underline underline-offset-4">
          Ir a la revisión
        </Link>
      }
    >
      {alertas.length === 0 ? (
        <p className="rounded-xl border-2 border-linea bg-superficie p-4 text-base text-tinta-2">Todo en orden: no hay desviaciones ni pendientes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((x) => (
            <li key={x.id}>
              <Link
                to={x.viaje_id ? `/viajes/${x.viaje_id}` : x.unidad_id ? `/unidades/${x.unidad_id}` : '/revision'}
                className="flex items-start gap-3 rounded-xl border-2 border-linea bg-superficie p-3 hover:border-tinta"
              >
                <Rombo />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-tinta-2">{TIPO_ALERTA[x.tipo ?? ''] ?? x.tipo}</span>
                  <span className="block text-base">{x.mensaje}</span>
                </span>
              </Link>
            </li>
          ))}
          {pendientes > 0 && (
            <li>
              <Link to="/revision" className="flex items-center gap-3 rounded-xl border-2 border-linea bg-superficie p-3 hover:border-tinta">
                <Rombo />
                <span className="text-base font-semibold">
                  {pendientes === 1 ? '1 gasto de chofer espera aprobación' : `${pendientes} gastos de choferes esperan aprobación`}
                </span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </Seccion>
  );
}

// ----- Tablas -----------------------------------------------------------------------------------
function TablaDestinos({ filas, cargando }: { filas: CostoDestino[]; cargando: boolean }) {
  const columnas: Columna<CostoDestino>[] = [
    { id: 'destino', titulo: 'Destino', celda: (f) => f.destino, orden: (f) => f.destino, movil: 'principal', exportar: { valor: (f) => f.destino } },
    { id: 'viajes', titulo: 'Viajes', celda: (f) => num(f.viajes), orden: (f) => Number(f.viajes), alinear: 'der', exportar: { valor: (f) => f.viajes, tipo: 'entero' } },
    { id: 'km', titulo: 'Km prom.', celda: (f) => num(f.km_prom), orden: (f) => Number(f.km_prom), alinear: 'der', exportar: { valor: (f) => f.km_prom, tipo: 'km', titulo: 'Km promedio' } },
    { id: 'costo', titulo: 'Costo prom.', celda: (f) => usd(f.costo_prom), orden: (f) => Number(f.costo_prom), alinear: 'der', exportar: { valor: (f) => f.costo_prom, tipo: 'usd', titulo: 'Costo promedio' } },
    { id: 'rend', titulo: 'km/L', celda: (f) => num(f.rendimiento, 2), orden: (f) => Number(f.rendimiento), alinear: 'der', exportar: { valor: (f) => f.rendimiento, tipo: 'kml' } },
  ];
  return (
    <Tabla filas={filas} columnas={columnas} clave={(f) => f.destino_id ?? f.destino ?? ''} cargando={cargando} nombreExport="costo-por-destino"
      ordenInicial={{ id: 'costo', dir: 'desc' }} vacio={<p className="text-tinta-2">Sin rutas cerradas en el período.</p>} />
  );
}

function TablaRutas({ filas, cargando }: { filas: CostoRuta[]; cargando: boolean }) {
  const columnas: Columna<CostoRuta>[] = [
    { id: 'ruta', titulo: 'Ruta', envolver: true, celda: (f) => f.ruta, orden: (f) => f.ruta, movil: 'principal', exportar: { valor: (f) => f.ruta } },
    { id: 'viajes', titulo: 'Viajes', celda: (f) => num(f.viajes), orden: (f) => Number(f.viajes), alinear: 'der', exportar: { valor: (f) => f.viajes, tipo: 'entero' } },
    { id: 'km', titulo: 'Km prom.', celda: (f) => num(f.km_prom), orden: (f) => Number(f.km_prom), alinear: 'der', exportar: { valor: (f) => f.km_prom, tipo: 'km', titulo: 'Km promedio' } },
    { id: 'costo', titulo: 'Costo prom.', celda: (f) => usd(f.costo_prom), orden: (f) => Number(f.costo_prom), alinear: 'der', exportar: { valor: (f) => f.costo_prom, tipo: 'usd', titulo: 'Costo promedio' } },
    { id: 'rend', titulo: 'km/L', celda: (f) => num(f.rendimiento, 2), orden: (f) => Number(f.rendimiento), alinear: 'der', exportar: { valor: (f) => f.rendimiento, tipo: 'kml' } },
    { id: 'total', titulo: 'Total', celda: (f) => usd(f.costo_total), orden: (f) => Number(f.costo_total), alinear: 'der', exportar: { valor: (f) => f.costo_total, tipo: 'usd', titulo: 'Costo total' } },
  ];
  return (
    <Tabla filas={filas} columnas={columnas} clave={(f) => f.ruta ?? ''} cargando={cargando} nombreExport="costo-por-ruta"
      ordenInicial={{ id: 'total', dir: 'desc' }} vacio={<p className="text-tinta-2">Sin rutas cerradas en el período.</p>} />
  );
}

function TablaCamiones({ filas, cargando, alElegir, kpis }: { filas: ResumenUnidad[]; cargando: boolean; alElegir: (r: ResumenUnidad) => void; kpis?: Kpis }) {
  const prom = kpis?.rendimiento ?? null;
  const columnas: Columna<ResumenUnidad>[] = [
    {
      id: 'unidad', titulo: 'Camión', movil: 'principal',
      celda: (f) => (
        <span>
          <span className="font-bold">{f.placa}</span> <span className="text-tinta-2">{f.alias}</span>
        </span>
      ),
      orden: (f) => f.placa, exportar: { valor: (f) => nombreUnidad(f), titulo: 'Camión' },
    },
    {
      id: 'estado', titulo: 'Estado', movil: 'oculta',
      celda: (f) => (f.estado === 'en_ruta' ? <Etiqueta tono="via">En ruta</Etiqueta> : f.estado === 'disponible' ? 'Disponible' : f.estado === 'taller' ? <Etiqueta tono="alerta">Taller</Etiqueta> : 'Inactivo'),
      orden: (f) => f.estado, exportar: { valor: (f) => f.estado },
    },
    { id: 'viajes', titulo: 'Viajes', celda: (f) => num(f.viajes), orden: (f) => Number(f.viajes), alinear: 'der', exportar: { valor: (f) => f.viajes, tipo: 'entero' } },
    { id: 'km', titulo: 'Km período', celda: (f) => num(f.km_total), orden: (f) => Number(f.km_total), alinear: 'der', exportar: { valor: (f) => f.km_total, tipo: 'km', titulo: 'Km del período' } },
    {
      id: 'rend', titulo: 'km/L', alinear: 'der',
      celda: (f) => {
        const r = f.rendimiento == null ? null : Number(f.rendimiento);
        const bajo = r != null && prom != null && r < Number(prom) * 0.85;
        return <span className={bajo ? 'font-extrabold text-peligro' : ''}>{r == null ? '—' : num(r, 2)}{bajo && <span className="sr-only"> (15 % o más bajo que la flota)</span>}</span>;
      },
      orden: (f) => Number(f.rendimiento ?? -1), exportar: { valor: (f) => f.rendimiento, tipo: 'kml' },
    },
    { id: 'litros', titulo: 'Litros', celda: (f) => num(f.litros, 0), orden: (f) => Number(f.litros), alinear: 'der', movil: 'oculta', exportar: { valor: (f) => f.litros, tipo: 'litros', titulo: 'Litros consumidos' } },
    { id: 'comb', titulo: 'Combustible', celda: (f) => usd(f.gasto_comb), orden: (f) => Number(f.gasto_comb), alinear: 'der', exportar: { valor: (f) => f.gasto_comb, tipo: 'usd', titulo: 'Gasto combustible' } },
    { id: 'mant', titulo: 'Mantenimiento', celda: (f) => (f.gasto_mant == null ? '—' : usd(f.gasto_mant)), orden: (f) => Number(f.gasto_mant ?? 0), alinear: 'der', exportar: { valor: (f) => f.gasto_mant, tipo: 'usd', titulo: 'Gasto mantenimiento' } },
    { id: 'ckm', titulo: '$/km', celda: (f) => num(f.costo_km_total, 4), orden: (f) => Number(f.costo_km_total ?? 0), alinear: 'der', exportar: { valor: (f) => f.costo_km_total, tipo: 'usdKm', titulo: 'Costo por km' } },
  ];
  return (
    <Tabla titulo="Camiones" filas={filas} columnas={columnas} clave={(f) => f.unidad_id ?? ''} cargando={cargando} alElegir={alElegir} nombreExport="camiones-periodo"
      ordenInicial={{ id: 'km', dir: 'desc' }} vacio={<p className="text-tinta-2">No hay camiones registrados.</p>} />
  );
}

function TablaPlantas({ filas, alElegir }: { filas: ResumenUnidad[]; alElegir: (r: ResumenUnidad) => void }) {
  const columnas: Columna<ResumenUnidad>[] = [
    { id: 'planta', titulo: 'Planta eléctrica', celda: (f) => <span className="font-bold">{f.alias ?? f.nombre}</span>, orden: (f) => f.alias, movil: 'principal', exportar: { valor: (f) => f.alias ?? f.nombre, titulo: 'Planta' } },
    { id: 'cargas', titulo: 'Cargas', celda: (f) => num(f.cargas), orden: (f) => Number(f.cargas), alinear: 'der', exportar: { valor: (f) => f.cargas, tipo: 'entero' } },
    { id: 'litros', titulo: 'Litros cargados', celda: (f) => fLitros(f.litros_cargados), orden: (f) => Number(f.litros_cargados), alinear: 'der', exportar: { valor: (f) => f.litros_cargados, tipo: 'litros' } },
    { id: 'comb', titulo: 'Combustible', celda: (f) => usd(f.gasto_comb), orden: (f) => Number(f.gasto_comb), alinear: 'der', exportar: { valor: (f) => f.gasto_comb, tipo: 'usd', titulo: 'Gasto combustible' } },
    { id: 'mant', titulo: 'Mantenimiento', celda: (f) => (f.gasto_mant == null ? '—' : usd(f.gasto_mant)), orden: (f) => Number(f.gasto_mant ?? 0), alinear: 'der', exportar: { valor: (f) => f.gasto_mant, tipo: 'usd', titulo: 'Gasto mantenimiento' } },
    { id: 'total', titulo: 'Total', celda: (f) => usd(f.gasto_total), orden: (f) => Number(f.gasto_total), alinear: 'der', exportar: { valor: (f) => f.gasto_total, tipo: 'usd', titulo: 'Gasto total' } },
  ];
  return (
    <Tabla titulo="Plantas eléctricas" filas={filas} columnas={columnas} clave={(f) => f.unidad_id ?? ''} alElegir={alElegir} nombreExport="plantas-periodo"
      acciones={<span className="self-center text-sm text-tinta-2">Sin horómetro: se controlan litros y costo.</span>} />
  );
}
