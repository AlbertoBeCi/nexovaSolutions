import { redirectToInventory } from "./_lib/redirect-to-inventory";

export default async function LegacyInventoryProductsPage({
  searchParams,
}: PageProps<"/inventario">) {
  redirectToInventory("/backoffice/inventory/products", await searchParams);
}
