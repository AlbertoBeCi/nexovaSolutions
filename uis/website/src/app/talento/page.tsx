/**
 * NEXOVA SOLUTIONS - website/talento/page.tsx
 * Registro de talento con maquetacion editorial en dos columnas, aviso B2B
 * obligatorio y formulario en 3 pasos (<TalentForm/>).
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
    <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Registro de Talento
            </h1>
            <p className="text-base leading-relaxed text-ink-muted">
              Completa tus datos profesionales en 3 pasos para unirte a nuestra bolsa de talento.
              Evaluaremos tu perfil y te contactaremos cuando surja una oportunidad que encaje
              contigo.
            </p>
          </div>

          <div className="border border-line bg-surface p-6">
            <h2 className="font-display text-base font-bold text-ink">
              ¿Cómo evaluamos tu candidatura?
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-ink-muted">
              <li className="flex items-start gap-3">
                <span className="font-mono text-xs font-semibold text-accent">01</span>
                <span>Revisión de experiencia, sector e idiomas por nuestro equipo en Valencia y Miami.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono text-xs font-semibold text-accent">02</span>
                <span>Contacto directo cuando exista una vacante alineada con tu disponibilidad.</span>
              </li>
            </ul>
          </div>

          <div className="border border-line bg-bg-alt p-6 text-sm text-ink-muted">
            <p className="m-0 leading-relaxed">
              ¿Eres una empresa buscando talento? Escríbenos a{" "}
              <a
                href="mailto:contacto@nexova.com"
                className="font-semibold text-accent underline hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                contacto@nexova.com
              </a>
            </p>
          </div>
        </div>

        <div className="border border-line bg-surface p-6 sm:p-8">
          <TalentForm />
        </div>
      </div>
    </main>
  );
}
