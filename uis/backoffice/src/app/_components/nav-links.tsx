/**
 * NEXOVA SOLUTIONS - backoffice/_components/nav-links.tsx
 * Enlaces de navegación del shell interno con estado activo derivado de la
 * ruta, y ahora tambien el estado de sesion. Client component (usePathname
 * + useSyncExternalStore sobre el token guardado).
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { logout } from "../../lib/auth-api";
import { getToken, subscribeToken } from "../../lib/auth-storage";

function getHasSessionSnapshot(): boolean {
  return Boolean(getToken());
}

function getHasSessionServerSnapshot(): boolean {
  return false;
}

const NAV_ITEMS = [
  { href: "/", label: "Pipeline" },
  { href: "/candidates/new", label: "Registrar candidato" },
  { href: "/incidencias", label: "Incidencias" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || (pathname.startsWith("/candidates/") && pathname !== "/candidates/new");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LINK_CLASS =
  "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";
const ACTIVE_LINK_CLASS =
  "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900";

export function NavLinks({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const router = useRouter();
  const hasSession = useSyncExternalStore(
    subscribeToken,
    getHasSessionSnapshot,
    getHasSessionServerSnapshot
  );

  function handleLogout() {
    logout();
    router.push("/login");
  }

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
            className={active ? ACTIVE_LINK_CLASS : LINK_CLASS}
          >
            {item.label}
          </Link>
        );
      })}

      {hasSession ? (
        <>
          <Link
            href="/account/profile"
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
            className={pathname.startsWith("/account") ? ACTIVE_LINK_CLASS : LINK_CLASS}
          >
            Mi cuenta
          </Link>
          <button type="button" onClick={handleLogout} className={LINK_CLASS}>
            Cerrar sesión
          </button>
        </>
      ) : (
        <Link
          href="/login"
          aria-current={isActive(pathname, "/login") ? "page" : undefined}
          className={isActive(pathname, "/login") ? ACTIVE_LINK_CLASS : LINK_CLASS}
        >
          Iniciar sesión
        </Link>
      )}
    </nav>
  );
}
