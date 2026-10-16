/** Client guard for pages that need an active Nexova session. */
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ApiRequestError } from "../../lib/api-client";
import { getLoginHref } from "../../lib/auth-navigation";
import { getCurrentUser, logout } from "../../lib/auth-api";
import { getToken, subscribeToken } from "../../lib/auth-storage";
import type { User } from "../../types/auth";

type AuthResult =
  | { token: string; status: "ready"; user: User }
  | { token: string; status: "error"; message: string };

export function RequireAuth({
  children,
}: {
  children: React.ReactNode | ((currentUser: User) => React.ReactNode);
}) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useSyncExternalStore(subscribeToken, getToken, () => null);
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!token) {
      const returnTo = `${pathname}${window.location.search}`;
      router.replace(getLoginHref(returnTo));
      return;
    }

    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setAuthResult({ token, status: "ready", user });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 401) {
          logout();
          router.replace(getLoginHref(`${pathname}${window.location.search}`));
          return;
        }
        setAuthResult({
          token,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "No se pudo comprobar la sesión. Inténtalo de nuevo.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, retryKey, router, token]);

  if (!token || !authResult || authResult.token !== token) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-4 py-10">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Comprobando sesión…</p>
      </main>
    );
  }

  if (authResult.status === "error") {
    return (
      <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-start justify-center gap-4 px-6 py-10">
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {authResult.message}
        </p>
        <button
          type="button"
          onClick={() => setRetryKey((value) => value + 1)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Reintentar
        </button>
      </main>
    );
  }

  return <>{typeof children === "function" ? children(authResult.user) : children}</>;
}
