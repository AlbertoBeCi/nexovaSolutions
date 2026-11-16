/**
 * NEXOVA SOLUTIONS - website/_components/site-footer.tsx
 * Pie de la web publica con sedes de Valencia y Miami (GEO-SEO),
 * enlaces corporativos y redes.
 */

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer
      id="contacto"
      aria-label="Pie de página"
      className="border-t border-line bg-bg-alt px-4 py-14 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-[1.6fr_1.4fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-5 items-center justify-center bg-accent text-[10px] font-bold text-accent-ink"
            >
              N
            </span>
            <span className="font-display text-lg font-bold text-ink">NEXOVA</span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-ink-muted">
            Consultora de recursos humanos y adquisición de talento con más de 10 años ayudando a
            empresas de tecnología, retail y servicios financieros. Sedes en Valencia y Miami.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <address className="space-y-2 border border-line bg-surface p-5 text-sm not-italic text-ink-muted">
            <strong className="block border-b border-line pb-2 font-semibold text-ink">
              Valencia, España
            </strong>
            <p className="pt-1">
              Av. de Francia 12, 46023
              <br />
              Valencia, España
            </p>
            <a
              href="tel:+34960123456"
              className="inline-block font-mono text-xs font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              +34 960 123 456
            </a>
          </address>
          <address className="space-y-2 border border-line bg-surface p-5 text-sm not-italic text-ink-muted">
            <strong className="block border-b border-line pb-2 font-semibold text-ink">
              Miami, Florida (EE. UU.)
            </strong>
            <p className="pt-1">
              1450 Brickell Ave, Suite 900
              <br />
              Miami, FL 33131
            </p>
            <a
              href="tel:+13055550191"
              className="inline-block font-mono text-xs font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              +1 305 555 0191
            </a>
          </address>
        </div>

        <div className="flex flex-col justify-between gap-6 border-t border-line pt-8 sm:flex-row sm:items-center md:col-span-2">
          <nav aria-label="Enlaces corporativos" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link
              href="/#inicio"
              className="px-1 py-1 font-medium text-accent transition-colors hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Inicio
            </Link>
            <Link
              href="/#servicios"
              className="px-1 py-1 font-medium text-accent transition-colors hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Servicios
            </Link>
            <Link
              href="/#talento"
              className="px-1 py-1 font-medium text-accent transition-colors hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Por qué Nexova
            </Link>
            <Link
              href="/talento"
              className="px-1 py-1 font-medium text-accent transition-colors hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Solicitar Ahora
            </Link>
          </nav>

          <div className="space-y-2 text-xs text-ink-muted sm:space-y-1 sm:text-right">
            <p className="text-sm">
              <a
                href="mailto:contacto@nexova.com"
                className="px-1 font-medium text-ink hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                contacto@nexova.com
              </a>
            </p>
            <p className="flex items-center justify-start gap-3 sm:justify-end">
              <a
                href="https://linkedin.com/company/nexova"
                target="_blank"
                rel="noopener noreferrer"
                className="px-1 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                LinkedIn
              </a>
              <span aria-hidden="true">|</span>
              <a
                href="https://instagram.com/nexova"
                target="_blank"
                rel="noopener noreferrer"
                className="px-1 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Instagram
              </a>
            </p>
            <p>© 2025 Nexova. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
