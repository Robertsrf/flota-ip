import { beforeAll, describe, expect, it } from 'vitest';
import { crearUsuario } from '../../scripts/pglite/db.mjs';
import {
  consultar, crearCamion, crearPlanta, error, escenario, finalizar, iniciar, n, rpc, uuid, type Escenario, type Fila,
} from './helpers';

// Fase 2 adelantada: recordatorios de servicio por km o fecha y documentos con vencimiento.
let e: Escenario;
let aceite: string;
let cauchos: string;
let hoy: string;

const dias = async (d: number) =>
  (await consultar<{ f: string }>(e.db, null, `select to_char(public.hoy_caracas() + $1::int, 'YYYY-MM-DD') as f`, [d]))[0].f;

const recordatorio = (id: string) => consultar(e.db, null, `select * from public.v_recordatorios where id = $1`, [id]).then((f) => f[0]);
const documento = (id: string) => consultar(e.db, null, `select * from public.v_documentos where id = $1`, [id]).then((f) => f[0]);

beforeAll(async () => {
  e = await escenario();
  const cats = await consultar<{ id: string; nombre: string }>(e.db, null, `select id, nombre from public.categorias_mantenimiento`);
  aceite = cats.find((c) => c.nombre === 'Aceite')!.id;
  cauchos = cats.find((c) => c.nombre === 'Cauchos')!.id;
  hoy = await dias(0);
}, 60_000);

describe('recordatorios de servicio por km', () => {
  let camion: string;
  let rec: string;

  beforeAll(async () => {
    camion = await crearCamion(e.db, { placa: 'REC-001', lectura: 10000 });
    rec = uuid();
    await rpc(e.db, e.u.flota, 'guardar_recordatorio', {
      p_id: rec, p_unidad_id: camion, p_nombre: 'Cambio de aceite', p_categoria_id: aceite, p_cada_km: 5000, p_aviso_km: 500,
    });
  });

  it('nace al día y toma el último km conocido como punto de partida', async () => {
    const r = await recordatorio(rec);
    expect(n(r.ultimo_km)).toBe(10000);
    expect(n(r.proximo_km)).toBe(15000);
    expect(n(r.km_restantes)).toBe(5000);
    expect(r.situacion).toBe('al_dia');
  });

  it('pasa a "pronto" dentro del aviso y a "vencido" al pasarse', async () => {
    const v1 = await iniciar(e, e.u.chofer1, camion, { km: 10000 });
    await finalizar(e, e.u.chofer1, v1.id as string, { km: 14600, reposto: true, litros: 150, precio: e.p.p050 });
    let r = await recordatorio(rec);
    expect(n(r.km_restantes)).toBe(400);
    expect(r.situacion).toBe('pronto');

    const v2 = await iniciar(e, e.u.chofer1, camion, { km: 14600, salida: '2026-09-11T08:00:00-04:00' });
    await finalizar(e, e.u.chofer1, v2.id as string, { km: 15100, reposto: true, litros: 90, precio: e.p.p050, llegada: '2026-09-11T15:00:00-04:00' });
    r = await recordatorio(rec);
    expect(n(r.km_restantes)).toBe(-100);
    expect(r.situacion).toBe('vencido');

    const alertas = await consultar(e.db, e.u.flota, `select * from public.v_alertas where tipo = 'servicio' and registro_id = $1`, [rec]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidad).toBe('alta');
    expect(alertas[0].mensaje).toBe('Cambio de aceite de REC-001 (REC-001): se pasó por 100 km (tocaba en el km 15.000).');
  });

  it('un gasto de chofer pendiente no lo reinicia; al aprobarse, sí', async () => {
    const g = await rpc(e.db, e.u.chofer1, 'registrar_mantenimiento', {
      p_id: uuid(), p_unidad_id: camion, p_categoria_id: aceite, p_fecha: hoy, p_moneda: 'USD', p_monto: 45, p_lectura: 15120,
    });
    expect(g.estado_aprobacion).toBe('pendiente');
    expect((await recordatorio(rec)).situacion).toBe('vencido');

    await rpc(e.db, e.u.flota, 'revisar_gasto', { p_id: g.id, p_aprobar: true });
    const r = await recordatorio(rec);
    expect(n(r.ultimo_km)).toBe(15120);
    expect(new Date(r.ultima_fecha as string).toISOString().slice(0, 10)).toBe(hoy);
    expect(n(r.proximo_km)).toBe(20120);
    expect(r.situacion).toBe('al_dia');

    const [audit] = await consultar(e.db, null,
      `select accion, motivo from public.auditoria where tabla = 'recordatorios_servicio' and registro_id = $1`, [rec]);
    expect(audit.accion).toBe('servicio_hecho');
    expect(audit.motivo).toMatch(/^Gasto M-\d{4} aprobado$/);
  });

  it('un gasto de otra categoría no lo toca', async () => {
    await rpc(e.db, e.u.flota, 'registrar_mantenimiento', {
      p_id: uuid(), p_unidad_id: camion, p_categoria_id: cauchos, p_fecha: hoy, p_moneda: 'USD', p_monto: 300, p_lectura: 15130,
    });
    expect(n((await recordatorio(rec)).ultimo_km)).toBe(15120);
  });

  it('"Marcar hecho" a mano valida que el km no retroceda', async () => {
    const err = await error(rpc(e.db, e.u.flota, 'marcar_servicio_hecho', { p_id: rec, p_km: 15000 }));
    expect(err.message).toBe('El km del servicio (15.000) es menor que el del servicio anterior (15.120).');
    const r = await rpc(e.db, e.u.flota, 'marcar_servicio_hecho', { p_id: rec, p_km: 15130, p_nota: 'Hecho en el taller de la sede' });
    expect(n(r.ultimo_km)).toBe(15130);
  });
});

