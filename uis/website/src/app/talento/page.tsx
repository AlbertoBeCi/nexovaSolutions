/**
 * NEXOVA SOLUTIONS - website/talento/page.tsx
 * Registro de talento. Portado desde application.html (Hito 1): introduccion,
 * aviso para empresas y el formulario en 3 pasos (<TalentForm/>).
 */

import type { Metadata } from "next";
import { TalentForm } from "../_components/talent-form";

export const metadata: Metadata = {
  title: "Registro de Talento",
  description:
    "Regístrate en la bolsa de talento de Nexova Solutions. Comparte tu perfil profesional y te contactaremos cuando encaje con una oportunidad en tecnología, retail o servicios financieros en Valencia y Miami.",
};

export default function TalentoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <p className="mb-4 font-display text-sm uppercase tracking-[0.2em] text-accent">
          Para profesionales
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Registro de Talento
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink-muted sm:text-base">
          Completa tus datos profesionales en 3 pasos para unirte a nuestra bolsa de talento.
          Evaluaremos tu perfil y te contactaremos cuando surja una oportunidad que encaje contigo.
        </p>
      </div>

      <div className="mb-10 flex items-start gap-3 border border-line bg-bg-alt p-4 text-sm text-ink-muted">
        <p className="m-0">
          ¿Eres una empresa buscando talento? Escríbenos a{" "}
          <a
            href="mailto:contacto@nexova.com"
            className="px-0.5 font-semibold text-accent underline hover:text-accent-strong focus:outline-none focus:ring-1 focus:ring-accent"
          >
            contacto@nexova.com
          </a>
        </p>
      </div>

      <TalentForm />
    </main>
  );
}
