import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Camera, ChevronLeft, ImageOff, Trash2 } from 'lucide-react';
import { urlFirmada, type Bucket } from '@/lib/fotos';

// ----- Encabezado de página ----------------------------------------------------------
export function EncabezadoPagina({ titulo, descripcion, acciones, volver }: { titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode; volver?: { a: string; texto: string } }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {volver && (
          <Link to={volver.a} className="-ml-1 mb-1 inline-flex min-h-10 items-center gap-0.5 text-sm font-semibold text-tinta-2 underline-offset-4 hover:underline">
            <ChevronLeft aria-hidden className="size-4" /> {volver.texto}
          </Link>
        )}
        <h1 className="text-2xl font-extrabold leading-tight md:text-3xl">{titulo}</h1>
        {descripcion && <div className="mt-1 text-base text-tinta-2">{descripcion}</div>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

// ----- Pestañas (estado en la URL: ?pestana=) -----------------------------------------------
export interface Pestana {
  id: string;
  titulo: string;
  contenido: () => ReactNode;
}

export function Pestanas({ pestanas, parametro = 'pestana' }: { pestanas: Pestana[]; parametro?: string }) {
  const [params, setParams] = useSearchParams();
  const actual = pestanas.find((p) => p.id === params.get(parametro)) ?? pestanas[0];
  const elegir = (id: string) =>
    setParams(
      (p) => {
        p.set(parametro, id);
        return p;
      },
      { replace: true },
    );
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Secciones" className="flex gap-1 overflow-x-auto border-b-2 border-linea">
        {pestanas.map((p, i) => {
          const activa = p.id === actual.id;
          return (
            <button
              key={p.id}
              id={`pestana-${p.id}`}
              role="tab"
              type="button"
              aria-selected={activa}
              aria-controls={`panel-${p.id}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => elegir(p.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + pestanas.length) % pestanas.length;
                elegir(pestanas[j].id);
                document.getElementById(`pestana-${pestanas[j].id}`)?.focus();
              }}
              className={`-mb-0.5 min-h-12 whitespace-nowrap border-b-4 px-4 text-base font-bold transition-colors
                ${activa ? 'border-via-acento text-tinta' : 'border-transparent text-tinta-2 hover:text-tinta'}`}
            >
              {p.titulo}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${actual.id}`} aria-labelledby={`pestana-${actual.id}`}>
        {actual.contenido()}
      </div>
    </div>
  );
}

// ----- El pórtico: rutas en curso como señales de destino --------------------------------------
export interface Senal {
  id: string;
  arriba: ReactNode;
  destino: ReactNode;
  abajo: ReactNode;
  enlace?: string;
  alerta?: boolean;
}

/** Firma de la dirección "Señal vial": paneles verdes colgados de una viga */
export function Portico({ senales, vacio }: { senales: Senal[]; vacio?: ReactNode }) {
  return (
    <div>
      <div aria-hidden className="h-2 rounded-sm bg-viga" />
      {senales.length === 0 ? (
        <div className="px-3 pt-3">{vacio}</div>
      ) : (
        <ul className="flex gap-4 overflow-x-auto px-3 pb-2">
          {senales.map((s) => {
            const panel = (
              <div className="panel-senal relative mt-3 flex min-h-28 w-72 flex-col justify-between rounded-lg px-4 py-3">
                <span aria-hidden className="absolute -top-3 left-8 h-3 w-1 bg-viga" />
                <span aria-hidden className="absolute -top-3 right-8 h-3 w-1 bg-viga" />
                <span className="truncate text-sm font-semibold">{s.arriba}</span>
                <span className="truncate text-2xl font-black leading-tight">{s.destino}</span>
                <span className="cifra flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="truncate">{s.abajo}</span>
                  {s.alerta && <span className="shrink-0 rounded bg-alerta px-1.5 text-xs font-extrabold text-alerta-tinta">Revisar</span>}
                </span>
              </div>
            );
            return (
              <li key={s.id} className="shrink-0">
                {s.enlace ? (
                  <Link to={s.enlace} className="block rounded-lg focus-visible:outline-offset-4">
                    {panel}
                  </Link>
                ) : (
                  panel
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ----- Fotos ---------------------------------------------------------------------------------
export function CampoFoto({ etiqueta, archivo, alCambiar, id }: { etiqueta: string; archivo: Blob | null; alCambiar: (f: Blob | null) => void; id: string }) {
  const vista = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  useEffect(() => () => {
    if (vista) URL.revokeObjectURL(vista);
  }, [vista]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-bold">
        {etiqueta} <span className="text-sm font-normal text-tinta-2">(opcional)</span>
      </span>
      {vista ? (
        <div className="flex items-center gap-3">
          <img src={vista} alt={`Vista previa: ${etiqueta}`} className="size-20 rounded-lg border-2 border-linea object-cover" />
          <button
            type="button"
            onClick={() => alCambiar(null)}
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-linea-fuerte px-3 font-bold hover:bg-superficie-2"
          >
            <Trash2 aria-hidden className="size-5" /> Quitar foto
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-linea-fuerte bg-superficie px-4 font-bold hover:bg-superficie-2 focus-within:outline focus-within:outline-3 focus-within:outline-foco"
        >
          <Camera aria-hidden className="size-6" />
          Tomar foto
          <input
            id={id}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="sr-only"
            onChange={(e) => alCambiar(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}

/** Miniatura de un archivo privado (URL firmada); abre la imagen completa */
export function VerFoto({ bucket = 'comprobantes', ruta, etiqueta }: { bucket?: Bucket; ruta: string | null | undefined; etiqueta: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (!ruta) return;
    void urlFirmada(bucket, ruta).then((u) => {
      if (vivo) {
        setUrl(u);
        setFallo(!u);
      }
    });
    return () => {
      vivo = false;
    };
  }, [bucket, ruta]);
  if (!ruta) return <span className="text-sm text-tinta-2">Sin foto</span>;
  if (fallo) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-tinta-2">
        <ImageOff aria-hidden className="size-4" /> No se pudo cargar
      </span>
    );
  }
  if (!url) return <span className="block size-20 animate-pulse rounded-lg bg-superficie-2" aria-label="Cargando foto" />;
  if (ruta.endsWith('.pdf')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="font-bold text-via-acento underline underline-offset-4">
        Ver {etiqueta.toLowerCase()} (PDF)
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-block rounded-lg">
      <img src={url} alt={etiqueta} className="size-20 rounded-lg border-2 border-linea object-cover" loading="lazy" />
    </a>
  );
}

export function Seccion({ titulo, children, acciones, id }: { titulo: string; children: ReactNode; acciones?: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-extrabold">
          {titulo}
        </h2>
        {acciones}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border-2 border-linea bg-superficie p-4 ${className}`}>{children}</div>;
}
