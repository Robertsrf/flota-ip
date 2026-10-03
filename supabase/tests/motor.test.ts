import { beforeAll, describe, expect, it } from 'vitest';
import {
  consultar, crearCamion, crearPlanta, error, escenario, finalizar, iniciar, n, repostar, rpc, uuid,
  type Escenario, type Fila,
} from './helpers';

// Casos de la sección 12 del handoff. Camión de prueba: 200 L.
let e: Escenario;

beforeAll(async () => {
  e = await escenario();
}, 60_000);

describe('motor de cálculo por viaje', () => {
  it('T1 · sale lleno, llega a 10.400 y llena con 80 L a $0,60', async () => {
    const c = await crearCamion(e.db, { placa: 'T1-001' });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000, fuente: 'lleno' });
    const f = await finalizar(e, e.u.chofer1, v.id as string, { km: 10400, reposto: true, litros: 80, precio: e.p.p060 });
    expect(n(f.km_recorridos)).toBe(400);
    expect(n(f.litros_consumidos)).toBe(80);
    expect(n(f.rendimiento_kml)).toBe(5);
    expect(n(f.litros_100km)).toBe(20);
    expect(n(f.costo_combustible_usd)).toBe(48);
    expect(n(f.costo_km_usd)).toBe(0.12);
    expect(f.calidad).toBe('exacto');
    expect(f.estado).toBe('cerrado');
    const [u] = await consultar(e.db, null, `select estado from public.unidades where id = $1`, [c]);
    expect(u.estado).toBe('disponible');
  });

  it('T2 · sale a medio tanque (aguja) y llena con 180 L a $0,50', async () => {
    const c = await crearCamion(e.db, { placa: 'T2-001', inicial: 100 });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000, fuente: 'aguja', litros: 100 });
    const f = await finalizar(e, e.u.chofer1, v.id as string, { km: 10400, reposto: true, litros: 180, precio: e.p.p050 });
    expect(n(f.litros_consumidos)).toBe(80);
    expect(n(f.rendimiento_kml)).toBe(5);
    expect(n(f.costo_combustible_usd)).toBe(40);
    expect(f.calidad).toBe('estimado');
  });

  it('T3 · carga parcial en el camino y llena al llegar', async () => {
    const c = await crearCamion(e.db, { placa: 'T3-001' });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000 });
    const r = await repostar(e, e.u.chofer1, c, { lectura: 10250, litros: 40, precio: e.p.p050, lleno: false });
    expect(r.viaje_id).toBe(v.id);
    const f = await finalizar(e, e.u.chofer1, v.id as string, { km: 10600, reposto: true, litros: 70, precio: e.p.p060 });
    expect(n(f.km_recorridos)).toBe(600);
    expect(n(f.litros_consumidos)).toBe(110);
    expect(n(f.rendimiento_kml)).toBe(5.45);
    expect(n(f.costo_combustible_usd)).toBe(62);
    expect(n(f.costo_km_usd)).toBe(0.1033);
    expect(f.calidad).toBe('exacto');
  });

  it('T4 · no repostó al llegar: aguja 3/4 y precio de la última carga', async () => {
    const c = await crearCamion(e.db, { placa: 'T4-001', lectura: 9900, inicial: 150 });
    await repostar(e, e.u.flota, c, { lectura: 10000, litros: 60, precio: e.p.p060, fecha: '2026-09-09T17:00:00-04:00' });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000, fuente: 'heredado' });
    expect(v.fuente_nivel_salida).toBe('heredado');
    const f = await finalizar(e, e.u.chofer1, v.id as string, { km: 10300, reposto: false, aguja: 150 });
    expect(n(f.litros_consumidos)).toBe(50);
    expect(n(f.rendimiento_kml)).toBe(6);
    expect(n(f.costo_combustible_usd)).toBe(30);
    expect(f.calidad).toBe('estimado');
  });

  it('T5 · km de llegada menor que el de salida: rechazado con mensaje claro', async () => {
    const c = await crearCamion(e.db, { placa: 'T5-001' });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000 });
    const err = await error(finalizar(e, e.u.chofer1, v.id as string, { km: 9990, reposto: false, aguja: 150 }));
    expect(err.message).toBe('El km de llegada (9.990) es menor que el de salida (10.000). Revísalo en el tablero.');
    await rpc(e.db, e.u.flota, 'anular_registro', { p_tabla: 'viajes', p_id: v.id, p_motivo: 'Limpieza de la prueba' });
  });

  it('T6 · carga de 250 L en un tanque de 200 L: rechazada', async () => {
    const c = await crearCamion(e.db, { placa: 'T6-001' });
    const err = await error(repostar(e, e.u.flota, c, { lectura: 10010, litros: 250, precio: e.p.p050 }));
    expect(err.detail).toBe('LITROS_SUPERAN_TANQUE');
    expect(err.message).toContain('250,00 L');
    expect(err.message).toContain('200,00 L');
  });

  it('T7 · ciclo lleno a lleno: 700 km, 120 L, 5,83 km/L', async () => {
    const c = await crearCamion(e.db, { placa: 'T7-001' });
    await repostar(e, e.u.flota, c, { lectura: 10300, litros: 30, precio: e.p.p050, lleno: false, fecha: '2026-09-11T08:00:00-04:00' });
    await repostar(e, e.u.flota, c, { lectura: 10700, litros: 90, precio: e.p.p050, lleno: true, fecha: '2026-09-12T08:00:00-04:00' });
    const ciclos = await consultar(e.db, e.u.consulta, `select * from public.v_ciclos_combustible where unidad_id = $1`, [c]);
    expect(ciclos).toHaveLength(1);
    expect(n(ciclos[0].distancia)).toBe(700);
    expect(n(ciclos[0].litros)).toBe(120);
    expect(n(ciclos[0].rendimiento)).toBe(5.83);
    expect(ciclos[0].invalido).toBe(false);
  });

  it('T8 · nivel heredado tras T1: propone tanque lleno y puede quedar exacto', async () => {
    const c = await crearCamion(e.db, { placa: 'T8-001' });
    const v1 = await iniciar(e, e.u.chofer1, c, { km: 10000 });
    await finalizar(e, e.u.chofer1, v1.id as string, { km: 10400, reposto: true, litros: 80, precio: e.p.p060 });
    const [sug] = await rpc<Fila[]>(e.db, e.u.chofer1, 'sugerir_nivel_salida', { p_unidad: c, p_km: 10400 });
    expect(sug.fuente).toBe('heredado');
    expect(n(sug.litros)).toBe(200);
    expect(sug.descripcion).toMatch(/^Tanque lleno \(cierre de la ruta V-\d{4}\)$/);
    const v2 = await iniciar(e, e.u.chofer1, c, {
      km: 10400, fuente: 'heredado', salida: '2026-09-11T08:00:00-04:00',
    });
    expect(v2.fuente_nivel_salida).toBe('heredado');
    const f = await finalizar(e, e.u.chofer1, v2.id as string, {
      km: 10800, reposto: true, litros: 75, precio: e.p.p060, llegada: '2026-09-11T14:00:00-04:00',
    });
    expect(f.calidad).toBe('exacto');
    expect(n(f.litros_consumidos)).toBe(75);
  });

  it('T8b · lejos del último lleno no se propone herencia', async () => {
    const c = await crearCamion(e.db, { placa: 'T8-002' });
    const sug = await rpc<Fila[]>(e.db, e.u.chofer1, 'sugerir_nivel_salida', { p_unidad: c, p_km: 10050 });
    expect(sug).toHaveLength(0);
  });

  it('T9 · mantenimiento en Bs: 37.900,00 a 379,00 = $100,00', async () => {
    const c = await crearCamion(e.db, { placa: 'T9-001' });
    const [cat] = await consultar(e.db, null, `select id from public.categorias_mantenimiento where nombre = 'Cauchos'`);
    const m = await rpc(e.db, e.u.flota, 'registrar_mantenimiento', {
      p_id: uuid(), p_unidad_id: c, p_categoria_id: cat.id, p_fecha: '2026-09-15',
      p_moneda: 'VES', p_monto: 37900, p_bs_por_usd: 379,
    });
    expect(n(m.monto_usd)).toBe(100);
    expect(n(m.monto_bs)).toBe(37900);
    expect(m.estado_aprobacion).toBe('aprobado');
    const [t] = await consultar(e.db, null, `select * from public.tasas_bcv where fecha = '2026-09-15'`);
    expect(t.manual).toBe(true);
    const k = await rpc(e.db, e.u.consulta, 'kpis_periodo', { p_desde: '2026-09-15', p_hasta: '2026-09-15', p_unidad: c });
    expect(n(k.gasto_mant)).toBe(100);
    expect(n(k.gasto_total)).toBe(100);
  });

  it('T12 · el mismo id enviado dos veces crea un solo registro', async () => {
    const c = await crearCamion(e.db, { placa: 'T12-001' });
    const id = uuid();
    const a = await iniciar(e, e.u.chofer2, c, { id, km: 10000 });
    const b = await iniciar(e, e.u.chofer2, c, { id, km: 10000 });
    expect(b.folio).toBe(a.folio);
    const rid = uuid();
    const f1 = await finalizar(e, e.u.chofer2, id, { km: 10100, reposto: true, litros: 20, precio: e.p.p050, repostajeId: rid });
    const f2 = await finalizar(e, e.u.chofer2, id, { km: 10100, reposto: true, litros: 20, precio: e.p.p050, repostajeId: rid });
    expect(f2.costo_combustible_usd).toEqual(f1.costo_combustible_usd);
    const viajes = await consultar(e.db, null, `select count(*)::int as c from public.viajes where id = $1`, [id]);
    const cargas = await consultar(e.db, null, `select count(*)::int as c from public.repostajes where viaje_id = $1`, [id]);
    expect(viajes[0].c).toBe(1);
    expect(cargas[0].c).toBe(1);
    const gid = uuid();
    await repostar(e, e.u.chofer2, c, { id: gid, lectura: 10150, litros: 10, precio: e.p.p050, fecha: '2026-09-11T08:00:00-04:00' });
    await repostar(e, e.u.chofer2, c, { id: gid, lectura: 10150, litros: 10, precio: e.p.p050, fecha: '2026-09-11T08:00:00-04:00' });
    const sueltas = await consultar(e.db, null, `select count(*)::int as c from public.repostajes where id = $1`, [gid]);
    expect(sueltas[0].c).toBe(1);
  });

  it('T14 · rutas simultáneas: chofer con ruta abierta o camión en ruta, rechazado', async () => {
    const c1 = await crearCamion(e.db, { placa: 'T14-001' });
    const c2 = await crearCamion(e.db, { placa: 'T14-002' });
    const v = await iniciar(e, e.u.chofer1, c1, { km: 10000 });
    const e1 = await error(iniciar(e, e.u.chofer1, c2, { km: 10000 }));
    expect(e1.detail).toBe('RUTA_ABIERTA_CHOFER');
    expect(e1.message).toMatch(/^Ya hay una ruta abierta para este chofer \(V-\d{4} a Valera/);
    const e2 = await error(iniciar(e, e.u.chofer2, c1, { km: 10000 }));
    expect(e2.detail).toBe('UNIDAD_EN_RUTA');
    expect(e2.message).toContain('ya está en ruta');
    await rpc(e.db, e.u.chofer1, 'anular_registro', { p_tabla: 'viajes', p_id: v.id, p_motivo: 'Deshecho por el chofer' });
    const [u] = await consultar(e.db, null, `select estado from public.unidades where id = $1`, [c1]);
    expect(u.estado).toBe('disponible');
  });
});

