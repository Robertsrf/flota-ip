import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { Boton } from '@/components/controles';
import { usePreferenciaLocal } from '@/lib/ganchos';
import { supabase } from '@/lib/supabase';

interface Paso {
  id: string;
  titulo: string;
  detalle: string;
  a?: string;
  listo: boolean;
}

async function contar(consulta: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
}

function usePasos(activo: boolean) {
  return useQuery({
    queryKey: ['primeros-pasos'],
    enabled: activo,
    staleTime: 60_000,
    queryFn: async () => {
      const cuenta = { count: 'exact' as const, head: true };
      const [sede, destinos, unidades, choferes, recordatorios, documentos, viajes] = await Promise.all([
        contar(supabase.from('ubicaciones').select('*', cuenta).eq('tipo', 'sede').eq('activo', true)),
        contar(supabase.from('ubicaciones').select('*', cuenta).eq('es_sistema', false).neq('tipo', 'sede').eq('activo', true)),
        contar(supabase.from('unidades').select('*', cuenta)),
        contar(supabase.from('perfiles').select('*', cuenta).eq('rol', 'chofer')),
        contar(supabase.from('recordatorios_servicio').select('*', cuenta)),
        contar(supabase.from('documentos').select('*', cuenta)),
        contar(supabase.from('viajes').select('*', cuenta)),
      ]);
      const pasos: Paso[] = [
        { id: 'sede', titulo: 'Carga la sede', detalle: 'Es el punto de salida de todas las rutas.', a: '/catalogos?pestana=ubicaciones', listo: sede > 0 },
        { id: 'destinos', titulo: 'Carga los destinos', detalle: 'Los clientes y lugares a los que van los camiones.', a: '/catalogos?pestana=ubicaciones', listo: destinos > 0 },
        { id: 'unidades', titulo: 'Da de alta los camiones y las plantas', detalle: 'Placa, tanque y km actual de cada uno.', a: '/unidades/nueva', listo: unidades > 0 },
        { id: 'choferes', titulo: 'Crea los usuarios de los choferes', detalle: 'Cada chofer entra con su usuario y un PIN de 6 dígitos.', a: '/usuarios', listo: choferes > 0 },
        {
          id: 'vencimientos', titulo: 'Programa servicios y carga documentos',
          detalle: 'Cambio de aceite, póliza RCV, licencias: el sistema avisa antes de que toquen o venzan.', a: '/vencimientos',
          listo: recordatorios + documentos > 0,
        },
        { id: 'ruta', titulo: 'Primera ruta', detalle: 'Un chofer la inicia desde su teléfono y este tablero se llena solo.', listo: viajes > 0 },
      ];
      return pasos;
    },
  });
}

/** Lista para arrancar con la base vacía. Desaparece al completar los pasos o al ocultarla. */
export function PrimerosPasos({ activo }: { activo: boolean }) {
  const [oculto, setOculto] = usePreferenciaLocal<'si' | 'no'>('primeros-pasos-oculto', 'no');
  const { data: pasos } = usePasos(activo && oculto === 'no');
  if (!activo || oculto === 'si' || !pasos || pasos.every((p) => p.listo)) return null;
  const hechos = pasos.filter((p) => p.listo).length;
  return (
    <section aria-labelledby="primeros-pasos" className="flex flex-col gap-3 rounded-xl border-2 border-via-acento bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="primeros-pasos" className="text-lg font-extrabold">Primeros pasos</h2>
          <p className="cifra text-sm text-tinta-2">
            {hechos} de {pasos.length} listos. Con esto el sistema queda listo para que los choferes registren sus rutas.
          </p>
        </div>
        <Boton tamano="sm" variante="fantasma" onClick={() => setOculto('si')}>Ocultar</Boton>
      </div>
      <ol className="flex flex-col divide-y divide-linea">
        {pasos.map((p, i) => {
          const contenido = (
            <>
              {p.listo ? (
                <CircleCheck aria-hidden className="size-7 shrink-0 text-via-acento" />
              ) : (
                <span aria-hidden className="cifra grid size-7 shrink-0 place-items-center rounded bg-via text-sm font-black text-via-tinta">{i + 1}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className={`block font-bold ${p.listo ? 'text-tinta-2 line-through' : ''}`}>{p.titulo}</span>
                {!p.listo && <span className="block text-sm text-tinta-2">{p.detalle}</span>}
              </span>
              {p.listo ? <span className="text-sm font-semibold text-via-acento">Listo</span> : p.a && <ChevronRight aria-hidden className="size-5 shrink-0" />}
            </>
          );
          return (
            <li key={p.id}>
              {p.a && !p.listo ? (
                <Link to={p.a} className="flex min-h-14 items-center gap-3 py-2 hover:bg-superficie-2">
                  {contenido}
                </Link>
              ) : (
                <div className="flex min-h-14 items-center gap-3 py-2">{contenido}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
