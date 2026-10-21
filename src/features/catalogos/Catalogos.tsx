import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAvisos } from '@/components/avisos';
import { Boton, Campo, Casilla, Entrada, EntradaNumero, Seleccion } from '@/components/controles';
import { EstadoVacio, Etiqueta, MensajeError } from '@/components/datos';
import { EncabezadoPagina, Panel, Pestanas } from '@/components/estructura';
import { Hoja } from '@/components/hoja';
import { Tabla, type Columna } from '@/components/tabla';
import { rpc, type Categoria, type Configuracion, type Precio, type TasaBcv, type Ubicacion } from '@/lib/api';
import type { TablesUpdate } from '@/lib/database.types';
import { exigir, traducirError, type ErrorApp } from '@/lib/errores';
import { fecha, fechaHora, hoyIso, leerNumero, num, tasa } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';

const ESTADOS_VE = ['Trujillo', 'Mérida', 'Zulia', 'Lara', 'Táchira', 'Falcón', 'Portuguesa', 'Barinas', 'Carabobo', 'Distrito Capital', 'Otro'];
const TIPOS_UBICACION: Record<string, string> = { sede: 'Sede', almacen: 'Almacén', cliente: 'Cliente o destino', taller: 'Taller', estacion: 'Estación', otro: 'Otro' };

function useGuardar() {
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ejecutar = async (fn: () => Promise<unknown>, ok: string, alTerminar?: () => void) => {
    setEnviando(true);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries();
      avisos.ok(ok);
      alTerminar?.();
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setEnviando(false);
    }
  };
  return { error, setError, enviando, ejecutar };
}

const lanzar = (r: { error: unknown }) => {
  if (r.error) throw r.error;
};

// ----- Ubicaciones ------------------------------------------------------------------------------
function Ubicaciones() {
  const consulta = useQuery({
    queryKey: ['ubicaciones', 'todas'],
    queryFn: async () => exigir(await supabase.from('ubicaciones').select('*').order('activo', { ascending: false }).order('nombre')) as Ubicacion[],
  });
  const [editando, setEditando] = useState<Ubicacion | 'nueva' | null>(null);
  const avisos = useAvisos();
  const columnas: Columna<Ubicacion>[] = [
    { id: 'nombre', titulo: 'Nombre', movil: 'principal', celda: (u) => <span className="font-bold">{u.nombre}</span>, orden: (u) => u.nombre, exportar: { valor: (u) => u.nombre } },
    { id: 'tipo', titulo: 'Tipo', celda: (u) => TIPOS_UBICACION[u.tipo] ?? u.tipo, movilCelda: (u) => TIPOS_UBICACION[u.tipo] ?? u.tipo, orden: (u) => u.tipo, exportar: { valor: (u) => u.tipo } },
    { id: 'estado', titulo: 'Estado', movilCelda: (u) => [u.municipio, u.estado_ve].filter(Boolean).join(', ') || '—', celda: (u) => u.estado_ve ?? '—', orden: (u) => u.estado_ve, exportar: { valor: (u) => u.estado_ve } },
    { id: 'municipio', titulo: 'Municipio', movil: 'oculta', celda: (u) => u.municipio ?? '—', orden: (u) => u.municipio, exportar: { valor: (u) => u.municipio } },
    { id: 'activo', titulo: 'Situación', movilCelda: (u) => (u.es_sistema ? <Etiqueta>Del sistema</Etiqueta> : u.activo ? null : <Etiqueta tono="alerta">Archivada</Etiqueta>), celda: (u) => (u.es_sistema ? <Etiqueta>Del sistema</Etiqueta> : u.activo ? 'Activa' : <Etiqueta tono="alerta">Archivada</Etiqueta>), exportar: { valor: (u) => (u.activo ? 'activa' : 'archivada') } },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-tinta-2">
        Los destinos que eligen los choferes. Toca una ubicación para editarla. Eliminar borra una ubicación sin uso; si ya tiene viajes, la archiva (deja de aparecer en las listas y el historial la conserva).
      </p>
      <Tabla
        filas={consulta.data ?? []}
        columnas={columnas}
        clave={(u) => u.id}
        cargando={consulta.isLoading}
        nombreExport="ubicaciones"
        alElegir={(u) => (u.es_sistema ? avisos.mostrar('"Otro" es del sistema: no se edita ni se elimina.') : setEditando(u))}
        acciones={<Boton variante="principal" tamano="sm" icono={<Plus aria-hidden className="size-4" />} onClick={() => setEditando('nueva')}>Nueva ubicación</Boton>}
        vacio={<EstadoVacio titulo="Aún no hay destinos">Agrega la sede y los destinos a los que van los camiones.</EstadoVacio>}
      />
      {editando && <FormUbicacion ubicacion={editando === 'nueva' ? null : editando} alCerrar={() => setEditando(null)} />}
    </div>
  );
}

