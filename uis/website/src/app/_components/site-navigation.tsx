import Link from "next/link";

const NAV_ITEMS = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/#talento", label: "Por qué Nexova" },
  { href: "/#contacto", label: "Contacto" },
];

/** Enlaces compartidos por las dos presentaciones de SiteHeader. */
export function SiteNavigation({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const className = variant === "desktop"
    ? "px-2 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    : "px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return NAV_ITEMS.map((item) => (
    <Link key={item.href} href={item.href} onClick={onNavigate} className={className}>
      {item.label}
    </Link>
  ));
}
