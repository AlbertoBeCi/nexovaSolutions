/**
 * NEXOVA SOLUTIONS - backoffice/_components/app-shell.tsx
 * Chrome de la aplicacion interna (Modo Operate): barra lateral con superficie
 * neutra diferenciada en escritorio, barra superior en movil. Server component.
 */

import Link from "next/link";
import { NavLinks } from "./nav-links";

function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-ink"
      >
        N
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-base font-bold tracking-tight">Nexova</span>
        <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-foreground-muted">
          Backoffice
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border-subtle bg-sidebar px-4 py-6 md:flex">
        <div className="border-b border-border-subtle pb-4">
          <Wordmark />
        </div>
        <NavLinks orientation="vertical" />
      </aside>

      <header className="flex flex-col gap-3 border-b border-border-subtle bg-sidebar px-4 py-3 md:hidden">
        <Wordmark />
        <NavLinks orientation="horizontal" />
      </header>

      {/* Cada página aporta su propio <main>, así que aquí solo maquetamos. */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
