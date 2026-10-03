import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { LoaderCircle } from 'lucide-react';

type Variante = 'principal' | 'secundario' | 'peligro' | 'fantasma' | 'sobreVia';
type Tamano = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTES: Record<Variante, string> = {
  principal: 'bg-via text-via-tinta border-via hover:bg-via-fuerte active:bg-via-fuerte',
  secundario: 'bg-superficie text-tinta border-tinta hover:bg-superficie-2 active:bg-superficie-2',
  peligro: 'bg-peligro text-peligro-tinta border-peligro hover:opacity-90',
  fantasma: 'bg-transparent text-tinta border-transparent hover:bg-superficie-2',
  sobreVia: 'bg-transparent text-via-tinta border-white/80 hover:bg-via-fuerte',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'min-h-10 px-3 text-sm gap-1.5',
  md: 'min-h-12 px-4 text-base gap-2',
  lg: 'min-h-14 px-5 text-lg gap-2',
  xl: 'min-h-[72px] px-6 text-xl gap-3',
};

export function clasesBoton(variante: Variante = 'secundario', tamano: Tamano = 'md', extra = '') {
  return `inline-flex items-center justify-center rounded-lg border-2 font-bold select-none transition-colors duration-150
    disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`;
}

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  icono?: ReactNode;
  bloque?: boolean;
}

export const Boton = forwardRef<HTMLButtonElement, PropsBoton>(function Boton(
  { variante = 'secundario', tamano = 'md', cargando, icono, bloque, className = '', children, disabled, type = 'button', ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={clasesBoton(variante, tamano, `${bloque ? 'w-full' : ''} ${className}`)}
      {...resto}
    >
      {cargando ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : icono}
      {children}
    </button>
  );
});

interface PropsBotonEnlace extends LinkProps {
  variante?: Variante;
  tamano?: Tamano;
  icono?: ReactNode;
  bloque?: boolean;
}

export function BotonEnlace({ variante = 'secundario', tamano = 'md', icono, bloque, className = '', children, ...resto }: PropsBotonEnlace) {
  return (
    <Link className={clasesBoton(variante, tamano, `${bloque ? 'w-full' : ''} ${className}`)} {...resto}>
      {icono}
      {children}
    </Link>
  );
}

// ----- Campos ------------------------------------------------------------------
interface PropsCampo {
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  error?: string | null;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
  className?: string;
  opcional?: boolean;
}

/** Etiqueta visible + control + ayuda + error junto al campo */
export function Campo({ etiqueta, ayuda, error, children, className = '', opcional }: PropsCampo) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descritoPor = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-base font-bold text-tinta">
        {etiqueta}
        {opcional && <span className="ml-1.5 text-sm font-normal text-tinta-2">(opcional)</span>}
      </label>
      {children({ id, 'aria-describedby': descritoPor, 'aria-invalid': error ? true : undefined })}
      {ayuda && !error && (
        <p id={idAyuda} className="text-sm text-tinta-2">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} role="alert" className="text-sm font-semibold text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

const BASE_ENTRADA = `w-full rounded-lg border-2 border-linea-fuerte bg-superficie px-3 text-tinta placeholder:text-tinta-2/80
  focus:border-foco focus:outline-none aria-[invalid=true]:border-peligro disabled:bg-superficie-2 disabled:text-tinta-2`;

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { grande?: boolean }>(function Entrada(
  { grande, className = '', ...resto },
  ref,
) {
  return <input ref={ref} className={`${BASE_ENTRADA} ${grande ? 'min-h-16 text-2xl font-bold' : 'min-h-12 text-base'} ${className}`} {...resto} />;
});

interface PropsNumero extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  unidad?: string;
  grande?: boolean;
}

/** Campo numérico con teclado decimal y unidad visible ("km", "L", "$") */
export const EntradaNumero = forwardRef<HTMLInputElement, PropsNumero>(function EntradaNumero(
  { unidad, grande, className = '', ...resto },
  ref,
) {
  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        className={`${BASE_ENTRADA} cifra ${grande ? 'min-h-16 text-3xl font-extrabold' : 'min-h-12 text-lg font-semibold'} ${unidad ? 'pr-16' : ''} ${className}`}
        {...resto}
      />
      {unidad && (
        <span aria-hidden className={`pointer-events-none absolute inset-y-0 right-3 flex items-center font-bold text-tinta-2 ${grande ? 'text-xl' : 'text-base'}`}>
          {unidad}
        </span>
      )}
    </div>
  );
});

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AreaTexto(
  { className = '', rows = 3, ...resto },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={`${BASE_ENTRADA} py-2.5 text-base ${className}`} {...resto} />;
});

export const Seleccion = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Seleccion(
  { className = '', children, ...resto },
  ref,
) {
  return (
    <select ref={ref} className={`${BASE_ENTRADA} min-h-12 appearance-auto text-base ${className}`} {...resto}>
      {children}
    </select>
  );
});

// ----- Segmentado (botones grandes para 2–5 opciones) ---------------------------------
export interface OpcionSegmento<T extends string> {
  valor: T;
  etiqueta: ReactNode;
  detalle?: ReactNode;
}

interface PropsSegmentado<T extends string> {
  opciones: OpcionSegmento<T>[];
  valor: T | null;
  alCambiar: (v: T) => void;
  etiqueta: string;
  grande?: boolean;
  columnas?: number;
  id?: string;
  error?: boolean;
}

export function Segmentado<T extends string>({ opciones, valor, alCambiar, etiqueta, grande, columnas, id, error }: PropsSegmentado<T>) {
  const cols = columnas ?? Math.min(opciones.length, 4);
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={etiqueta}
      aria-invalid={error || undefined}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => alCambiar(o.valor)}
            className={`flex flex-col items-center justify-center rounded-lg border-2 px-2 text-center font-bold transition-colors duration-150
              ${grande ? 'min-h-16 text-lg' : 'min-h-12 text-base'}
              ${activo ? 'border-tinta bg-tinta text-superficie' : `${error ? 'border-peligro' : 'border-linea-fuerte'} bg-superficie text-tinta hover:bg-superficie-2`}`}
          >
            <span className="cifra">{o.etiqueta}</span>
            {o.detalle && <span className={`text-xs font-semibold ${activo ? 'opacity-90' : 'text-tinta-2'}`}>{o.detalle}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Casilla({ etiqueta, checked, onChange, id }: { etiqueta: ReactNode; checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  const auto = useId();
  const i = id ?? auto;
  return (
    <label htmlFor={i} className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
      <input
        id={i}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-6 cursor-pointer accent-[var(--via)]"
      />
      <span>{etiqueta}</span>
    </label>
  );
}
