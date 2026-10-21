import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCheck, FileText, Pencil, Plus, RefreshCw, Wrench } from 'lucide-react';
import { useAvisos } from '@/components/avisos';
import { AreaTexto, Boton, Campo, Casilla, Entrada, EntradaNumero, Segmentado, Seleccion } from '@/components/controles';
import { Cargando, EstadoVacio, Etiqueta, MensajeError, TableroKpis } from '@/components/datos';
import { CampoFoto, EncabezadoPagina, Pestanas, VerFoto } from '@/components/estructura';
import { Hoja } from '@/components/hoja';
import { rpc, type Documento, type Recordatorio, type Situacion } from '@/lib/api';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { comprimirFoto, rutaDocumento, subirArchivo } from '@/lib/fotos';
import { fecha, hoyIso, km as fKm, leerNumero, num } from '@/lib/formato';
import { NOMBRE_ROL, useSesion } from '@/lib/sesion';
import { useCategorias } from '@/features/cabina/datos';
import { etiquetaUnidad, useUnidadesLista } from '@/features/registros/datosComunes';
import { avanceServicio, estadoFecha, estadoServicio, frecuencia, useDocumentos, usePersonas, useRecordatorios } from './datos';

const SITUACION: Record<Situacion, { texto: string; tono: 'peligro' | 'alerta' | 'via' | 'neutro'; barra: string }> = {
  vencido: { texto: 'Vencido', tono: 'peligro', barra: 'bg-peligro' },
  pronto: { texto: 'Por vencer', tono: 'alerta', barra: 'bg-alerta' },
  al_dia: { texto: 'Al día', tono: 'via', barra: 'bg-via-acento' },
  archivado: { texto: 'Archivado', tono: 'neutro', barra: 'bg-linea-fuerte' },
};

const SERVICIOS_SUGERIDOS = ['Cambio de aceite', 'Filtros de aire y combustible', 'Rotación de cauchos', 'Frenos', 'Correa de tiempo', 'Servicio general', 'Servicio de la planta'];
const DOCUMENTOS_SUGERIDOS = ['Póliza RCV', 'Póliza de casco', 'Permiso de circulación', 'Revisión técnica', 'Licencia de conducir', 'Certificado médico'];

const sit = (s: string | null | undefined) => SITUACION[(s ?? 'al_dia') as Situacion] ?? SITUACION.al_dia;

function ChipSituacion({ situacion }: { situacion: string | null }) {
  const s = sit(situacion);
  return <Etiqueta tono={s.tono}>{s.texto}</Etiqueta>;
}

/** Fila de la lista: título, quién, estado en palabras, detalle y acciones */
function Fila({ situacion, titulo, titular, estado, avance, detalle, extra, acciones }: {
  situacion: string | null;
  titulo: string;
  titular: ReactNode;
  estado: string[];
  avance?: number;
  detalle: ReactNode;
  extra?: ReactNode;
  acciones?: ReactNode;
}) {
  const s = sit(situacion);
  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 bg-superficie p-4 lg:flex-row lg:items-center ${situacion === 'vencido' ? 'border-peligro' : 'border-linea'}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <ChipSituacion situacion={situacion} />
          <span className="text-lg font-extrabold leading-tight">{titulo}</span>
        </div>
        <p className="text-base font-semibold">{titular}</p>
        {estado.map((e) => (
          <p key={e} className={`cifra text-base ${/^(Se pasó|Tocaba|Venció)/.test(e) ? 'font-bold text-peligro' : ''}`}>{e}</p>
        ))}
        {avance !== undefined && situacion !== 'archivado' && (
          <div aria-hidden className="mt-1 h-2 w-full max-w-md overflow-hidden rounded-full bg-superficie-2">
            <div className={`h-full rounded-full ${s.barra}`} style={{ width: `${Math.round(avance * 100)}%` }} />
          </div>
        )}
        <p className="cifra text-sm text-tinta-2">{detalle}</p>
        {extra}
      </div>
      {acciones && <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">{acciones}</div>}
    </li>
  );
}

