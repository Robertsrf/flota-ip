import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { BotonEnlace } from '@/components/controles';
import { EstadoVacio, Etiqueta, MensajeError } from '@/components/datos';
import { EncabezadoPagina } from '@/components/estructura';
import { Tabla, type Columna } from '@/components/tabla';
import type { Unidad } from '@/lib/api';
import { exigir, traducirError } from '@/lib/errores';
import { fecha, hora, km as fKm, litros as fLitros, num } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';
import { INTERVALO_VIVO, useTiempoReal } from '@/lib/tiempoReal';

export function EtiquetaEstado({ estado }: { estado: string | null }) {
  if (estado === 'en_ruta') return <Etiqueta tono="via">En ruta</Etiqueta>;
  if (estado === 'taller') return <Etiqueta tono="alerta">En taller</Etiqueta>;
  if (estado === 'inactivo') return <Etiqueta>Inactivo</Etiqueta>;
  return <span>Disponible</span>;
}

export function ListaUnidades() {
  useTiempoReal();
  const { esOficina } = useSesion();
  const navegar = useNavigate();
  const consulta = useQuery({
    queryKey: ['unidades', 'todas'],
    refetchInterval: INTERVALO_VIVO,
    queryFn: async () => exigir(await supabase.from('v_unidades').select('*').order('tipo').order('placa')) as Unidad[],
  });
  const camiones = (consulta.data ?? []).filter((u) => u.tipo === 'camion');
  const plantas = (consulta.data ?? []).filter((u) => u.tipo === 'planta');

  const colCamiones: Columna<Unidad>[] = [
    {
      id: 'placa', titulo: 'Camión', movil: 'principal',
      celda: (u) => <span><span className="font-bold">{u.placa}</span> <span className="text-tinta-2">{u.alias}</span></span>,
      orden: (u) => u.placa, exportar: { valor: (u) => u.placa, titulo: 'Placa' },
    },
    { id: 'estado', titulo: 'Estado', movil: 'derecha', celda: (u) => <EtiquetaEstado estado={u.estado} />, orden: (u) => u.estado, exportar: { valor: (u) => u.estado } },
    {
      id: 'ruta', titulo: 'En ruta', envolver: true,
      movilCelda: (u) => (u.viaje_abierto_id ? `A ${u.viaje_abierto_destino} con ${u.viaje_abierto_chofer}` : null),
      celda: (u) => (u.viaje_abierto_id ? `${u.viaje_abierto_destino}, ${u.viaje_abierto_chofer}, desde ${fecha(u.viaje_abierto_salida_at)} ${hora(u.viaje_abierto_salida_at)}` : '—'),
      exportar: { valor: (u) => u.viaje_abierto_destino, titulo: 'Destino actual' },
    },
    { id: 'km', titulo: 'Km actual', alinear: 'der', movilCelda: (u) => fKm(u.lectura_actual), celda: (u) => num(u.lectura_actual), orden: (u) => Number(u.lectura_actual ?? 0), exportar: { valor: (u) => u.lectura_actual, tipo: 'km', titulo: 'Km actual' } },
    {
      id: 'nivel', titulo: 'Nivel estimado', alinear: 'der',
      movilCelda: (u) =>
        u.nivel_estimado_l == null ? null : `Tanque ${u.nivel_estimado_fuente === 'exacto' ? '' : '≈ '}${fLitros(u.nivel_estimado_l, 0)} de ${fLitros(u.capacidad_tanque_l, 0)}`,
      celda: (u) => (u.nivel_estimado_l == null ? '—' : `${u.nivel_estimado_fuente === 'exacto' ? '' : '≈ '}${fLitros(u.nivel_estimado_l, 0)}`),
      orden: (u) => Number(u.nivel_estimado_l ?? -1), exportar: { valor: (u) => u.nivel_estimado_l, tipo: 'litros', titulo: 'Nivel estimado' },
    },
    { id: 'tanque', titulo: 'Tanque', alinear: 'der', movil: 'oculta', celda: (u) => fLitros(u.capacidad_tanque_l, 0), orden: (u) => Number(u.capacidad_tanque_l), exportar: { valor: (u) => u.capacidad_tanque_l, tipo: 'litros', titulo: 'Capacidad' } },
    { id: 'chofer', titulo: 'Chofer habitual', movil: 'oculta', celda: (u) => u.chofer_habitual_nombre ?? '—', orden: (u) => u.chofer_habitual_nombre, exportar: { valor: (u) => u.chofer_habitual_nombre } },
    { id: 'comb', titulo: 'Combustible', movil: 'oculta', celda: (u) => (u.combustible === 'diesel' ? 'Diésel' : 'Gasolina'), exportar: { valor: (u) => u.combustible } },
  ];

  const colPlantas: Columna<Unidad>[] = [
    { id: 'nombre', titulo: 'Planta eléctrica', movil: 'principal', celda: (u) => <span className="font-bold">{u.alias}</span>, orden: (u) => u.alias, exportar: { valor: (u) => u.alias, titulo: 'Planta' } },
    { id: 'estado', titulo: 'Estado', movil: 'derecha', celda: (u) => <EtiquetaEstado estado={u.estado} />, orden: (u) => u.estado, exportar: { valor: (u) => u.estado } },
    { id: 'comb', titulo: 'Combustible', movilCelda: (u) => (u.combustible === 'diesel' ? 'Diésel' : 'Gasolina'), celda: (u) => (u.combustible === 'diesel' ? 'Diésel' : 'Gasolina'), exportar: { valor: (u) => u.combustible } },
    { id: 'tanque', titulo: 'Tanque', alinear: 'der', movilCelda: (u) => `Tanque ${fLitros(u.capacidad_tanque_l, 0)}`, celda: (u) => fLitros(u.capacidad_tanque_l, 0), orden: (u) => Number(u.capacidad_tanque_l), exportar: { valor: (u) => u.capacidad_tanque_l, tipo: 'litros', titulo: 'Capacidad' } },
    { id: 'medidor', titulo: 'Medidor', movil: 'oculta', celda: (u) => (u.medidor === 'horas' ? 'Horómetro' : 'Sin medidor'), exportar: { valor: (u) => u.medidor } },
  ];

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Camiones y plantas"
        descripcion="Todo lo que consume combustible: los camiones de la flota y las plantas eléctricas."
        acciones={esOficina && <BotonEnlace to="/unidades/nueva" variante="principal" icono={<Plus aria-hidden className="size-5" />}>Nueva unidad</BotonEnlace>}
      />
      {consulta.error && <MensajeError error={traducirError(consulta.error)} />}
      <Tabla
        titulo={`Camiones (${camiones.length})`}
        filas={camiones}
        columnas={colCamiones}
        clave={(u) => u.id!}
        cargando={consulta.isLoading}
        alElegir={(u) => navegar(`/unidades/${u.id}`)}
        nombreExport="camiones"
        vacio={<EstadoVacio titulo="Aún no hay camiones">{esOficina ? 'Registra el primero con "Nueva unidad".' : 'Flota los registra.'}</EstadoVacio>}
      />
      <Tabla
        titulo={`Plantas eléctricas (${plantas.length})`}
        filas={plantas}
        columnas={colPlantas}
        clave={(u) => u.id!}
        cargando={consulta.isLoading}
        alElegir={(u) => navegar(`/unidades/${u.id}`)}
        nombreExport="plantas"
        vacio={<EstadoVacio titulo="Aún no hay plantas registradas" />}
      />
    </div>
  );
}
