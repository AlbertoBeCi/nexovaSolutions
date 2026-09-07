/**
 * NEXOVA SOLUTIONS - website/talento/page.tsx
 * Punto de entrada del banco de talento. El formulario completo (campos y
 * validaciones de CONTEXT.md) se implementa en un hito posterior; por ahora esta
 * página deja el enlace vivo y explica el siguiente paso.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Banco de talento",
  description:
    "Regístrate en el banco de talento de Nexova: te contactaremos cuando surja una oportunidad que encaje con tu perfil.",
};

export default function TalentoPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Únete a nuestro banco de talento
      </h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-300">
        Estamos preparando el formulario de registro (datos de contacto, experiencia, sector de
        interés, nivel de inglés y disponibilidad). Mientras tanto, escríbenos y guardaremos tu
        candidatura.
      </p>

      <div className="mt-8 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Envía tu CV a{" "}
          <a
            href="mailto:talento@nexova.com"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            talento@nexova.com
          </a>
        </p>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          ¿Eres una empresa buscando talento? Escríbenos a{" "}
          <a
            href="mailto:contacto@nexova.com"
            className="font-medium text-zinc-700 hover:underline dark:text-zinc-200"
          >
            contacto@nexova.com
          </a>
          .
        </p>
      </div>

      <Link
        href="/"
        className="mt-8 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
