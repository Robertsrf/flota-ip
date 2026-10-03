import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MODO_LOCAL, supabase } from './supabase';

/**
 * Escucha cambios en viajes y unidades (Realtime) y refresca las consultas.
 * En el servidor local no hay Realtime: las consultas usan refetchInterval.
 */
export function useTiempoReal(activo = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!activo || MODO_LOCAL) return;
    let espera: number | undefined;
    const refrescar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
        void qc.invalidateQueries({ queryKey: ['unidades'] });
        void qc.invalidateQueries({ queryKey: ['viajes'] });
        void qc.invalidateQueries({ queryKey: ['cabina'] });
      }, 400);
    };
    const canal = supabase
      .channel('flota-en-ruta')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes' }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, refrescar)
      .subscribe();
    return () => {
      window.clearTimeout(espera);
      void supabase.removeChannel(canal);
    };
  }, [activo, qc]);
}

/** Intervalo de respaldo para lo que debe verse "en vivo" */
export const INTERVALO_VIVO = MODO_LOCAL ? 30_000 : 120_000;