describe('recordatorios por fecha y validaciones', () => {
  it('por días: "pronto" dentro del aviso, con la fecha en el mensaje', async () => {
    const planta = await crearPlanta(e.db, 'Planta REC');
    const id = uuid();
    await rpc(e.db, e.u.flota, 'guardar_recordatorio', {
      p_id: id, p_unidad_id: planta, p_nombre: 'Servicio de la planta', p_cada_dias: 90, p_aviso_dias: 15,
      p_ultima_fecha: await dias(-80),
    });
    const r = await recordatorio(id);
    expect(n(r.dias_restantes)).toBe(10);
    expect(r.situacion).toBe('pronto');
    const [a] = await consultar(e.db, e.u.consulta, `select mensaje from public.v_alertas where registro_id = $1`, [id]);
    expect(a.mensaje).toMatch(/^Servicio de la planta de Planta REC: toca en 10 días \(\d{2}\/\d{2}\/\d{4}\)\.$/);
  });

  it('una planta sin medidor no admite frecuencia en km', async () => {
    const planta = await crearPlanta(e.db, 'Planta sin medidor');
    const err = await error(rpc(e.db, e.u.flota, 'guardar_recordatorio', {
      p_id: uuid(), p_unidad_id: planta, p_nombre: 'Aceite', p_cada_km: 1000, p_aviso_km: 100,
    }));
    expect(err.message).toBe('Planta sin medidor no tiene medidor: programa el servicio por días.');
  });

  it('exige frecuencia y un aviso menor que la frecuencia', async () => {
    const c = await crearCamion(e.db, { placa: 'REC-002' });
    expect((await error(rpc(e.db, e.u.flota, 'guardar_recordatorio', { p_id: uuid(), p_unidad_id: c, p_nombre: 'Aceite' }))).message)
      .toBe('Indica cada cuántos km o cada cuántos días toca el servicio.');
    expect((await error(rpc(e.db, e.u.flota, 'guardar_recordatorio', {
      p_id: uuid(), p_unidad_id: c, p_nombre: 'Aceite', p_cada_km: 500, p_aviso_km: 500,
    }))).message).toBe('El aviso (500 km antes) debe ser menor que la frecuencia (cada 500 km).');
    expect((await error(rpc(e.db, e.u.flota, 'guardar_recordatorio', {
      p_id: uuid(), p_unidad_id: c, p_nombre: 'Aceite', p_cada_km: 5000, p_ultimo_km: 12000,
    }))).message).toBe('El km del último servicio (12.000) es mayor que el último km conocido de REC-002 (REC-002) (10.000).');
  });

  it('solo flota y superusuario programan servicios', async () => {
    const c = await crearCamion(e.db, { placa: 'REC-003' });
    for (const uid of [e.u.chofer1, e.u.consulta]) {
      const err = await error(rpc(e.db, uid, 'guardar_recordatorio', { p_id: uuid(), p_unidad_id: c, p_nombre: 'Aceite', p_cada_dias: 90 }));
      expect(err.code).toBe('42501');
    }
    const r = await rpc(e.db, e.u.super, 'guardar_recordatorio', { p_id: uuid(), p_unidad_id: c, p_nombre: 'Aceite', p_cada_dias: 90 });
    expect(r.id).toBeTruthy();
  });

  it('nadie escribe directo en las tablas: solo por las funciones', async () => {
    const c = await crearCamion(e.db, { placa: 'REC-004' });
    expect((await error(consultar(e.db, e.u.flota,
      `insert into public.recordatorios_servicio (unidad_id, nombre, cada_dias) values ($1, 'x', 30)`, [c]))).message)
      .toContain('permission denied');
    expect((await error(consultar(e.db, e.u.flota,
      `insert into public.documentos (unidad_id, tipo, vence) values ($1, 'x', '2027-01-01')`, [c]))).message)
      .toContain('permission denied');
  });
});

