/**
 * NEXOVA SOLUTIONS - app/login/page.tsx
 * Inicio de sesion (POST /auth/login). Guarda el token y redirige a /.
 *
 * El flujo de "olvide mi contrasena" vive solo en uis/application (el email
 * de reset apunta a un unico FRONTEND_URL en services/api): este enlace es
 * cruzado hacia esa app en vez de duplicar el flujo aca.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "../_components/form-styles";
import { login } from "../../lib/auth-api";

const APPLICATION_URL = process.env.NEXT_PUBLIC_APPLICATION_URL ?? "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
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
          Accede con tu cuenta de Nexova Backoffice.
        </p>
      </header>

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
        <a
          href={`${APPLICATION_URL}/forgot-password`}
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ¿Olvidaste tu contraseña?
        </a>
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
