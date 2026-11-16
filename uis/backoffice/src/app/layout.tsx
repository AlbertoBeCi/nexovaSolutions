import type { Metadata } from "next";
import { JetBrains_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "./_components/app-shell";
import { Suspense } from "react";
import { TelemetryObserver } from "./_components/telemetry-observer";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const trackerOrigin = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "https://playground.4geeks.com/tracker/api/v1"
).origin;

export const metadata: Metadata = {
  title: {
    default: "Nexova · Backoffice",
    template: "%s · Nexova Backoffice",
  },
  description: "Herramientas internas de Nexova: pipeline de talento y gestión de candidaturas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${publicSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <link rel="preconnect" href={trackerOrigin} crossOrigin="anonymous" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <Suspense fallback={null}><TelemetryObserver /></Suspense>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