describe('validaciones de la sección 8.5', () => {
  it('km de salida menor que el último conocido: el chofer no puede; flota sí con motivo', async () => {
    const c = await crearCamion(e.db, { placa: 'V-KM-01' });
    const err = await error(iniciar(e, e.u.chofer1, c, { km: 9500 }));
    expect(err.detail).toBe('KM_MENOR_ACTUAL');
    expect(err.message).toContain('(9.500)');
    expect(err.message).toContain('(10.000)');
    const v = await rpc(e.db, e.u.flota, 'iniciar_viaje', {
      p_id: uuid(), p_unidad_id: c, p_paradas: [e.l.valera], p_salida_at: '2026-09-10T08:00:00-04:00',
      p_km_salida: 9500, p_litros_salida: null, p_fuente_nivel: 'lleno', p_chofer_id: e.u.chofer2,
      p_motivo: 'Se cambió el tablero',
    });
    expect(v.chofer_id).toBe(e.u.chofer2);
    await rpc(e.db, e.u.flota, 'anular_registro', { p_tabla: 'viajes', p_id: v.id, p_motivo: 'Limpieza' });
  });

  it('consumo no positivo al finalizar: bloquea', async () => {
    const c = await crearCamion(e.db, { placa: 'V-CN-01', inicial: 50 });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000, fuente: 'aguja', litros: 50 });
    const err = await error(finalizar(e, e.u.chofer1, v.id as string, { km: 10100, reposto: false, aguja: 60 }));
    expect(err.detail).toBe('CONSUMO_NO_POSITIVO');
    await rpc(e.db, e.u.flota, 'anular_registro', { p_tabla: 'viajes', p_id: v.id, p_motivo: 'Limpieza' });
  });

  it('rendimiento fuera del rango del camión: permite y marca revisar', async () => {
    const c = await crearCamion(e.db, { placa: 'V-RG-01', min: 3, max: 8 });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000 });
    const f = await finalizar(e, e.u.chofer1, v.id as string, { km: 10100, reposto: true, litros: 80, precio: e.p.p050 });
    expect(n(f.rendimiento_kml)).toBe(1.25);
    expect(f.revisar).toBe(true);
    expect(f.revisar_motivos).toContain('rendimiento_fuera_rango');
  });

  it('nivel de salida mayor que el tanque: bloquea', async () => {
    const c = await crearCamion(e.db, { placa: 'V-NV-01' });
    const err = await error(iniciar(e, e.u.chofer1, c, { km: 10000, fuente: 'litros', litros: 210 }));
    expect(err.detail).toBe('NIVEL_SUPERA_TANQUE');
  });

  it('sin repostaje ni aguja al llegar: el viaje queda incompleto', async () => {
    const c = await crearCamion(e.db, { placa: 'V-IN-01' });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000 });
    const f = await finalizar(e, e.u.chofer1, v.id as string, { km: 10200, reposto: false, aguja: null });
    expect(f.calidad).toBe('incompleto');
    expect(f.litros_consumidos).toBeNull();
    expect(n(f.km_recorridos)).toBe(200);
  });
});

