import { useState, type ComponentType } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck, CloudOff, Fuel, Gauge, LayoutDashboard, LogOut, Menu, Monitor, Moon, Route, Settings, Sun, Truck, UserRound, Users, Wrench,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NOMBRE_ROL, useSesion, type Rol } from '@/lib/sesion';
import { useEnLinea, useTema, type Tema } from '@/lib/ganchos';
import { Hoja } from '@/components/hoja';
import { AvisoActualizacion } from './Actualizacion';

interface Item {
  a: string;
  texto: string;
  Icono: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  roles: Rol[];
  movil?: boolean;
}

const TODOS: Rol[] = ['superusuario', 'flota', 'chofer', 'consulta'];
const OFICINA: Rol[] = ['superusuario', 'flota'];

const ITEMS: Item[] = [
  { a: '/cabina', texto: 'Mi cabina', Icono: Gauge, roles: ['chofer'], movil: true },
  { a: '/dashboard', texto: 'Dashboard', Icono: LayoutDashboard, roles: TODOS, movil: true },
  { a: '/unidades', texto: 'Camiones y plantas', Icono: Truck, roles: TODOS, movil: true },
  { a: '/viajes', texto: 'Viajes', Icono: Route, roles: TODOS, movil: true },
  { a: '/combustible', texto: 'Combustible', Icono: Fuel, roles: ['superusuario', 'flota', 'consulta'] },
  { a: '/mantenimiento', texto: 'Mantenimiento', Icono: Wrench, roles: ['superusuario', 'flota', 'consulta'] },
  { a: '/revision', texto: 'Revisión', Icono: ClipboardCheck, roles: OFICINA, movil: true },
  { a: '/catalogos', texto: 'Catálogos', Icono: Settings, roles: OFICINA },
  { a: '/usuarios', texto: 'Usuarios', Icono: Users, roles: OFICINA },
];

const TIPOS_BANDEJA = ['gasto_pendiente', 'revisar', 'ruta_abierta', 'viaje_incompleto', 'km_sin_ruta'];

