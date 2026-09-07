import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nexova.com"),
  title: {
    default: "Nexova Solutions — Consultora de RRHH y adquisición de talento",
    template: "%s — Nexova Solutions",
  },
  description:
    "Consultora de recursos humanos con más de 10 años ayudando a empresas de tecnología, retail y servicios financieros en España y Estados Unidos a encontrar y desarrollar talento.",
  openGraph: {
    title: "Nexova Solutions",
    description: "Consultora de recursos humanos y adquisición de talento. Valencia y Miami.",
    url: "https://nexova.com",
    siteName: "Nexova Solutions",
    locale: "es_ES",
    type: "website",
  },
};

const organizationSchema = {
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
  sameAs: ["https://linkedin.com/company/nexova", "https://instagram.com/nexova"],
};

// Fija data-theme antes del primer paint para evitar parpadeo de tema.
const themeInitScript = `(function(){try{var t=localStorage.getItem('nexova-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${fraunces.variable} ${publicSans.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink focus:outline-none"
        >
          Saltar al contenido principal
        </a>
        <SiteHeader />
        <div id="contenido" className="flex-1">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
