import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import { useAvisos } from '@/components/avisos';
import { Boton, Campo, Casilla, Entrada, EntradaNumero, Seleccion } from '@/components/controles';
import { AvisoAlerta, EstadoVacio, Etiqueta, MensajeError } from '@/components/datos';
import { EncabezadoPagina } from '@/components/estructura';
import { Hoja } from '@/components/hoja';
import { Tabla, type Columna } from '@/components/tabla';
import type { PerfilFila } from '@/lib/api';
import { exigir, traducirError, type ErrorApp } from '@/lib/errores';
import { NOMBRE_ROL, useSesion, type Rol } from '@/lib/sesion';
import { esCorreoSintetico, supabase } from '@/lib/supabase';

async function adminUsuarios(cuerpo: Record<string, unknown>): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: cuerpo });
  if (error) {
    const r = (error as { context?: Response }).context;
    const detalle = r ? await r.json().catch(() => null) : null;
    throw new Error(detalle?.error ?? 'No se pudo completar la operación.');
  }
  return data as { id: string };
}

const pinAleatorio = () => String(Math.floor(100000 + Math.random() * 900000));

function validarClave(rol: Rol, clave: string): string | null {
  if (rol === 'chofer') return /^\d{6}$/.test(clave) ? null : 'El PIN del chofer debe tener 6 dígitos.';
  return clave.length >= 8 ? null : 'La contraseña debe tener al menos 8 caracteres.';
}