// ----- Servicios ------------------------------------------------------------------------------------
export function ListaServicios({ filas, cargando, unidadFija, verUnidad = true }: {
  filas: Recordatorio[];
  cargando?: boolean;
  unidadFija?: string;
  verUnidad?: boolean;
}) {
  const { esOficina } = useSesion();
  const [archivados, setArchivados] = useState(false);
  const [editando, setEditando] = useState<Recordatorio | 'nuevo' | null>(null);
  const [hecho, setHecho] = useState<Recordatorio | null>(null);
  const visibles = filas.filter((r) => archivados || r.activo);
  const hayArchivados = filas.some((r) => !r.activo);

  if (cargando) return <Cargando />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-base text-tinta-2">
          Servicios que tocan cada tantos km o cada tantos días. Si tienen categoría, se marcan hechos solos cuando flota aprueba un gasto de esa categoría para la unidad.
        </p>
        {esOficina && (
          <Boton variante="principal" tamano="sm" icono={<Plus aria-hidden className="size-4" />} onClick={() => setEditando('nuevo')}>
            Nuevo servicio
          </Boton>
        )}
      </div>
      {visibles.length === 0 ? (
        <EstadoVacio titulo="Aún no hay servicios programados" icono={<Wrench aria-hidden className="size-6 text-tinta-2" />}>
          {esOficina
            ? 'Programa el cambio de aceite, los filtros o la rotación de cauchos: el sistema avisa cuando falta poco y cuando ya se pasó.'
            : 'Flota programa los servicios de cada unidad.'}
        </EstadoVacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((r) => (
            <Fila
              key={r.id}
              situacion={r.situacion}
              titulo={r.nombre ?? 'Servicio'}
              titular={verUnidad ? <Link to={`/unidades/${r.unidad_id}`} className="underline underline-offset-4">{r.unidad_nombre}</Link> : null}
              estado={r.activo ? estadoServicio(r) : ['Archivado: ya no avisa.']}
              avance={avanceServicio(r)}
              detalle={[
                frecuencia(r),
                `último el ${fecha(r.ultima_fecha)}${r.ultimo_km != null ? `, en el km ${num(r.ultimo_km)}` : ''}`,
                r.categoria_nombre ? `se cumple con un gasto de ${r.categoria_nombre}` : null,
              ].filter(Boolean).join(' • ')}
              extra={r.notas ? <p className="text-sm">{r.notas}</p> : undefined}
              acciones={
                esOficina && (
                  <>
                    {r.activo && (
                      <Boton variante="principal" tamano="sm" icono={<CheckCheck aria-hidden className="size-4" />} onClick={() => setHecho(r)}>
                        Marcar hecho
                      </Boton>
                    )}
                    <Boton tamano="sm" icono={<Pencil aria-hidden className="size-4" />} onClick={() => setEditando(r)}>Editar</Boton>
                  </>
                )
              }
            />
          ))}
        </ul>
      )}
      {hayArchivados && <Casilla etiqueta="Mostrar los archivados" checked={archivados} onChange={setArchivados} />}
      {editando && <FormServicio r={editando === 'nuevo' ? null : editando} unidadFija={unidadFija} alCerrar={() => setEditando(null)} />}
      {hecho && <FormHecho r={hecho} alCerrar={() => setHecho(null)} />}
    </div>
  );
}

function useEnvio() {
  const qc = useQueryClient();
  const avisos = useAvisos();
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (fn: () => Promise<unknown>, ok: string, alTerminar: () => void) => {
    setEnviando(true);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries();
      avisos.ok(ok);
      alTerminar();
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setEnviando(false);
    }
  };
  const fallar = (mensaje: string) => setError({ mensaje, deRed: false, rechazado: true });
  return { error, enviando, enviar, fallar };
}

/** Último km conocido de una unidad (para proponer el km del último servicio) */
function useLectura(unidad: string) {
  return useQuery({
    queryKey: ['lectura', unidad],
    enabled: Boolean(unidad),
    queryFn: async () => (await rpc('lectura_actual', { p_unidad: unidad })) as number | null,
  });
}