function usePendientesRevision(activo: boolean) {
  return useQuery({
    queryKey: ['revision', 'conteo'],
    enabled: activo,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase.from('v_alertas').select('*', { count: 'exact', head: true }).in('tipo', TIPOS_BANDEJA);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

const ICONO_TEMA: Record<Tema, typeof Sun> = { claro: Sun, oscuro: Moon, sistema: Monitor };
const SIGUIENTE_TEMA: Record<Tema, Tema> = { sistema: 'claro', claro: 'oscuro', oscuro: 'sistema' };
const NOMBRE_TEMA: Record<Tema, string> = { sistema: 'Tema del sistema', claro: 'Tema claro', oscuro: 'Tema oscuro' };

export function DisenoOficina() {
  const { rol, perfil, esOficina, salir } = useSesion();
  const enLinea = useEnLinea();
  const [tema, setTema] = useTema();
  const [mas, setMas] = useState(false);
  const navegar = useNavigate();
  const { data: pendientes } = usePendientesRevision(esOficina);
  const items = ITEMS.filter((i) => rol && i.roles.includes(rol));
  const enBarra = items.filter((i) => i.movil).slice(0, 4);
  const resto = items.filter((i) => !enBarra.includes(i));
  const IconoTema = ICONO_TEMA[tema];

  const enlace = (i: Item, compacto = false) => (
    <NavLink
      key={i.a}
      to={i.a}
      end={i.a === '/cabina'}
      className={({ isActive }) =>
        compacto
          ? `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold ${isActive ? 'text-via-acento' : 'text-tinta-2'}`
          : `flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-semibold transition-colors ${
              isActive ? 'bg-via-fuerte text-via-tinta shadow-[inset_0_0_0_2px_rgb(255_255_255/0.85)]' : 'text-via-tinta/90 hover:bg-via-fuerte'
            }`
      }
    >
      <i.Icono aria-hidden className={compacto ? 'size-6' : 'size-5'} />
      <span className="truncate">{compacto ? i.texto.replace('Camiones y plantas', 'Unidades') : i.texto}</span>
      {i.a === '/revision' && (pendientes ?? 0) > 0 && (
        <span className={`cifra rounded-md bg-alerta px-1.5 text-xs font-extrabold text-alerta-tinta ${compacto ? '' : 'ml-auto'}`}>
          {pendientes}
          <span className="sr-only"> por revisar</span>
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-superficie focus:p-3">
        Saltar al contenido
      </a>
      {/* Barra lateral (escritorio) */}
      <div className="hidden bg-via md:block">
      <aside className="sticky top-0 flex h-dvh flex-col bg-via text-via-tinta">
        <div className="px-5 pb-4 pt-5">
          <p className="text-xl font-black leading-none">Flota IP</p>
          <p className="mt-1 text-sm opacity-90">Distribuidora y Suministros IP</p>
        </div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {items.map((i) => enlace(i))}
        </nav>
        <div className="flex flex-col gap-1 border-t border-white/25 px-3 py-3">
          {!enLinea && (
            <p className="flex items-center gap-2 rounded-lg bg-tinta px-3 py-2 text-sm font-semibold text-superficie">
              <CloudOff aria-hidden className="size-4" /> Sin conexión
            </p>
          )}
          <NavLink to="/cuenta" className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-via-fuerte">
            <UserRound aria-hidden className="size-5" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{perfil?.nombre}</span>
              <span className="block text-xs opacity-90">{rol ? NOMBRE_ROL[rol] : ''}</span>
            </span>
          </NavLink>
          <button type="button" onClick={() => setTema(SIGUIENTE_TEMA[tema])} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-via-fuerte">
            <IconoTema aria-hidden className="size-5" /> {NOMBRE_TEMA[tema]}
          </button>
          <button type="button" onClick={() => void salir()} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-via-fuerte">
            <LogOut aria-hidden className="size-5" /> Salir
          </button>
        </div>
      </aside>
      </div>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <AvisoActualizacion />
        {/* Barra superior (teléfono) */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-via px-4 py-2 text-via-tinta md:hidden">
          <p className="text-lg font-black">Flota IP</p>
          {!enLinea && (
            <span className="flex items-center gap-1 text-sm font-semibold">
              <CloudOff aria-hidden className="size-4" /> Sin conexión
            </span>
          )}
        </header>
        <main id="contenido" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
          <Outlet />
        </main>
        {/* Barra inferior (teléfono) */}
        <nav aria-label="Principal" className="zona-segura-abajo fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-linea bg-superficie md:hidden">
          {enBarra.map((i) => enlace(i, true))}
          <button type="button" onClick={() => setMas(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold text-tinta-2">
            <Menu aria-hidden className="size-6" />
            Más
          </button>
        </nav>
        <Hoja abierta={mas} alCerrar={() => setMas(false)} titulo="Más opciones">
          <nav className="flex flex-col gap-2" aria-label="Más opciones">
            {resto.map((i) => (
              <button
                key={i.a}
                type="button"
                onClick={() => {
                  setMas(false);
                  navegar(i.a);
                }}
                className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-linea px-4 text-lg font-bold hover:bg-superficie-2"
              >
                <i.Icono aria-hidden className="size-6" /> {i.texto}
              </button>
            ))}
            <button type="button" onClick={() => { setMas(false); navegar('/cuenta'); }} className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-linea px-4 text-lg font-bold hover:bg-superficie-2">
              <UserRound aria-hidden className="size-6" /> Mi cuenta
            </button>
            <button type="button" onClick={() => setTema(SIGUIENTE_TEMA[tema])} className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-linea px-4 text-lg font-bold hover:bg-superficie-2">
              <IconoTema aria-hidden className="size-6" /> {NOMBRE_TEMA[tema]}
            </button>
            <button type="button" onClick={() => void salir()} className="flex min-h-14 items-center gap-3 rounded-lg px-4 text-lg font-bold hover:bg-superficie-2">
              <LogOut aria-hidden className="size-6" /> Salir
            </button>
          </nav>
        </Hoja>
      </div>
    </div>
  );
}
