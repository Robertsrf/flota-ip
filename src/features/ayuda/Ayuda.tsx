import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { Calidad } from '@/components/datos';
import { EncabezadoPagina } from '@/components/estructura';
import { useSesion, type Rol } from '@/lib/sesion';

interface Termino {
  nombre: string;
  texto: ReactNode;
}

const CIFRAS: Termino[] = [
  { nombre: 'Km recorridos', texto: 'Km del tablero al llegar menos km al salir, en cada ruta.' },
  {
    nombre: 'Litros consumidos',
    texto: 'Lo que tenía el tanque al salir, más lo que se cargó en el camino, menos lo que quedó al llegar. Por eso importa decir bien el nivel al salir y al llegar.',
  },
  {
    nombre: 'Rendimiento (km/L)',
    texto: 'Cuántos km hace el camión con un litro. Más alto es mejor. Para la flota o un mes se divide el total de km entre el total de litros; no se promedian los viajes.',
  },
  { nombre: 'L/100 km', texto: 'Litros que gasta para recorrer 100 km. Es el mismo dato visto al revés: más bajo es mejor.' },
  { nombre: 'Costo del viaje', texto: 'Litros consumidos por el precio promedio de las cargas de esa ruta. Si en la ruta no hubo cargas, se usa el precio de la última carga del camión.' },
  {
    nombre: 'Gasto de combustible',
    texto: 'Lo que se pagó en cargas. No es igual a la suma del costo de los viajes: lo que se carga hoy puede quedar en el tanque para la próxima ruta.',
  },
  { nombre: 'Costo por km', texto: 'Combustible más mantenimiento aprobado, dividido entre los km recorridos. Más bajo es mejor.' },
  {
    nombre: '▲ y ▼',
    texto: 'Cuánto cambió la cifra contra los mismos días del período anterior. Verde es mejora y rojo es empeora. Si el período anterior tiene menos de 3 viajes no se compara.',
  },
  { nombre: 'Ciclo lleno a lleno', texto: 'Rendimiento medido entre dos cargas con el tanque lleno. Sirve para confirmar los viajes: si en un mes no cuadran por más de 10 %, aparece una alerta.' },
  { nombre: 'Tasa BCV', texto: 'Los gastos pagados en bolívares se pasan a dólares con la tasa oficial del día del gasto. Todos los totales están en dólares; los Bs son solo referencia.' },
  { nombre: 'Folios', texto: 'Cada registro tiene un número para buscarlo o citarlo por teléfono: V- rutas, R- repostajes y M- gastos de mantenimiento.' },
];

const CALIDADES: { valor: 'exacto' | 'estimado' | 'incompleto'; texto: string }[] = [
  { valor: 'exacto', texto: 'Salió con el tanque lleno y llegó llenándolo. La cifra es de fiar.' },
  { valor: 'estimado', texto: 'Se usó la aguja (1/2, 3/4) o litros dichos por el chofer. Sirve, pero puede variar unos litros.' },
  { valor: 'incompleto', texto: 'Falta saber cuánto quedó al llegar. No entra en los promedios hasta que se corrija.' },
];

