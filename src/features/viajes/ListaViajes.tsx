import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Campo, Entrada, Seleccion } from '@/components/controles';
import { PanelFiltros } from '@/components/filtros';
import { Calidad, EstadoVacio, Etiqueta, MensajeError } from '@/components/datos';
import { EncabezadoPagina } from '@/components/estructura';
import { Tabla, type Columna } from '@/components/tabla';
import type { Viaje } from '@/lib/api';
import { exigir, traducirError } from '@/lib/errores';
import { fechaHora, km as fKm, kml, num, usd } from '@/lib/formato';
import { supabase } from '@/lib/supabase';
import { calcularPeriodo, NOMBRES_PERIODO, type ClavePeriodo } from '@/features/dashboard/periodo';
import { etiquetaUnidad, useChoferes, useUnidadesLista } from '@/features/registros/datosComunes';

export function EstadoViaje({ v }: { v: Pick<Viaje, 'estado' | 'revisar'> }) {
  if (v.estado === 'en_curso') return <Etiqueta tono="via">En ruta</Etiqueta>;
  if (v.estado === 'anulado') return <Etiqueta tono="peligro">Anulada</Etiqueta>;
  if (v.revisar) return <Etiqueta tono="alerta">Revisar</Etiqueta>;
  return <Etiqueta>Cerrada</Etiqueta>;
}

/** Una cerrada muestra la calidad del cálculo; las demás, su estado. "Revisar" acompaña a la calidad. */
export function EstadoYCalidad({ v }: { v: Pick<Viaje, 'estado' | 'revisar' | 'calidad'> }) {
  if (v.estado !== 'cerrado') return <EstadoViaje v={v} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Calidad valor={v.calidad} compacta />
      {v.revisar && <Etiqueta tono="alerta">Revisar</Etiqueta>}
    </span>
  );
}

const ESTADOS: Record<string, string> = { en_curso: 'En ruta', cerrado: 'Cerradas', revisar: 'Para revisar', anulado: 'Anuladas' };

