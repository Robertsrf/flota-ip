import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { Boton, Campo, Entrada } from '@/components/controles';
import { MensajeError } from '@/components/datos';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { useSesion } from '@/lib/sesion';
import { configurado, MODO_LOCAL } from '@/lib/supabase';

export function PaginaLogin() {
  const { sesion, perfil, cargando, entrar } = useSesion();
  const [params] = useSearchParams();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!cargando && sesion && perfil?.activo) return <Navigate to="/" replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !clave) {
      setError({ mensaje: 'Escribe tu usuario y tu PIN o contraseña.', deRed: false, rechazado: true });
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await entrar(usuario, clave);
    } catch (err) {
      const t = traducirError(err);
      setError(err instanceof Error && err.message.startsWith('Demasiados') ? { ...t, mensaje: err.message } : t);
    } finally {
      setEnviando(false);
    }
  };

  const inactivo = params.get('inactivo') === '1' || (sesion && perfil && !perfil.activo);

  return (
    <main className="flex min-h-dvh flex-col bg-fondo md:items-center md:justify-center md:p-6">
      <div className="flex w-full flex-1 flex-col md:max-w-md md:flex-none md:overflow-hidden md:rounded-2xl md:border-2 md:border-linea md:bg-superficie">
        <div className="panel-senal px-6 pb-8 pt-10 md:rounded-none">
          <h1 className="text-5xl font-black leading-none">Flota IP</h1>
          <p className="mt-4 text-base font-semibold">Rutas, combustible y mantenimiento de la flota de Distribuidora y Suministros IP</p>
        </div>
        <form onSubmit={enviar} noValidate className="flex flex-1 flex-col gap-5 bg-superficie px-6 py-7">
          {!configurado && (
            <MensajeError
              error={{ mensaje: 'Falta configurar la conexión con Supabase.', ayuda: 'Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.', deRed: false, rechazado: true }}
            />
          )}
          {inactivo && (
            <MensajeError error={{ mensaje: 'Tu usuario está desactivado.', ayuda: 'Habla con flota o con el superusuario.', deRed: false, rechazado: true }} />
          )}
          <Campo etiqueta="Usuario" ayuda="Tu usuario (por ejemplo, pedro.rivas) o tu correo.">
            {(p) => (
              <Entrada
                {...p}
                grande
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
              />
            )}
          </Campo>
          <Campo etiqueta="PIN o contraseña">
            {(p) => (
              <div className="relative">
                <Entrada
                  {...p}
                  grande
                  type={ver ? 'text' : 'password'}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  className="pr-14"
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  aria-label={ver ? 'Ocultar PIN' : 'Mostrar PIN'}
                  aria-pressed={ver}
                  className="absolute inset-y-0 right-1 my-auto grid size-12 place-items-center rounded-lg text-tinta-2 hover:bg-superficie-2"
                >
                  {ver ? <EyeOff aria-hidden className="size-6" /> : <Eye aria-hidden className="size-6" />}
                </button>
              </div>
            )}
          </Campo>
          {error && <MensajeError error={error} />}
          <Boton type="submit" variante="principal" tamano="xl" bloque cargando={enviando}>
            Entrar
          </Boton>
          <p className="text-base text-tinta-2">¿Olvidaste tu PIN? Pídele a flota que te lo restablezca.</p>
          {MODO_LOCAL && (
            <div className="rounded-xl border-2 border-dashed border-linea-fuerte p-4 text-sm text-tinta-2">
              <p className="font-bold text-tinta">Servidor local de prueba</p>
              <p className="mt-1">demo.super, demo.flota o demo.gerencia con la clave demo1234; demo.pedro, demo.luis o demo.carlos con el PIN 123456.</p>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
