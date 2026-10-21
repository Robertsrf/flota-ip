import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Archive, CirclePlus, RefreshCw, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react';
import { Etiqueta } from '@/components/datos';
import { EncabezadoPagina } from '@/components/estructura';
import { fecha } from '@/lib/formato';
import changelog from '../../../CHANGELOG.md?raw';
import { leerChangelog, trozos } from './changelog';

const ICONO: Record<string, LucideIcon> = {
  Agregado: CirclePlus,
  Cambiado: RefreshCw,
  Corregido: Wrench,
  Seguridad: ShieldCheck,
  Eliminado: Archive,
  Obsoleto: TriangleAlert,
};

function Texto({ texto }: { texto: string }) {
  return (
    <>
      {trozos(texto).map((t, i) =>
        t.estilo === 'negrita' ? <strong key={i}>{t.texto}</strong> : t.estilo === 'codigo' ? <code key={i} className="rounded bg-superficie-2 px-1 text-[0.95em]">{t.texto}</code> : <span key={i}>{t.texto}</span>,
      )}
    </>
  );
}

export function Novedades() {
  const versiones = useMemo(() => leerChangelog(changelog), []);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <EncabezadoPagina
        titulo="Novedades"
        descripcion={`Tienes la versión ${__VERSION__}. Aquí está todo lo que cambió desde el inicio, de lo más nuevo a lo más viejo.`}
      />
      <ol className="flex flex-col gap-6">
        {versiones.map((v) => (
          <li key={v.numero}>
            <article aria-labelledby={`version-${v.numero}`} className="flex flex-col gap-4 rounded-xl border-2 border-linea bg-superficie p-4 md:p-5">
              <header className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`version-${v.numero}`} className="cifra text-xl font-extrabold">
                    {v.numero === 'Sin publicar' ? 'En preparación' : `Versión ${v.numero}`}
                  </h2>
                  {v.numero === __VERSION__ && <Etiqueta tono="via">Instalada</Etiqueta>}
                </div>
                <p className="cifra text-sm text-tinta-2">
                  {[v.fecha ? fecha(v.fecha) : 'Todavía no se publica', v.titulo].filter(Boolean).join(' • ')}
                </p>
              </header>
              {v.grupos.filter((g) => g.cambios.length).map((g) => {
                const Icono = ICONO[g.tipo] ?? CirclePlus;
                return (
                  <section key={g.tipo} className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-2 text-base font-extrabold">
                      <Icono aria-hidden className="size-5 text-tinta-2" /> {g.tipo}
                    </h3>
                    <ul className="flex list-disc flex-col gap-1.5 pl-6 text-base leading-relaxed marker:text-tinta-2">
                      {g.cambios.map((c) => (
                        <li key={c}><Texto texto={c} /></li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
