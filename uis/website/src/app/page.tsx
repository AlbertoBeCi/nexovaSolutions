/**
 * NEXOVA SOLUTIONS - website/page.tsx
 * Landing corporativa redisenada bajo el sistema "Transatlantic Executive Ledger"
 * (1 seccion por pantalla, bordes simetricos, sin kickers sobre encabezados,
 * micro-interacciones y fidelidad literal a CONTEXT.md).
 */

import Link from "next/link";

const SERVICIOS = [
  {
    n: "01",
    titulo: "Headhunting Ejecutivo",
    texto:
      "Búsqueda y selección de perfiles ejecutivos y mandos medios, con proceso personalizado y garantía de reemplazo.",
    detalle: "Búsqueda directa · Evaluación por competencias",
  },
  {
    n: "02",
    titulo: "Outsourcing de Atención al Cliente",
    texto:
      "Equipos especializados para empresas tecnológicas, con formación continua y supervisión dedicada.",
    detalle: "Operación bilingüe · SLA monitorizado",
  },
  {
    n: "03",
    titulo: "Formación Corporativa",
    texto:
      "Programas de soft skills y liderazgo, con cursos presenciales y en línea adaptados a cada organización.",
    detalle: "Liderazgo · Equipos de alto rendimiento",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Nexova",
            description: "Consultora de recursos humanos y adquisición de talento",
            url: "https://nexova.com",
            foundingDate: "2011",
            address: [
              {
                "@type": "PostalAddress",
                addressCountry: "ES",
                addressLocality: "Valencia",
                addressRegion: "Comunidad Valenciana",
              },
              {
                "@type": "PostalAddress",
                addressCountry: "US",
                addressLocality: "Miami",
                addressRegion: "Florida",
              },
            ],
            contactPoint: {
              "@type": "ContactPoint",
              telephone: "+34-960-123-456",
              contactType: "customer service",
              availableLanguage: ["Spanish", "English"],
            },
            sameAs: [
              "https://linkedin.com/company/nexova",
              "https://instagram.com/nexova",
            ],
          }),
        }}
      />

      {/* Pantalla 1: Hero */}
      <section
        id="inicio"
        aria-labelledby="inicio-heading"
        className="flex min-h-[calc(100svh-4rem)] items-center border-b border-line py-14 lg:py-20"
      >
        <div
          data-enter
          className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:px-8"
        >
          <div className="space-y-7">
            <h1
              id="inicio-heading"
              className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]"
            >
              Construimos equipos excepcionales para empresas en crecimiento
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Consultora de recursos humanos y adquisición de talento con más de 10 años ayudando a
              empresas de tecnología, retail y servicios financieros a encontrar y desarrollar el
              mejor talento.
            </p>

            <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center">
              <Link
                href="/talento"
                className="btn-tactile inline-flex min-h-12 items-center justify-center bg-accent px-7 py-3.5 text-sm font-semibold text-accent-ink hover:bg-accent-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
              >
                Únete a nuestro banco de talento
              </Link>
              <a
                href="#servicios"
                className="btn-tactile inline-flex min-h-12 items-center justify-center border border-line bg-surface px-7 py-3.5 text-sm font-semibold text-ink hover:border-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-ink/10"
              >
                Ver servicios
              </a>
            </div>

            <p className="font-mono text-xs text-ink-muted">
              Fundada en 2011 · Valencia, España — Miami, EE. UU.
            </p>
          </div>

          <aside
            aria-label="Expediente de evaluación de candidato"
            className="card-lift border border-line bg-surface p-7 sm:p-9"
          >
            <div className="flex items-center justify-between pb-5">
              <span className="font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                Expediente de cribado
              </span>
              <span className="bg-accent-soft px-2.5 py-1 font-mono text-xs font-semibold text-accent">
                N.º 9842
              </span>
            </div>

            <dl className="space-y-4 border-y border-line py-6 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-muted">Perfil evaluado</dt>
                <dd className="text-right font-semibold text-ink">Tecnológico · Ventas B2B</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-muted">Operación</dt>
                <dd className="text-right font-medium text-ink">Valencia / Miami</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-muted">Inglés verificado</dt>
                <dd className="font-mono font-medium text-ink">C1 Avanzado</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-muted">SLA de respuesta</dt>
                <dd className="font-mono font-medium text-ink">&lt; 24 horas</dd>
              </div>
            </dl>

            <div className="flex items-center justify-between pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Coincidencia técnica
                </p>
                <p className="mt-1 text-xs text-ink-muted">Validación por competencias</p>
              </div>
              <span className="font-display text-3xl font-bold text-accent">98%</span>
            </div>
          </aside>
        </div>
      </section>

      {/* Pantalla 2: Servicios */}
      <section
        id="servicios"
        aria-labelledby="servicios-heading"
        className="flex min-h-[calc(100svh-4rem)] items-center border-b border-line py-20"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2
              id="servicios-heading"
              className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            >
              Servicios
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              Tres líneas de práctica especializadas para acompañar el crecimiento de equipos en
              España y Estados Unidos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {SERVICIOS.map((s) => (
              <article
                key={s.n}
                className="card-lift flex flex-col justify-between border border-line bg-surface p-8"
              >
                <div>
                  <div className="mb-8 flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold tracking-widest text-accent">
                      {s.n}
                    </span>
                    <span className="h-2 w-2 bg-accent" aria-hidden="true" />
                  </div>
                  <h3 className="mb-4 font-display text-xl font-bold leading-snug text-ink">
                    {s.titulo}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{s.texto}</p>
                </div>

                <div className="mt-8 border-t border-line pt-5">
                  <p className="font-mono text-xs text-ink-muted">{s.detalle}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pantalla 3: Por qué Nexova + CTA banco de talento */}
      <section
        id="talento"
        aria-labelledby="talento-heading"
        className="flex min-h-[calc(100svh-4rem)] items-center py-20"
      >
        <div className="mx-auto w-full max-w-6xl space-y-12 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2
              id="talento-heading"
              className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            >
              Por qué Nexova
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              Trayectoria contrastada en procesos ejecutivos y equipos operativos desde 2011.
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {RAZONES.map((r) => (
              <div key={r.dato} className="border border-line bg-surface p-7">
                <dt className="font-display text-2xl font-bold text-ink">{r.dato}</dt>
                <dd className="mt-2.5 text-sm leading-relaxed text-ink-muted">{r.texto}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col items-start justify-between gap-8 bg-surface-inverse p-8 text-ink-inverse sm:flex-row sm:items-center sm:p-12">
            <div className="space-y-3">
              <h3 className="font-display text-2xl font-bold tracking-tight">
                ¿Buscas tu próxima oportunidad?
              </h3>
              <p className="max-w-xl text-sm leading-relaxed text-ink-inverse-muted">
                Regístrate en nuestro banco de talento y te contactaremos cuando surja una posición
                que encaje con tu perfil.
              </p>
            </div>
            <Link
              href="/talento"
              className="btn-tactile inline-flex min-h-12 shrink-0 items-center justify-center bg-bg px-7 py-3.5 text-sm font-semibold text-ink hover:bg-bg-alt focus:outline-none focus-visible:ring-4 focus-visible:ring-bg/40"
            >
              Ir al formulario
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
