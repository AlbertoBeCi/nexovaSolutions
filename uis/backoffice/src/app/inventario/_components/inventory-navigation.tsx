import Link from "next/link";

const INVENTORY_LINKS = [
  { href: "/backoffice/inventory/products", label: "Productos" },
  { href: "/backoffice/inventory/orders/inbound", label: "Registrar entrada" },
  { href: "/backoffice/inventory/orders/outbound", label: "Registrar salida" },
  { href: "/backoffice/inventory/orders", label: "Historial" },
] as const;

export function InventoryNavigation() {
  return (
    <nav aria-label="Sección de inventario" className="flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      {INVENTORY_LINKS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