function FormServicio({ r, unidadFija, alCerrar }: { r: Recordatorio | null; unidadFija?: string; alCerrar: () => void }) {
  const { data: unidades = [] } = useUnidadesLista();
  const { data: categorias = [] } = useCategorias();
  const [unidadId, setUnidadId] = useState(r?.unidad_id ?? unidadFija ?? '');
  const [nombre, setNombre] = useState(r?.nombre ?? '');
  const [categoria, setCategoria] = useState(r?.categoria_id ?? '');
  const [cadaKm, setCadaKm] = useState(r?.cada_km != null ? String(r.cada_km) : '');
  const [cadaDias, setCadaDias] = useState(r?.cada_dias != null ? String(r.cada_dias) : '');
  const [avisoKm, setAvisoKm] = useState(String(r?.aviso_km ?? 500));
  const [avisoDias, setAvisoDias] = useState(String(r?.aviso_dias ?? 15));
  const [ultimoKmEscrito, setUltimoKm] = useState<string | null>(r?.ultimo_km != null ? String(Math.round(Number(r.ultimo_km))) : null);
  const [ultimaFecha, setUltimaFecha] = useState(r?.ultima_fecha ?? hoyIso());
  const [notas, setNotas] = useState(r?.notas ?? '');
  const [activo, setActivo] = useState(r?.activo ?? true);
  const e = useEnvio();
  const unidad = unidades.find((u) => u.id === unidadId);
  const sinMedidor = unidad?.medidor === 'ninguno';
  const { data: lectura } = useLectura(unidadId);
  const ultimoKm = ultimoKmEscrito ?? (lectura != null ? String(Math.round(Number(lectura))) : '');

  const guardar = () => {
    const km = sinMedidor ? null : leerNumero(cadaKm, 'entero');
    const dias = leerNumero(cadaDias, 'entero');
    const aKm = leerNumero(avisoKm, 'entero') ?? 0;
    const aDias = leerNumero(avisoDias, 'entero') ?? 0;
    if (!unidad) return e.fallar('Elige la unidad.');
    if (!nombre.trim()) return e.fallar('Escribe qué servicio es (por ejemplo, "Cambio de aceite").');
    if (km === null && dias === null) return e.fallar('Indica cada cuántos km o cada cuántos días toca.');
    if (km !== null && aKm >= km) return e.fallar(`El aviso (${num(aKm)} km antes) debe ser menor que la frecuencia (cada ${num(km)} km).`);
    if (dias !== null && aDias >= dias) return e.fallar(`El aviso (${aDias} días antes) debe ser menor que la frecuencia (cada ${dias} días).`);
    void e.enviar(
      () =>
        rpc('guardar_recordatorio', {
          p_id: r?.id ?? crypto.randomUUID(),
          p_unidad_id: unidad.id,
          p_nombre: nombre.trim(),
          p_categoria_id: categoria || null,
          p_cada_km: km,
          p_cada_dias: dias,
          p_aviso_km: aKm,
          p_aviso_dias: aDias,
          p_ultimo_km: km === null ? null : leerNumero(ultimoKm, 'entero'),
          p_ultima_fecha: ultimaFecha,
          p_notas: notas.trim() || null,
          p_activo: activo,
        }),
      r ? 'Servicio guardado' : 'Servicio programado',
      alCerrar,
    );
  };

  return (
    <Hoja
      abierta
      alCerrar={alCerrar}
      titulo={r ? `Editar: ${r.nombre}` : 'Programar un servicio'}
      descripcion="Llena los km, los días o los dos: avisa con lo que llegue primero."
      ancho="ancho"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={e.enviando} onClick={guardar}>{r ? 'Guardar' : 'Programar servicio'}</Boton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {!unidadFija && (
          <Campo etiqueta="Unidad">
            {(p) => (
              <Seleccion {...p} value={unidadId} onChange={(x) => { setUnidadId(x.target.value); setUltimoKm(null); }}>
                <option value="">Elige un camión o planta</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.tipo === 'planta' ? `Planta: ${u.alias}` : etiquetaUnidad(u)}</option>)}
              </Seleccion>
            )}
          </Campo>
        )}
        <Campo etiqueta="Servicio" ayuda="Escríbelo o elige uno de la lista.">
          {(p) => (
            <>
              <Entrada {...p} list="servicios-sugeridos" value={nombre} onChange={(x) => setNombre(x.target.value)} placeholder="Cambio de aceite" />
              <datalist id="servicios-sugeridos">{SERVICIOS_SUGERIDOS.map((s) => <option key={s} value={s} />)}</datalist>
            </>
          )}
        </Campo>
        <Campo etiqueta="Cada" ayuda={sinMedidor ? 'Esta unidad no tiene medidor: solo por días.' : undefined}>
          {(p) => <EntradaNumero {...p} unidad="km" value={sinMedidor ? '' : cadaKm} disabled={sinMedidor} onChange={(x) => setCadaKm(x.target.value)} placeholder="5.000" />}
        </Campo>
        <Campo etiqueta="O cada">
          {(p) => <EntradaNumero {...p} unidad="días" value={cadaDias} onChange={(x) => setCadaDias(x.target.value)} placeholder="120" />}
        </Campo>
        {!sinMedidor && (
          <Campo etiqueta="Avisar cuando falten">
            {(p) => <EntradaNumero {...p} unidad="km" value={avisoKm} onChange={(x) => setAvisoKm(x.target.value)} />}
          </Campo>
        )}
        <Campo etiqueta="Avisar cuántos días antes">
          {(p) => <EntradaNumero {...p} unidad="días" value={avisoDias} onChange={(x) => setAvisoDias(x.target.value)} />}
        </Campo>
        {!sinMedidor && (
          <Campo etiqueta="Km del último servicio" ayuda={lectura != null ? `Km actual de la unidad: ${fKm(lectura)}` : undefined}>
            {(p) => <EntradaNumero {...p} unidad="km" value={ultimoKm} onChange={(x) => setUltimoKm(x.target.value)} />}
          </Campo>
        )}
        <Campo etiqueta="Fecha del último servicio">
          {(p) => <Entrada {...p} type="date" max={hoyIso()} value={ultimaFecha} onChange={(x) => setUltimaFecha(x.target.value)} />}
        </Campo>
        <Campo etiqueta="Se cumple con un gasto de" opcional ayuda="Al aprobarse un gasto de esta categoría para la unidad, el servicio se marca hecho solo.">
          {(p) => (
            <Seleccion {...p} value={categoria} onChange={(x) => setCategoria(x.target.value)}>
              <option value="">Ninguna: lo marco a mano</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta="Notas" opcional className="md:col-span-2">
          {(p) => <AreaTexto {...p} rows={2} value={notas} onChange={(x) => setNotas(x.target.value)} placeholder="Aceite 15W-40, 18 litros" />}
        </Campo>
        {r && <Casilla etiqueta="Activo (desmárcalo para archivarlo: deja de avisar)" checked={activo} onChange={setActivo} />}
      </div>
      {e.error && <MensajeError error={e.error} className="mt-4" />}
    </Hoja>
  );
}

