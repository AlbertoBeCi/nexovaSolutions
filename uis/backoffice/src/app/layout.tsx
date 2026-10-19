import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./_components/app-shell";

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
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
