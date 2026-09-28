/**
 * NEXOVA SOLUTIONS - app/login/page.tsx
 * Inicio de sesion (POST /auth/login). Guarda el token y redirige a /. Si
 * la URL trae ?reset=success (viene de /reset-password), muestra un aviso.
 */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { login } from "@/lib/auth-api";
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SUCCESS_CLASS } from "@/app/_components/form-styles";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSucceeded = searchParams.get("reset") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await login({ email: email.trim(), password });
      router.replace("/");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Iniciar sesión</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Accede con tu cuenta de Nexova Operaciones.
        </p>
      </header>

      {resetSucceeded && (
        <p className={SUCCESS_CLASS}>Tu contraseña se actualizó. Inicia sesión con la nueva.</p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <label className={LABEL_CLASS}>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Contraseña
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        {errorMessage && (
          <p role="alert" className={ERROR_CLASS}>
            {errorMessage}
          </p>
        )}

        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON_CLASS}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-2 text-sm font-medium">
        <Link
          href="/forgot-password"
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ¿Olvidaste tu contraseña?
        </Link>
        <Link
          href="/register"
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ¿No tienes cuenta? Crear una
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
