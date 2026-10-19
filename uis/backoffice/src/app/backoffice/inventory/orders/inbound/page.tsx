import { InboundOrderForm } from "../../../../inventario/_components/inbound-order-form";

export default async function InventoryInboundPage({
  searchParams,
}: PageProps<"/backoffice/inventory/orders/inbound">) {
  const params = await searchParams;
  const initialProductId = typeof params.producto === "string" ? params.producto : "";
  return <InboundOrderForm initialProductId={initialProductId} />;
}
