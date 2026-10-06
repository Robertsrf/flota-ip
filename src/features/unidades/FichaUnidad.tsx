import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Fuel, Gauge, Receipt, Truck, Zap } from 'lucide-react';
import { Boton, BotonEnlace, Campo, Seleccion } from '@/components/controles';
import { Calidad, Cargando, Dato, EstadoVacio, MensajeError, TableroKpis, type DatoKpi } from '@/components/datos';
import { EncabezadoPagina, Panel, Pestanas, Seccion } from '@/components/estructura';
import { Tabla, type Columna } from '@/components/tabla';
import { rpc, type Ciclo, type Gasto, type Kpis, type Repostaje, type Unidad, type Viaje } from '@/lib/api';
import { exigir, traducirError } from '@/lib/errores';
import { urlFirmada } from '@/lib/fotos';
import { fecha, fechaHora, km as fKm, kml, l100, litros as fLitros, mesCorto, num, usd, usdKm, variacion } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';
import { useTiempoReal } from '@/lib/tiempoReal';
import { GraficoBarrasH, GraficoGastoMensual, GraficoViajesEnElTiempo } from '@/features/dashboard/graficos';
import { calcularPeriodo, mesesDelRango, NOMBRES_PERIODO, ultimos12Meses, type ClavePeriodo } from '@/features/dashboard/periodo';
import { FormGastoOficina, FormRepostajeOficina } from '@/features/registros/FormulariosOficina';
import { TablaCiclos, TablaGastos, TablaRepostajes } from '@/features/registros/Tablas';
import { EstadoViaje } from '@/features/viajes/ListaViajes';
import { FormUnidad } from './FormUnidad';
import { EtiquetaEstado } from './ListaUnidades';

function useFoto(ruta: string | null | undefined) {
  return useQuery({ queryKey: ['foto', ruta], enabled: Boolean(ruta), staleTime: 40 * 60_000, queryFn: () => urlFirmada('unidades', ruta) });
}

