import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Gauge } from 'lucide-react';
import type { ErrorApp } from '@/lib/errores';
import { aNumero, num } from '@/lib/formato';

export type CalidadDato = 'exacto' | 'estimado' | 'incompleto';

const CALIDAD: Record<CalidadDato, { texto: string; clase: string; Icono: typeof CircleCheck; ayuda: string }> = {
  exacto: { texto: 'Exacto', clase: 'text-exacto', Icono: CircleCheck, ayuda: 'Salió con tanque lleno y cerró llenando.' },
  estimado: { texto: 'Estimado', clase: 'text-estimado', Icono: Gauge, ayuda: 'Interviene una lectura de aguja o litros declarados.' },
  incompleto: { texto: 'Incompleto', clase: 'text-incompleto', Icono: CircleAlert, ayuda: 'Falta el nivel al llegar; no entra en los promedios.' },
};

/** Calidad del dato: siempre ícono + texto, nunca solo color */
export function Calidad({ valor, compacta }: { valor: CalidadDato | string | null | undefined; compacta?: boolean }) {
  if (!valor || !(valor in CALIDAD)) return <span className="text-tinta-2">—</span>;
  const c = CALIDAD[valor as CalidadDato];
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${c.clase} ${compacta ? 'text-sm' : 'text-base'}`} title={c.ayuda}>
      <c.Icono aria-hidden className={compacta ? 'size-4' : 'size-5'} />
      {c.texto}
    </span>
  );
}

/** Rombo de señal preventiva (alertas). Amarillo con borde de asfalto. */
export function Rombo({ tamano = 22 }: { tamano?: number }) {
  return (
    <svg aria-hidden width={tamano} height={tamano} viewBox="0 0 24 24" className="shrink-0">
      <path d="M12 1.5 22.5 12 12 22.5 1.5 12Z" fill="var(--alerta)" stroke="#22272b" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 7v6.2" stroke="#22272b" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1.35" fill="#22272b" />
    </svg>
  );
}

/** ▲/▼ contra el período anterior, como en los reportes de IP */
export function Variacion({ valor, mejorSiSube, sufijo = '' }: { valor: number | null; mejorSiSube: boolean; sufijo?: string }) {
  if (valor === null || !Number.isFinite(valor)) return <span className="text-sm text-tinta-2">Sin período anterior</span>;
  if (Math.abs(valor) < 0.05) return <span className="cifra text-sm text-tinta-2">Sin cambio {sufijo}</span>;
  const sube = valor > 0;
  const bueno = sube === mejorSiSube;
  return (
    <span className={`cifra text-sm font-bold ${bueno ? 'text-via-acento' : 'text-peligro'}`}>
      <span aria-hidden>{sube ? '▲' : '▼'}</span> {num(Math.abs(valor), 1)} %{' '}
      <span className="font-normal text-tinta-2">
        <span className="sr-only">{sube ? 'más' : 'menos'} que el período anterior </span>
        {sufijo}
      </span>
    </span>
  );
}

export interface DatoKpi {
  titulo: string;
  valor: string;
  secundario?: ReactNode;
  variacion?: number | null;
  mejorSiSube?: boolean;
  nota?: string;
}

/** Fila de indicadores en un solo tablero con divisiones (no tarjetas sueltas) */
export function TableroKpis({ datos, cargando }: { datos: DatoKpi[]; cargando?: boolean }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border-2 border-linea bg-linea md:grid-cols-3 xl:grid-cols-6">
      {datos.map((d) => (
        <div key={d.titulo} className="flex flex-col gap-1 bg-superficie p-4">
          <dt className="text-sm font-semibold text-tinta-2">{d.titulo}</dt>
          <dd className="cifra text-2xl font-extrabold leading-tight text-tinta">
            {cargando ? <span className="inline-block h-7 w-28 animate-pulse rounded bg-superficie-2" /> : d.valor}
          </dd>
          {!cargando && d.secundario && <dd className="cifra text-sm text-tinta-2">{d.secundario}</dd>}
          {!cargando && d.variacion !== undefined && (
            <dd>
              <Variacion valor={d.variacion} mejorSiSube={d.mejorSiSube ?? true} />
            </dd>
          )}
          {!cargando && d.nota && <dd className="text-xs text-tinta-2">{d.nota}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function EstadoVacio({ titulo, children, accion, icono }: { titulo: string; children?: ReactNode; accion?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-linea-fuerte bg-superficie p-6">
      {icono}
      <p className="text-lg font-bold">{titulo}</p>
      {children && <div className="max-w-prose text-base text-tinta-2">{children}</div>}
      {accion}
    </div>
  );
}

export function Esqueleto({ alto = 'h-6', ancho = 'w-full', className = '' }: { alto?: string; ancho?: string; className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-lg bg-superficie-2 ${alto} ${ancho} ${className}`} />;
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex flex-col gap-3 py-2">
      <span className="sr-only">{texto}</span>
      <Esqueleto alto="h-8" ancho="w-1/3" />
      <Esqueleto alto="h-24" />
      <Esqueleto alto="h-24" />
    </div>
  );
}

export function MensajeError({ error, className = '' }: { error: ErrorApp; className?: string }) {
  return (
    <div role="alert" className={`flex gap-3 rounded-xl border-2 border-peligro bg-peligro-suave p-4 text-tinta ${className}`}>
      <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-peligro" />
      <div>
        <p className="font-bold">{error.mensaje}</p>
        {error.ayuda && <p className="mt-1 text-sm">{error.ayuda}</p>}
      </div>
    </div>
  );
}

export function AvisoAlerta({ children, titulo }: { children: ReactNode; titulo?: string }) {
  return (
    <div className="flex gap-3 rounded-xl border-2 border-alerta bg-alerta-suave p-4 text-tinta">
      <Rombo />
      <div>
        {titulo && <p className="font-bold">{titulo}</p>}
        <div className="text-base">{children}</div>
      </div>
    </div>
  );
}

/** Etiqueta pequeña de estado (no es un encabezado) */
export function Etiqueta({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'via' | 'alerta' | 'peligro' }) {
  const tonos = {
    neutro: 'border-linea-fuerte text-tinta-2',
    via: 'border-via-acento text-via-acento',
    alerta: 'border-alerta bg-alerta text-alerta-tinta',
    peligro: 'border-peligro text-peligro',
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border-2 px-2 py-0.5 text-sm font-bold ${tonos[tono]}`}>{children}</span>;
}

/** Valor con etiqueta para fichas y resúmenes */
export function Dato({ etiqueta, children, grande }: { etiqueta: string; children: ReactNode; grande?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-tinta-2">{etiqueta}</span>
      <span className={`cifra font-bold ${grande ? 'text-2xl' : 'text-lg'}`}>{children}</span>
    </div>
  );
}

export const esNumero = (v: unknown) => aNumero(v as number) !== null;
