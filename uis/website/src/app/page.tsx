/**
 * NEXOVA SOLUTIONS - website/page.tsx
 * Landing corporativa. Portada desde index.html (Hito 1) a Next/React: hero con
 * ficha de candidato, servicios y "Por qué Nexova". Contenido alineado con
 * CONTEXT.md. Server component.
 */

import Link from "next/link";

const SERVICIOS = [
  {
    n: "N.º 01",
    titulo: "Headhunting Ejecutivo",
    texto:
      "Búsqueda y selección de perfiles ejecutivos y mandos medios, con proceso personalizado y garantía de reemplazo.",
  },
  {
    n: "N.º 02",
    titulo: "Outsourcing de Atención al Cliente",
    texto:
      "Equipos especializados para empresas tecnológicas, con formación continua y supervisión dedicada.",
  },
  {
    n: "N.º 03",
    titulo: "Formación Corporativa",
    texto:
      "Programas de soft skills y liderazgo, con cursos presenciales y en línea adaptados a cada organización.",
  },
];

const RAZONES = [
  { dato: "12 años", texto: "de experiencia en el mercado" },
  { dato: "Presencia regional", texto: "España y Estados Unidos" },
  { dato: "+500", texto: "procesos de selección completados" },
  { dato: "Especialización", texto: "tecnología, retail y finanzas" },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section
        id="inicio"
        aria-labelledby="inicio-heading"
        className="relative overflow-hidden border-b border-line py-20 lg:py-28"
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8">
          <div>
            <p className="mb-6 font-display text-sm uppercase tracking-[0.2em] text-accent">
              Valencia, España — Miami, EE. UU.
            </p>
            <h1
              id="inicio-heading"
              className="mb-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl"
            >
              Construimos equipos excepcionales para empresas en crecimiento
            </h1>
            <p className="mb-10 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg">
              Consultora de recursos humanos y adquisición de talento con más de 10 años ayudando a
              empresas de tecnología, retail y servicios financieros a encontrar y desarrollar el
              mejor talento.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/talento"
                className="inline-flex items-center justify-center bg-accent px-6 py-3.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
              >
                Únete a nuestro banco de talento
              </Link>
              <a
                href="#servicios"
                className="inline-flex items-center justify-center border border-ink/25 px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-ink/10"
              >
                Ver servicios
              </a>
            </div>
          </div>

          <div className="relative select-none border border-line bg-bg-alt/70 p-6 sm:p-8">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                Ficha de candidato
              </span>
              <span className="font-mono text-[11px] text-accent">N.º 9842</span>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Perfil</dt>
                <dd className="text-right font-medium text-ink">Tecnológico · Ventas B2B</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Inglés</dt>
                <dd className="font-medium text-ink">C1</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">SLA de cribado</dt>
                <dd className="font-medium text-ink">&lt; 24 horas</dd>
              </div>
            </dl>
            <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Coincidencia algorítmica
              </span>
              <span className="font-display text-2xl font-semibold text-accent">98%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section
        id="servicios"
        aria-labelledby="servicios-heading"
        className="mx-auto w-full max-w-6xl border-b border-line px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 font-display text-sm uppercase tracking-[0.2em] text-accent">
            Qué hacemos
          </p>
          <h2
            id="servicios-heading"
            className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            Servicios
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
          {SERVICIOS.map((s) => (
            <article
              key={s.n}
              className="flex flex-col bg-bg p-8 transition-colors hover:bg-bg-alt lg:p-10"
            >
              <span className="mb-8 font-mono text-xs tracking-widest text-accent">{s.n}</span>
              <h3 className="mb-3 font-display text-xl font-semibold text-ink">{s.titulo}</h3>
              <p className="mb-10 flex-grow text-sm leading-relaxed text-ink-muted">{s.texto}</p>
              <span className="inline-flex items-center gap-2 border-t border-line pt-5 text-xs font-semibold uppercase tracking-wider text-accent">
                Garantía Nexova
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* Por qué Nexova */}
      <section
        id="talento"
        aria-labelledby="talento-heading"
        className="mx-auto w-full max-w-6xl border-b border-line px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 font-display text-sm uppercase tracking-[0.2em] text-accent">Talento</p>
          <h2
            id="talento-heading"
            className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            Por qué Nexova
          </h2>
        </div>

        <dl className="grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {RAZONES.map((r) => (
            <div key={r.dato} className="py-8 sm:px-8 sm:py-2 first:sm:pl-0 last:sm:pr-0">
              <dt className="font-display text-3xl font-semibold text-ink">{r.dato}</dt>
              <dd className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                {r.texto}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA banco de talento */}
      <section className="bg-bg-alt">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
              ¿Buscas tu próxima oportunidad?
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-muted">
              Regístrate en nuestro banco de talento y te contactaremos cuando surja una posición que
              encaje con tu perfil.
            </p>
          </div>
          <Link
            href="/talento"
            className="inline-flex shrink-0 items-center justify-center bg-accent px-6 py-3.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          >
            Ir al formulario
          </Link>
        </div>
      </section>
    </main>
  );
}
