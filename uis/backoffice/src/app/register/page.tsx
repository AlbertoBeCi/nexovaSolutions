/**
 * NEXOVA SOLUTIONS - app/register/page.tsx
 * Registro (POST /users, con Profile opcional embebido si se llena el
 * nombre) + login automatico con las mismas credenciales. Un solo
 * formulario: el backend ya soporta todo en una llamada.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "../_components/form-styles";
import { register } from "../../lib/auth-api";

interface FormState {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone: string;
  address: string;
}

const EMPTY_FORM: FormState = {
  email: "",
  password: "",
  confirmPassword: "",
  name: "",
  phone: "",
  address: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      router.replace("/");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo completar el registro.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Crear cuenta</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Los datos de perfil son opcionales: puedes completarlos ahora o después desde «Mi cuenta».
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <label className={LABEL_CLASS}>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Contraseña
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            className={FIELD_CLASS}
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            Al menos 8 caracteres.
          </span>
        </label>

        <label className={LABEL_CLASS}>
          Confirmar contraseña
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Nombre (opcional)
          <input
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Teléfono (opcional)
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Dirección (opcional)
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

        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON_CLASS}>
          {submitting ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}
