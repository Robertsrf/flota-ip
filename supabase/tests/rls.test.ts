import { beforeAll, describe, expect, it } from 'vitest';
import { comoUsuario, llamarRpc } from '../../scripts/pglite/db.mjs';
import {
  consultar, consultarAnon, crearCamion, error, escenario, finalizar, iniciar, rpc, uuid, type Escenario, type Fila,
} from './helpers';

// T13 y la matriz de permisos de la sección 6, probada con un usuario de cada rol.
let e: Escenario;
let camion: string;
let viajeChofer1: string;
let gastoFlota: string;

beforeAll(async () => {
  e = await escenario();
  camion = await crearCamion(e.db, { placa: 'RLS-001' });
  const v = await iniciar(e, e.u.chofer1, camion, { km: 10000 });
  viajeChofer1 = v.id as string;
  await finalizar(e, e.u.chofer1, viajeChofer1, { km: 10300, reposto: true, litros: 60, precio: e.p.p050 });
  const [cat] = await consultar(e.db, null, `select id from public.categorias_mantenimiento limit 1`);
  const g = await rpc(e.db, e.u.flota, 'registrar_mantenimiento', {
    p_id: uuid(), p_unidad_id: camion, p_categoria_id: cat.id, p_fecha: '2026-09-10', p_moneda: 'USD', p_monto: 40,
  });
  gastoFlota = g.id as string;
}, 60_000);

describe('visitante sin sesión (anon)', () => {
  it('no puede leer tablas ni vistas', async () => {
    expect((await error(consultarAnon(e.db, `select * from public.viajes`))).message).toContain('permission denied');
    expect((await error(consultarAnon(e.db, `select * from public.v_unidades`))).message).toContain('permission denied');
  });
  it('no puede llamar funciones', async () => {
    const err = await error(comoUsuario(e.db, null, (tx) => llamarRpc(tx, 'kpis_periodo', {
      p_desde: '2026-01-01', p_hasta: '2026-12-31',
    }), 'anon'));
    expect(err.message).toContain('permission denied');
  });
});

describe('T13 · el chofer no edita lo ajeno', () => {
  it('no puede actualizar un mantenimiento directamente', async () => {
    const err = await error(consultar(e.db, e.u.chofer2, `update public.mantenimientos set monto = 1 where id = $1`, [gastoFlota]));
    expect(err.message).toContain('permission denied');
  });
  it('no puede corregir el viaje de otro chofer', async () => {
    const err = await error(rpc(e.db, e.u.chofer2, 'corregir_registro', {
      p_tabla: 'viajes', p_id: viajeChofer1, p_cambios: { km_llegada: 10350 }, p_motivo: 'x',
    }));
    expect(err.code).toBe('42501');
  });
  it('no puede corregir ni anular un gasto registrado por flota', async () => {
    const e1 = await error(rpc(e.db, e.u.chofer1, 'corregir_registro', {
      p_tabla: 'mantenimientos', p_id: gastoFlota, p_cambios: { monto: 1 }, p_motivo: 'x',
    }));
    expect(e1.code).toBe('42501');
    const e2 = await error(rpc(e.db, e.u.chofer1, 'anular_registro', { p_tabla: 'mantenimientos', p_id: gastoFlota, p_motivo: 'x' }));
    expect(e2.code).toBe('42501');
  });
  it('no puede escribir directamente en viajes, repostajes ni unidades', async () => {
    expect((await error(consultar(e.db, e.u.chofer1, `update public.viajes set notas = 'x' where id = $1`, [viajeChofer1]))).message)
      .toContain('permission denied');
    expect((await error(consultar(e.db, e.u.chofer1, `delete from public.repostajes`))).message).toContain('permission denied');
    expect((await error(consultar(e.db, e.u.chofer1,
      `insert into public.unidades (placa, capacidad_tanque_l, lectura_inicial) values ('X-1', 100, 0)`))).message)
      .toContain('row-level security');
  });
  it('sí ve la flota completa y puede corregir lo suyo dentro de la ventana', async () => {
    const viajes = await consultar(e.db, e.u.chofer2, `select id from public.v_viajes`);
    expect(viajes.length).toBeGreaterThan(0);
    const r = await rpc(e.db, e.u.chofer1, 'corregir_registro', {
      p_tabla: 'viajes', p_id: viajeChofer1, p_cambios: { km_llegada: 10320 }, p_motivo: 'Me equivoqué al escribir',
    });
    expect(Number(r.km_recorridos)).toBe(320);
    const err = await error(rpc(e.db, e.u.chofer1, 'corregir_registro', {
      p_tabla: 'viajes', p_id: viajeChofer1, p_cambios: { unidad_id: camion }, p_motivo: 'x',
    }));
    expect(err.code).toBe('42501');
  });
  it('fuera de la ventana de 30 minutos ya no puede corregir', async () => {
    await e.db.query(`update public.viajes set created_at = now() - interval '2 hours' where id = $1`, [viajeChofer1]);
    const err = await error(rpc(e.db, e.u.chofer1, 'corregir_registro', {
      p_tabla: 'viajes', p_id: viajeChofer1, p_cambios: { km_llegada: 10330 }, p_motivo: 'x',
    }));
    expect(err.detail).toBe('FUERA_DE_VENTANA');
  });
  it('no ve la auditoría', async () => {
    expect(await consultar(e.db, e.u.chofer1, `select * from public.auditoria`)).toHaveLength(0);
  });
});

