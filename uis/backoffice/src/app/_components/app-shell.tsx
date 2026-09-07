/**
 * NEXOVA SOLUTIONS - backoffice/_components/app-shell.tsx
 * Chrome de la aplicación interna: barra lateral en escritorio, barra superior en
 * móvil. Envuelve todas las páginas desde el root layout. Server component.
 */

import Link from "next/link";
import { NavLinks } from "./nav-links";

function Wordmark() {
  return (
    <Link href="/" className="flex items-baseline gap-1.5 font-semibold text-zinc-900 dark:text-zinc-50">
      <span className="text-lg tracking-tight">Nexova</span>
      <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">Backoffice</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-zinc-200 px-4 py-6 md:flex dark:border-zinc-800">
        <Wordmark />
        <NavLinks orientation="vertical" />
      </aside>

      <header className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
        <Wordmark />
        <NavLinks orientation="horizontal" />
      </header>

      {/* Cada página aporta su propio <main>, así que aquí solo maquetamos. */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
