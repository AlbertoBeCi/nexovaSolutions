import { redirectToInventory } from "../../_lib/redirect-to-inventory";

export default async function LegacyInboundOrderPage({
  searchParams,
}: PageProps<"/inventario/entradas/nueva">) {
  redirectToInventory("/backoffice/inventory/orders/inbound", await searchParams);
}
