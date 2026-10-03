import { BotonEnlace } from '@/components/controles';
import { Rombo } from '@/components/datos';

export function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <Rombo tamano={48} />
      <h1 className="text-3xl font-extrabold">Esta página no existe</h1>
      <p className="text-lg text-tinta-2">El enlace está incompleto o la página cambió de lugar.</p>
      <BotonEnlace to="/" variante="principal" tamano="lg">
        Ir al inicio
      </BotonEnlace>
    </main>
  );
}