function FormHecho({ r, alCerrar }: { r: Recordatorio; alCerrar: () => void }) {
  const [dia, setDia] = useState(hoyIso());
  const [kmTexto, setKm] = useState(r.lectura_actual != null ? String(Math.round(Number(r.lectura_actual))) : '');
  const [nota, setNota] = useState('');
  const e = useEnvio();
  const guardar = () =>
    void e.enviar(
      () => rpc('marcar_servicio_hecho', { p_id: r.id!, p_fecha: dia, p_km: r.cada_km != null ? leerNumero(kmTexto, 'entero') : null, p_nota: nota.trim() || null }),
      `${r.nombre}: hecho`,
      alCerrar,
    );
  return (
    <Hoja
      abierta
      alCerrar={alCerrar}
      titulo={`Marcar hecho: ${r.nombre}`}
      descripcion={`${r.unidad_nombre}. El próximo se cuenta desde aquí.`}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={e.enviando} onClick={guardar}>Marcar hecho</Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Fecha en que se hizo">{(p) => <Entrada {...p} type="date" max={hoyIso()} value={dia} onChange={(x) => setDia(x.target.value)} />}</Campo>
        {r.cada_km != null && (
          <Campo etiqueta="Km del tablero ese día" ayuda={`Último km conocido: ${fKm(r.lectura_actual)}`}>
            {(p) => <EntradaNumero {...p} unidad="km" value={kmTexto} onChange={(x) => setKm(x.target.value)} />}
          </Campo>
        )}
        <Campo etiqueta="Nota" opcional ayuda="Queda en el historial de cambios.">
          {(p) => <AreaTexto {...p} rows={2} value={nota} onChange={(x) => setNota(x.target.value)} placeholder="Hecho en el taller de la sede" />}
        </Campo>
        {r.categoria_nombre && (
          <p className="text-sm text-tinta-2">Consejo: si registras el gasto de {r.categoria_nombre} de esta unidad, se marca hecho solo al aprobarse.</p>
        )}
        {e.error && <MensajeError error={e.error} />}
      </div>
    </Hoja>
  );
}

