import { useMemo, type ReactNode } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import type { EChartsOption } from 'echarts';
import { useEsOscuro } from '@/lib/ganchos';
import { num } from '@/lib/formato';
import { EstadoVacio } from '@/components/datos';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, AriaComponent, SVGRenderer]);

interface Tokens {
  tinta: string;
  tinta2: string;
  linea: string;
  superficie: string;
  combustible: string;
  mantenimiento: string;
  plantas: string;
  via: string;
  alerta: string;
  serie: string[];
}

function leerTokens(): Tokens {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    tinta: v('--tinta'),
    tinta2: v('--tinta-2'),
    linea: v('--linea'),
    superficie: v('--superficie'),
    combustible: v('--combustible'),
    mantenimiento: v('--mantenimiento'),
    plantas: v('--plantas'),
    via: v('--via-acento'),
    alerta: v('--alerta'),
    // series para camiones: colores de la señalización, distinguibles entre sí
    serie: [v('--combustible'), v('--mantenimiento'), v('--via-acento'), v('--plantas'), '#7d3c98', '#5d6d7e', '#b03a2e', '#117a65'],
  };
}

function useTokens(): Tokens {
  const oscuro = useEsOscuro();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => leerTokens(), [oscuro]);
}

function base(t: Tokens): EChartsOption {
  return {
    animation: false,
    textStyle: { fontFamily: '"Overpass Variable", Overpass, system-ui, sans-serif', color: t.tinta },
    aria: { enabled: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.superficie,
      borderColor: t.linea,
      borderWidth: 2,
      textStyle: { color: t.tinta, fontSize: 13 },
      axisPointer: { type: 'shadow' },
    },
    grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
  };
}

function eje(t: Tokens, extra: Record<string, unknown> = {}) {
  return {
    axisLine: { lineStyle: { color: t.linea } },
    axisTick: { show: false },
    axisLabel: { color: t.tinta2, fontSize: 12 },
    splitLine: { lineStyle: { color: t.linea, type: 'dashed' as const } },
    ...extra,
  };
}

