import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAvisos } from '@/components/avisos';
import { AreaTexto, Boton, Campo, Entrada, EntradaNumero, Seleccion, Segmentado } from '@/components/controles';
import { AvisoAlerta, MensajeError } from '@/components/datos';
import { CampoFoto, EncabezadoPagina, Panel } from '@/components/estructura';
import type { Unidad } from '@/lib/api';
import type { TablesInsert } from '@/lib/database.types';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { comprimirFoto, subirArchivo } from '@/lib/fotos';
import { hoyIso, leerNumero } from '@/lib/formato';
import { supabase } from '@/lib/supabase';
import { useChoferes } from '@/features/registros/datosComunes';

type Tipo = 'camion' | 'planta';

export function NuevaUnidad() {
  const navegar = useNavigate();
  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina volver={{ a: '/unidades', texto: 'Camiones y plantas' }} titulo="Nueva unidad" descripcion="Un camión de la flota o una planta eléctrica que consume combustible." />
      <FormUnidad alGuardar={(id) => navegar(`/unidades/${id}`, { replace: true })} />
    </div>
  );
}

const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

export function FormUnidad({ unidad, alGuardar }: { unidad?: Unidad; alGuardar: (id: string) => void }) {
  const { data: choferes = [] } = useChoferes();
  const qc = useQueryClient();
  const avisos = useAvisos();
  const editando = Boolean(unidad);
  const [tipo, setTipo] = useState<Tipo>((unidad?.tipo as Tipo) ?? 'camion');
  const [v, setV] = useState({
    placa: unidad?.placa ?? '',
    alias: unidad?.alias ?? '',
    marca: unidad?.marca ?? '',
    modelo: unidad?.modelo ?? '',
    anio: txt(unidad?.anio),
    combustible: unidad?.combustible ?? 'diesel',
    medidor: unidad?.medidor ?? 'km',
    capacidad: txt(unidad?.capacidad_tanque_l),
    lectura: txt(unidad?.lectura_inicial),
    inicial: txt(unidad?.combustible_inicial_l),
    fechaAlta: unidad?.fecha_alta ?? hoyIso(),
    chofer: unidad?.chofer_habitual_id ?? '',
    rendMin: txt(unidad?.rendimiento_min ?? 1.5),
    rendMax: txt(unidad?.rendimiento_max ?? 15),
    estado: unidad?.estado ?? 'disponible',
    notas: unidad?.notas ?? '',
  });
  const [foto, setFoto] = useState<Blob | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);
  const poner = (k: keyof typeof v) => (valor: string) => setV((x) => ({ ...x, [k]: valor }));
  const medidor = tipo === 'camion' ? 'km' : v.medidor;
  const capacidadOriginal = unidad?.capacidad_tanque_l;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const capacidad = leerNumero(v.capacidad);
    const lectura = leerNumero(v.lectura, 'entero');
    const inicial = leerNumero(v.inicial) ?? 0;
    const anio = v.anio ? Number(v.anio) : null;
    const rendMin = leerNumero(v.rendMin);
    const rendMax = leerNumero(v.rendMax);
    if (tipo === 'camion' && !v.placa.trim()) err.placa = 'Escribe la placa.';
    if (tipo === 'planta' && !v.alias.trim()) err.alias = 'Escribe un nombre para la planta.';
    if (capacidad === null || capacidad <= 0) err.capacidad = 'Escribe la capacidad del tanque en litros.';
    if (medidor !== 'ninguno' && lectura === null) err.lectura = medidor === 'km' ? 'Escribe el km del tablero.' : 'Escribe las horas del horómetro.';
    if (capacidad !== null && inicial > capacidad) err.inicial = 'No puede superar la capacidad del tanque.';
    if (anio !== null && (anio < 1950 || anio > 2100)) err.anio = 'Año no válido.';
    if (tipo === 'camion' && (rendMin === null || rendMax === null || rendMin >= rendMax)) err.rend = 'El mínimo debe ser menor que el máximo.';
    setErrores(err);
    if (Object.keys(err).length) return;

    setEnviando(true);
    setError(null);
    const id = unidad?.id ?? crypto.randomUUID();
    const datos: TablesInsert<'unidades'> = {
      id,
      tipo,
      placa: v.placa.trim().toUpperCase() || null,
      alias: v.alias.trim() || null,
      marca: v.marca.trim() || null,
      modelo: v.modelo.trim() || null,
      anio,
      combustible: v.combustible as 'diesel',
      medidor: medidor as 'km',
      capacidad_tanque_l: capacidad!,
      lectura_inicial: medidor === 'ninguno' ? null : lectura,
      combustible_inicial_l: inicial,
      fecha_alta: v.fechaAlta,
      chofer_habitual_id: v.chofer || null,
      rendimiento_min: tipo === 'camion' ? rendMin! : 1.5,
      rendimiento_max: tipo === 'camion' ? rendMax! : 15,
      notas: v.notas.trim() || null,
    };
    if (!(unidad?.estado === 'en_ruta')) datos.estado = v.estado as 'disponible';
    try {
      if (foto) {
        const blob = await comprimirFoto(foto);
        datos.foto_path = await subirArchivo('unidades', `${id}/foto-${Date.now()}.jpg`, blob);
      }
      const r = editando
        ? await supabase.from('unidades').update(datos).eq('id', id)
        : await supabase.from('unidades').insert(datos);
      if (r.error) throw r.error;
      await qc.invalidateQueries();
      avisos.ok(editando ? 'Datos guardados' : 'Unidad registrada');
      alGuardar(id);
    } catch (x) {
      setError(traducirError(x));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
      {!editando && (
        <Panel>
          <span className="text-base font-bold">¿Qué vas a registrar?</span>
          <div className="mt-2">
            <Segmentado
              etiqueta="Tipo de unidad"
              valor={tipo}
              alCambiar={setTipo}
              opciones={[
                { valor: 'camion', etiqueta: 'Camión', detalle: 'hace rutas, km' },
                { valor: 'planta', etiqueta: 'Planta eléctrica', detalle: 'sin rutas' },
              ]}
            />
          </div>
        </Panel>
      )}
      <Panel className="grid gap-4 md:grid-cols-3">
        {tipo === 'camion' && (
          <Campo etiqueta="Placa" error={errores.placa}>
            {(p) => <Entrada {...p} value={v.placa} onChange={(e) => poner('placa')(e.target.value)} autoCapitalize="characters" />}
          </Campo>
        )}
        <Campo etiqueta={tipo === 'camion' ? 'Alias' : 'Nombre'} opcional={tipo === 'camion'} error={errores.alias} ayuda={tipo === 'camion' ? 'Como lo llaman: "Camión 3", "El blanco".' : undefined}>
          {(p) => <Entrada {...p} value={v.alias} onChange={(e) => poner('alias')(e.target.value)} />}
        </Campo>
        <Campo etiqueta="Marca" opcional>{(p) => <Entrada {...p} value={v.marca} onChange={(e) => poner('marca')(e.target.value)} />}</Campo>
        <Campo etiqueta="Modelo" opcional>{(p) => <Entrada {...p} value={v.modelo} onChange={(e) => poner('modelo')(e.target.value)} />}</Campo>
        <Campo etiqueta="Año" opcional error={errores.anio}>{(p) => <EntradaNumero {...p} value={v.anio} onChange={(e) => poner('anio')(e.target.value)} />}</Campo>
        <Campo etiqueta="Combustible">
          {(p) => (
            <Seleccion {...p} value={v.combustible} onChange={(e) => poner('combustible')(e.target.value)}>
              <option value="diesel">Diésel</option>
              <option value="gasolina">Gasolina</option>
            </Seleccion>
          )}
        </Campo>
      </Panel>

      <Panel className="grid gap-4 md:grid-cols-3">
        {tipo === 'planta' && (
          <Campo etiqueta="Medidor" ayuda="Sin horómetro solo se controlan litros y costo.">
            {(p) => (
              <Seleccion {...p} value={v.medidor} onChange={(e) => poner('medidor')(e.target.value)}>
                <option value="ninguno">Sin medidor</option>
                <option value="horas">Horómetro (horas)</option>
              </Seleccion>
            )}
          </Campo>
        )}
        <Campo etiqueta="Capacidad del tanque" error={errores.capacidad}>
          {(p) => <EntradaNumero {...p} unidad="L" value={v.capacidad} onChange={(e) => poner('capacidad')(e.target.value)} />}
        </Campo>
        {medidor !== 'ninguno' && (
          <Campo etiqueta={medidor === 'km' ? 'Km al darlo de alta' : 'Horas al darla de alta'} error={errores.lectura}>
            {(p) => <EntradaNumero {...p} unidad={medidor === 'km' ? 'km' : 'h'} value={v.lectura} onChange={(e) => poner('lectura')(e.target.value)} />}
          </Campo>
        )}
        <Campo etiqueta="Combustible al darlo de alta" error={errores.inicial} ayuda="Si el tanque está lleno, escribe la capacidad: así la primera ruta queda exacta.">
          {(p) => (
            <div className="flex gap-2">
              <EntradaNumero {...p} unidad="L" value={v.inicial} onChange={(e) => poner('inicial')(e.target.value)} className="flex-1" />
              <Boton onClick={() => poner('inicial')(v.capacidad)}>Lleno</Boton>
            </div>
          )}
        </Campo>
        <Campo etiqueta="Fecha de alta">{(p) => <Entrada {...p} type="date" value={v.fechaAlta} onChange={(e) => poner('fechaAlta')(e.target.value)} />}</Campo>
        {tipo === 'camion' && (
          <>
            <Campo etiqueta="Chofer habitual" opcional>
              {(p) => (
                <Seleccion {...p} value={v.chofer} onChange={(e) => poner('chofer')(e.target.value)}>
                  <option value="">Sin chofer fijo</option>
                  {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Seleccion>
              )}
            </Campo>
            <Campo etiqueta="Rendimiento razonable (km/L)" error={errores.rend} ayuda="Fuera de este rango la ruta se marca para revisar.">
              {(p) => (
                <div className="flex items-center gap-2">
                  <EntradaNumero {...p} aria-label="Mínimo" value={v.rendMin} onChange={(e) => poner('rendMin')(e.target.value)} />
                  <span className="text-tinta-2">a</span>
                  <EntradaNumero aria-label="Máximo" value={v.rendMax} onChange={(e) => poner('rendMax')(e.target.value)} />
                </div>
              )}
            </Campo>
          </>
        )}
        <Campo etiqueta="Estado">
          {(p) =>
            unidad?.estado === 'en_ruta' ? (
              <Entrada {...p} value="En ruta (se cambia al finalizar la ruta)" disabled />
            ) : (
              <Seleccion {...p} value={v.estado} onChange={(e) => poner('estado')(e.target.value)}>
                <option value="disponible">Disponible</option>
                <option value="taller">En taller</option>
                <option value="inactivo">Inactivo</option>
              </Seleccion>
            )
          }
        </Campo>
        <Campo etiqueta="Notas" opcional className="md:col-span-3">{(p) => <AreaTexto {...p} value={v.notas} onChange={(e) => poner('notas')(e.target.value)} rows={2} />}</Campo>
        <CampoFoto etiqueta={unidad?.foto_path ? 'Cambiar foto' : 'Foto de la unidad'} archivo={foto} alCambiar={setFoto} id="foto-unidad" />
      </Panel>

      {editando && capacidadOriginal != null && leerNumero(v.capacidad) !== Number(capacidadOriginal) && (
        <AvisoAlerta titulo="Cambiar la capacidad recalcula todas sus rutas">Los consumos ya registrados se rehacen con la capacidad nueva. Queda en la auditoría.</AvisoAlerta>
      )}
      {error && <MensajeError error={error} />}
      <div className="flex justify-end">
        <Boton type="submit" variante="principal" tamano="lg" cargando={enviando}>
          {editando ? 'Guardar cambios' : tipo === 'camion' ? 'Registrar camión' : 'Registrar planta'}
        </Boton>
      </div>
    </form>
  );
}