export function Usuarios() {
  const { esSuper, perfil } = useSesion();
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<PerfilFila | null>(null);
  const [clave, setClave] = useState<PerfilFila | null>(null);
  const consulta = useQuery({
    queryKey: ['perfiles', 'todos'],
    queryFn: async () => exigir(await supabase.from('perfiles').select('*').order('activo', { ascending: false }).order('rol').order('nombre')) as PerfilFila[],
  });
  const puedeGestionar = (p: PerfilFila) => esSuper || p.rol === 'chofer';

  const columnas: Columna<PerfilFila>[] = [
    { id: 'nombre', titulo: 'Nombre', movil: 'principal', celda: (p) => <span className="font-bold">{p.nombre}</span>, orden: (p) => p.nombre, exportar: { valor: (p) => p.nombre } },
    { id: 'usuario', titulo: 'Usuario', celda: (p) => p.usuario ?? '—', orden: (p) => p.usuario, exportar: { valor: (p) => p.usuario } },
    { id: 'correo', titulo: 'Correo', movil: 'oculta', celda: (p) => (esCorreoSintetico(p.correo) ? '—' : (p.correo ?? '—')), exportar: { valor: (p) => (esCorreoSintetico(p.correo) ? '' : p.correo) } },
    { id: 'rol', titulo: 'Rol', celda: (p) => NOMBRE_ROL[p.rol], orden: (p) => p.rol, exportar: { valor: (p) => p.rol } },
    { id: 'telefono', titulo: 'Teléfono', movil: 'oculta', celda: (p) => p.telefono ?? '—', exportar: { valor: (p) => p.telefono } },
    { id: 'activo', titulo: 'Situación', celda: (p) => (p.activo ? 'Activo' : <Etiqueta tono="peligro">Desactivado</Etiqueta>), orden: (p) => (p.activo ? 1 : 0), exportar: { valor: (p) => (p.activo ? 'activo' : 'desactivado') } },
    {
      id: 'acc', titulo: 'Acciones', movil: 'oculta',
      celda: (p) =>
        puedeGestionar(p) ? (
          <div className="flex gap-1">
            <Boton tamano="sm" variante="fantasma" icono={<Pencil aria-hidden className="size-4" />} onClick={() => setEditando(p)}>Editar</Boton>
            <Boton tamano="sm" variante="fantasma" icono={<KeyRound aria-hidden className="size-4" />} onClick={() => setClave(p)}>{p.rol === 'chofer' ? 'Nuevo PIN' : 'Nueva clave'}</Boton>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion={esSuper ? 'Choferes, flota, gerencia y superusuarios. Sin registro público: los usuarios se crean aquí.' : 'Flota puede dar de alta choferes y restablecer su PIN.'}
        acciones={<Boton variante="principal" icono={<Plus aria-hidden className="size-5" />} onClick={() => setNuevo(true)}>{esSuper ? 'Nuevo usuario' : 'Nuevo chofer'}</Boton>}
      />
      {consulta.error && <MensajeError error={traducirError(consulta.error)} />}
      <Tabla filas={consulta.data ?? []} columnas={columnas} clave={(p) => p.id} cargando={consulta.isLoading} nombreExport="usuarios"
        alElegir={(p) => puedeGestionar(p) && setEditando(p)} vacio={<EstadoVacio titulo="Sin usuarios" />} />
      {nuevo && <FormNuevo alCerrar={() => setNuevo(false)} />}
      {editando && <FormEditar p={editando} esYo={editando.id === perfil?.id} alCerrar={() => setEditando(null)} />}
      {clave && <FormClave p={clave} alCerrar={() => setClave(null)} />}
    </div>
  );
}

function useEnvio() {
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (cuerpo: Record<string, unknown>, ok: string) => {
    setEnviando(true);
    setError(null);
    try {
      await adminUsuarios(cuerpo);
      await qc.invalidateQueries({ queryKey: ['perfiles'] });
      avisos.ok(ok);
      return true;
    } catch (e) {
      setError({ mensaje: e instanceof Error ? e.message : 'No se pudo completar.', deRed: false, rechazado: true });
      return false;
    } finally {
      setEnviando(false);
    }
  };
  return { error, setError, enviando, enviar };
}

function FormNuevo({ alCerrar }: { alCerrar: () => void }) {
  const { esSuper } = useSesion();
  const [rol, setRol] = useState<Rol>('chofer');
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState(pinAleatorio);
  const [telefono, setTelefono] = useState('');
  const [creado, setCreado] = useState<{ usuario: string; clave: string } | null>(null);
  const e = useEnvio();

  const crear = async () => {
    if (!nombre.trim()) return e.setError({ mensaje: 'Escribe el nombre.', deRed: false, rechazado: true });
    if (!usuario.trim() && !correo.trim()) return e.setError({ mensaje: 'Indica un usuario o un correo.', deRed: false, rechazado: true });
    const errClave = validarClave(rol, clave);
    if (errClave) return e.setError({ mensaje: errClave, deRed: false, rechazado: true });
    const ok = await e.enviar({ accion: 'crear', nombre: nombre.trim(), usuario: usuario.trim().toLowerCase() || null, correo: correo.trim() || null, clave, rol, telefono: telefono.trim() || null }, 'Usuario creado');
    if (ok) setCreado({ usuario: usuario.trim().toLowerCase() || correo.trim(), clave });
  };

  if (creado) {
    return (
      <Hoja abierta alCerrar={alCerrar} titulo="Usuario creado" pie={<Boton variante="principal" onClick={alCerrar}>Listo</Boton>}>
        <AvisoAlerta titulo="Anota estos datos y entrégalos en persona">
          <p className="cifra mt-1 text-lg">Usuario: <b>{creado.usuario}</b></p>
          <p className="cifra text-lg">{rol === 'chofer' ? 'PIN' : 'Contraseña'}: <b>{creado.clave}</b></p>
          <p className="mt-2 text-sm">No se vuelven a mostrar. Si se pierden, se restablecen desde esta pantalla.</p>
        </AvisoAlerta>
      </Hoja>
    );
  }

  return (
    <Hoja abierta alCerrar={alCerrar} titulo={esSuper ? 'Nuevo usuario' : 'Nuevo chofer'}
      pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton variante="principal" cargando={e.enviando} onClick={() => void crear()}>Crear usuario</Boton></>}>
      <div className="flex flex-col gap-4">
        {esSuper && (
          <Campo etiqueta="Rol">
            {(p) => (
              <Seleccion {...p} value={rol} onChange={(x) => { const r = x.target.value as Rol; setRol(r); setClave(r === 'chofer' ? pinAleatorio() : ''); }}>
                <option value="chofer">Chofer: cabina, sus rutas, cargas y gastos</option>
                <option value="flota">Flota: administra unidades, gastos y revisión</option>
                <option value="consulta">Consulta: gerencia, solo lectura</option>
                <option value="superusuario">Superusuario: todo, incluidos usuarios y reglas</option>
              </Seleccion>
            )}
          </Campo>
        )}
        <Campo etiqueta="Nombre y apellido">{(p) => <Entrada {...p} value={nombre} onChange={(x) => setNombre(x.target.value)} autoFocus />}</Campo>
        <Campo etiqueta="Usuario" ayuda="Para entrar: minúsculas, números y punto. Ej.: pedro.rivas" opcional={rol !== 'chofer'}>
          {(p) => <Entrada {...p} value={usuario} onChange={(x) => setUsuario(x.target.value.toLowerCase().replace(/\s/g, '.'))} autoCapitalize="none" spellCheck={false} />}
        </Campo>
        {rol !== 'chofer' && <Campo etiqueta="Correo" opcional ayuda="Si lo indicas, también puede entrar con el correo.">{(p) => <Entrada {...p} type="email" value={correo} onChange={(x) => setCorreo(x.target.value)} />}</Campo>}
        <Campo etiqueta={rol === 'chofer' ? 'PIN de 6 dígitos' : 'Contraseña (mínimo 8 caracteres)'}>
          {(p) => (
            <div className="flex gap-2">
              {rol === 'chofer' ? (
                <EntradaNumero {...p} value={clave} onChange={(x) => setClave(x.target.value.replace(/\D/g, '').slice(0, 6))} className="flex-1" />
              ) : (
                <Entrada {...p} value={clave} onChange={(x) => setClave(x.target.value)} className="flex-1" />
              )}
              {rol === 'chofer' && <Boton onClick={() => setClave(pinAleatorio())}>Otro PIN</Boton>}
            </div>
          )}
        </Campo>
        <Campo etiqueta="Teléfono" opcional>{(p) => <Entrada {...p} type="tel" value={telefono} onChange={(x) => setTelefono(x.target.value)} />}</Campo>
        {e.error && <MensajeError error={e.error} />}
      </div>
    </Hoja>
  );
}

function FormEditar({ p, esYo, alCerrar }: { p: PerfilFila; esYo: boolean; alCerrar: () => void }) {
  const { esSuper } = useSesion();
  const [nombre, setNombre] = useState(p.nombre);
  const [telefono, setTelefono] = useState(p.telefono ?? '');
  const [rol, setRol] = useState<Rol>(p.rol);
  const [activo, setActivo] = useState(p.activo);
  const e = useEnvio();
  const guardar = async () => {
    const ok = await e.enviar(
      { accion: 'actualizar', id: p.id, nombre: nombre.trim(), telefono: telefono.trim() || null, ...(esSuper && !esYo ? { rol } : {}), ...(!esYo ? { activo } : {}) },
      'Usuario actualizado',
    );
    if (ok) alCerrar();
  };
  return (
    <Hoja abierta alCerrar={alCerrar} titulo={`Editar a ${p.nombre}`}
      pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton variante="principal" cargando={e.enviando} onClick={() => void guardar()}>Guardar</Boton></>}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre">{(x) => <Entrada {...x} value={nombre} onChange={(v) => setNombre(v.target.value)} />}</Campo>
        <Campo etiqueta="Teléfono" opcional>{(x) => <Entrada {...x} type="tel" value={telefono} onChange={(v) => setTelefono(v.target.value)} />}</Campo>
        {esSuper && !esYo && (
          <Campo etiqueta="Rol">
            {(x) => (
              <Seleccion {...x} value={rol} onChange={(v) => setRol(v.target.value as Rol)}>
                {(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
              </Seleccion>
            )}
          </Campo>
        )}
        {!esYo && <Casilla etiqueta="Activo (desactivado no puede entrar; su historial se conserva)" checked={activo} onChange={setActivo} />}
        {esYo && <p className="text-sm text-tinta-2">Tu propio rol y estado los cambia otro superusuario.</p>}
        {e.error && <MensajeError error={e.error} />}
      </div>
    </Hoja>
  );
}

function FormClave({ p, alCerrar }: { p: PerfilFila; alCerrar: () => void }) {
  const [clave, setClave] = useState(p.rol === 'chofer' ? pinAleatorio() : '');
  const [hecho, setHecho] = useState(false);
  const e = useEnvio();
  const guardar = async () => {
    const err = validarClave(p.rol, clave);
    if (err) return e.setError({ mensaje: err, deRed: false, rechazado: true });
    if (await e.enviar({ accion: 'clave', id: p.id, clave }, p.rol === 'chofer' ? 'PIN restablecido' : 'Contraseña restablecida')) setHecho(true);
  };
  return (
    <Hoja abierta alCerrar={alCerrar} titulo={p.rol === 'chofer' ? `Nuevo PIN para ${p.nombre}` : `Nueva contraseña para ${p.nombre}`}
      pie={hecho ? <Boton variante="principal" onClick={alCerrar}>Listo</Boton> : <><Boton onClick={alCerrar}>Cancelar</Boton><Boton variante="principal" cargando={e.enviando} onClick={() => void guardar()}>Guardar</Boton></>}>
      {hecho ? (
        <AvisoAlerta titulo="Entrégalo en persona">
          <p className="cifra text-lg">{p.rol === 'chofer' ? 'PIN' : 'Contraseña'}: <b>{clave}</b></p>
        </AvisoAlerta>
      ) : (
        <div className="flex flex-col gap-4">
          <Campo etiqueta={p.rol === 'chofer' ? 'PIN de 6 dígitos' : 'Contraseña (mínimo 8 caracteres)'}>
            {(x) => (p.rol === 'chofer'
              ? <EntradaNumero {...x} value={clave} onChange={(v) => setClave(v.target.value.replace(/\D/g, '').slice(0, 6))} />
              : <Entrada {...x} value={clave} onChange={(v) => setClave(v.target.value)} />)}
          </Campo>
          {e.error && <MensajeError error={e.error} />}
        </div>
      )}
    </Hoja>
  );
}
