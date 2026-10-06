import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, History, Pencil, RotateCcw } from 'lucide-react';
import { useAvisos } from '@/components/avisos';
import { AreaTexto, Boton, Campo, Entrada, EntradaNumero, Seleccion } from '@/components/controles';
import { Cargando, EstadoVacio, MensajeError } from '@/components/datos';
import { ConfirmarConMotivo, Hoja } from '@/components/hoja';
import { rpc } from '@/lib/api';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { aDatetimeLocal, desdeDatetimeLocal, fechaHora, leerNumero, num } from '@/lib/formato';
import { useAuditoria } from './datosComunes';

export type TablaRegistro = 'viajes' | 'repostajes' | 'mantenimientos';

export interface CampoCorreccion {
  clave: string;
  etiqueta: string;
  tipo: 'numero' | 'texto' | 'largo' | 'fecha' | 'fechahora' | 'seleccion' | 'booleano';
  opciones?: { valor: string; texto: string }[];
  unidad?: string;
}

type Valor = string | number | boolean | null;

function aTexto(v: unknown, tipo: CampoCorreccion['tipo']): string {
  if (v === null || v === undefined) return '';
  if (tipo === 'fechahora') return aDatetimeLocal(new Date(String(v)));
  if (tipo === 'numero') return String(v).replace('.', ',');
  if (tipo === 'booleano') return v ? 'si' : 'no';
  return String(v);
}

function deTexto(t: string, tipo: CampoCorreccion['tipo']): Valor {
  if (t === '') return null;
  if (tipo === 'numero') return leerNumero(t);
  if (tipo === 'fechahora') return desdeDatetimeLocal(t);
  if (tipo === 'booleano') return t === 'si';
  return t;
}

/** Corrige datos de entrada con motivo; el sistema recalcula y audita (D10). */
export function CorregirRegistro({
  tabla, registro, campos, abierta, alCerrar, titulo,
}: { tabla: TablaRegistro; registro: Record<string, unknown>; campos: CampoCorreccion[]; abierta: boolean; alCerrar: () => void; titulo: string }) {
  const inicial = Object.fromEntries(campos.map((c) => [c.clave, aTexto(registro[c.clave], c.tipo)]));
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);
  const qc = useQueryClient();
  const avisos = useAvisos();

  const guardar = async () => {
    const cambios: Record<string, Valor> = {};
    for (const c of campos) {
      if (valores[c.clave] !== inicial[c.clave]) {
        const v = deTexto(valores[c.clave], c.tipo);
        if (c.tipo === 'numero' && valores[c.clave] !== '' && v === null) {
          setError({ mensaje: `"${c.etiqueta}" no es un número válido.`, deRed: false, rechazado: true });
          return;
        }
        cambios[c.clave] = v;
      }
    }
    if (!Object.keys(cambios).length) {
      setError({ mensaje: 'No cambiaste ningún dato.', deRed: false, rechazado: true });
      return;
    }
    if (!motivo.trim()) {
      setError({ mensaje: 'Escribe el motivo de la corrección: queda en la auditoría.', deRed: false, rechazado: true });
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await rpc('corregir_registro', { p_tabla: tabla, p_id: registro.id as string, p_cambios: cambios, p_motivo: motivo.trim() });
      await qc.invalidateQueries();
      avisos.ok('Corrección guardada. Las cifras se recalcularon.');
      alCerrar();
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja
      abierta={abierta}
      alCerrar={alCerrar}
      titulo={titulo}
      descripcion="Corrige el dato de origen; las cifras calculadas se rehacen solas."
      ancho="ancho"
      pie={
        <>
          <Boton onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="principal" cargando={enviando} onClick={() => void guardar()}>
            Guardar corrección
          </Boton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {campos.map((c) => (
          <Campo key={c.clave} etiqueta={c.etiqueta} className={c.tipo === 'largo' ? 'md:col-span-2' : ''}>
            {(p) => {
              const valor = valores[c.clave];
              const cambiar = (v: string) => setValores((x) => ({ ...x, [c.clave]: v }));
              if (c.tipo === 'seleccion' || c.tipo === 'booleano') {
                const ops = c.tipo === 'booleano' ? [{ valor: 'si', texto: 'Sí' }, { valor: 'no', texto: 'No' }] : (c.opciones ?? []);
                return (
                  <Seleccion {...p} value={valor} onChange={(e) => cambiar(e.target.value)}>
                    {c.tipo === 'seleccion' && <option value="">—</option>}
                    {ops.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.texto}
                      </option>
                    ))}
                  </Seleccion>
                );
              }
              if (c.tipo === 'numero') return <EntradaNumero {...p} unidad={c.unidad} value={valor} onChange={(e) => cambiar(e.target.value)} />;
              if (c.tipo === 'largo') return <AreaTexto {...p} value={valor} onChange={(e) => cambiar(e.target.value)} />;
              return (
                <Entrada
                  {...p}
                  type={c.tipo === 'fecha' ? 'date' : c.tipo === 'fechahora' ? 'datetime-local' : 'text'}
                  value={valor}
                  onChange={(e) => cambiar(e.target.value)}
                />
              );
            }}
          </Campo>
        ))}
        <Campo etiqueta="Motivo de la corrección" className="md:col-span-2">
          {(p) => <AreaTexto {...p} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: la foto del tablero dice 10.480" />}
        </Campo>
      </div>
      {error && <MensajeError error={error} className="mt-4" />}
    </Hoja>
  );
}

