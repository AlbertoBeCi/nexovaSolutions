/**
 * NEXOVA SOLUTIONS - app/account/change-password/page.tsx
 * Cambia la contraseña del usuario autenticado (POST /auth/change-password).
 * Requiere sesion activa (envuelta en RequireAuth).
 */
"use client";

import { useState, type FormEvent } from "react";

import { RequireAuth } from "@/app/_components/require-auth";
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SUCCESS_CLASS } from "@/app/_components/form-styles";
import { changePassword } from "@/lib/auth-api";

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      setSuccessMessage(null);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Tu contraseña se actualizó correctamente.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Cambiar contraseña</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          La nueva contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula y número.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <label className={LABEL_CLASS}>
          Contraseña actual
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

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
          Confirmar nueva contraseña
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
        {successMessage && <p className={SUCCESS_CLASS}>{successMessage}</p>}

        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON_CLASS}>
          {submitting ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <ChangePasswordForm />
    </RequireAuth>
  );
}