// ----- Documentos -----------------------------------------------------------------------------------
export function ListaDocumentos({ filas, cargando, unidadFija, verTitular = true }: {
  filas: Documento[];
  cargando?: boolean;
  unidadFija?: string;
  verTitular?: boolean;
}) {
  const { esOficina } = useSesion();
  const [archivados, setArchivados] = useState(false);
  const [editando, setEditando] = useState<Documento | 'nuevo' | null>(null);
  const [renovando, setRenovando] = useState<Documento | null>(null);
  const visibles = filas.filter((d) => archivados || d.activo);
  const hayArchivados = filas.some((d) => !d.activo);

  if (cargando) return <Cargando />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-base text-tinta-2">
          Papeles con fecha de vencimiento, de los camiones o de las personas. Renovar guarda el anterior en el historial.
        </p>
        {esOficina && (
          <Boton variante="principal" tamano="sm" icono={<Plus aria-hidden className="size-4" />} onClick={() => setEditando('nuevo')}>
            Nuevo documento
          </Boton>
        )}
      </div>
      {visibles.length === 0 ? (
        <EstadoVacio titulo="Aún no hay documentos" icono={<FileText aria-hidden className="size-6 text-tinta-2" />}>
          {esOficina ? 'Carga la póliza RCV, el permiso de circulación o la licencia de cada chofer: el sistema avisa antes de que venzan.' : 'Flota carga los documentos.'}
        </EstadoVacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((d) => (
            <Fila
              key={d.id}
              situacion={d.situacion}
              titulo={d.tipo ?? 'Documento'}
              titular={
                !verTitular ? null : d.unidad_id ? (
                  <Link to={`/unidades/${d.unidad_id}`} className="underline underline-offset-4">{d.titular}</Link>
                ) : (
                  d.titular
                )
              }
              estado={d.activo ? [estadoFecha(d.dias_restantes ?? 0, d.vence, 'Vence')] : [`Renovado o archivado; vencía el ${fecha(d.vence)}.`]}
              detalle={[d.numero ? `N.º ${d.numero}` : null, d.emisor, `avisa ${d.aviso_dias} días antes`].filter(Boolean).join(' • ')}
              extra={
                <>
                  {d.notas && <p className="text-sm">{d.notas}</p>}
                  {d.archivo_path && <div className="mt-1"><VerFoto bucket="documentos" ruta={d.archivo_path} etiqueta={d.tipo ?? 'Documento'} /></div>}
                </>
              }
              acciones={
                esOficina && (
                  <>
                    {d.activo && (
                      <Boton variante={d.situacion === 'al_dia' ? 'secundario' : 'principal'} tamano="sm" icono={<RefreshCw aria-hidden className="size-4" />} onClick={() => setRenovando(d)}>
                        Renovar
                      </Boton>
                    )}
                    <Boton tamano="sm" icono={<Pencil aria-hidden className="size-4" />} onClick={() => setEditando(d)}>Editar</Boton>
                  </>
                )
              }
            />
          ))}
        </ul>
      )}
      {hayArchivados && <Casilla etiqueta="Mostrar los renovados y archivados" checked={archivados} onChange={setArchivados} />}
      {editando && <FormDocumento d={editando === 'nuevo' ? null : editando} unidadFija={unidadFija} alCerrar={() => setEditando(null)} />}
      {renovando && <FormRenovar d={renovando} alCerrar={() => setRenovando(null)} />}
    </div>
  );
}