const PASOS: Record<'chofer' | 'flota' | 'consulta', { titulo: string; pasos: { nombre: string; texto: ReactNode }[] }> = {
  chofer: {
    titulo: 'Para el chofer',
    pasos: [
      { nombre: 'Iniciar ruta', texto: 'En la cabina revisa el camión ("Cambiar" si es otro), toca "Iniciar ruta", elige el destino (o varias paradas en orden), confirma el km del tablero y cuánto combustible tiene.' },
      { nombre: 'Repostar', texto: 'Toca "Repostaje": km del tablero, litros, precio y si llenaste el tanque. La foto del recibo es opcional.' },
      { nombre: 'Gasto', texto: 'Lavado, cauchos o un repuesto en la calle: toca "Gasto". Queda por aprobar hasta que flota lo revise.' },
      { nombre: 'Finalizar ruta', texto: 'Al llegar: km del tablero y si repostaste. Si no llenaste el tanque, di cómo quedó la aguja. Verás el rendimiento del viaje.' },
      { nombre: 'Sin señal', texto: 'Registra igual: se guarda en el teléfono y se envía solo cuando vuelva la señal. Arriba verás cuántos registros esperan envío.' },
      { nombre: 'Me equivoqué', texto: 'Justo después de registrar tienes 10 segundos para "Deshacer". Durante 30 minutos puedes corregir la ruta desde su resumen. Después, pídele la corrección a flota.' },
    ],
  },
  flota: {
    titulo: 'Para flota',
    pasos: [
      { nombre: 'Revisión diaria', texto: <>Entra a <Link to="/revision" className="font-bold underline underline-offset-4">Revisión</Link>: aprueba o rechaza los gastos de los choferes, cierra las rutas que quedaron abiertas y lee las novedades.</> },
      { nombre: 'Vencimientos', texto: <>En <Link to="/vencimientos" className="font-bold underline underline-offset-4">Vencimientos</Link> programa los servicios (aceite cada tantos km) y carga los documentos (póliza RCV, licencias). El sistema avisa antes.</> },
      { nombre: 'Corregir sin borrar', texto: 'Nada se borra: un registro equivocado se corrige o se anula con un motivo, y queda en el historial de cambios. El superusuario puede restaurar lo anulado.' },
      { nombre: 'Choferes y PIN', texto: <>En <Link to="/usuarios" className="font-bold underline underline-offset-4">Usuarios</Link> da de alta al chofer con su usuario y un PIN de 6 dígitos. Si lo olvida, toca su nombre y "Nuevo PIN". Entrégalo en persona.</> },
      { nombre: 'Catálogos', texto: <>Destinos, precios por litro, categorías de gasto y tasa BCV están en <Link to="/catalogos" className="font-bold underline underline-offset-4">Catálogos</Link>. Un destino con viajes no se borra: se archiva.</> },
    ],
  },
  consulta: {
    titulo: 'Para la gerencia',
    pasos: [
      { nombre: 'De un vistazo', texto: 'El dashboard abre con seis cifras del mes: gasto total, combustible, mantenimiento, km, rendimiento y costo por km. Toca el nombre de cada una para ver qué significa.' },
      { nombre: 'Qué se desvía', texto: 'Las alertas muestran primero lo urgente: rutas abiertas de más, consumos raros, servicios y documentos vencidos.' },
      { nombre: 'Filtrar y comparar', texto: 'Cambia el período, el camión, el chofer o el destino. Los filtros quedan en la dirección de la página: puedes compartir el enlace.' },
      { nombre: 'Llevarlo a Excel', texto: 'Cada tabla tiene botones CSV y Excel con lo que estás viendo.' },
    ],
  },
};

const PREGUNTAS: { p: string; r: ReactNode }[] = [
  { p: '¿Por qué un viaje sale "Incompleto"?', r: 'Porque al llegar no se llenó el tanque ni se dijo cómo quedó la aguja. Flota puede corregir la ruta con el nivel al llegar y el cálculo se rehace solo.' },
  { p: '¿Por qué el gasto de combustible no es igual a la suma de los viajes?', r: 'El gasto es lo que se pagó en cargas; el costo de los viajes es lo que se consumió. Una carga de hoy puede usarse en la ruta de mañana o en otro mes.' },
  { p: '¿Se puede borrar un registro?', r: 'No. Se anula con un motivo y deja de contar en las cifras, pero queda en el historial. Así nadie pierde información por un error.' },
  { p: '¿Qué pasa si un chofer olvida finalizar la ruta?', r: 'A las 48 horas aparece en la revisión. Flota la finaliza con los datos que tenga y queda marcada para revisar.' },
  { p: '¿Cómo instalo la app en el teléfono?', r: 'En Android, con Chrome: menú ⋮ y "Instalar app" o "Agregar a la pantalla principal". En iPhone, con Safari: botón Compartir y "Agregar a inicio". Se abre como una app más.' },
  { p: 'Olvidé mi PIN o mi contraseña', r: 'Pídele a flota (o al superusuario) uno nuevo. Por seguridad no se envía por correo.' },
  { p: '¿Funciona sin internet?', r: 'La cabina del chofer sí: iniciar y finalizar rutas, repostajes y gastos se guardan en el teléfono. La oficina (dashboard, tablas) necesita conexión.' },
  { p: '¿Cómo sé qué cambió en el sistema?', r: <>En <Link to="/novedades" className="font-bold underline underline-offset-4">Novedades</Link> está cada versión con su fecha y lo que trajo.</> },
];

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20 flex flex-col gap-3">
      <h2 id={`${id}-titulo`} className="text-xl font-extrabold">{titulo}</h2>
      {children}
    </section>
  );
}

