import type { PGlite, Transaction } from '@electric-sql/pglite';

export declare const RAIZ: string;
export declare function listarMigraciones(): string[];
export declare function crearDb(opciones?: { seed?: boolean; dataDir?: string }): Promise<PGlite>;
export declare function comoUsuario<T>(
  db: PGlite,
  uid: string | null,
  fn: (tx: Transaction) => Promise<T>,
  rol?: 'authenticated' | 'anon' | 'service_role',
): Promise<T>;
export declare function crearUsuario(
  db: PGlite,
  datos: { email: string; password?: string; nombre: string; usuario?: string | null; rol?: string },
): Promise<string>;
export declare function aParametro(v: unknown): string | null;
export declare function llamarRpc(tx: Transaction, nombre: string, args?: Record<string, unknown>): Promise<unknown>;
