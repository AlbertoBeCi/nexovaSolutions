import type { Metadata } from "next";
import { JetBrains_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "./_components/app-shell";

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

export const metadata: Metadata = {
  title: {
    default: "Nexova · Operaciones",
    template: "%s · Nexova Operaciones",
  },
  description: "Aplicación interna de operaciones de Nexova: directorio de proveedores y tarifas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${publicSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
