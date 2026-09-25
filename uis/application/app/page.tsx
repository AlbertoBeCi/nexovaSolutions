/**
 * NEXOVA SOLUTIONS - application/page.tsx
 * Vista de entrada de la aplicación de operaciones: acceso a sus módulos.
 */

import Link from "next/link";

const MODULES = [
  {
    href: "/suppliers",
    title: "Directorio de proveedores",
    description:
      "Consulta los proveedores de las sedes de Valencia y Miami, sus tarifas mensuales y el estado de cada contrato.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Operaciones</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Herramientas internas para el equipo de operaciones de Nexova.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((module) => (
          <li key={module.href}>
            <Link
              href={module.href}
              className="flex h-full flex-col gap-2 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus-visible:outline-zinc-50"
            >
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">{module.title}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{module.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