export function FichaUnidad() {
  useTiempoReal();
  const { id } = useParams();
  const { esOficina } = useSesion();
  const [clave, setClave] = useState<ClavePeriodo>('90d');
  const [repostar, setRepostar] = useState(false);
  const [gastar, setGastar] = useState(false);
  const periodo = calcularPeriodo(clave);
  const unidad = useQuery({
    queryKey: ['unidades', id, 'ficha'],
    queryFn: async () => exigir(await supabase.from('v_unidades').select('*').eq('id', id!).single()) as Unidad,
  });
  const { data: foto } = useFoto(unidad.data?.foto_path);

  if (unidad.isLoading) return <Cargando />;
  if (unidad.error || !unidad.data) return <MensajeError error={traducirError(unidad.error)} />;
  const u = unidad.data;
  const esCamion = u.tipo === 'camion';

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        volver={{ a: '/unidades', texto: 'Camiones y plantas' }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {esCamion ? u.placa : u.alias} <EtiquetaEstado estado={u.estado} />
          </span>
        }
        descripcion={[esCamion ? u.alias : 'Planta eléctrica', [u.marca, u.modelo, u.anio].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
        acciones={
          esOficina && (
            <>
              <Boton icono={<Fuel aria-hidden className="size-4" />} onClick={() => setRepostar(true)}>Registrar repostaje</Boton>
              <Boton icono={<Receipt aria-hidden className="size-4" />} onClick={() => setGastar(true)}>Registrar gasto</Boton>
            </>
          )
        }
      />

      <Panel className="flex flex-col gap-5 md:flex-row">
        <div className="grid size-36 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-linea bg-superficie-2">
          {foto ? (
            <img src={foto} alt={`Foto de ${u.placa ?? u.alias}`} className="size-full object-cover" />
          ) : esCamion ? (
            <Truck aria-hidden className="size-14 text-tinta-2" />
          ) : (
            <Zap aria-hidden className="size-14 text-tinta-2" />
          )}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
          {u.medidor !== 'ninguno' && <Dato etiqueta={u.medidor === 'km' ? 'Km actual' : 'Horas actuales'} grande>{num(u.lectura_actual)}</Dato>}
          <Dato etiqueta="Tanque" grande>{fLitros(u.capacidad_tanque_l, 0)}</Dato>
          <Dato etiqueta="Nivel estimado" grande>
            {u.nivel_estimado_l == null ? '—' : `${u.nivel_estimado_fuente === 'exacto' ? '' : '≈ '}${fLitros(u.nivel_estimado_l, 0)}`}
          </Dato>
          <Dato etiqueta="Combustible">{u.combustible === 'diesel' ? 'Diésel' : 'Gasolina'}</Dato>
          {esCamion && <Dato etiqueta="Chofer habitual">{u.chofer_habitual_nombre ?? 'Sin chofer fijo'}</Dato>}
          {u.viaje_abierto_id && (
            <Dato etiqueta="En ruta">
              <BotonEnlace to={`/viajes/${u.viaje_abierto_id}`} tamano="sm" variante="principal">
                {u.viaje_abierto_destino}, con {u.viaje_abierto_chofer}
              </BotonEnlace>
            </Dato>
          )}
          <Dato etiqueta="Alta">{fecha(u.fecha_alta)}</Dato>
        </div>
      </Panel>
      {u.nivel_estimado_l != null && u.nivel_estimado_fuente !== 'exacto' && (
        <p className="-mt-4 text-sm text-tinta-2">
          Nivel estimado: último nivel conocido ({fechaHora(u.nivel_base_fecha)}) menos los km recorridos desde entonces por su consumo promedio.
        </p>
      )}

      <Pestanas
        pestanas={[
          { id: 'resumen', titulo: 'Resumen', contenido: () => <Resumen u={u} clave={clave} setClave={setClave} desde={periodo.desde} hasta={periodo.hasta} antesDesde={periodo.antesDesde} antesHasta={periodo.antesHasta} /> },
          ...(esCamion ? [{ id: 'viajes', titulo: 'Viajes', contenido: () => <ViajesUnidad id={u.id!} /> }] : []),
          { id: 'combustible', titulo: 'Combustible', contenido: () => <CombustibleUnidad u={u} /> },
          { id: 'mantenimiento', titulo: 'Mantenimiento', contenido: () => <MantenimientoUnidad id={u.id!} /> },
          {
            id: 'datos',
            titulo: 'Datos',
            contenido: () =>
              esOficina ? <FormUnidad unidad={u} alGuardar={() => void unidad.refetch()} /> : <DatosLectura u={u} />,
          },
        ]}
      />
      {repostar && <FormRepostajeOficina abierta={repostar} alCerrar={() => setRepostar(false)} unidadFija={u.id!} />}
      {gastar && <FormGastoOficina abierta={gastar} alCerrar={() => setGastar(false)} unidadFija={u.id!} />}
    </div>
  );
}

function Resumen({ u, clave, setClave, desde, hasta, antesDesde, antesHasta }: {
  u: Unidad; clave: ClavePeriodo; setClave: (c: ClavePeriodo) => void; desde: string; hasta: string; antesDesde: string; antesHasta: string;
}) {
  const esCamion = u.tipo === 'camion';
  const kpis = useQuery({ queryKey: ['dashboard', 'kpis-unidad', u.id, desde, hasta], queryFn: async () => (await rpc('kpis_periodo', { p_desde: desde, p_hasta: hasta, p_unidad: u.id! })) as unknown as Kpis });
  const antes = useQuery({ queryKey: ['dashboard', 'kpis-unidad', u.id, antesDesde, antesHasta], queryFn: async () => (await rpc('kpis_periodo', { p_desde: antesDesde, p_hasta: antesHasta, p_unidad: u.id! })) as unknown as Kpis });
  const flota = useQuery({ queryKey: ['dashboard', 'kpis', 'flota', desde, hasta], enabled: esCamion, queryFn: async () => (await rpc('kpis_periodo', { p_desde: desde, p_hasta: hasta })) as unknown as Kpis });
  const meses12 = ultimos12Meses();
  const mensual = useQuery({
    queryKey: ['dashboard', 'mensual', u.id, meses12[0]],
    queryFn: async () => exigir(await supabase.from('v_kpi_unidad_mes').select('*').eq('unidad_id', u.id!).gte('mes', meses12[0]).order('mes')),
  });
  const meses = mesesDelRango(desde, hasta);
  const categorias = useQuery({
    queryKey: ['dashboard', 'categorias', u.id, meses[0], hasta],
    queryFn: async () => exigir(await supabase.from('v_mant_categoria_mes').select('*').eq('unidad_id', u.id!).gte('mes', meses[0]).lte('mes', hasta)),
  });
  const viajes = useQuery({
    enabled: esCamion,
    queryKey: ['viajes', 'unidad', u.id, desde, hasta],
    queryFn: async () =>
      exigir(await supabase.from('v_viajes').select('id, llegada_at, rendimiento_kml, ruta, calidad').eq('unidad_id', u.id!).eq('estado', 'cerrado')
        .gte('fecha_llegada', desde).lte('fecha_llegada', hasta).order('llegada_at')),
  });

  const k = kpis.data;
  const a = antes.data;
  const datos: DatoKpi[] = esCamion
    ? [
        { titulo: 'Rendimiento', valor: kml(k?.rendimiento), variacion: variacion(k?.rendimiento, a?.rendimiento), mejorSiSube: true, secundario: flota.data?.rendimiento ? `Flota: ${kml(flota.data.rendimiento)}` : undefined },
        { titulo: 'Km recorridos', valor: fKm(k?.km_total), variacion: variacion(k?.km_total, a?.km_total), mejorSiSube: true, secundario: k ? `${num(k.viajes)} viajes` : undefined },
        { titulo: 'Combustible', valor: usd(k?.gasto_comb), variacion: variacion(k?.gasto_comb, a?.gasto_comb), mejorSiSube: false, secundario: l100(k?.litros_100km) },
        { titulo: 'Mantenimiento', valor: usd(k?.gasto_mant), variacion: variacion(k?.gasto_mant, a?.gasto_mant), mejorSiSube: false },
        { titulo: 'Gasto total', valor: usd(k?.gasto_total), variacion: variacion(k?.gasto_total, a?.gasto_total), mejorSiSube: false },
        { titulo: 'Costo por km', valor: usdKm(k?.costo_km_total), variacion: variacion(k?.costo_km_total, a?.costo_km_total), mejorSiSube: false, secundario: flota.data?.costo_km_total ? `Flota: ${usdKm(flota.data.costo_km_total)}` : undefined },
      ]
    : [
        { titulo: 'Litros cargados', valor: fLitros(k?.litros_plantas, 0), variacion: variacion(k?.litros_plantas, a?.litros_plantas), mejorSiSube: false },
        { titulo: 'Combustible', valor: usd(k?.gasto_comb), variacion: variacion(k?.gasto_comb, a?.gasto_comb), mejorSiSube: false },
        { titulo: 'Mantenimiento', valor: usd(k?.gasto_mant), variacion: variacion(k?.gasto_mant, a?.gasto_mant), mejorSiSube: false },
        { titulo: 'Gasto total', valor: usd(k?.gasto_total), variacion: variacion(k?.gasto_total, a?.gasto_total), mejorSiSube: false },
      ];

  const gastoMensual = meses12.map((m) => {
    const f = (mensual.data ?? []).find((x) => x.mes === m);
    return {
      mes: m,
      etiqueta: mesCorto(m),
      camiones: esCamion ? Number(f?.gasto_comb ?? 0) : 0,
      plantas: esCamion ? 0 : Number(f?.gasto_comb ?? 0),
      mantenimiento: Number(f?.gasto_mant ?? 0),
    };
  });
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of categorias.data ?? []) m.set(x.categoria ?? '', (m.get(x.categoria ?? '') ?? 0) + Number(x.monto_usd ?? 0));
    return [...m.entries()].map(([nombre, valor]) => ({ nombre, valor }));
  }, [categorias.data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <Campo etiqueta="Período">
          {(p) => (
            <Seleccion {...p} value={clave} onChange={(e) => setClave(e.target.value as ClavePeriodo)}>
              {(['mes', 'anterior', '90d', 'anio'] as ClavePeriodo[]).map((c) => <option key={c} value={c}>{NOMBRES_PERIODO[c]}</option>)}
            </Seleccion>
          )}
        </Campo>
      </div>
      {kpis.error && <MensajeError error={traducirError(kpis.error)} />}
      <TableroKpis datos={datos} cargando={kpis.isLoading} />
      <div className="grid gap-4 xl:grid-cols-2">
        {esCamion && (
          <GraficoViajesEnElTiempo
            promedio={k?.rendimiento ?? null}
            puntos={(viajes.data ?? []).filter((v) => v.rendimiento_kml != null).map((v) => ({ fecha: v.llegada_at!, etiqueta: fecha(v.llegada_at), valor: Number(v.rendimiento_kml), ruta: v.ruta ?? '' }))}
          />
        )}
        <GraficoGastoMensual meses={gastoMensual} />
        <GraficoBarrasH titulo="Mantenimiento por categoría" descripcion="Gastos aprobados del período, en USD." filas={porCategoria} formato={(v) => `$ ${num(v, 2)}`} color="mantenimiento" columnaValor="USD" />
      </div>
    </div>
  );
}

