import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CabeceraCabina } from '@/app/DisenoCabina';
import { useAvisos } from '@/components/avisos';
import { Boton, Campo, Entrada, EntradaNumero, Segmentado } from '@/components/controles';
import { Cargando, EstadoVacio, MensajeError } from '@/components/datos';
import { CampoFoto } from '@/components/estructura';
import { traducirError, type ErrorApp } from '@/lib/errores';
import { comprimirFoto } from '@/lib/fotos';
import { km as fKm, leerNumero, num, usd } from '@/lib/formato';
import { redondear } from '@/lib/consumo';
import { baseLocal, descartar, encolar } from '@/lib/offline/cola';
import { useSesion } from '@/lib/sesion';
import { useEstadoCabina, usePrecios, useUltimoPrecio, useUnidad } from './datos';
import { PantallaTarea, SelectorPrecio } from './piezas';

export function RegistrarRepostaje() {
  const { abierto, ultimaUnidadId, cargando } = useEstadoCabina();
  const unidadId = abierto?.unidad_id ?? ultimaUnidadId;
  const { data: unidad } = useUnidad(unidadId);
  const { data: precios = [] } = usePrecios();
  const { data: ultimo } = useUltimoPrecio(unidadId);
  const { sesion } = useSesion();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const qc = useQueryClient();

  const [kmTexto, setKmTexto] = useState('');
  const [litrosTexto, setLitrosTexto] = useState('');
  const [precioId, setPrecioId] = useState<string | null>(null);
  const [lleno, setLleno] = useState<'si' | 'no'>('si');
  const [estacion, setEstacion] = useState('');
  const [recibo, setRecibo] = useState<Blob | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<ErrorApp | null>(null);
  const [enviando, setEnviando] = useState(false);

  const precioElegido = precioId ?? precios.find((p) => p.id === ultimo?.precio_id)?.id ?? precios[0]?.id ?? null;

  if (cargando) return <Cargando />;
  if (!unidadId) {
    return (
      <>
        <CabeceraCabina volver={{ a: '/cabina', texto: 'Cancelar' }} />
        <div className="p-4">
          <EstadoVacio titulo="Primero inicia una ruta">Las cargas se registran en el camión de tu ruta o en el último que manejaste.</EstadoVacio>
        </div>
      </>
    );
  }
  if (!unidad) return <Cargando />;

  const lectura = Number(unidad.lectura_actual ?? 0);
  const km = leerNumero(kmTexto, 'entero');
  const litros = leerNumero(litrosTexto);
  const precio = precios.find((p) => p.id === precioElegido);
  const capacidad = Number(unidad.capacidad_tanque_l);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (km === null) err.km = 'Escribe el km del tablero.';
    else if (km < lectura) err.km = `El km (${num(km)}) es menor que el último conocido (${num(lectura)}). Revisa el tablero.`;
    if (litros === null || litros <= 0) err.litros = 'Escribe los litros del recibo.';
    else if (litros > capacidad * 1.05) err.litros = `La carga de ${num(litros, 2)} L supera la capacidad del tanque (${num(capacidad)} L).`;
    if (!precio) err.precio = 'Elige el precio por litro.';
    setErrores(err);
    if (Object.keys(err).length) return;

    setEnviando(true);
    setErrorServidor(null);
    const id = crypto.randomUUID();
    try {
      const r = await encolar({
        id,
        tipo: 'registrar_repostaje',
        usuario: sesion!.user.id,
        resumen: `repostaje de ${num(litros, 2)} L en ${unidad.placa}`,
        args: {
          p_id: id,
          p_unidad_id: unidad.id,
          p_fecha: new Date().toISOString(),
          p_lectura: km,
          p_litros: litros,
          p_precio_id: precioElegido,
          p_tanque_lleno: lleno === 'si',
          p_estacion: estacion.trim() || null,
        },
        fotos: recibo ? [{ campo: 'p_recibo', blob: await comprimirFoto(recibo) }] : [],
      });
      if (r === 'rechazado') {
        const p = await baseLocal.pendientes.get(id);
        setErrorServidor({ mensaje: p?.error ?? 'No se pudo registrar.', ayuda: p?.ayuda, deRed: false, rechazado: true });
        await descartar(id);
        return;
      }
      await qc.invalidateQueries();
      avisos.ok(r === 'enviado' ? 'Repostaje registrado' : 'Repostaje guardado en el teléfono; se envía al volver la señal');
      navegar('/cabina', { replace: true });
    } catch (x) {
      setErrorServidor(traducirError(x));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-1 flex-col">
      <PantallaTarea
        cabecera={
          <CabeceraCabina volver={{ a: '/cabina', texto: 'Cancelar' }}>
            <h1 className="mt-3 text-3xl font-black">Registrar repostaje</h1>
            <p className="mt-1 text-lg font-bold">
              {unidad.placa} <span className="font-semibold opacity-90">{abierto ? `en ruta a ${abierto.ruta}` : unidad.alias}</span>
            </p>
          </CabeceraCabina>
        }
        accion={
          <Boton type="submit" variante="principal" tamano="xl" bloque cargando={enviando}>
            Registrar repostaje
          </Boton>
        }
      >
        <Campo etiqueta="Km del tablero" error={errores.km} ayuda={`Último km conocido: ${fKm(lectura)}`}>
          {(p) => <EntradaNumero {...p} grande unidad="km" value={kmTexto} onChange={(e) => setKmTexto(e.target.value)} autoFocus />}
        </Campo>
        <Campo
          etiqueta="Litros cargados"
          error={errores.litros}
          ayuda={litros && precio ? `Total: ${usd(redondear(litros * Number(precio.precio_usd_litro), 2))}` : undefined}
        >
          {(p) => <EntradaNumero {...p} grande unidad="L" value={litrosTexto} onChange={(e) => setLitrosTexto(e.target.value)} />}
        </Campo>
        <SelectorPrecio precios={precios} valor={precioElegido} alCambiar={setPrecioId} error={errores.precio} />
        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">¿Llenaste el tanque?</span>
          <Segmentado
            etiqueta="¿Llenaste el tanque?"
            grande
            valor={lleno}
            alCambiar={setLleno}
            opciones={[
              { valor: 'si', etiqueta: 'Sí' },
              { valor: 'no', etiqueta: 'No' },
            ]}
          />
        </div>
        <Campo etiqueta="Estación" opcional>
          {(p) => <Entrada {...p} value={estacion} onChange={(e) => setEstacion(e.target.value)} />}
        </Campo>
        <CampoFoto etiqueta="Foto del recibo" archivo={recibo} alCambiar={setRecibo} id="foto-recibo-suelto" />
        {errorServidor && <MensajeError error={errorServidor} />}
      </PantallaTarea>
    </form>
  );
}