/** Botones de corregir, anular, restaurar e historial para un registro */
export function AccionesRegistro({
  tabla, registro, campos, puedeCorregir, puedeAnular, puedeRestaurar, nombre,
}: {
  tabla: TablaRegistro;
  registro: Record<string, unknown>;
  campos: CampoCorreccion[];
  puedeCorregir: boolean;
  puedeAnular: boolean;
  puedeRestaurar: boolean;
  nombre: string;
}) {
  const [corregir, setCorregir] = useState(false);
  const [anular, setAnular] = useState(false);
  const [restaurar, setRestaurar] = useState(false);
  const qc = useQueryClient();
  const avisos = useAvisos();
  const anulado = Boolean(registro.anulado);
  return (
    <div className="flex flex-wrap gap-2">
      {puedeCorregir && !anulado && (
        <Boton icono={<Pencil aria-hidden className="size-4" />} onClick={() => setCorregir(true)}>
          Corregir
        </Boton>
      )}
      {puedeRestaurar && anulado && (
        <Boton icono={<RotateCcw aria-hidden className="size-4" />} onClick={() => setRestaurar(true)}>
          Restaurar
        </Boton>
      )}
      {/* Anular queda aparte, separado de las acciones que guardan */}
      {puedeAnular && !anulado && (
        <Boton variante="fantasma" className="text-peligro md:ml-6" icono={<Ban aria-hidden className="size-4" />} onClick={() => setAnular(true)}>
          Anular
        </Boton>
      )}
      {corregir && (
        <CorregirRegistro tabla={tabla} registro={registro} campos={campos} abierta={corregir} alCerrar={() => setCorregir(false)} titulo={`Corregir ${nombre}`} />
      )}
      <ConfirmarConMotivo
        abierta={anular}
        alCerrar={() => setAnular(false)}
        titulo={`Anular ${nombre}`}
        descripcion="No se borra: queda anulado, fuera de los cálculos y con su motivo en la auditoría."
        textoAccion="Anular"
        peligro
        alConfirmar={async (motivo) => {
          await rpc('anular_registro', { p_tabla: tabla, p_id: registro.id as string, p_motivo: motivo });
          await qc.invalidateQueries();
          avisos.ok(`${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} anulado`);
        }}
      />
      <ConfirmarConMotivo
        abierta={restaurar}
        alCerrar={() => setRestaurar(false)}
        titulo={`Restaurar ${nombre}`}
        textoAccion="Restaurar"
        alConfirmar={async (motivo) => {
          await rpc('restaurar_registro', { p_tabla: tabla, p_id: registro.id as string, p_motivo: motivo });
          await qc.invalidateQueries();
          avisos.ok('Registro restaurado');
        }}
      />
    </div>
  );
}

const ACCION: Record<string, string> = {
  update: 'Corrección', anular: 'Anulación', restaurar: 'Restauración', aprobar: 'Aprobación', rechazar: 'Rechazo',
  eliminar: 'Eliminación', revisar: 'Revisión',
};

function valorLegible(v: unknown): string {
  if (v === null || v === undefined) return 'vacío';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'number') return num(v, Number.isInteger(v) ? 0 : 2);
  if (Array.isArray(v)) return v.length ? `${v.length} elementos` : 'ninguno';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return fechaHora(s);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

/** Historial de auditoría de un registro (solo oficina) */
export function HistorialAuditoria({ tabla, registroId }: { tabla: string; registroId: string }) {
  const { data, isLoading, error } = useAuditoria(tabla, registroId);
  if (isLoading) return <Cargando />;
  if (error) return <MensajeError error={traducirError(error)} />;
  if (!data?.length) {
    return <EstadoVacio titulo="Sin cambios registrados" icono={<History aria-hidden className="size-6 text-tinta-2" />}>Este registro no se ha corregido ni anulado.</EstadoVacio>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {data.map((a) => (
        <li key={a.id} className="rounded-xl border-2 border-linea bg-superficie p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">{ACCION[a.accion ?? ''] ?? a.accion}</span>
            <span className="cifra text-sm text-tinta-2">
              {fechaHora(a.fecha)}, {a.usuario_nombre ?? 'Sistema'}
            </span>
          </div>
          {a.motivo && <p className="mt-1 text-base">Motivo: {a.motivo}</p>}
          {a.despues && typeof a.despues === 'object' && (
            <ul className="cifra mt-1 text-sm text-tinta-2">
              {Object.keys(a.despues as Record<string, unknown>).map((k) => (
                <li key={k}>
                  {k.replace(/_/g, ' ')}: {valorLegible((a.antes as Record<string, unknown> | null)?.[k])} → {valorLegible((a.despues as Record<string, unknown>)[k])}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
