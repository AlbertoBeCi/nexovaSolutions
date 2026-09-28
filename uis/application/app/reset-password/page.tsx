/**
 * NEXOVA SOLUTIONS - app/reset-password/page.tsx
 * Establece la nueva contraseña (POST /auth/reset-password) a partir del
 * token que llega por query string (?token=...), tal como lo logueo
 * POST /auth/forgot-password. Exito -> redirige a /login?reset=success.
 */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { resetPassword } from "@/lib/auth-api";
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "@/app/_components/form-styles";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await resetPassword(token ?? "", newPassword);
      router.replace("/login?reset=success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo restablecer la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Enlace inválido</h1>
        <p className={ERROR_CLASS}>
          Este enlace no incluye un token de restablecimiento. Pide uno nuevo desde{" "}
          <Link href="/forgot-password" className="underline">
            ¿Olvidaste tu contraseña?
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Restablecer contraseña</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Elige una contraseña nueva de al menos 8 caracteres, con mayúscula, minúscula y número.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <label className={LABEL_CLASS}>
          Nueva contraseña
          <input
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Confirmar contraseña
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        {errorMessage && (
          <p role="alert" className={ERROR_CLASS}>
            {errorMessage}
          </p>
        )}

        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON_CLASS}>
          {submitting ? "Guardando..." : "Restablecer contraseña"}
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