function ViajesUnidad({ id }: { id: string }) {
  const navegar = useNavigate();
  const consulta = useQuery({
    queryKey: ['viajes', 'unidad', id, 'todos'],
    queryFn: async () => exigir(await supabase.from('v_viajes').select('*').eq('unidad_id', id).order('salida_at', { ascending: false }).limit(300)) as Viaje[],
  });
  const columnas: Columna<Viaje>[] = [
    { id: 'folio', titulo: 'Folio', celda: (v) => <span className="font-bold">{v.folio_txt}</span>, orden: (v) => v.folio, exportar: { valor: (v) => v.folio_txt } },
    { id: 'salida', titulo: 'Salida', celda: (v) => fechaHora(v.salida_at), orden: (v) => v.salida_at, exportar: { valor: (v) => v.salida_at, tipo: 'fechaHora' } },
    { id: 'llegada', titulo: 'Llegada', movil: 'oculta', celda: (v) => fechaHora(v.llegada_at), orden: (v) => v.llegada_at, exportar: { valor: (v) => v.llegada_at, tipo: 'fechaHora' } },
    { id: 'ruta', titulo: 'Ruta', movil: 'principal', celda: (v) => v.ruta, exportar: { valor: (v) => v.ruta } },
    { id: 'chofer', titulo: 'Chofer', movil: 'oculta', celda: (v) => v.chofer_nombre, exportar: { valor: (v) => v.chofer_nombre } },
    { id: 'km', titulo: 'Km', alinear: 'der', celda: (v) => num(v.km_recorridos), orden: (v) => Number(v.km_recorridos ?? -1), exportar: { valor: (v) => v.km_recorridos, tipo: 'km' } },
    { id: 'litros', titulo: 'Litros', alinear: 'der', celda: (v) => num(v.litros_consumidos, 2), orden: (v) => Number(v.litros_consumidos ?? -1), exportar: { valor: (v) => v.litros_consumidos, tipo: 'litros' } },
    { id: 'rend', titulo: 'km/L', alinear: 'der', celda: (v) => num(v.rendimiento_kml, 2), orden: (v) => Number(v.rendimiento_kml ?? -1), exportar: { valor: (v) => v.rendimiento_kml, tipo: 'kml' } },
    { id: 'costo', titulo: 'Costo', alinear: 'der', celda: (v) => usd(v.costo_combustible_usd), orden: (v) => Number(v.costo_combustible_usd ?? -1), exportar: { valor: (v) => v.costo_combustible_usd, tipo: 'usd' } },
    { id: 'ckm', titulo: '$/km', alinear: 'der', movil: 'oculta', celda: (v) => num(v.costo_km_usd, 4), orden: (v) => Number(v.costo_km_usd ?? -1), exportar: { valor: (v) => v.costo_km_usd, tipo: 'usdKm' } },
    { id: 'calidad', titulo: 'Calidad', celda: (v) => (v.estado === 'cerrado' ? <Calidad valor={v.calidad} compacta /> : <EstadoViaje v={v} />), exportar: { valor: (v) => v.calidad } },
  ];
  return (
    <Tabla filas={consulta.data ?? []} columnas={columnas} clave={(v) => v.id!} cargando={consulta.isLoading} alElegir={(v) => navegar(`/viajes/${v.id}`)}
      nombreExport="viajes-camion" ordenInicial={{ id: 'salida', dir: 'desc' }} vacio={<EstadoVacio titulo="Aún no hay rutas con este camión" />} />
  );
}