/** El archivo va al bucket "documentos", en la carpeta del documento: lo leen solo quienes ven el documento */
async function subirArchivoDocumento(id: string, archivo: Blob | null): Promise<string | null> {
  if (!archivo) return null;
  const blob = await comprimirFoto(archivo);
  return subirArchivo('documentos', rutaDocumento(id, blob.type), blob);
}

function FormDocumento({ d, unidadFija, alCerrar }: { d: Documento | null; unidadFija?: string; alCerrar: () => void }) {
  const { data: unidades = [] } = useUnidadesLista();
  const { data: personas = [] } = usePersonas();
  const [de, setDe] = useState<'unidad' | 'persona'>(d?.persona_id ? 'persona' : 'unidad');
  const [unidadId, setUnidadId] = useState(d?.unidad_id ?? unidadFija ?? '');
  const [personaId, setPersonaId] = useState(d?.persona_id ?? '');
  const [tipo, setTipo] = useState(d?.tipo ?? '');
  const [numero, setNumero] = useState(d?.numero ?? '');
  const [emisor, setEmisor] = useState(d?.emisor ?? '');
  const [vence, setVence] = useState(d?.vence ?? '');
  const [aviso, setAviso] = useState(String(d?.aviso_dias ?? 15));
  const [notas, setNotas] = useState(d?.notas ?? '');
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const [activo, setActivo] = useState(d?.activo ?? true);
  const e = useEnvio();

  const guardar = () => {
    const avisoDias = leerNumero(aviso, 'entero');
    if (de === 'unidad' && !unidadId) return e.fallar('Elige la unidad.');
    if (de === 'persona' && !personaId) return e.fallar('Elige la persona.');
    if (!tipo.trim()) return e.fallar('Escribe qué documento es (por ejemplo, "Póliza RCV").');
    if (!vence) return e.fallar('Indica la fecha de vencimiento.');
    if (avisoDias === null || avisoDias < 0 || avisoDias > 365) return e.fallar('El aviso debe estar entre 0 y 365 días antes.');
    const id = d?.id ?? crypto.randomUUID();
    void e.enviar(
      async () => {
        const ruta = await subirArchivoDocumento(id, archivo);
        return rpc('guardar_documento', {
          p_id: id,
          p_unidad_id: de === 'unidad' ? unidadId : null,
          p_persona_id: de === 'persona' ? personaId : null,
          p_tipo: tipo.trim(),
          p_vence: vence,
          p_numero: numero.trim() || null,
          p_emisor: emisor.trim() || null,
          p_aviso_dias: avisoDias,
          p_archivo: ruta,
          p_notas: notas.trim() || null,
          p_activo: activo,
        });
      },
      d ? 'Documento guardado' : 'Documento registrado',
      alCerrar,
    );
  };

  return (
    <Hoja
      abierta
      alCerrar={alCerrar}
      titulo={d ? `Editar: ${d.tipo}` : 'Registrar un documento'}
      ancho="ancho"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={e.enviando} onClick={guardar}>{d ? 'Guardar' : 'Registrar documento'}</Boton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {!unidadFija && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="text-base font-bold">¿De quién es?</span>
            <Segmentado etiqueta="¿De quién es?" valor={de} alCambiar={setDe} opciones={[{ valor: 'unidad', etiqueta: 'De una unidad' }, { valor: 'persona', etiqueta: 'De una persona' }]} />
          </div>
        )}
        {!unidadFija && de === 'unidad' && (
          <Campo etiqueta="Unidad">
            {(p) => (
              <Seleccion {...p} value={unidadId} onChange={(x) => setUnidadId(x.target.value)}>
                <option value="">Elige un camión o planta</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.tipo === 'planta' ? `Planta: ${u.alias}` : etiquetaUnidad(u)}</option>)}
              </Seleccion>
            )}
          </Campo>
        )}
        {!unidadFija && de === 'persona' && (
          <Campo etiqueta="Persona">
            {(p) => (
              <Seleccion {...p} value={personaId} onChange={(x) => setPersonaId(x.target.value)}>
                <option value="">Elige a la persona</option>
                {personas.filter((x) => x.activo || x.id === personaId).map((x) => <option key={x.id} value={x.id}>{x.nombre} ({NOMBRE_ROL[x.rol].toLowerCase()})</option>)}
              </Seleccion>
            )}
          </Campo>
        )}
        <Campo etiqueta="Documento" ayuda="Escríbelo o elige uno de la lista.">
          {(p) => (
            <>
              <Entrada {...p} list="documentos-sugeridos" value={tipo} onChange={(x) => setTipo(x.target.value)} placeholder="Póliza RCV" />
              <datalist id="documentos-sugeridos">{DOCUMENTOS_SUGERIDOS.map((s) => <option key={s} value={s} />)}</datalist>
            </>
          )}
        </Campo>
        <Campo etiqueta="Vence el">{(p) => <Entrada {...p} type="date" value={vence} onChange={(x) => setVence(x.target.value)} />}</Campo>
        <Campo etiqueta="Avisar cuántos días antes">{(p) => <EntradaNumero {...p} unidad="días" value={aviso} onChange={(x) => setAviso(x.target.value)} />}</Campo>
        <Campo etiqueta="Número" opcional>{(p) => <Entrada {...p} value={numero} onChange={(x) => setNumero(x.target.value)} />}</Campo>
        <Campo etiqueta="Aseguradora u organismo" opcional>{(p) => <Entrada {...p} value={emisor} onChange={(x) => setEmisor(x.target.value)} />}</Campo>
        <Campo etiqueta="Notas" opcional className="md:col-span-2">{(p) => <AreaTexto {...p} rows={2} value={notas} onChange={(x) => setNotas(x.target.value)} />}</Campo>
        <CampoFoto etiqueta={d?.archivo_path ? 'Reemplazar la foto o el PDF' : 'Foto o PDF del documento'} archivo={archivo} alCambiar={setArchivo} id="foto-documento" />
        {d && <Casilla etiqueta="Activo (desmárcalo para archivarlo: deja de avisar)" checked={activo} onChange={setActivo} />}
      </div>
      {e.error && <MensajeError error={e.error} className="mt-4" />}
    </Hoja>
  );
}

