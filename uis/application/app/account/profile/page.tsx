/**
 * NEXOVA SOLUTIONS - app/account/profile/page.tsx
 * Vista principal de "Mi cuenta": email/role (de GET /auth/me, vía
 * RequireAuth) + formulario de perfil (PUT /profiles/me, upsert). Requiere
 * sesión activa.
 */
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SUCCESS_CLASS } from "@/app/_components/form-styles";
import { RequireAuth } from "@/app/_components/require-auth";
import { updateMyProfile } from "@/lib/auth-api";
import { USER_ROLES, type User } from "@/types/auth";

const ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
  admin: "Administrador",
  manager: "Manager",
  user: "Usuario",
};

interface FormState {
  name: string;
  phone: string;
  address: string;
}

function toFormState(user: User): FormState {
  return {
    name: user.profile?.name ?? "",
    phone: user.profile?.phone ?? "",
    address: user.profile?.address ?? "",
  };
}

function ProfileView({ currentUser }: { currentUser: User }) {
  const [form, setForm] = useState<FormState>(() => toFormState(currentUser));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setErrorMessage("El nombre es obligatorio.");
      setSuccessMessage(null);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateMyProfile({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      setSuccessMessage("Perfil actualizado correctamente.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo actualizar el perfil.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Mi cuenta</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {currentUser.email} · {ROLE_LABELS[currentUser.role]}
        </p>
      </header>

      <section aria-labelledby="profile-form-title" className="flex flex-col gap-4">
        <h2 id="profile-form-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Datos de perfil
        </h2>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <label className={LABEL_CLASS}>
            Nombre
            <input
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          <label className={LABEL_CLASS}>
            Teléfono
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          <label className={LABEL_CLASS}>
            Dirección
            <input
              type="text"
              autoComplete="street-address"
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
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
            {submitting ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>

      <Link
        href="/account/change-password"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        Cambiar contraseña →
      </Link>
    </main>
  );
}

export default function ProfilePage() {
  return <RequireAuth>{(currentUser) => <ProfileView currentUser={currentUser} />}</RequireAuth>;
}
