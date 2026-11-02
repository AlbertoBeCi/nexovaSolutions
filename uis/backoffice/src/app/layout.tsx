import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./_components/app-shell";
import { Suspense } from "react";
import { TelemetryObserver } from "./_components/telemetry-observer";

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
      className="h-full antialiased"
    >
      <head>
        <link rel="preconnect" href={trackerOrigin} crossOrigin="anonymous" />
      </head>
      <body className="min-h-full">
        <Suspense fallback={null}><TelemetryObserver /></Suspense>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
