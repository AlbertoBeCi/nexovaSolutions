/**
 * NEXOVA SOLUTIONS - website/_components/site-header.tsx
 * Cabecera fija de la web publica. Portada desde index.html: navegacion de
 * seccion, alternador de tema y CTA "Solicitar Ahora". Menu movil con estado.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/#talento", label: "Por qué Nexova" },
  { href: "/#contacto", label: "Contacto" },
];

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
    <header className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur-sm">
      <nav
        aria-label="Navegación principal"
        className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:px-6 lg:px-8 md:flex md:justify-between md:gap-4"
      >
        <button
          type="button"
          aria-controls="menu-movil"
          aria-expanded={open}
          aria-label={open ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          onClick={() => setOpen((v) => !v)}
          className="-ml-2 inline-flex items-center justify-center justify-self-start p-2 text-ink transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
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
          className="justify-self-center px-2 py-1 font-display text-xl font-semibold tracking-tight text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:justify-self-auto"
        >
          NEXOVA
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-2 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 justify-self-end md:justify-self-auto">
          <ThemeToggle />
          <Link
            href="/talento"
            className="whitespace-nowrap bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          >
            Solicitar Ahora
          </Link>
        </div>
      </nav>

      {open && (
        <div id="menu-movil" className="border-t border-line bg-bg md:hidden">
          <div className="flex flex-col gap-1 px-4 py-4 sm:px-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
