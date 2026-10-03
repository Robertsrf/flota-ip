import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { Cargando } from '@/components/datos';
import { useSesion, type Rol } from '@/lib/sesion';
import { DisenoCabina } from './DisenoCabina';
import { DisenoOficina } from './DisenoOficina';
import { PaginaLogin } from '@/features/auth/PaginaLogin';
import { NoEncontrado } from './NoEncontrado';

function diferida(cargar: () => Promise<Record<string, ComponentType>>, nombre: string) {
  const C = lazy(async () => ({ default: (await cargar())[nombre] }));
  return (
    <Suspense fallback={<div className="p-4"><Cargando /></div>}>
      <C />
    </Suspense>
  );
}

/** Exige sesión y, si se indica, uno de los roles */
function Protegida({ roles, children }: { roles?: Rol[]; children?: ReactNode }) {
  const { cargando, sesion, rol, perfil } = useSesion();
  if (cargando) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Cargando texto="Abriendo Flota IP…" />
      </div>
    );
  }
  if (!sesion) return <Navigate to="/entrar" replace />;
  if (perfil && !perfil.activo) return <Navigate to="/entrar?inactivo=1" replace />;
  if (roles && (!rol || !roles.includes(rol))) return <Navigate to="/" replace />;
  return children ?? <Outlet />;
}

/** El chofer aterriza en su cabina; los demás, en el dashboard */
function Inicio() {
  const { rol } = useSesion();
  if (!rol) return <Cargando />;
  return <Navigate to={rol === 'chofer' ? '/cabina' : '/dashboard'} replace />;
}

const OFICINA: Rol[] = ['superusuario', 'flota'];
const ESCRIBEN: Rol[] = ['superusuario', 'flota', 'chofer'];

export const enrutador = createBrowserRouter(
  [
    { path: '/entrar', element: <PaginaLogin /> },
    {
      element: <Protegida />,
      children: [
        { index: true, element: <Inicio /> },
        {
          path: 'cabina',
          element: (
            <Protegida roles={ESCRIBEN}>
              <DisenoCabina />
            </Protegida>
          ),
          children: [
            { index: true, element: diferida(() => import('@/features/cabina/CabinaInicio'), 'CabinaInicio') },
            { path: 'iniciar', element: diferida(() => import('@/features/cabina/IniciarRuta'), 'IniciarRuta') },
            { path: 'finalizar', element: diferida(() => import('@/features/cabina/FinalizarRuta'), 'FinalizarRuta') },
            { path: 'repostaje', element: diferida(() => import('@/features/cabina/RegistrarRepostaje'), 'RegistrarRepostaje') },
            { path: 'gasto', element: diferida(() => import('@/features/cabina/RegistrarGasto'), 'RegistrarGasto') },
            { path: 'resumen/:id', element: diferida(() => import('@/features/cabina/ResumenRuta'), 'ResumenRuta') },
            { path: 'historial', element: diferida(() => import('@/features/cabina/Historial'), 'Historial') },
          ],
        },
        {
          element: <DisenoOficina />,
          children: [
            { path: 'dashboard', element: diferida(() => import('@/features/dashboard/Dashboard'), 'Dashboard') },
            { path: 'unidades', element: diferida(() => import('@/features/unidades/ListaUnidades'), 'ListaUnidades') },
            {
              path: 'unidades/nueva',
              element: <Protegida roles={OFICINA}>{diferida(() => import('@/features/unidades/FormUnidad'), 'NuevaUnidad')}</Protegida>,
            },
            { path: 'unidades/:id', element: diferida(() => import('@/features/unidades/FichaUnidad'), 'FichaUnidad') },
            { path: 'viajes', element: diferida(() => import('@/features/viajes/ListaViajes'), 'ListaViajes') },
            { path: 'viajes/:id', element: diferida(() => import('@/features/viajes/DetalleViaje'), 'DetalleViaje') },
            { path: 'combustible', element: diferida(() => import('@/features/combustible/Combustible'), 'Combustible') },
            { path: 'mantenimiento', element: diferida(() => import('@/features/mantenimiento/Mantenimiento'), 'Mantenimiento') },
            {
              path: 'revision',
              element: <Protegida roles={OFICINA}>{diferida(() => import('@/features/revision/Revision'), 'Revision')}</Protegida>,
            },
            {
              path: 'catalogos',
              element: <Protegida roles={OFICINA}>{diferida(() => import('@/features/catalogos/Catalogos'), 'Catalogos')}</Protegida>,
            },
            {
              path: 'usuarios',
              element: <Protegida roles={OFICINA}>{diferida(() => import('@/features/usuarios/Usuarios'), 'Usuarios')}</Protegida>,
            },
            { path: 'cuenta', element: diferida(() => import('@/features/usuarios/MiCuenta'), 'MiCuenta') },
          ],
        },
      ],
    },
    { path: '*', element: <NoEncontrado /> },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