describe('agregados, anulación y auditoría', () => {
  it('T10 · T1 + T3 en el mismo mes: ponderado 5,26 km/L, $110,00, $0,1100/km', async () => {
    const a = await crearCamion(e.db, { placa: 'T10-001' });
    const b = await crearCamion(e.db, { placa: 'T10-002' });
    const v1 = await iniciar(e, e.u.chofer1, a, { km: 10000, salida: '2026-08-05T08:00:00-04:00' });
    await finalizar(e, e.u.chofer1, v1.id as string, {
      km: 10400, reposto: true, litros: 80, precio: e.p.p060, llegada: '2026-08-05T15:00:00-04:00',
    });
    const v2 = await iniciar(e, e.u.chofer1, b, { km: 10000, salida: '2026-08-06T08:00:00-04:00' });
    await repostar(e, e.u.chofer1, b, { lectura: 10250, litros: 40, precio: e.p.p050, lleno: false, fecha: '2026-08-06T11:00:00-04:00' });
    await finalizar(e, e.u.chofer1, v2.id as string, {
      km: 10600, reposto: true, litros: 70, precio: e.p.p060, llegada: '2026-08-06T17:00:00-04:00',
    });
    const k = await rpc(e.db, e.u.consulta, 'kpis_periodo', { p_desde: '2026-08-01', p_hasta: '2026-08-31' });
    expect(n(k.km)).toBe(1000);
    expect(n(k.litros)).toBe(190);
    expect(n(k.rendimiento)).toBe(5.26);
    expect(n(k.costo_viajes)).toBe(110);
    expect(n(k.costo_km_comb)).toBe(0.11);
    expect(n(k.gasto_comb)).toBe(110);
    const [mes] = await consultar(e.db, e.u.consulta, `select * from public.v_kpi_flota_mes where mes = '2026-08-01'`);
    expect(n(mes.rendimiento)).toBe(5.26);
    expect(n(mes.km)).toBe(1000);
  });

  it('T11 · anular la carga de cierre de T1: viaje incompleto, auditoría y dashboard al día', async () => {
    const c = await crearCamion(e.db, { placa: 'T11-001' });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000, salida: '2026-07-05T08:00:00-04:00' });
    await finalizar(e, e.u.chofer1, v.id as string, {
      km: 10400, reposto: true, litros: 80, precio: e.p.p060, llegada: '2026-07-05T15:00:00-04:00',
    });
    const [carga] = await consultar(e.db, null, `select id from public.repostajes where viaje_id = $1`, [v.id]);
    await rpc(e.db, e.u.flota, 'anular_registro', { p_tabla: 'repostajes', p_id: carga.id, p_motivo: 'Recibo duplicado' });
    const [vj] = await consultar(e.db, null, `select * from public.viajes where id = $1`, [v.id]);
    expect(vj.calidad).toBe('incompleto');
    expect(vj.litros_consumidos).toBeNull();
    const aud = await consultar(e.db, e.u.flota, `select * from public.auditoria where registro_id = $1`, [carga.id]);
    expect(aud).toHaveLength(1);
    expect(aud[0].accion).toBe('anular');
    expect(aud[0].motivo).toBe('Recibo duplicado');
    expect(aud[0].usuario_id).toBe(e.u.flota);
    const k = await rpc(e.db, e.u.consulta, 'kpis_periodo', { p_desde: '2026-07-01', p_hasta: '2026-07-31', p_unidad: c });
    expect(n(k.litros)).toBe(0);
    expect(n(k.gasto_comb)).toBe(0);
    expect(n(k.km_total)).toBe(400);
  });

  it('corrección de flota recalcula el viaje y queda auditada', async () => {
    const c = await crearCamion(e.db, { placa: 'COR-001' });
    const v = await iniciar(e, e.u.chofer1, c, { km: 10000, salida: '2026-09-20T08:00:00-04:00' });
    await finalizar(e, e.u.chofer1, v.id as string, {
      km: 10400, reposto: true, litros: 80, precio: e.p.p060, llegada: '2026-09-20T15:00:00-04:00',
    });
    const r = await rpc(e.db, e.u.flota, 'corregir_registro', {
      p_tabla: 'viajes', p_id: v.id, p_cambios: { km_llegada: 10480 }, p_motivo: 'Foto del tablero dice 10.480',
    });
    expect(n(r.km_recorridos)).toBe(480);
    expect(n(r.rendimiento_kml)).toBe(6);
    const aud = await consultar(e.db, e.u.flota, `select * from public.auditoria where registro_id = $1 and accion = 'update'`, [v.id]);
    expect(aud).toHaveLength(1);
    expect(aud[0].antes).toEqual({ km_llegada: 10400 });
    expect(aud[0].despues).toEqual({ km_llegada: 10480 });
  });

  it('superusuario restaura un registro anulado', async () => {
    const c = await crearCamion(e.db, { placa: 'RES-001' });
    const r = await repostar(e, e.u.flota, c, { lectura: 10010, litros: 20, precio: e.p.p050 });
    await rpc(e.db, e.u.flota, 'anular_registro', { p_tabla: 'repostajes', p_id: r.id, p_motivo: 'Error' });
    const err = await error(rpc(e.db, e.u.flota, 'restaurar_registro', { p_tabla: 'repostajes', p_id: r.id, p_motivo: 'x' }));
    expect(err.code).toBe('42501');
    await rpc(e.db, e.u.super, 'restaurar_registro', { p_tabla: 'repostajes', p_id: r.id, p_motivo: 'Era válida' });
    const [x] = await consultar(e.db, null, `select anulado from public.repostajes where id = $1`, [r.id]);
    expect(x.anulado).toBe(false);
  });
});

