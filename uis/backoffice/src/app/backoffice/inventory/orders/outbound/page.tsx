import { OutboundOrderForm } from "../../../../inventario/_components/outbound-order-form";

export default async function InventoryOutboundPage({
  searchParams,
}: PageProps<"/backoffice/inventory/orders/outbound">) {
  const params = await searchParams;
  const initialProductId = typeof params.producto === "string" ? params.producto : "";
  return <OutboundOrderForm initialProductId={initialProductId} />;
}
