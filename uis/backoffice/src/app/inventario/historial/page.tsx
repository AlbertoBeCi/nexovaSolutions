import { redirectToInventory } from "../_lib/redirect-to-inventory";

export default async function LegacyInventoryHistoryPage({
  searchParams,
}: PageProps<"/inventario/historial">) {
  redirectToInventory("/backoffice/inventory/orders", await searchParams);
}