describe('documentos con vencimiento', () => {
  let camion: string;

  beforeAll(async () => {
    camion = await crearCamion(e.db, { placa: 'DOC-001' });
  });

  it('marca "pronto" dentro del aviso y "vencido" desde el día siguiente al vencimiento', async () => {
    const pronto = uuid();
    await rpc(e.db, e.u.flota, 'guardar_documento', {
      p_id: pronto, p_unidad_id: camion, p_persona_id: null, p_tipo: 'Póliza RCV', p_vence: await dias(10), p_emisor: 'Seguros Andes',
    });
    expect((await documento(pronto)).situacion).toBe('pronto');

    const hoyMismo = uuid();
    await rpc(e.db, e.u.flota, 'guardar_documento', {
      p_id: hoyMismo, p_unidad_id: camion, p_persona_id: null, p_tipo: 'Permiso de circulación', p_vence: hoy,
    });
    expect((await documento(hoyMismo)).situacion).toBe('pronto');

    const vencido = uuid();
    await rpc(e.db, e.u.flota, 'guardar_documento', {
      p_id: vencido, p_unidad_id: camion, p_persona_id: null, p_tipo: 'Revisión técnica', p_vence: await dias(-3),
    });
    expect((await documento(vencido)).situacion).toBe('vencido');

    const alertas = await consultar(e.db, e.u.flota,
      `select registro_id, severidad, mensaje from public.v_alertas where tipo = 'documento' order by fecha`);
    const porId = new Map(alertas.map((a) => [a.registro_id, a]));
    expect(porId.get(vencido)?.severidad).toBe('alta');
    expect(porId.get(vencido)?.mensaje).toMatch(/^Revisión técnica de DOC-001 \(DOC-001\) venció el \d{2}\/\d{2}\/\d{4} \(hace 3 días\)\.$/);
    expect(porId.get(hoyMismo)?.mensaje).toBe('Permiso de circulación de DOC-001 (DOC-001) vence hoy.');
    expect(porId.get(pronto)?.mensaje).toMatch(/\(en 10 días\)\.$/);
  });

  it('renovar archiva el anterior, crea uno nuevo y es idempotente', async () => {
    const viejo = uuid();
    await rpc(e.db, e.u.flota, 'guardar_documento', {
      p_id: viejo, p_unidad_id: camion, p_persona_id: null, p_tipo: 'Póliza de casco', p_vence: await dias(5), p_numero: 'A-1',
    });
    const err = await error(rpc(e.db, e.u.flota, 'renovar_documento', { p_id: viejo, p_nuevo_id: uuid(), p_vence: await dias(2) }));
    expect(err.message).toMatch(/^La nueva fecha de vencimiento debe ser posterior a la actual \(\d{2}\/\d{2}\/\d{4}\)\.$/);

    const nuevoId = uuid();
    const args = { p_id: viejo, p_nuevo_id: nuevoId, p_vence: await dias(370), p_numero: 'A-2' };
    const nuevo = await rpc<Fila>(e.db, e.u.flota, 'renovar_documento', args);
    const otraVez = await rpc<Fila>(e.db, e.u.flota, 'renovar_documento', args);
    expect(otraVez.id).toBe(nuevo.id);
    expect(nuevo.numero).toBe('A-2');
    expect(nuevo.tipo).toBe('Póliza de casco');
    expect((await documento(nuevoId)).situacion).toBe('al_dia');
    const v = await documento(viejo);
    expect(v.situacion).toBe('archivado');
    expect(v.renovado_por).toBe(nuevoId);
    const [audit] = await consultar(e.db, null, `select accion from public.auditoria where tabla = 'documentos' and registro_id = $1`, [viejo]);
    expect(audit.accion).toBe('renovar');
  });

  it('el archivo tiene que estar en la carpeta del propio documento', async () => {
    const id = uuid();
    const ajeno = await error(rpc(e.db, e.u.flota, 'guardar_documento', {
      p_id: id, p_unidad_id: null, p_persona_id: e.u.chofer2, p_tipo: 'Certificado médico', p_vence: await dias(90),
      p_archivo: `${e.u.chofer1}/${uuid()}-documento.jpg`,
    }));
    expect(ajeno.code).toBe('23514');
    expect(ajeno.message).toContain('documentos_archivo_ck');
    const d = await rpc<Fila>(e.db, e.u.flota, 'guardar_documento', {
      p_id: id, p_unidad_id: null, p_persona_id: e.u.chofer2, p_tipo: 'Certificado médico', p_vence: await dias(90),
      p_archivo: `${id}/archivo.jpg`,
    });
    expect(d.archivo_path).toBe(`${id}/archivo.jpg`);
    const nuevo = uuid();
    expect((await error(rpc(e.db, e.u.flota, 'renovar_documento', {
      p_id: id, p_nuevo_id: nuevo, p_vence: await dias(400), p_archivo: `${id}/archivo.jpg`,
    }))).code).toBe('23514');
    const r = await rpc<Fila>(e.db, e.u.flota, 'renovar_documento', { p_id: id, p_nuevo_id: nuevo, p_vence: await dias(400), p_archivo: `${nuevo}/archivo.pdf` });
    expect(r.archivo_path).toBe(`${nuevo}/archivo.pdf`);
  });

  it('un documento es de una unidad o de una persona, no de ambas', async () => {
    const err = await error(rpc(e.db, e.u.flota, 'guardar_documento', {
      p_id: uuid(), p_unidad_id: camion, p_persona_id: e.u.chofer1, p_tipo: 'X', p_vence: hoy,
    }));
    expect(err.message).toBe('Indica si el documento es de una unidad o de una persona.');
  });

  it('la licencia de un chofer la ven él y la oficina, no los demás choferes', async () => {
    const lic = uuid();
    await rpc(e.db, e.u.flota, 'guardar_documento', {
      p_id: lic, p_unidad_id: null, p_persona_id: e.u.chofer1, p_tipo: 'Licencia de conducir', p_vence: await dias(200),
    });
    const ve = async (uid: string) => (await consultar(e.db, uid, `select id from public.v_documentos where id = $1`, [lic])).length;
    expect(await ve(e.u.chofer1)).toBe(1);
    expect(await ve(e.u.consulta)).toBe(1);
    expect(await ve(e.u.flota)).toBe(1);
    expect(await ve(e.u.chofer2)).toBe(0);
    expect((await error(rpc(e.db, e.u.chofer1, 'guardar_documento', {
      p_id: uuid(), p_unidad_id: null, p_persona_id: e.u.chofer1, p_tipo: 'Licencia', p_vence: hoy,
    }))).code).toBe('42501');
  });

  it('un usuario desactivado no ve documentos', async () => {
    const otro = await crearUsuario(e.db, { email: 'inactivo@chofer.test', nombre: 'Inactivo', rol: 'chofer' });
    await e.db.query(`update public.perfiles set activo = false where id = $1`, [otro]);
    expect(await consultar(e.db, otro, `select id from public.v_documentos`)).toHaveLength(0);
  });
});

describe('la revisión muestra la novedad del chofer', () => {
  it('el mensaje de la alerta trae el texto que escribió', async () => {
    const c = await crearCamion(e.db, { placa: 'NOV-001' });
    const ayer = await dias(-1);
    const v = await iniciar(e, e.u.chofer2, c, { km: 10000, salida: `${ayer}T08:00:00-04:00` });
    await finalizar(e, e.u.chofer2, v.id as string, {
      km: 10300, reposto: true, litros: 60, precio: e.p.p050, notas: 'Se espichó un caucho en la Lara-Zulia', llegada: `${ayer}T15:00:00-04:00`,
    });
    const [a] = await consultar(e.db, e.u.flota, `select mensaje from public.v_alertas where tipo = 'revisar' and viaje_id = $1`, [v.id]);
    expect(a.mensaje).toMatch(/necesita revisión: el chofer escribió "Se espichó un caucho en la Lara-Zulia"\.$/);
  });
});
