/**
 * NEXOVA SOLUTIONS - website/_components/site-header.tsx
 * Cabecera fija de la web pública. El menú móvil usa <details>/<summary> para
 * funcionar sin JavaScript. Server component.
 */

import Link from "next/link";

const NAV_ITEMS = [
  { href: "/#servicios", label: "Servicios" },
  { href: "/#nexova", label: "Nexova" },
  { href: "/#contacto", label: "Contacto" },
  { href: "/talento", label: "Talento" },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-baseline gap-1 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
      <span className="text-lg">Nexova</span>
      <span className="hidden text-lg text-zinc-400 sm:inline">Solutions</span>
    </Link>
  );
}

function CtaButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/talento"
      className={`inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${className}`}
    >
      Únete al banco de talento
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Wordmark />

        <nav aria-label="Navegación principal" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <CtaButton />
        </div>

        <details className="relative md:hidden">
          <summary
            aria-label="Abrir menú"
            className="flex cursor-pointer list-none items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 [&::-webkit-details-marker]:hidden"
          >
            Menú
          </summary>
          <div className="absolute right-0 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:bg-zinc-950 dark:border-zinc-800">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {item.label}
              </Link>
            ))}
            <CtaButton className="mt-1 w-full" />
          </div>
        </details>
      </div>
    </header>
  );
}
