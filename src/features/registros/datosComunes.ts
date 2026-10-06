import { useQuery } from '@tanstack/react-query';
import type { Auditoria } from '@/lib/api';
import { exigir } from '@/lib/errores';
import { supabase } from '@/lib/supabase';

export function useChoferes() {
  return useQuery({
    queryKey: ['perfiles', 'choferes'],
    staleTime: 5 * 60_000,
    queryFn: async () => exigir(await supabase.from('perfiles').select('id, nombre, activo').eq('rol', 'chofer').order('nombre')),
  });
}

export function useUnidadesLista() {
  return useQuery({
    queryKey: ['unidades', 'lista'],
    staleTime: 60_000,
    queryFn: async () =>
      exigir(await supabase.from('unidades').select('id, placa, alias, tipo, estado, medidor, capacidad_tanque_l').order('tipo').order('placa')),
  });
}

export function useAuditoria(tabla: string, registroId: string | null | undefined, activo = true) {
  return useQuery({
    queryKey: ['auditoria', tabla, registroId],
    enabled: Boolean(registroId) && activo,
    queryFn: async () =>
      exigir(
        await supabase
          .from('v_auditoria')
          .select('*')
          .in('tabla', tabla === 'viajes' ? ['viajes', 'viaje_paradas'] : [tabla])
          .eq('registro_id', registroId!)
          .order('fecha', { ascending: false }),
      ) as Auditoria[],
  });
}

export function etiquetaUnidad(u: { placa?: string | null; alias?: string | null }) {
  return u.placa ? `${u.placa}${u.alias ? `, ${u.alias}` : ''}` : (u.alias ?? '—');
}