function ordenRoles(rol: Rol | null): ('chofer' | 'flota' | 'consulta')[] {
  if (rol === 'chofer') return ['chofer', 'flota', 'consulta'];
  if (rol === 'consulta') return ['consulta', 'flota', 'chofer'];
  return ['flota', 'consulta', 'chofer'];
}

export function Ayuda() {
  const { rol } = useSesion();
  const roles = ordenRoles(rol);
  const indice = [
    ...roles.map((r) => ({ id: r, titulo: PASOS[r].titulo })),
    { id: 'cifras', titulo: 'Qué significa cada cifra' },
    { id: 'calidad', titulo: 'Calidad del dato' },
    { id: 'preguntas', titulo: 'Preguntas frecuentes' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Ayuda" descripcion="Cómo se usa Flota IP y qué significa cada cifra. Primero lo de tu rol." />
      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="En esta página" className="lg:sticky lg:top-8 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {indice.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-11 items-center rounded-lg border-2 border-linea bg-superficie px-3 text-sm font-bold hover:border-tinta lg:w-full lg:border-transparent lg:bg-transparent">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex max-w-3xl flex-col gap-10">
          {roles.map((r) => (
            <Seccion key={r} id={r} titulo={PASOS[r].titulo}>
              <ol className="flex flex-col gap-3">
                {PASOS[r].pasos.map((p, i) => (
                  <li key={p.nombre} className="flex gap-3">
                    <span aria-hidden className="cifra grid size-8 shrink-0 place-items-center rounded bg-via text-sm font-black text-via-tinta">{i + 1}</span>
                    <div>
                      <p className="font-bold">{p.nombre}</p>
                      <p className="text-base leading-relaxed">{p.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Seccion>
          ))}
          <Seccion id="cifras" titulo="Qué significa cada cifra">
            <dl className="flex flex-col divide-y divide-linea rounded-xl border-2 border-linea bg-superficie">
              {CIFRAS.map((t) => (
                <div key={t.nombre} className="flex flex-col gap-1 p-4 md:flex-row md:gap-6">
                  <dt className="font-bold md:w-48 md:shrink-0">{t.nombre}</dt>
                  <dd className="text-base leading-relaxed">{t.texto}</dd>
                </div>
              ))}
            </dl>
          </Seccion>
          <Seccion id="calidad" titulo="Calidad del dato">
            <p className="text-base leading-relaxed">Cada cálculo dice qué tan seguro es, con ícono y palabra:</p>
            <ul className="flex flex-col gap-3">
              {CALIDADES.map((c) => (
                <li key={c.valor} className="flex flex-col gap-1 rounded-xl border-2 border-linea bg-superficie p-4">
                  <Calidad valor={c.valor} />
                  <span className="text-base leading-relaxed">{c.texto}</span>
                </li>
              ))}
            </ul>
          </Seccion>
          <Seccion id="preguntas" titulo="Preguntas frecuentes">
            <div className="flex flex-col gap-2">
              {PREGUNTAS.map((q) => (
                <details key={q.p} className="group rounded-xl border-2 border-linea bg-superficie">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold [&::-webkit-details-marker]:hidden">
                    {q.p}
                    <Plus aria-hidden className="size-5 shrink-0 text-tinta-2 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="px-4 pb-4 text-base leading-relaxed">{q.r}</p>
                </details>
              ))}
            </div>
          </Seccion>
        </div>
      </div>
    </div>
  );
}
