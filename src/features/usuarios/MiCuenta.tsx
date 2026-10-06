import { useState, type FormEvent } from 'react';
import { LogOut } from 'lucide-react';
import { useAvisos } from '@/components/avisos';
import { Boton, BotonEnlace, Campo, Entrada, EntradaNumero, Segmentado } from '@/components/controles';
import { Dato, MensajeError } from '@/components/datos';
import { EncabezadoPagina, Panel, Seccion } from '@/components/estructura';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { useTema, type Tema } from '@/lib/ganchos';
import { NOMBRE_ROL, useSesion } from '@/lib/sesion';
import { esCorreoSintetico, supabase } from '@/lib/supabase';

export function MiCuenta() {
  const { perfil, rol, esChofer, salir } = useSesion();
  const [tema, setTema] = useTema();
  const avisos = useAvisos();
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = async (e: FormEvent) => {
    e.preventDefault();
    if (esChofer ? !/^\d{6}$/.test(clave) : clave.length < 8) {
      return setError({ mensaje: esChofer ? 'El PIN debe tener 6 dígitos.' : 'La contraseña debe tener al menos 8 caracteres.', deRed: false, rechazado: true });
    }
    if (clave !== repetir) return setError({ mensaje: 'Los dos valores no coinciden.', deRed: false, rechazado: true });
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (err) return setError(traducirError(err));
    setClave('');
    setRepetir('');
    avisos.ok(esChofer ? 'PIN cambiado' : 'Contraseña cambiada');
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <EncabezadoPagina
        titulo="Mi cuenta"
        volver={esChofer ? { a: '/cabina', texto: 'Mi cabina' } : undefined}
        acciones={esChofer && <BotonEnlace to="/cabina" variante="principal">Ir a mi cabina</BotonEnlace>}
      />
      <Panel className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Dato etiqueta="Nombre">{perfil?.nombre}</Dato>
        <Dato etiqueta="Usuario">{perfil?.usuario ?? '—'}</Dato>
        <Dato etiqueta="Rol">{rol ? NOMBRE_ROL[rol] : '—'}</Dato>
        {!esCorreoSintetico(perfil?.correo) && <Dato etiqueta="Correo">{perfil?.correo ?? '—'}</Dato>}
      </Panel>

      <Seccion titulo={esChofer ? 'Cambiar mi PIN' : 'Cambiar mi contraseña'}>
        <form onSubmit={cambiar} noValidate className="grid gap-4 rounded-xl border-2 border-linea bg-superficie p-4 md:grid-cols-2">
          <Campo etiqueta={esChofer ? 'PIN nuevo (6 dígitos)' : 'Contraseña nueva'}>
            {(p) => (esChofer
              ? <EntradaNumero {...p} value={clave} onChange={(e) => setClave(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="new-password" />
              : <Entrada {...p} type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" />)}
          </Campo>
          <Campo etiqueta="Repítelo">
            {(p) => (esChofer
              ? <EntradaNumero {...p} value={repetir} onChange={(e) => setRepetir(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="new-password" />
              : <Entrada {...p} type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />)}
          </Campo>
          {error && <MensajeError error={error} className="md:col-span-2" />}
          <div className="md:col-span-2">
            <Boton type="submit" variante="principal" cargando={enviando}>{esChofer ? 'Cambiar PIN' : 'Cambiar contraseña'}</Boton>
          </div>
        </form>
      </Seccion>

      <Seccion titulo="Apariencia">
        <div className="max-w-md">
          <Segmentado<Tema>
            etiqueta="Tema"
            valor={tema}
            alCambiar={setTema}
            opciones={[
              { valor: 'claro', etiqueta: 'Claro', detalle: 'mejor al sol' },
              { valor: 'oscuro', etiqueta: 'Oscuro' },
              { valor: 'sistema', etiqueta: 'Del teléfono' },
            ]}
          />
        </div>
      </Seccion>

      <div>
        <Boton variante="fantasma" icono={<LogOut aria-hidden className="size-5" />} onClick={() => void salir()}>Salir de Flota IP</Boton>
      </div>
    </div>
  );
}