/** Marco común: título, gráfico y tabla equivalente (accesibilidad y exportación) */
export function MarcoGrafico({ titulo, descripcion, children, tabla, vacio, alto = 300 }: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  tabla: { columnas: string[]; filas: (string | number)[][] };
  vacio?: boolean;
  alto?: number;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-linea bg-superficie p-4" aria-label={titulo}>
      <div>
        <h2 className="text-base font-extrabold">{titulo}</h2>
        {descripcion && <p className="text-sm text-tinta-2">{descripcion}</p>}
      </div>
      {vacio ? (
        <EstadoVacio titulo="Sin datos en este período">Cambia el período o los filtros.</EstadoVacio>
      ) : (
        <>
          <div style={{ height: alto }} aria-hidden>
            {children}
          </div>
          <details className="text-sm">
            <summary className="min-h-10 cursor-pointer py-2 font-semibold text-tinta-2">Ver como tabla</summary>
            <div className="max-h-72 overflow-auto">
              <table className="cifra w-full text-left">
                <thead>
                  <tr>
                    {tabla.columnas.map((c, i) => (
                      <th key={c} className={`border-b border-linea px-2 py-1 ${i > 0 ? 'text-right' : ''}`}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabla.filas.map((f, i) => (
                    <tr key={i}>
                      {f.map((c, j) => (
                        <td key={j} className={`border-b border-linea px-2 py-1 ${j > 0 ? 'text-right' : ''}`}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function Grafico({ opcion }: { opcion: EChartsOption }) {
  return <ReactEChartsCore echarts={echarts} option={opcion} notMerge style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />;
}

// ----- 1. Gasto mensual: combustible vs. mantenimiento -------------------------------------
export interface MesGasto {
  mes: string;
  etiqueta: string;
  camiones: number;
  plantas: number;
  mantenimiento: number;
}

export function GraficoGastoMensual({ meses }: { meses: MesGasto[] }) {
  const t = useTokens();
  const opcion: EChartsOption = {
    ...base(t),
    aria: { enabled: true, decal: { show: true } },
    legend: { top: 0, left: 0, textStyle: { color: t.tinta, fontSize: 13 }, itemWidth: 14, itemHeight: 14 },
    tooltip: { ...(base(t).tooltip as object), valueFormatter: (v) => `$ ${num(v as number, 2)}` },
    xAxis: { type: 'category', data: meses.map((m) => m.etiqueta), ...eje(t, { splitLine: { show: false } }) },
    yAxis: { type: 'value', name: 'USD', nameTextStyle: { color: t.tinta2 }, ...eje(t), axisLabel: { color: t.tinta2, formatter: (v: number) => num(v) } },
    series: [
      { name: 'Combustible camiones', type: 'bar', stack: 'g', data: meses.map((m) => m.camiones), itemStyle: { color: t.combustible } },
      { name: 'Combustible plantas', type: 'bar', stack: 'g', data: meses.map((m) => m.plantas), itemStyle: { color: t.plantas } },
      { name: 'Mantenimiento', type: 'bar', stack: 'g', data: meses.map((m) => m.mantenimiento), itemStyle: { color: t.mantenimiento }, barMaxWidth: 36 },
    ],
  };
  return (
    <MarcoGrafico
      titulo="Gasto mensual"
      descripcion="Combustible pagado y mantenimiento aprobado, en USD. Últimos 12 meses."
      vacio={!meses.some((m) => m.camiones + m.plantas + m.mantenimiento > 0)}
      tabla={{
        columnas: ['Mes', 'Camiones ($)', 'Plantas ($)', 'Mantenimiento ($)', 'Total ($)'],
        filas: meses.map((m) => [m.etiqueta, num(m.camiones, 2), num(m.plantas, 2), num(m.mantenimiento, 2), num(m.camiones + m.plantas + m.mantenimiento, 2)]),
      }}
    >
      <Grafico opcion={opcion} />
    </MarcoGrafico>
  );
}

// ----- Barras horizontales ordenadas (rendimiento, categorías, costo/km) -------------------------
export function GraficoBarrasH({
  titulo, descripcion, filas, formato, color = 'combustible', promedio, etiquetaPromedio, columnaValor, mayorEsMejor = true,
}: {
  titulo: string;
  descripcion?: string;
  filas: { nombre: string; valor: number }[];
  formato: (v: number) => string;
  color?: 'combustible' | 'mantenimiento' | 'via';
  promedio?: number | null;
  etiquetaPromedio?: string;
  columnaValor: string;
  mayorEsMejor?: boolean;
}) {
  const t = useTokens();
  const orden = [...filas].sort((a, b) => (mayorEsMejor ? a.valor - b.valor : b.valor - a.valor));
  const opcion: EChartsOption = {
    ...base(t),
    tooltip: { ...(base(t).tooltip as object), valueFormatter: (v) => formato(v as number) },
    grid: { left: 8, right: 56, top: promedio ? 28 : 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', ...eje(t), axisLabel: { color: t.tinta2, formatter: (v: number) => num(v, v % 1 ? 1 : 0) } },
    yAxis: { type: 'category', data: orden.map((f) => f.nombre), ...eje(t, { splitLine: { show: false } }), axisLabel: { color: t.tinta, fontSize: 13, fontWeight: 600 } },
    series: [
      {
        type: 'bar',
        data: orden.map((f) => f.valor),
        barMaxWidth: 22,
        itemStyle: { color: t[color] },
        label: { show: true, position: 'right', color: t.tinta, fontWeight: 700, formatter: (p) => formato(p.value as number) },
        markLine:
          promedio != null
            ? {
                symbol: 'none',
                lineStyle: { color: t.tinta, type: 'solid', width: 2 },
                label: { formatter: `${etiquetaPromedio ?? 'Promedio'}: ${formato(promedio)}`, color: t.tinta, fontWeight: 700, position: 'end' },
                data: [{ xAxis: promedio }],
              }
            : undefined,
      },
    ],
  };
  return (
    <MarcoGrafico
      titulo={titulo}
      descripcion={descripcion}
      vacio={filas.length === 0}
      alto={Math.max(160, orden.length * 38 + 48)}
      tabla={{ columnas: ['Nombre', columnaValor], filas: [...orden].reverse().map((f) => [f.nombre, formato(f.valor)]) }}
    >
      <Grafico opcion={opcion} />
    </MarcoGrafico>
  );
}

// ----- 3. Tendencia del rendimiento por camión ---------------------------------------------------------
export function GraficoTendencia({ meses, series }: { meses: { mes: string; etiqueta: string }[]; series: { nombre: string; valores: (number | null)[] }[] }) {
  const t = useTokens();
  const opcion: EChartsOption = {
    ...base(t),
    tooltip: { ...(base(t).tooltip as object), axisPointer: { type: 'line' }, valueFormatter: (v) => (v == null ? '—' : `${num(v as number, 2)} km/L`) },
    legend: { top: 0, left: 0, textStyle: { color: t.tinta, fontSize: 13 }, type: 'scroll' },
    grid: { left: 8, right: 24, top: 40, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: meses.map((m) => m.etiqueta), boundaryGap: false, ...eje(t, { splitLine: { show: false } }) },
    yAxis: { type: 'value', scale: true, ...eje(t), axisLabel: { color: t.tinta2, formatter: (v: number) => num(v, 1) } },
    series: series.map((s, i) => ({
      name: s.nombre,
      type: 'line',
      data: s.valores,
      connectNulls: true,
      symbol: ['circle', 'rect', 'triangle', 'diamond', 'roundRect', 'pin'][i % 6],
      symbolSize: 8,
      lineStyle: { width: 2.5, color: t.serie[i % t.serie.length] },
      itemStyle: { color: t.serie[i % t.serie.length] },
    })),
  };
  return (
    <MarcoGrafico
      titulo="Tendencia del rendimiento"
      descripcion="km/L por camión y mes (ponderado). Toca la leyenda para ocultar camiones."
      vacio={!series.some((s) => s.valores.some((v) => v != null))}
      tabla={{ columnas: ['Mes', ...series.map((s) => `${s.nombre} (km/L)`)], filas: meses.map((m, i) => [m.etiqueta, ...series.map((s) => (s.valores[i] == null ? '—' : num(s.valores[i], 2)))]) }}
    >
      <Grafico opcion={opcion} />
    </MarcoGrafico>
  );
}

// ----- 6. Costo por km por camión (combustible + mantenimiento) -------------------------------------------
export function GraficoCostoKm({ filas }: { filas: { nombre: string; combustible: number; mantenimiento: number }[] }) {
  const t = useTokens();
  const orden = [...filas].sort((a, b) => a.combustible + a.mantenimiento - (b.combustible + b.mantenimiento));
  const opcion: EChartsOption = {
    ...base(t),
    aria: { enabled: true, decal: { show: true } },
    tooltip: { ...(base(t).tooltip as object), valueFormatter: (v) => `$ ${num(v as number, 4)}/km` },
    legend: { top: 0, left: 0, textStyle: { color: t.tinta, fontSize: 13 } },
    grid: { left: 8, right: 72, top: 36, bottom: 8, containLabel: true },
    xAxis: { type: 'value', ...eje(t), axisLabel: { color: t.tinta2, formatter: (v: number) => num(v, 2) } },
    yAxis: { type: 'category', data: orden.map((f) => f.nombre), ...eje(t, { splitLine: { show: false } }), axisLabel: { color: t.tinta, fontSize: 13, fontWeight: 600 } },
    series: [
      { name: 'Combustible', type: 'bar', stack: 'c', data: orden.map((f) => f.combustible), itemStyle: { color: t.combustible }, barMaxWidth: 22 },
      {
        name: 'Mantenimiento', type: 'bar', stack: 'c', data: orden.map((f) => f.mantenimiento), itemStyle: { color: t.mantenimiento }, barMaxWidth: 22,
        label: { show: true, position: 'right', color: t.tinta, fontWeight: 700, formatter: (p) => `$ ${num(orden[p.dataIndex].combustible + orden[p.dataIndex].mantenimiento, 4)}` },
      },
    ],
  };
  return (
    <MarcoGrafico
      titulo="Costo por km por camión"
      descripcion="Gasto del período (combustible pagado + mantenimiento) entre los km recorridos."
      vacio={filas.length === 0}
      alto={Math.max(170, orden.length * 38 + 60)}
      tabla={{
        columnas: ['Camión', 'Combustible ($/km)', 'Mantenimiento ($/km)', 'Total ($/km)'],
        filas: [...orden].reverse().map((f) => [f.nombre, num(f.combustible, 4), num(f.mantenimiento, 4), num(f.combustible + f.mantenimiento, 4)]),
      }}
    >
      <Grafico opcion={opcion} />
    </MarcoGrafico>
  );
}

// ----- Rendimiento por viaje en el tiempo (ficha del camión) ------------------------------------------------
export function GraficoViajesEnElTiempo({ puntos, promedio }: { puntos: { fecha: string; etiqueta: string; valor: number; ruta: string }[]; promedio: number | null }) {
  const t = useTokens();
  const opcion: EChartsOption = {
    ...base(t),
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: 'item',
      formatter: (p) => {
        const x = puntos[(p as { dataIndex: number }).dataIndex];
        return `${x.etiqueta}<br/><b>${num(x.valor, 2)} km/L</b><br/>${x.ruta}`;
      },
    },
    grid: { left: 8, right: 24, top: 28, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: puntos.map((p) => p.etiqueta), ...eje(t, { splitLine: { show: false } }) },
    yAxis: { type: 'value', scale: true, ...eje(t), axisLabel: { color: t.tinta2, formatter: (v: number) => num(v, 1) } },
    series: [
      {
        type: 'line',
        data: puntos.map((p) => p.valor),
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 2, color: t.combustible },
        itemStyle: { color: t.combustible },
        markLine:
          promedio != null
            ? { symbol: 'none', lineStyle: { color: t.tinta, width: 2 }, label: { formatter: `Promedio ${num(promedio, 2)} km/L`, color: t.tinta, fontWeight: 700 }, data: [{ yAxis: promedio }] }
            : undefined,
      },
    ],
  };
  return (
    <MarcoGrafico
      titulo="Rendimiento por viaje"
      descripcion="Cada punto es una ruta cerrada; la raya es su promedio ponderado del período."
      vacio={puntos.length === 0}
      tabla={{ columnas: ['Fecha', 'Ruta', 'km/L'], filas: puntos.map((p) => [p.etiqueta, p.ruta, num(p.valor, 2)]) }}
    >
      <Grafico opcion={opcion} />
    </MarcoGrafico>
  );
}