describe('consulta (gerencia) solo lee', () => {
  it('lee el dashboard', async () => {
    const k = await rpc<Fila>(e.db, e.u.consulta, 'kpis_periodo', { p_desde: '2026-09-01', p_hasta: '2026-09-30' });
    expect(Number(k.viajes)).toBeGreaterThan(0);
    expect((await consultar(e.db, e.u.consulta, `select * from public.v_alertas`)).length).toBeGreaterThanOrEqual(0);
  });
  it('no inicia rutas, no registra cargas ni gastos, no anula', async () => {
    const c2 = await crearCamion(e.db, { placa: 'RLS-002' });
    expect((await error(iniciar(e, e.u.consulta, c2, { km: 10000 }))).code).toBe('42501');
    expect((await error(rpc(e.db, e.u.consulta, 'registrar_repostaje', {
      p_id: uuid(), p_unidad_id: c2, p_fecha: '2026-09-10T10:00:00-04:00', p_lectura: 10010, p_litros: 10, p_precio_id: e.p.p050,
    }))).code).toBe('42501');
    expect((await error(rpc(e.db, e.u.consulta, 'anular_registro', { p_tabla: 'viajes', p_id: viajeChofer1, p_motivo: 'x' }))).code)
      .toBe('42501');
    const filas = await consultar(e.db, e.u.consulta, `update public.unidades set notas = 'x' where id = $1 returning id`, [c2]);
    expect(filas).toHaveLength(0);
  });
});

describe('flota y superusuario', () => {
  it('flota gestiona unidades y catálogos, pero no la configuración', async () => {
    const [u] = await consultar(e.db, e.u.flota,
      `insert into public.unidades (placa, capacidad_tanque_l, lectura_inicial, combustible_inicial_l) values ('FLO-001', 180, 5000, 180) returning id`);
    expect(u.id).toBeTruthy();
    const filas = await consultar(e.db, e.u.flota, `update public.configuracion set umbral_ruta_abierta_h = 24 returning id`);
    expect(filas).toHaveLength(0);
    const sup = await consultar(e.db, e.u.super, `update public.configuracion set umbral_ruta_abierta_h = 24 returning id`);
    expect(sup).toHaveLength(1);
  });
  it('flota ve la auditoría', async () => {
    expect((await consultar(e.db, e.u.flota, `select * from public.auditoria`)).length).toBeGreaterThan(0);
  });
  it('nadie cambia roles por la API de datos: solo la función admin-usuarios', async () => {
    const err = await error(consultar(e.db, e.u.super, `update public.perfiles set rol = 'superusuario' where id = $1`, [e.u.chofer2]));
    expect(err.message).toContain('pantalla de usuarios');
    const propias = await consultar(e.db, e.u.chofer1, `update public.perfiles set nombre = 'Otro' where id = $1 returning id`, [e.u.chofer1]);
    expect(propias).toHaveLength(0);
  });
  it('un usuario desactivado pierde el acceso de inmediato', async () => {
    await e.db.query(`update public.perfiles set activo = false where id = $1`, [e.u.chofer2]);
    expect(await consultar(e.db, e.u.chofer2, `select * from public.viajes`)).toHaveLength(0);
    expect((await error(rpc(e.db, e.u.chofer2, 'registrar_repostaje', {
      p_id: uuid(), p_unidad_id: camion, p_fecha: '2026-09-11T10:00:00-04:00', p_lectura: 10400, p_litros: 10, p_precio_id: e.p.p050,
    }))).code).toBe('42501');
    await e.db.query(`update public.perfiles set activo = true where id = $1`, [e.u.chofer2]);
  });
});