function FormRenovar({ d, alCerrar }: { d: Documento; alCerrar: () => void }) {
  const [vence, setVence] = useState('');
  const [numero, setNumero] = useState(d.numero ?? '');
  const [emisor, setEmisor] = useState(d.emisor ?? '');
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const e = useEnvio();
  const guardar = () => {
    if (!vence) return e.fallar('Indica la nueva fecha de vencimiento.');
    if (d.vence && vence <= d.vence) return e.fallar(`La nueva fecha debe ser posterior al vencimiento actual (${fecha(d.vence)}).`);
    const nuevoId = crypto.randomUUID();
    void e.enviar(
      async () => {
        const ruta = await subirArchivoDocumento(nuevoId, archivo);
        return rpc('renovar_documento', { p_id: d.id!, p_nuevo_id: nuevoId, p_vence: vence, p_numero: numero.trim() || null, p_emisor: emisor.trim() || null, p_archivo: ruta });
      },
      `${d.tipo} renovado`,
      alCerrar,
    );
  };
  return (
    <Hoja
      abierta
      alCerrar={alCerrar}
      titulo={`Renovar: ${d.tipo}`}
      descripcion={`${d.titular}. El documento actual (vence el ${fecha(d.vence)}) queda en el historial.`}
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={e.enviando} onClick={guardar}>Renovar</Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nuevo vencimiento">{(p) => <Entrada {...p} type="date" min={d.vence ?? undefined} value={vence} onChange={(x) => setVence(x.target.value)} />}</Campo>
        <Campo etiqueta="Número" opcional>{(p) => <Entrada {...p} value={numero} onChange={(x) => setNumero(x.target.value)} />}</Campo>
        <Campo etiqueta="Aseguradora u organismo" opcional>{(p) => <Entrada {...p} value={emisor} onChange={(x) => setEmisor(x.target.value)} />}</Campo>
        <CampoFoto etiqueta="Foto o PDF del nuevo documento" archivo={archivo} alCambiar={setArchivo} id="foto-renovacion" />
        {e.error && <MensajeError error={e.error} />}
      </div>
    </Hoja>
  );
}

