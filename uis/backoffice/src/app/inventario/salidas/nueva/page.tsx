import { redirectToInventory } from "../../_lib/redirect-to-inventory";

export default async function LegacyOutboundOrderPage({
  searchParams,
}: PageProps<"/inventario/salidas/nueva">) {
  redirectToInventory("/backoffice/inventory/orders/outbound", await searchParams);
}
