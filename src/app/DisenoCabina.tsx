import { useState, type ReactNode } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { ChevronLeft, CloudOff, History, LayoutDashboard, LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react';
import { Hoja } from '@/components/hoja';
import { Boton } from '@/components/controles';
import { useEnLinea, useTema } from '@/lib/ganchos';
import { useSesion } from '@/lib/sesion';
import { AvisoActualizacion } from './Actualizacion';
import { AvisosCola } from '@/features/cabina/AvisosCola';

/** Cabina del chofer: sin barra de navegación; la pantalla es la tarea. */
export function DisenoCabina() {
  const enLinea = useEnLinea();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-superficie md:my-4 md:min-h-[calc(100dvh-2rem)] md:rounded-2xl md:border-2 md:border-linea md:shadow-panel">
      <AvisoActualizacion />
      {!enLinea && (
        <div role="status" className="flex items-center gap-2 bg-tinta px-4 py-2 text-sm font-semibold text-superficie">
          <CloudOff aria-hidden className="size-4" />
          Sin señal: lo que registres se guarda en el teléfono y se envía solo.
        </div>
      )}
      <AvisosCola />
      <Outlet />
    </div>
  );
}

/** Cabecera verde de la cabina: nombre, acceso al dashboard y menú */
export function CabeceraCabina({ children, volver }: { children?: ReactNode; volver?: { a: string; texto: string } }) {
  const { perfil, salir } = useSesion();
  const [menu, setMenu] = useState(false);
  const [tema, setTema] = useTema();
  const navegar = useNavigate();
  const nombre = perfil?.nombre?.split(' ')[0] ?? '';
  return (
    <header className="panel-senal rounded-none px-4 pb-5 pt-3 md:rounded-t-2xl">
      <div className="flex min-h-12 items-center justify-between gap-2">
        {volver ? (
          <Link to={volver.a} className="-ml-2 inline-flex min-h-12 items-center gap-1 rounded-lg px-2 text-base font-bold hover:bg-via-fuerte">
            <ChevronLeft aria-hidden className="size-6" /> {volver.texto}
          </Link>
        ) : (
          <span className="text-base font-bold">{nombre}</span>
        )}
        <div className="flex items-center gap-1">
          {!volver && (
            <Link to="/dashboard" className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-3 font-bold underline-offset-4 hover:underline">
              <LayoutDashboard aria-hidden className="size-5" /> Dashboard
            </Link>
          )}
          <button type="button" onClick={() => setMenu(true)} aria-label="Menú" className="grid size-12 place-items-center rounded-lg hover:bg-via-fuerte">
            <Menu aria-hidden className="size-6" />
          </button>
        </div>
      </div>
      {children}
      <Hoja abierta={menu} alCerrar={() => setMenu(false)} titulo={perfil?.nombre ?? 'Menú'}>
        <nav className="flex flex-col gap-2">
          <Boton bloque tamano="lg" icono={<History aria-hidden className="size-5" />} onClick={() => navegar('/cabina/historial')}>
            Mis rutas y registros
          </Boton>
          <Boton bloque tamano="lg" icono={<LayoutDashboard aria-hidden className="size-5" />} onClick={() => navegar('/dashboard')}>
            Dashboard de la flota
          </Boton>
          <Boton bloque tamano="lg" icono={<UserRound aria-hidden className="size-5" />} onClick={() => navegar('/cuenta')}>
            Cambiar mi PIN
          </Boton>
          <Boton
            bloque
            tamano="lg"
            icono={tema === 'oscuro' ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
            onClick={() => setTema(tema === 'oscuro' ? 'claro' : 'oscuro')}
          >
            {tema === 'oscuro' ? 'Modo claro (para el sol)' : 'Modo oscuro'}
          </Boton>
          <Boton bloque tamano="lg" variante="fantasma" icono={<LogOut aria-hidden className="size-5" />} onClick={() => void salir()}>
            Salir
          </Boton>
        </nav>
      </Hoja>
    </header>
  );
}