// ----- Pantalla ----------------------------------------------------------------------------------
export function Vencimientos() {
  const servicios = useRecordatorios();
  const documentos = useDocumentos();
  const activos = [...(servicios.data ?? []).filter((r) => r.activo), ...(documentos.data ?? []).filter((d) => d.activo)];
  const cuenta = (s: Situacion) => activos.filter((x) => x.situacion === s).length;
  const error = servicios.error ?? documentos.error;

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Vencimientos"
        descripcion="Servicios que tocan por km o por fecha y documentos que vencen. Lo vencido va primero."
      />
      {error && <MensajeError error={traducirError(error)} />}
      <TableroKpis
        cargando={servicios.isLoading || documentos.isLoading}
        datos={[
          { titulo: 'Vencidos', valor: num(cuenta('vencido')), ayuda: 'Servicios que ya se pasaron de km o de fecha y documentos con la fecha vencida.' },
          { titulo: 'Por vencer', valor: num(cuenta('pronto')), ayuda: 'Dentro del aviso: faltan pocos km o pocos días.' },
          { titulo: 'Al día', valor: num(cuenta('al_dia')) },
        ]}
      />
      <Pestanas
        pestanas={[
          {
            id: 'servicios',
            titulo: `Servicios (${(servicios.data ?? []).filter((r) => r.activo).length})`,
            contenido: () => <ListaServicios filas={servicios.data ?? []} cargando={servicios.isLoading} />,
          },
          {
            id: 'documentos',
            titulo: `Documentos (${(documentos.data ?? []).filter((d) => d.activo).length})`,
            contenido: () => <ListaDocumentos filas={documentos.data ?? []} cargando={documentos.isLoading} />,
          },
        ]}
      />
    </div>
  );
}

/** Pestaña de la ficha de una unidad */
export function VencimientosUnidad({ unidadId }: { unidadId: string }) {
  const servicios = useRecordatorios(unidadId);
  const documentos = useDocumentos({ unidad: unidadId });
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2" aria-labelledby="servicios-unidad">
        <h2 id="servicios-unidad" className="flex items-center gap-2 text-lg font-extrabold">
          <Wrench aria-hidden className="size-5" /> Servicios programados
        </h2>
        <ListaServicios filas={servicios.data ?? []} cargando={servicios.isLoading} unidadFija={unidadId} verUnidad={false} />
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="documentos-unidad">
        <h2 id="documentos-unidad" className="flex items-center gap-2 text-lg font-extrabold">
          <CalendarClock aria-hidden className="size-5" /> Documentos
        </h2>
        <ListaDocumentos filas={documentos.data ?? []} cargando={documentos.isLoading} unidadFija={unidadId} verTitular={false} />
      </section>
    </div>
  );
}