function CombustibleUnidad({ u }: { u: Unidad }) {
  const cargas = useQuery({
    queryKey: ['repostajes', 'unidad', u.id],
    queryFn: async () => exigir(await supabase.from('v_repostajes').select('*').eq('unidad_id', u.id!).order('fecha', { ascending: false }).limit(300)) as Repostaje[],
  });
  const ciclos = useQuery({
    enabled: u.medidor !== 'ninguno',
    queryKey: ['ciclos', u.id],
    queryFn: async () => exigir(await supabase.from('v_ciclos_combustible').select('*').eq('unidad_id', u.id!).order('fecha_fin', { ascending: false })) as Ciclo[],
  });
  return (
    <div className="flex flex-col gap-6">
      <TablaRepostajes titulo="Repostajes" filas={cargas.data ?? []} cargando={cargas.isLoading} mostrarUnidad={false} nombreExport="repostajes-unidad" />
      {u.medidor !== 'ninguno' && (
        <Seccion titulo="Ciclos lleno a lleno">
          <p className="-mt-2 text-sm text-tinta-2">Validación cruzada: rendimiento entre dos cargas llenas, aunque haya km fuera de rutas registradas.</p>
          <TablaCiclos filas={ciclos.data ?? []} cargando={ciclos.isLoading} />
        </Seccion>
      )}
    </div>
  );
}

