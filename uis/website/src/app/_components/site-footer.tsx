/**
 * NEXOVA SOLUTIONS - website/_components/site-footer.tsx
 * Pie de la web publica. Portado desde index.html: sedes de Valencia y Miami
 * (GEO-SEO), enlaces corporativos y redes.
 */

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer id="contacto" aria-label="Pie de página" className="bg-bg-alt px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <span className="font-display text-lg font-semibold text-ink">NEXOVA</span>
          <p className="max-w-md text-sm leading-relaxed text-ink-muted">
            Consultora de recursos humanos y adquisición de talento con más de 10 años ayudando a
            empresas de tecnología, retail y servicios financieros. Sedes en Valencia y Miami.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <address className="space-y-1.5 text-sm not-italic text-ink-muted">
            <strong className="mb-1 block border-b border-line pb-1 text-ink">Valencia, España</strong>
            Av. de Francia 12, 46023
            <br />
            Valencia, España
            <br />
            <a href="tel:+34960123456" className="px-1 hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent">
              +34 960 123 456
            </a>
          </address>
          <address className="space-y-1.5 text-sm not-italic text-ink-muted">
            <strong className="mb-1 block border-b border-line pb-1 text-ink">Miami, Florida (EE. UU.)</strong>
            1450 Brickell Ave, Suite 900
            <br />
            Miami, FL 33131
            <br />
            <a href="tel:+13055550191" className="px-1 hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent">
              +1 305 555 0191
            </a>
          </address>
        </div>

        <div className="flex flex-col justify-between gap-6 border-t border-line pt-8 sm:flex-row sm:items-center md:col-span-2">
          <nav aria-label="Enlaces corporativos" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/#inicio" className="px-1 text-accent transition-colors hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent">
              Inicio
            </Link>
            <Link href="/#servicios" className="px-1 text-accent transition-colors hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent">
              Servicios
            </Link>
            <Link href="/#talento" className="px-1 text-accent transition-colors hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent">
              Por qué Nexova
            </Link>
            <Link href="/talento" className="px-1 text-accent transition-colors hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent">
              Solicitar Ahora
            </Link>
          </nav>

          <div className="space-y-2 text-xs text-ink-muted sm:space-y-1 sm:text-right">
            <p className="text-sm">
              <a href="mailto:contacto@nexova.com" className="px-1 hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent">
                contacto@nexova.com
              </a>
            </p>
            <p className="flex items-center justify-start gap-3 sm:justify-end">
              <a
                href="https://linkedin.com/company/nexova"
                target="_blank"
                rel="noopener noreferrer"
                className="px-1 hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                LinkedIn
              </a>
              <span aria-hidden="true">|</span>
              <a
                href="https://instagram.com/nexova"
                target="_blank"
                rel="noopener noreferrer"
                className="px-1 hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
