import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          // JSON-LD estático: sin datos de usuario, seguro de serializar aquí.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
