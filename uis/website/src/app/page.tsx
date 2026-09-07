/**
 * NEXOVA SOLUTIONS - website/page.tsx
 * Landing corporativa. Vista de entrada de la web pública: hero, líneas de
 * negocio, por qué Nexova y llamada al banco de talento. Server component.
 */

import Link from "next/link";

const SERVICIOS = [
  {
    titulo: "Headhunting Ejecutivo",
    puntos: [
      "Búsqueda y selección de perfiles ejecutivos y mandos medios",
      "Proceso personalizado con garantía de reemplazo",
    ],
  },
  {
    titulo: "Outsourcing de Atención al Cliente",
    puntos: [
      "Equipos especializados para empresas tecnológicas",
      "Formación continua y supervisión dedicada",
    ],
  },
  {
    titulo: "Formación Corporativa",
    puntos: [
      "Programas de soft skills y liderazgo",
      "Cursos presenciales y en línea adaptados a cada organización",
    ],
  },
];

const RAZONES = [
  { dato: "12 años", texto: "de experiencia en el mercado" },
  { dato: "España y EE. UU.", texto: "presencia regional en Valencia y Miami" },
  { dato: "+500 procesos", texto: "de selección completados con éxito" },
  { dato: "Tech · Retail · Finanzas", texto: "especialización sectorial" },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section id="inicio" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          Consultora de talento · Valencia + Miami
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          Construimos equipos excepcionales para empresas en crecimiento
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
          Consultora de recursos humanos y adquisición de talento con más de 10 años ayudando a
          empresas de tecnología, retail y servicios financieros a encontrar y desarrollar el mejor
          talento.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/talento"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Únete a nuestro banco de talento
          </Link>
          <a
            href="#servicios"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Ver servicios
          </a>
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios" className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Nuestras líneas de negocio
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {SERVICIOS.map((servicio) => (
              <article
                key={servicio.titulo}
                className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{servicio.titulo}</h3>
                <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {servicio.puntos.map((punto) => (
                    <li key={punto} className="flex gap-2">
                      <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      {punto}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Por qué Nexova */}
      <section id="nexova" className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Por qué Nexova
        </h2>
        <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {RAZONES.map((razon) => (
            <div key={razon.dato} className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
              <dt className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{razon.dato}</dt>
              <dd className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{razon.texto}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA banco de talento */}
      <section className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              ¿Buscas tu próxima oportunidad?
            </h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
              Regístrate en nuestro banco de talento y te contactaremos cuando surja una posición que
              encaje con tu perfil.
            </p>
          </div>
          <Link
            href="/talento"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Ir al formulario
          </Link>
        </div>
      </section>
    </main>
  );
}
