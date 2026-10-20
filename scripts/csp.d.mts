import type { Plugin } from 'vite';

export declare function politica(supabaseUrl: string, scriptsEnLinea?: string[]): string;
export declare function cspPlugin(supabaseUrl: string | undefined): Plugin;
