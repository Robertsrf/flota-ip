import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Boton, Campo, Seleccion } from '@/components/controles';
import { PanelFiltros } from '@/components/filtros';
import { MensajeError, TableroKpis } from '@/components/datos';
import { EncabezadoPagina, Pestanas } from '@/components/estructura';
import type { Ciclo, Repostaje } from '@/lib/api';
import { exigir, traducirError } from '@/lib/errores';
import { litros as fLitros, num, usd } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';
import { calcularPeriodo, NOMBRES_PERIODO, type ClavePeriodo } from '@/features/dashboard/periodo';
import { etiquetaUnidad, useUnidadesLista } from '@/features/registros/datosComunes';
import { FormRepostajeOficina } from '@/features/registros/FormulariosOficina';
import { TablaCiclos, TablaRepostajes } from '@/features/registros/Tablas';

export function Combustible() {
  const { esOficina } = useSesion();
  const [clave, setClave] = useState<ClavePeriodo>('mes');
  const [unidad, setUnidad] = useState('');
  const [tipo, setTipo] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const periodo = calcularPeriodo(clave);
  const { data: unidades = [] } = useUnidadesLista();

  const cargas = useQuery({
    queryKey: ['repostajes', 'lista', periodo.desde, periodo.hasta, unidad, tipo],
    queryFn: async () => {
      let q = supabase.from('v_repostajes').select('*').gte('fecha_local', periodo.desde).lte('fecha_local', periodo.hasta).order('fecha', { ascending: false }).limit(2000);
      if (unidad) q = q.eq('unidad_id', unidad);
      if (tipo) q = q.eq('unidad_tipo', tipo as 'camion');
      return exigir(await q) as Repostaje[];
    },
  });
  const ciclos = useQuery({
    queryKey: ['ciclos', 'todos', unidad],
    queryFn: async () => {
      let q = supabase.from('v_ciclos_combustible').select('*').order('fecha_fin', { ascending: false }).limit(500);
      if (unidad) q = q.eq('unidad_id', unidad);
      return exigir(await q) as Ciclo[];
    },
  });
  const nombres = useMemo(() => new Map(unidades.map((u) => [u.id, etiquetaUnidad(u)])), [unidades]);
  const validas = (cargas.data ?? []).filter((c) => !c.anulado);
  const litros = validas.reduce((s, c) => s + Number(c.litros ?? 0), 0);
  const monto = validas.reduce((s, c) => s + Number(c.monto_usd ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Combustible"
        descripcion={`${periodo.texto}. Cargas de camiones y plantas, con el precio copiado al momento de cada carga.`}
        acciones={esOficina && <Boton variante="principal" icono={<Plus aria-hidden className="size-5" />} onClick={() => setNuevo(true)}>Registrar repostaje</Boton>}
      />
      <PanelFiltros
        columnas={3}
        resumen={[
          NOMBRES_PERIODO[clave],
          unidad ? (nombres.get(unidad) ?? '') : tipo === 'camion' ? 'solo camiones' : tipo === 'planta' ? 'solo plantas' : 'camiones y plantas',
        ]}
        activos={[clave !== 'mes', unidad, tipo].filter(Boolean).length}
        alLimpiar={() => {
          setClave('mes');
          setUnidad('');
          setTipo('');
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
        <Campo etiqueta="Tipo">
          {(p) => (
            <Seleccion {...p} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Camiones y plantas</option>
              <option value="camion">Solo camiones</option>
              <option value="planta">Solo plantas</option>
            </Seleccion>
          )}
        </Campo>
      </PanelFiltros>
      {cargas.error && <MensajeError error={traducirError(cargas.error)} />}
      <TableroKpis
        cargando={cargas.isLoading}
        datos={[
          { titulo: 'Cargas', valor: num(validas.length) },
          { titulo: 'Litros', valor: fLitros(litros, 0) },
          { titulo: 'Pagado', valor: usd(monto), ayuda: 'Suma de lo pagado en las cargas del período (las anuladas no cuentan).' },
          { titulo: 'Precio promedio', valor: litros > 0 ? `${usd(monto / litros, 3)}/L` : '—', ayuda: 'Lo pagado entre los litros cargados: el precio que en realidad salió cada litro.' },
        ]}
      />
      <Pestanas
        pestanas={[
          { id: 'repostajes', titulo: 'Repostajes', contenido: () => <TablaRepostajes filas={cargas.data ?? []} cargando={cargas.isLoading} nombreExport={`repostajes-${periodo.desde}-${periodo.hasta}`} /> },
          {
            id: 'ciclos',
            titulo: 'Ciclos lleno a lleno',
            contenido: () => (
              <div className="flex flex-col gap-3">
                <p className="text-base text-tinta-2">
                  Rendimiento medido entre dos cargas con el tanque lleno, aunque haya km fuera de rutas registradas. Sirve para validar los viajes: si en un mes difieren más de 10 %, aparece una alerta.
                </p>
                <TablaCiclos filas={ciclos.data ?? []} cargando={ciclos.isLoading} nombres={nombres} />
              </div>
            ),
          },
        ]}
      />
      {nuevo && <FormRepostajeOficina abierta={nuevo} alCerrar={() => setNuevo(false)} />}
    </div>
  );
}