describe('decisiones del checkpoint F0', () => {
  it('paradas múltiples: el destino principal es la última parada', async () => {
    const c = await crearCamion(e.db, { placa: 'PAR-001' });
    const v = await iniciar(e, e.u.chofer2, c, { km: 10000, paradas: [e.l.valera, e.l.merida, e.l.maracaibo] });
    expect(v.destino_id).toBe(e.l.maracaibo);
    const [vv] = await consultar(e.db, e.u.consulta, `select ruta, paradas_nombres from public.v_viajes where id = $1`, [v.id]);
    expect(vv.ruta).toBe('Valera – Mérida – Maracaibo');
    await finalizar(e, e.u.chofer2, v.id as string, { km: 10500, reposto: true, litros: 100, precio: e.p.p050 });
    const rutas = await rpc<Fila[]>(e.db, e.u.consulta, 'costo_por_ruta', { p_desde: '2026-09-01', p_hasta: '2026-09-30', p_unidad: c });
    expect(rutas[0].ruta).toBe('Valera – Mérida – Maracaibo');
    expect(n(rutas[0].costo_total)).toBe(50);
  });

  it('destino "Otro" marca la ruta para revisar', async () => {
    const c = await crearCamion(e.db, { placa: 'OTR-001' });
    const v = await iniciar(e, e.u.chofer2, c, { km: 10000, paradas: [e.l.otro] });
    expect(v.revisar).toBe(true);
    expect(v.revisar_motivos).toEqual(['destino_otro']);
    await rpc(e.db, e.u.flota, 'anular_registro', { p_tabla: 'viajes', p_id: v.id, p_motivo: 'Limpieza' });
  });

  it('D7 · gasto del chofer queda pendiente y solo cuenta al aprobarlo', async () => {
    const c = await crearCamion(e.db, { placa: 'GAS-001' });
    const v = await iniciar(e, e.u.chofer2, c, { km: 10000, salida: '2026-06-02T08:00:00-04:00' });
    const [cat] = await consultar(e.db, null, `select id from public.categorias_mantenimiento where nombre = 'Lavado'`);
    const g = await rpc(e.db, e.u.chofer2, 'registrar_mantenimiento', {
      p_id: uuid(), p_unidad_id: c, p_categoria_id: cat.id, p_fecha: '2026-06-02', p_moneda: 'USD', p_monto: 15,
    });
    expect(g.estado_aprobacion).toBe('pendiente');
    let k = await rpc(e.db, e.u.consulta, 'kpis_periodo', { p_desde: '2026-06-01', p_hasta: '2026-06-30', p_unidad: c });
    expect(n(k.gasto_mant)).toBe(0);
    const alertas = await consultar(e.db, e.u.flota, `select * from public.v_alertas where tipo = 'gasto_pendiente' and registro_id = $1`, [g.id]);
    expect(alertas).toHaveLength(1);
    const err = await error(rpc(e.db, e.u.chofer2, 'revisar_gasto', { p_id: g.id, p_aprobar: true }));
    expect(err.code).toBe('42501');
    await rpc(e.db, e.u.flota, 'revisar_gasto', { p_id: g.id, p_aprobar: true });
    k = await rpc(e.db, e.u.consulta, 'kpis_periodo', { p_desde: '2026-06-01', p_hasta: '2026-06-30', p_unidad: c });
    expect(n(k.gasto_mant)).toBe(15);
    await finalizar(e, e.u.chofer2, v.id as string, {
      km: 10100, reposto: true, litros: 20, precio: e.p.p050, llegada: '2026-06-02T12:00:00-04:00',
    });
  });

  it('rechazar un gasto exige motivo', async () => {
    const c = await crearCamion(e.db, { placa: 'GAS-002' });
    const v = await iniciar(e, e.u.chofer2, c, { km: 10000, salida: '2026-06-03T08:00:00-04:00' });
    const [cat] = await consultar(e.db, null, `select id from public.categorias_mantenimiento where nombre = 'Lavado'`);
    const g = await rpc(e.db, e.u.chofer2, 'registrar_mantenimiento', {
      p_id: uuid(), p_unidad_id: c, p_categoria_id: cat.id, p_fecha: '2026-06-03', p_moneda: 'USD', p_monto: 15,
    });
    const err = await error(rpc(e.db, e.u.flota, 'revisar_gasto', { p_id: g.id, p_aprobar: false }));
    expect(err.message).toBe('Indica por qué se rechaza el gasto.');
    const r = await rpc(e.db, e.u.flota, 'revisar_gasto', { p_id: g.id, p_aprobar: false, p_motivo: 'Sin factura' });
    expect(r.estado_aprobacion).toBe('rechazado');
    await rpc(e.db, e.u.flota, 'anular_registro', { p_tabla: 'viajes', p_id: v.id, p_motivo: 'Limpieza' });
  });

  it('el chofer solo carga en el camión de su ruta o el último que manejó', async () => {
    const propio = await crearCamion(e.db, { placa: 'PER-001' });
    const ajeno = await crearCamion(e.db, { placa: 'PER-002' });
    const v = await iniciar(e, e.u.chofer2, propio, { km: 10000 });
    await finalizar(e, e.u.chofer2, v.id as string, { km: 10100, reposto: true, litros: 20, precio: e.p.p050 });
    await repostar(e, e.u.chofer2, propio, { lectura: 10120, litros: 10, precio: e.p.p050, fecha: '2026-09-12T08:00:00-04:00' });
    const err = await error(repostar(e, e.u.chofer2, ajeno, { lectura: 10010, litros: 10, precio: e.p.p050 }));
    expect(err.code).toBe('42501');
    expect(err.detail).toBe('UNIDAD_NO_PERMITIDA');
  });

  it('plantas eléctricas: solo flota registra; sin medidor; nunca entran en km/L', async () => {
    const pl = await crearPlanta(e.db, 'Planta DEMO');
    const err = await error(repostar(e, e.u.chofer1, pl, { lectura: null, litros: 40, precio: e.p.p050 }));
    expect(err.code).toBe('42501');
    const r = await repostar(e, e.u.flota, pl, { lectura: 123, litros: 40, precio: e.p.p050, fecha: '2026-05-10T09:00:00-04:00' });
    expect(r.lectura_medidor).toBeNull();
    expect(n(r.monto_usd)).toBe(20);
    const k = await rpc(e.db, e.u.consulta, 'kpis_periodo', { p_desde: '2026-05-01', p_hasta: '2026-05-31' });
    expect(n(k.gasto_comb_plantas)).toBe(20);
    expect(n(k.litros_plantas)).toBe(40);
    expect(n(k.km)).toBe(0);
    expect(k.rendimiento).toBeNull();
    const err2 = await error(iniciar(e, e.u.flota, pl, { km: 0 }));
    expect(err2.message).toBe('Las rutas solo se registran para camiones.');
  });

  it('carga anterior omitida invalida el ciclo (M2)', async () => {
    const c = await crearCamion(e.db, { placa: 'OMI-001' });
    await repostar(e, e.u.flota, c, { lectura: 10500, litros: 100, precio: e.p.p050, fecha: '2026-09-11T08:00:00-04:00', omitida: true });
    const ciclos = await consultar(e.db, null, `select * from public.v_ciclos_combustible where unidad_id = $1`, [c]);
    expect(ciclos).toHaveLength(1);
    expect(ciclos[0].invalido).toBe(true);
    const err = await error(repostar(e, e.u.chofer1, c, { lectura: 10600, litros: 10, precio: e.p.p050, omitida: true }));
    expect(err.code).toBe('42501');
  });

  it('ubicaciones: sin uso se eliminan, con viajes se archivan', async () => {
    const [nueva] = await consultar(e.db, null, `insert into public.ubicaciones (nombre) values ('Boconó') returning id`);
    expect(await rpc(e.db, e.u.flota, 'eliminar_ubicacion', { p_id: nueva.id })).toBe('eliminada');
    expect(await rpc(e.db, e.u.super, 'eliminar_ubicacion', { p_id: e.l.valera })).toBe('archivada');
    const [val] = await consultar(e.db, null, `select activo from public.ubicaciones where id = $1`, [e.l.valera]);
    expect(val.activo).toBe(false);
    await e.db.query(`update public.ubicaciones set activo = true where id = $1`, [e.l.valera]);
    const err = await error(rpc(e.db, e.u.flota, 'eliminar_ubicacion', { p_id: e.l.otro }));
    expect(err.message).toContain('del sistema');
  });

  it('formato de mensajes en es-VE', async () => {
    const [r] = await consultar(e.db, null, `select public.fmt_num(10400) a, public.fmt_num(62, 2) b, public.fmt_num(1234.5, 2) c, public.fmt_num(0.5, 2) d`);
    expect(r).toEqual({ a: '10.400', b: '62,00', c: '1.234,50', d: '0,50' });
  });
});
