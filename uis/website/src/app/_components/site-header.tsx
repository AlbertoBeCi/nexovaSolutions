/**
 * NEXOVA SOLUTIONS - website/_components/site-header.tsx
 * Cabecera fija de la web publica con navegacion de seccion, alternador de tema,
 * indicador de sedes VLC · MIA y CTA principal.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { SiteNavigation } from "./site-navigation";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur-md">
      <nav
        aria-label="Navegación principal"
        className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:px-6 lg:px-8 md:flex md:justify-between md:gap-6"
      >
        <button
          type="button"
          aria-controls="menu-movil"
          aria-expanded={open}
          aria-label={open ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          onClick={() => setOpen((v) => !v)}
          className="-ml-2 inline-flex min-h-11 min-w-11 items-center justify-center justify-self-start p-2 text-ink transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-6 w-6"
            aria-hidden="true"
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            )}
          </svg>
        </button>

        <Link
          href="/"
          aria-label="Nexova, inicio"
          className="flex items-center gap-2.5 justify-self-center px-2 py-1 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:justify-self-auto"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 items-center justify-center border border-accent bg-accent text-[10px] font-bold tracking-tighter text-accent-ink"
          >
            N
          </span>
          <span className="font-display text-lg font-bold tracking-tight">NEXOVA</span>
          <span className="hidden font-mono text-[11px] uppercase tracking-widest text-ink-muted lg:inline">
            VLC · MIA
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <SiteNavigation variant="desktop" />
        </div>

        <div className="flex items-center gap-2.5 justify-self-end md:justify-self-auto">
          <ThemeToggle />
          <Link
            href="/talento"
            className="btn-tactile inline-flex min-h-11 items-center whitespace-nowrap bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          >
            Solicitar Ahora
          </Link>
        </div>
      </nav>

      {open && (
        <div id="menu-movil" className="border-t border-line bg-bg md:hidden">
          <div className="flex flex-col gap-2 px-4 py-5 sm:px-6">
            <SiteNavigation variant="mobile" onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
