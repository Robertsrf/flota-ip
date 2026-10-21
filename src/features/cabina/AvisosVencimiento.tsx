import { AvisoAlerta } from '@/components/datos';
import { useSesion } from '@/lib/sesion';
import { estadoFecha, estadoServicio, useDocumentos, useRecordatorios } from '@/features/vencimientos/datos';

/**
 * En la cabina: papeles del camión o del chofer que vencen pronto y servicios ya pasados.
 * Un chofer con la póliza vencida se entera antes de salir, no en la alcabala.
 */
export function AvisosVencimiento({ unidadId, enRuta }: { unidadId: string | null | undefined; enRuta?: boolean }) {
  const { perfil } = useSesion();
  const { data: documentos = [] } = useDocumentos();
  const { data: servicios = [] } = useRecordatorios(unidadId);
  if (!unidadId) return null;

  const lineas = [
    ...documentos
      .filter((d) => d.activo && (d.situacion === 'vencido' || d.situacion === 'pronto') && (d.unidad_id === unidadId || d.persona_id === perfil?.id))
      .map((d) => {
        const cuando = estadoFecha(d.dias_restantes ?? 0, d.vence, 'Vence').toLowerCase();
        return { id: d.id!, texto: d.persona_id ? `Tu ${d.tipo?.toLowerCase()}: ${cuando}.` : `${d.tipo} de ${d.placa ?? d.titular}: ${cuando}.` };
      }),
    ...servicios
      .filter((r) => r.activo && r.situacion === 'vencido')
      .map((r) => ({ id: r.id!, texto: `${r.nombre}: ${estadoServicio(r).join('; ').toLowerCase()}.` })),
  ];
  if (!lineas.length) return null;

  return (
    <AvisoAlerta titulo={enRuta ? 'Pendientes de papeles y servicios' : 'Antes de salir'}>
      <ul className="flex flex-col gap-1">
        {lineas.map((l) => <li key={l.id}>{l.texto}</li>)}
      </ul>
      <p className="mt-1 text-sm text-tinta-2">Avísale a flota si no lo sabe.</p>
    </AvisoAlerta>
  );
}
