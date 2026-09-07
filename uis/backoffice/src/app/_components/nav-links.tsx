/**
 * NEXOVA SOLUTIONS - backoffice/_components/nav-links.tsx
 * Enlaces de navegación del shell interno con estado activo derivado de la ruta.
 * Es un client component solo por `usePathname`; el resto del shell es servidor.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Pipeline" },
  { href: "/candidates/new", label: "Registrar candidato" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || (pathname.startsWith("/candidates/") && pathname !== "/candidates/new");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className={
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex flex-row gap-1 overflow-x-auto"
      }
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
