/**
 * NEXOVA SOLUTIONS - website/_components/site-footer.tsx
 * Pie de la web pública con datos de contacto de ambas sedes (GEO-SEO).
 */

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer id="contacto" className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Nexova Solutions</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Consultora de recursos humanos y adquisición de talento desde 2011.
          </p>
        </div>

        <address className="text-sm not-italic text-zinc-600 dark:text-zinc-400">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Valencia, España</p>
          <p className="mt-1">+34 960 123 456</p>
        </address>

        <address className="text-sm not-italic text-zinc-600 dark:text-zinc-400">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Miami, Florida (EE. UU.)</p>
          <p className="mt-1">+1 305 555 0191</p>
        </address>

        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Contacto</p>
          <p className="mt-1">
            <a href="mailto:contacto@nexova.com" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              contacto@nexova.com
            </a>
          </p>
          <div className="mt-3 flex gap-4">
            <a href="https://linkedin.com/company/nexova" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              LinkedIn
            </a>
            <a href="https://instagram.com/nexova" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              Instagram
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 px-6 py-6 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
          <p>© 2025 Nexova. Todos los derechos reservados.</p>
          <Link href="/talento" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Únete a nuestro banco de talento
          </Link>
        </div>
      </div>
    </footer>
  );
}