function FormUbicacion({ ubicacion, alCerrar }: { ubicacion: Ubicacion | null; alCerrar: () => void }) {
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [nombre, setNombre] = useState(ubicacion?.nombre ?? '');
  const [tipo, setTipo] = useState(ubicacion?.tipo ?? 'cliente');
  const [estadoVe, setEstadoVe] = useState(ubicacion?.estado_ve ?? '');
  const [municipio, setMunicipio] = useState(ubicacion?.municipio ?? '');
  const g = useGuardar();
  const guardar = () => {
    if (!nombre.trim()) return g.setError({ mensaje: 'Escribe el nombre.', deRed: false, rechazado: true });
    const datos = { nombre: nombre.trim(), tipo, estado_ve: estadoVe || null, municipio: municipio.trim() || null };
    void g.ejecutar(
      async () => lanzar(ubicacion ? await supabase.from('ubicaciones').update(datos).eq('id', ubicacion.id) : await supabase.from('ubicaciones').insert(datos)),
      ubicacion ? 'Ubicación guardada' : 'Ubicación agregada',
      alCerrar,
    );
  };
  const eliminar = async (u: Ubicacion) => {
    g.setError(null);
    try {
      const r = await rpc('eliminar_ubicacion', { p_id: u.id });
      await qc.invalidateQueries();
      avisos.ok(r === 'archivada' ? `${u.nombre} tenía viajes: quedó archivada, no borrada` : `${u.nombre} eliminada`);
      alCerrar();
    } catch (e) {
      g.setError(traducirError(e));
    }
  };
  const reactivar = (u: Ubicacion) =>
    void g.ejecutar(async () => lanzar(await supabase.from('ubicaciones').update({ activo: true }).eq('id', u.id)), `${u.nombre} reactivada`, alCerrar);
  return (
    <Hoja abierta alCerrar={alCerrar} titulo={ubicacion ? 'Editar ubicación' : 'Nueva ubicación'}
      pie={
        <>
          {ubicacion && (ubicacion.activo ? (
            <Boton variante="fantasma" className="mr-auto text-peligro" icono={<Trash2 aria-hidden className="size-4" />} onClick={() => void eliminar(ubicacion)}>Eliminar</Boton>
          ) : (
            <Boton variante="fantasma" className="mr-auto" icono={<ArchiveRestore aria-hidden className="size-4" />} onClick={() => reactivar(ubicacion)}>Reactivar</Boton>
          ))}
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={g.enviando} onClick={guardar}>Guardar</Boton>
        </>
      }>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre" ayuda='Como lo dicen los choferes: "Valera", "Supermercado El Lago".'>{(p) => <Entrada {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />}</Campo>
        <Campo etiqueta="Tipo">
          {(p) => (
            <Seleccion {...p} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPOS_UBICACION).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Estado" opcional>
          {(p) => (
            <Seleccion {...p} value={estadoVe} onChange={(e) => setEstadoVe(e.target.value)}>
              <option value="">Sin indicar</option>
              {ESTADOS_VE.map((e) => <option key={e} value={e}>{e}</option>)}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Municipio" opcional ayuda="Distingue dos lugares con el mismo nombre.">{(p) => <Entrada {...p} value={municipio} onChange={(e) => setMunicipio(e.target.value)} />}</Campo>
        {g.error && <MensajeError error={g.error} />}
      </div>
    </Hoja>
  );
}

// ----- Precios ------------------------------------------------------------------------------------
function Precios() {
  const consulta = useQuery({ queryKey: ['precios', 'todos'], queryFn: async () => exigir(await supabase.from('precios_combustible').select('*').order('orden')) as Precio[] });
  const [editando, setEditando] = useState<Precio | 'nuevo' | null>(null);
  const columnas: Columna<Precio>[] = [
    { id: 'etiqueta', titulo: 'Etiqueta', movil: 'principal', celda: (p) => <span className="font-bold">{p.etiqueta}</span>, exportar: { valor: (p) => p.etiqueta } },
    { id: 'precio', titulo: 'USD por litro', alinear: 'der', movil: 'derecha', movilCelda: (p) => `$ ${num(p.precio_usd_litro, 3)}/L`, celda: (p) => num(p.precio_usd_litro, 3), exportar: { valor: (p) => p.precio_usd_litro, tipo: 'decimal' } },
    { id: 'orden', titulo: 'Orden', alinear: 'der', celda: (p) => num(p.orden) },
    { id: 'activo', titulo: 'Situación', celda: (p) => (p.activo ? 'Activo' : <Etiqueta>Inactivo</Etiqueta>) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-tinta-2">Los botones de precio que ve el chofer al repostar. Cada carga guarda una copia del precio: cambiarlo aquí no altera cargas pasadas. Toca un precio para editarlo.</p>
      <Tabla filas={consulta.data ?? []} columnas={columnas} clave={(p) => p.id} cargando={consulta.isLoading} nombreExport="precios" alElegir={setEditando}
        acciones={<Boton variante="principal" tamano="sm" icono={<Plus aria-hidden className="size-4" />} onClick={() => setEditando('nuevo')}>Nuevo precio</Boton>}
        vacio={<EstadoVacio titulo="Sin precios" />} />
      {editando && <FormPrecio precio={editando === 'nuevo' ? null : editando} alCerrar={() => setEditando(null)} />}
    </div>
  );
}

function FormPrecio({ precio, alCerrar }: { precio: Precio | null; alCerrar: () => void }) {
  const [valor, setValor] = useState(precio ? String(precio.precio_usd_litro).replace('.', ',') : '');
  const [etiqueta, setEtiqueta] = useState(precio?.etiqueta ?? '');
  const [orden, setOrden] = useState(String(precio?.orden ?? 1));
  const [activo, setActivo] = useState(precio?.activo ?? true);
  const g = useGuardar();
  const guardar = () => {
    const v = leerNumero(valor);
    if (v === null || v <= 0) return g.setError({ mensaje: 'Escribe un precio mayor que cero.', deRed: false, rechazado: true });
    const datos = { precio_usd_litro: v, etiqueta: etiqueta.trim() || `$${num(v, 2)}`, orden: Number(orden) || 0, activo };
    void g.ejecutar(async () => lanzar(precio ? await supabase.from('precios_combustible').update(datos).eq('id', precio.id) : await supabase.from('precios_combustible').insert(datos)), 'Precio guardado', alCerrar);
  };
  return (
    <Hoja abierta alCerrar={alCerrar} titulo={precio ? 'Editar precio' : 'Nuevo precio'}
      pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton variante="principal" cargando={g.enviando} onClick={guardar}>Guardar</Boton></>}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Precio en USD por litro">{(p) => <EntradaNumero {...p} unidad="$/L" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />}</Campo>
        <Campo etiqueta="Etiqueta del botón" opcional>{(p) => <Entrada {...p} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="$0,50" />}</Campo>
        <Campo etiqueta="Orden">{(p) => <EntradaNumero {...p} value={orden} onChange={(e) => setOrden(e.target.value)} />}</Campo>
        <Casilla etiqueta="Activo (se muestra al chofer)" checked={activo} onChange={setActivo} />
        {g.error && <MensajeError error={g.error} />}
      </div>
    </Hoja>
  );
}

// ----- Categorías ----------------------------------------------------------------------------------
function Categorias() {
  const consulta = useQuery({ queryKey: ['categorias', 'todas'], queryFn: async () => exigir(await supabase.from('categorias_mantenimiento').select('*').order('orden')) as Categoria[] });
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null);
  const columnas: Columna<Categoria>[] = [
    { id: 'nombre', titulo: 'Categoría', movil: 'principal', celda: (c) => <span className="font-bold">{c.nombre}</span>, exportar: { valor: (c) => c.nombre } },
    { id: 'orden', titulo: 'Orden', alinear: 'der', celda: (c) => num(c.orden) },
    { id: 'activo', titulo: 'Situación', celda: (c) => (c.activo ? 'Activa' : <Etiqueta>Inactiva</Etiqueta>) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-tinta-2">Categorías de gasto de mantenimiento. Se desactivan, nunca se borran, para no perder el historial. Toca una categoría para editarla.</p>
      <Tabla filas={consulta.data ?? []} columnas={columnas} clave={(c) => c.id} cargando={consulta.isLoading} nombreExport="categorias" alElegir={setEditando}
        acciones={<Boton variante="principal" tamano="sm" icono={<Plus aria-hidden className="size-4" />} onClick={() => setEditando('nueva')}>Nueva categoría</Boton>}
        vacio={<EstadoVacio titulo="Sin categorías" />} />
      {editando && <FormCategoria categoria={editando === 'nueva' ? null : editando} alCerrar={() => setEditando(null)} />}
    </div>
  );
}

function FormCategoria({ categoria, alCerrar }: { categoria: Categoria | null; alCerrar: () => void }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [orden, setOrden] = useState(String(categoria?.orden ?? 50));
  const [activo, setActivo] = useState(categoria?.activo ?? true);
  const g = useGuardar();
  const guardar = () => {
    if (!nombre.trim()) return g.setError({ mensaje: 'Escribe el nombre.', deRed: false, rechazado: true });
    const datos = { nombre: nombre.trim(), orden: Number(orden) || 0, activo };
    void g.ejecutar(async () => lanzar(categoria ? await supabase.from('categorias_mantenimiento').update(datos).eq('id', categoria.id) : await supabase.from('categorias_mantenimiento').insert(datos)), 'Categoría guardada', alCerrar);
  };
  return (
    <Hoja abierta alCerrar={alCerrar} titulo={categoria ? 'Editar categoría' : 'Nueva categoría'}
      pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton variante="principal" cargando={g.enviando} onClick={guardar}>Guardar</Boton></>}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre">{(p) => <Entrada {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />}</Campo>
        <Campo etiqueta="Orden">{(p) => <EntradaNumero {...p} value={orden} onChange={(e) => setOrden(e.target.value)} />}</Campo>
        <Casilla etiqueta="Activa (aparece en los formularios)" checked={activo} onChange={setActivo} />
        {g.error && <MensajeError error={g.error} />}
      </div>
    </Hoja>
  );
}

// ----- Tasas BCV -------------------------------------------------------------------------------------
function Tasas() {
  const consulta = useQuery({ queryKey: ['tasas'], queryFn: async () => exigir(await supabase.from('tasas_bcv').select('*').order('fecha', { ascending: false }).limit(90)) as TasaBcv[] });
  const [manual, setManual] = useState(false);
  const g = useGuardar();
  const consultar = () =>
    void g.ejecutar(async () => {
      const { data, error } = await supabase.functions.invoke('tasa-bcv', { body: {} });
      if (error) {
        const cuerpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(cuerpo?.error ?? 'No se pudo consultar la tasa BCV. Escríbela a mano.');
      }
      return data;
    }, 'Tasa BCV actualizada');
  const columnas: Columna<TasaBcv>[] = [
    { id: 'fecha', titulo: 'Fecha', movil: 'principal', celda: (t) => <span className="font-bold">{fecha(t.fecha)}</span>, orden: (t) => t.fecha, exportar: { valor: (t) => t.fecha, tipo: 'fecha' } },
    { id: 'tasa', titulo: 'Bs por USD', alinear: 'der', movil: 'derecha', movilCelda: (t) => tasa(t.bs_por_usd), celda: (t) => num(t.bs_por_usd, 4), orden: (t) => Number(t.bs_por_usd), exportar: { valor: (t) => t.bs_por_usd, tipo: 'decimal', titulo: 'Bs por USD' } },
    { id: 'fuente', titulo: 'Fuente', celda: (t) => (t.manual ? <Etiqueta>Manual</Etiqueta> : t.fuente), exportar: { valor: (t) => t.fuente } },
    { id: 'capturada', titulo: 'Registrada', movil: 'oculta', celda: (t) => fechaHora(t.capturada_at) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-tinta-2">
        La tasa oficial se consulta sola en días hábiles (ve.dolarapi.com). Si la consulta falla, o una factura usa otra tasa, se escribe a mano.
      </p>
      {g.error && <MensajeError error={g.error} />}
      <Tabla filas={consulta.data ?? []} columnas={columnas} clave={(t) => t.fecha} cargando={consulta.isLoading} nombreExport="tasas-bcv"
        acciones={
          <>
            <Boton tamano="sm" icono={<RefreshCw aria-hidden className="size-4" />} cargando={g.enviando} onClick={consultar}>Consultar BCV ahora</Boton>
            <Boton variante="principal" tamano="sm" icono={<Plus aria-hidden className="size-4" />} onClick={() => setManual(true)}>Tasa manual</Boton>
          </>
        }
        vacio={<EstadoVacio titulo="Aún no hay tasas" />} />
      {manual && <FormTasa alCerrar={() => setManual(false)} />}
    </div>
  );
}

function FormTasa({ alCerrar }: { alCerrar: () => void }) {
  const [dia, setDia] = useState(hoyIso());
  const [valor, setValor] = useState('');
  const g = useGuardar();
  const guardar = () => {
    const v = leerNumero(valor);
    if (v === null || v <= 0) return g.setError({ mensaje: 'Escribe la tasa (mayor que cero).', deRed: false, rechazado: true });
    void g.ejecutar(async () => lanzar(await supabase.from('tasas_bcv').upsert({ fecha: dia, bs_por_usd: v, fuente: 'manual', manual: true }, { onConflict: 'fecha' })), 'Tasa guardada', alCerrar);
  };
  return (
    <Hoja abierta alCerrar={alCerrar} titulo="Tasa manual"
      pie={<><Boton onClick={alCerrar}>Cancelar</Boton><Boton variante="principal" cargando={g.enviando} onClick={guardar}>Guardar</Boton></>}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Fecha">{(p) => <Entrada {...p} type="date" max={hoyIso()} value={dia} onChange={(e) => setDia(e.target.value)} />}</Campo>
        <Campo etiqueta="Bs por USD">{(p) => <EntradaNumero {...p} unidad="Bs/$" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />}</Campo>
        {g.error && <MensajeError error={g.error} />}
      </div>
    </Hoja>
  );
}

// ----- Configuración ------------------------------------------------------------------------------------
const UMBRALES: { clave: keyof Configuracion; etiqueta: string; unidad: string; ayuda: string }[] = [
  { clave: 'umbral_consumo_anomalo_pct', etiqueta: 'Consumo anómalo', unidad: '%', ayuda: 'Un viaje este porcentaje peor que el promedio de 90 días del camión.' },
  { clave: 'min_viajes_promedio', etiqueta: 'Viajes mínimos para el promedio', unidad: 'viajes', ayuda: 'Sin esa cantidad de viajes previos no se evalúa el consumo anómalo.' },
  { clave: 'umbral_ruta_abierta_h', etiqueta: 'Ruta abierta mucho tiempo', unidad: 'h', ayuda: 'Horas en curso antes de avisar.' },
  { clave: 'umbral_km_sin_ruta', etiqueta: 'Km sin ruta', unidad: 'km', ayuda: 'Salto del tablero entre una llegada y la siguiente salida.' },
  { clave: 'umbral_divergencia_pct', etiqueta: 'Divergencia viajes vs. ciclos', unidad: '%', ayuda: 'Diferencia mensual que dispara la alerta.' },
  { clave: 'tolerancia_heredado_km', etiqueta: 'Tolerancia del nivel heredado', unidad: 'km', ayuda: 'Distancia máxima al último lleno para proponer "Tanque lleno".' },
  { clave: 'viaje_max_km', etiqueta: 'Viaje largo: km', unidad: 'km', ayuda: 'Por encima se pide confirmar al finalizar.' },
  { clave: 'viaje_max_h', etiqueta: 'Viaje largo: horas', unidad: 'h', ayuda: 'Por encima se pide confirmar al finalizar.' },
  { clave: 'ventana_correccion_min', etiqueta: 'Ventana de corrección del chofer', unidad: 'min', ayuda: 'Tiempo en que el chofer puede corregir o deshacer lo suyo.' },
];

function ConfiguracionUmbrales() {
  const { esSuper } = useSesion();
  const consulta = useQuery({ queryKey: ['configuracion'], queryFn: async () => (await supabase.from('configuracion').select('*').maybeSingle()).data as Configuracion | null });
  const [valores, setValores] = useState<Record<string, string> | null>(null);
  const g = useGuardar();
  const cfg = consulta.data;
  if (!cfg) return null;
  const actuales = valores ?? Object.fromEntries(UMBRALES.map((u) => [u.clave, String(cfg[u.clave]).replace('.', ',')]));
  const guardar = () => {
    const datos: TablesUpdate<'configuracion'> = {};
    for (const u of UMBRALES) {
      const n = leerNumero(actuales[u.clave]);
      if (n === null || n < 0) return g.setError({ mensaje: `Revisa "${u.etiqueta}".`, deRed: false, rechazado: true });
      (datos as Record<string, number>)[u.clave] = n;
    }
    void g.ejecutar(async () => lanzar(await supabase.from('configuracion').update(datos).eq('id', true)), 'Configuración guardada', () => setValores(null));
  };
  return (
    <Panel className="flex flex-col gap-4">
      <p className="text-base text-tinta-2">{esSuper ? 'Reglas de las alertas y validaciones. Los cambios quedan en la auditoría.' : 'Solo el superusuario cambia estas reglas.'}</p>
      <div className="grid gap-4 md:grid-cols-3">
        {UMBRALES.map((u) => (
          <Campo key={u.clave} etiqueta={u.etiqueta} ayuda={u.ayuda}>
            {(p) => <EntradaNumero {...p} unidad={u.unidad} value={actuales[u.clave]} disabled={!esSuper} onChange={(e) => setValores({ ...actuales, [u.clave]: e.target.value })} />}
          </Campo>
        ))}
      </div>
      {g.error && <MensajeError error={g.error} />}
      {esSuper && <div className="flex justify-end"><Boton variante="principal" cargando={g.enviando} onClick={guardar}>Guardar configuración</Boton></div>}
    </Panel>
  );
}

export function Catalogos() {
  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Catálogos" descripcion="Listas que usan los formularios. Se desactivan en vez de borrarse, para no perder el historial." />
      <Pestanas
        pestanas={[
          { id: 'ubicaciones', titulo: 'Ubicaciones', contenido: () => <Ubicaciones /> },
          { id: 'precios', titulo: 'Precios por litro', contenido: () => <Precios /> },
          { id: 'categorias', titulo: 'Categorías', contenido: () => <Categorias /> },
          { id: 'tasas', titulo: 'Tasa BCV', contenido: () => <Tasas /> },
          { id: 'configuracion', titulo: 'Configuración', contenido: () => <ConfiguracionUmbrales /> },
        ]}
      />
    </div>
  );
}
