/**
 * NEXOVA SOLUTIONS - app/_components/require-auth.tsx
 * Envuelve una pagina que necesita sesion activa: si no hay token, o la API
 * lo rechaza (401), limpia el storage y redirige a /login. Client component
 * porque depende de localStorage y de una llamada a la API al montar.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser, logout } from "@/lib/auth-api";
import type { User } from "@/types/auth";

type Status = "checking" | "authorized";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        setStatus("authorized");
      })
      .catch(() => {
        if (cancelled) return;
        logout();
        router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status !== "authorized") {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-4 py-10">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Comprobando sesión…</p>
      </main>
    );
  }

  return <>{children}</>;
}
