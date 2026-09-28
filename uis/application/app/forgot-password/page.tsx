/**
 * NEXOVA SOLUTIONS - app/forgot-password/page.tsx
 * Solicita el reset de password (POST /auth/forgot-password). Siempre
 * muestra el mismo mensaje de exito, exista o no el email (lo hace tambien
 * la API, para no revelar que cuentas estan registradas).
 */
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { forgotPassword } from "@/lib/auth-api";
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SUCCESS_CLASS } from "@/app/_components/form-styles";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo procesar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">¿Olvidaste tu contraseña?</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Escribe tu email y, si está registrado, te enviamos instrucciones para restablecerla.
        </p>
      </header>

      {sent ? (
        <p className={SUCCESS_CLASS}>
          Si el email está registrado, enviamos instrucciones para restablecer la contraseña.
        </p>
      ) : (
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

          {errorMessage && (
            <p role="alert" className={ERROR_CLASS}>
              {errorMessage}
            </p>
          )}

          <button type="submit" disabled={submitting} className={PRIMARY_BUTTON_CLASS}>
            {submitting ? "Enviando..." : "Enviar instrucciones"}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="text-center text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
