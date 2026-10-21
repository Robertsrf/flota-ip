import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Boton, Campo, Seleccion } from '@/components/controles';
import { PanelFiltros } from '@/components/filtros';
import { EstadoVacio, MensajeError, TableroKpis } from '@/components/datos';
import { EncabezadoPagina, Pestanas, VerFoto } from '@/components/estructura';
import type { Gasto } from '@/lib/api';
import { exigir, traducirError } from '@/lib/errores';
import { bs, fecha, num, usd } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';
import { useCategorias } from '@/features/cabina/datos';
import { calcularPeriodo, NOMBRES_PERIODO, type ClavePeriodo } from '@/features/dashboard/periodo';
import { GraficoBarrasH } from '@/features/dashboard/graficos';
import { etiquetaUnidad, useUnidadesLista } from '@/features/registros/datosComunes';
import { FormGastoOficina } from '@/features/registros/FormulariosOficina';
import { BotonesAprobacion, TablaGastos } from '@/features/registros/Tablas';

export function usePendientesAprobacion(activo = true) {
  return useQuery({
    queryKey: ['gastos', 'pendientes'],
    enabled: activo,
    queryFn: async () =>
      exigir(await supabase.from('v_mantenimientos').select('*').eq('estado_aprobacion', 'pendiente').eq('anulado', false).order('created_at')) as Gasto[],
  });
}

/** Tarjetas de gastos por aprobar (también en la bandeja de revisión) */
export function ListaPorAprobar({ gastos, cargando }: { gastos: Gasto[]; cargando?: boolean }) {
  if (cargando) return null;
  if (!gastos.length) return <EstadoVacio titulo="No hay gastos por aprobar">Cuando un chofer registre un gasto, aparece aquí para que lo revises.</EstadoVacio>;
  return (
    <ul className="flex flex-col gap-3">
      {gastos.map((g) => (
        <li key={g.id} className="flex flex-col gap-3 rounded-xl border-2 border-linea bg-superficie p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            {g.factura_path && <VerFoto ruta={g.factura_path} etiqueta="Factura" />}
            <div>
              <p className="text-lg font-extrabold">
                {g.categoria_nombre}: {g.moneda === 'VES' ? `${bs(g.monto)} (${usd(g.monto_usd)})` : usd(g.monto)}
              </p>
              <p className="text-base">
                {g.unidad_nombre}, {fecha(g.fecha)}, registrado por {g.registrado_por_nombre}
              </p>
              {g.descripcion && <p className="text-sm text-tinta-2">{g.descripcion}{g.proveedor ? `, ${g.proveedor}` : ''}</p>}
            </div>
          </div>
          <BotonesAprobacion g={g} />
        </li>
      ))}
    </ul>
  );
}

export function Mantenimiento() {
  const { esOficina } = useSesion();
  const [clave, setClave] = useState<ClavePeriodo>('90d');
  const [unidad, setUnidad] = useState('');
  const [categoria, setCategoria] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const periodo = calcularPeriodo(clave);
  const { data: unidades = [] } = useUnidadesLista();
  const { data: categorias = [] } = useCategorias();
  const pendientes = usePendientesAprobacion(esOficina);

  const gastos = useQuery({
    queryKey: ['gastos', 'lista', periodo.desde, periodo.hasta, unidad, categoria],
    queryFn: async () => {
      let q = supabase.from('v_mantenimientos').select('*').gte('fecha', periodo.desde).lte('fecha', periodo.hasta).order('fecha', { ascending: false }).limit(2000);
      if (unidad) q = q.eq('unidad_id', unidad);
      if (categoria) q = q.eq('categoria_id', categoria);
      return exigir(await q) as Gasto[];
    },
  });
  const aprobados = (gastos.data ?? []).filter((g) => !g.anulado && g.estado_aprobacion === 'aprobado');
  const total = aprobados.reduce((s, g) => s + Number(g.monto_usd ?? 0), 0);
  const enBs = aprobados.filter((g) => g.moneda === 'VES');
  const sumas = new Map<string, number>();
  for (const g of aprobados) sumas.set(g.categoria_nombre ?? '', (sumas.get(g.categoria_nombre ?? '') ?? 0) + Number(g.monto_usd ?? 0));
  const porCategoria = [...sumas.entries()].map(([nombre, valor]) => ({ nombre, valor }));

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Mantenimiento"
        descripcion={`${periodo.texto}. Cada gasto en su moneda original, con la tasa BCV y su equivalente en dólares.`}
        acciones={esOficina && <Boton variante="principal" icono={<Plus aria-hidden className="size-5" />} onClick={() => setNuevo(true)}>Registrar gasto</Boton>}
      />
      <PanelFiltros
        columnas={3}
        resumen={[
          NOMBRES_PERIODO[clave],
          unidad ? etiquetaUnidad(unidades.find((u) => u.id === unidad) ?? {}) : 'todas las unidades',
          categorias.find((c) => c.id === categoria)?.nombre ?? '',
        ]}
        activos={[clave !== '90d', unidad, categoria].filter(Boolean).length}
        alLimpiar={() => {
          setClave('90d');
          setUnidad('');
          setCategoria('');
        }}
      >
        <Campo etiqueta="Período">
          {(p) => (
            <Seleccion {...p} value={clave} onChange={(e) => setClave(e.target.value as ClavePeriodo)}>
              {(['mes', 'anterior', '90d', 'anio'] as ClavePeriodo[]).map((c) => <option key={c} value={c}>{NOMBRES_PERIODO[c]}</option>)}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Unidad">
          {(p) => (
            <Seleccion {...p} value={unidad} onChange={(e) => setUnidad(e.target.value)}>
              <option value="">Todas</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.tipo === 'planta' ? `Planta: ${u.alias}` : etiquetaUnidad(u)}</option>)}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Categoría">
          {(p) => (
            <Seleccion {...p} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          )}
        </Campo>
      </PanelFiltros>
      {gastos.error && <MensajeError error={traducirError(gastos.error)} />}
      <TableroKpis
        cargando={gastos.isLoading}
        datos={[
          { titulo: 'Gasto aprobado', valor: usd(total) },
          { titulo: 'Gastos', valor: num(aprobados.length) },
          { titulo: 'Pagados en Bs', valor: num(enBs.length), secundario: enBs.length ? `${bs(enBs.reduce((s, g) => s + Number(g.monto ?? 0), 0))} en total` : undefined },
          ...(esOficina ? [{ titulo: 'Por aprobar', valor: num(pendientes.data?.length ?? 0) }] : []),
        ]}
      />
      <Pestanas
        pestanas={[
          { id: 'gastos', titulo: 'Gastos', contenido: () => <TablaGastos filas={gastos.data ?? []} cargando={gastos.isLoading} nombreExport={`mantenimiento-${periodo.desde}-${periodo.hasta}`} /> },
          ...(esOficina
            ? [{ id: 'aprobar', titulo: `Por aprobar (${pendientes.data?.length ?? 0})`, contenido: () => <ListaPorAprobar gastos={pendientes.data ?? []} cargando={pendientes.isLoading} /> }]
            : []),
          {
            id: 'categorias',
            titulo: 'Por categoría',
            contenido: () => (
              <GraficoBarrasH titulo="Gasto por categoría" descripcion="Aprobados del período, en USD." filas={porCategoria} formato={(v) => usd(v)} color="mantenimiento" columnaValor="USD" />
            ),
          },
        ]}
      />
      {nuevo && <FormGastoOficina abierta={nuevo} alCerrar={() => setNuevo(false)} />}
    </div>
  );
}