function MantenimientoUnidad({ id }: { id: string }) {
  const gastos = useQuery({
    queryKey: ['gastos', 'unidad', id],
    queryFn: async () => exigir(await supabase.from('v_mantenimientos').select('*').eq('unidad_id', id).order('fecha', { ascending: false }).limit(300)) as Gasto[],
  });
  const totales = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of gastos.data ?? []) if (!g.anulado && g.estado_aprobacion === 'aprobado') m.set(g.categoria_nombre ?? '', (m.get(g.categoria_nombre ?? '') ?? 0) + Number(g.monto_usd ?? 0));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [gastos.data]);
  return (
    <div className="flex flex-col gap-6">
      {totales.length > 0 && (
        <Seccion titulo="Total por categoría (aprobados)">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border-2 border-linea bg-linea md:grid-cols-4">
            {totales.map(([nombre, total]) => (
              <div key={nombre} className="bg-superficie p-3">
                <dt className="text-sm text-tinta-2">{nombre}</dt>
                <dd className="cifra text-lg font-extrabold">{usd(total)}</dd>
              </div>
            ))}
          </dl>
        </Seccion>
      )}
      <TablaGastos titulo="Gastos" filas={gastos.data ?? []} cargando={gastos.isLoading} mostrarUnidad={false} nombreExport="mantenimiento-unidad" />
    </div>
  );
}

function DatosLectura({ u }: { u: Unidad }) {
  return (
    <Panel className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Dato etiqueta="Placa">{u.placa ?? '—'}</Dato>
      <Dato etiqueta="Alias">{u.alias ?? '—'}</Dato>
      <Dato etiqueta="Marca y modelo">{[u.marca, u.modelo].filter(Boolean).join(' ') || '—'}</Dato>
      <Dato etiqueta="Año">{u.anio ?? '—'}</Dato>
      <Dato etiqueta="Medidor">{u.medidor === 'km' ? 'Km' : u.medidor === 'horas' ? 'Horómetro' : 'Sin medidor'}</Dato>
      <Dato etiqueta="Lectura al alta">{num(u.lectura_inicial)}</Dato>
      <Dato etiqueta="Combustible al alta">{fLitros(u.combustible_inicial_l, 0)}</Dato>
      {u.tipo === 'camion' && <Dato etiqueta="Rango razonable">{`${num(u.rendimiento_min, 1)} a ${num(u.rendimiento_max, 1)} km/L`}</Dato>}
      {u.notas && <div className="col-span-full"><Dato etiqueta="Notas">{u.notas}</Dato></div>}
      {!u.notas && <EstadoVacio titulo="Solo flota edita estos datos" icono={<Gauge aria-hidden className="size-6 text-tinta-2" />} />}
    </Panel>
  );
}