export function ListaViajes() {
  const [clave, setClave] = useState<ClavePeriodo>('mes');
  const [unidad, setUnidad] = useState('');
  const [chofer, setChofer] = useState('');
  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const periodo = calcularPeriodo(clave);
  const { data: unidades = [] } = useUnidadesLista();
  const { data: choferes = [] } = useChoferes();
  const navegar = useNavigate();

  const consulta = useQuery({
    queryKey: ['viajes', 'lista', periodo.desde, periodo.hasta, unidad, chofer, estado],
    queryFn: async () => {
      let q = supabase
        .from('v_viajes')
        .select('*')
        .gte('fecha_salida', periodo.desde)
        .lte('fecha_salida', periodo.hasta)
        .order('salida_at', { ascending: false })
        .limit(1000);
      if (unidad) q = q.eq('unidad_id', unidad);
      if (chofer) q = q.eq('chofer_id', chofer);
      if (estado === 'revisar') q = q.eq('revisar', true).neq('estado', 'anulado');
      else if (estado) q = q.eq('estado', estado as 'en_curso');
      return exigir(await q) as Viaje[];
    },
  });

  const filas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return consulta.data ?? [];
    return (consulta.data ?? []).filter((v) =>
      [v.folio_txt, v.ruta, v.placa, v.chofer_nombre, v.notas].some((x) => (x ?? '').toLowerCase().includes(t)));
  }, [consulta.data, busqueda]);

  const columnas: Columna<Viaje>[] = [
    { id: 'folio', titulo: 'Folio', celda: (v) => <span className="font-bold">{v.folio_txt}</span>, movilCelda: (v) => v.folio_txt, orden: (v) => v.folio, exportar: { valor: (v) => v.folio_txt } },
    { id: 'ruta', titulo: 'Ruta', movil: 'principal', envolver: true, celda: (v) => v.ruta, orden: (v) => v.ruta, exportar: { valor: (v) => v.ruta } },
    { id: 'salida', titulo: 'Salida', celda: (v) => fechaHora(v.salida_at), movilCelda: (v) => fechaHora(v.salida_at), orden: (v) => v.salida_at, exportar: { valor: (v) => v.salida_at, tipo: 'fechaHora' } },
    { id: 'camion', titulo: 'Camión', celda: (v) => v.placa, movilCelda: (v) => v.placa, orden: (v) => v.placa, exportar: { valor: (v) => v.placa, titulo: 'Placa' } },
    { id: 'chofer', titulo: 'Chofer', celda: (v) => v.chofer_nombre, orden: (v) => v.chofer_nombre, movil: 'oculta', exportar: { valor: (v) => v.chofer_nombre } },
    { id: 'km', titulo: 'Km', alinear: 'der', celda: (v) => num(v.km_recorridos), movilCelda: (v) => fKm(v.km_recorridos), orden: (v) => Number(v.km_recorridos ?? -1), exportar: { valor: (v) => v.km_recorridos, tipo: 'km', titulo: 'Km recorridos' } },
    { id: 'litros', titulo: 'Litros', alinear: 'der', movil: 'oculta', celda: (v) => num(v.litros_consumidos, 2), orden: (v) => Number(v.litros_consumidos ?? -1), exportar: { valor: (v) => v.litros_consumidos, tipo: 'litros', titulo: 'Litros consumidos' } },
    { id: 'rend', titulo: 'km/L', alinear: 'der', celda: (v) => num(v.rendimiento_kml, 2), movilCelda: (v) => kml(v.rendimiento_kml), orden: (v) => Number(v.rendimiento_kml ?? -1), exportar: { valor: (v) => v.rendimiento_kml, tipo: 'kml' } },
    { id: 'costo', titulo: 'Costo', alinear: 'der', movil: 'derecha', celda: (v) => usd(v.costo_combustible_usd), orden: (v) => Number(v.costo_combustible_usd ?? -1), exportar: { valor: (v) => v.costo_combustible_usd, tipo: 'usd', titulo: 'Costo combustible' } },
    { id: 'ckm', titulo: '$/km', alinear: 'der', movil: 'oculta', celda: (v) => num(v.costo_km_usd, 4), orden: (v) => Number(v.costo_km_usd ?? -1), exportar: { valor: (v) => v.costo_km_usd, tipo: 'usdKm', titulo: 'Costo por km' } },
    {
      id: 'estado', titulo: 'Estado', celda: (v) => <EstadoYCalidad v={v} />, movilCelda: (v) => <EstadoYCalidad v={v} />,
      orden: (v) => (v.estado === 'cerrado' ? `${v.revisar ? 'a' : 'b'}${v.calidad}` : v.estado),
      exportar: { valor: (v) => (v.revisar && v.estado !== 'anulado' ? 'revisar' : v.estado), titulo: 'Estado' },
    },
    { id: 'calidad', titulo: 'Calidad', soloExportar: true, celda: () => null, exportar: { valor: (v) => v.calidad } },
  ];

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Viajes" descripcion={`${periodo.texto}. Cada ruta con su cálculo de combustible y su calidad.`} />
      <PanelFiltros
        columnas={4}
        resumen={[
          NOMBRES_PERIODO[clave],
          unidad ? etiquetaUnidad(unidades.find((u) => u.id === unidad) ?? {}) : 'todos los camiones',
          chofer ? (choferes.find((c) => c.id === chofer)?.nombre ?? '') : '',
          estado ? ESTADOS[estado] : '',
        ]}
        activos={[clave !== 'mes', unidad, chofer, estado].filter(Boolean).length}
        alLimpiar={() => {
          setClave('mes');
          setUnidad('');
          setChofer('');
          setEstado('');
        }}
      >
        <Campo etiqueta="Período">
          {(p) => (
            <Seleccion {...p} value={clave} onChange={(e) => setClave(e.target.value as ClavePeriodo)}>
              {(['mes', 'anterior', '90d', 'anio'] as ClavePeriodo[]).map((c) => <option key={c} value={c}>{NOMBRES_PERIODO[c]}</option>)}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Camión">
          {(p) => (
            <Seleccion {...p} value={unidad} onChange={(e) => setUnidad(e.target.value)}>
              <option value="">Todos</option>
              {unidades.filter((u) => u.tipo === 'camion').map((u) => <option key={u.id} value={u.id}>{etiquetaUnidad(u)}</option>)}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Chofer">
          {(p) => (
            <Seleccion {...p} value={chofer} onChange={(e) => setChofer(e.target.value)}>
              <option value="">Todos</option>
              {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Estado">
          {(p) => (
            <Seleccion {...p} value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ESTADOS).map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}
            </Seleccion>
          )}
        </Campo>
      </PanelFiltros>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta-2" />
        <Entrada
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por folio, destino, placa o chofer"
          aria-label="Buscar viajes"
          className="pl-10"
        />
      </div>
      {consulta.error && <MensajeError error={traducirError(consulta.error)} />}
      <Tabla
        titulo={`${num(filas.length)} ${filas.length === 1 ? 'viaje' : 'viajes'}`}
        filas={filas}
        columnas={columnas}
        clave={(v) => v.id!}
        cargando={consulta.isLoading}
        alElegir={(v) => navegar(`/viajes/${v.id}`)}
        nombreExport={`viajes-${periodo.desde}-${periodo.hasta}`}
        ordenInicial={{ id: 'salida', dir: 'desc' }}
        vacio={<EstadoVacio titulo="Aún no hay rutas en este período">Las rutas aparecen aquí cuando un chofer las inicia desde su cabina.</EstadoVacio>}
      />
    </div>
  );
}
