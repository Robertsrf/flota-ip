import { useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { ProveedorAvisos } from '@/components/avisos';
import { ProveedorSesion } from '@/lib/sesion';
import { alSincronizar, instalarSincronizacion } from '@/lib/offline/cola';
import { traducirError } from '@/lib/errores';
import { enrutador } from './rutas';

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (intentos, error) => intentos < 2 && traducirError(error).deRed,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});

/** Cuando la cola offline envía registros, se refrescan los datos */
function PuenteSincronizacion() {
  const qc = useQueryClient();
  useEffect(() => {
    instalarSincronizacion();
    return alSincronizar(() => {
      void qc.invalidateQueries();
    });
  }, [qc]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <ProveedorSesion>
        <ProveedorAvisos>
          <PuenteSincronizacion />
          <RouterProvider router={enrutador} />
        </ProveedorAvisos>
      </ProveedorSesion>
    </QueryClientProvider>
  );
}
