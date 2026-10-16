import { RequireAuth } from "../../_components/require-auth";
import { InventoryNavigation } from "../../inventario/_components/inventory-navigation";

export default function InventoryChecklistLayout({ children }: LayoutProps<"/backoffice/inventory">) {
  return (
    <RequireAuth>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <InventoryNavigation />
        {children}
      </div>
    </RequireAuth>
  );
}
