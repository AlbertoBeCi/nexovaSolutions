export const INVENTORY_OFFICES = ["Valencia", "Miami"] as const;
export type InventoryOffice = (typeof INVENTORY_OFFICES)[number];

export const INVENTORY_CATEGORIES = [
  "hardware",
  "peripherals",
  "office_supplies",
  "training_materials",
] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const INVENTORY_EXIT_TYPES = ["allocation", "consumption"] as const;
export type InventoryExitType = (typeof INVENTORY_EXIT_TYPES)[number];
export type InventoryOrderType = "inbound" | "outbound";

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  hardware: "Equipos informáticos",
  peripherals: "Periféricos",
  office_supplies: "Material de oficina",
  training_materials: "Material de formación",
};

export const INVENTORY_OFFICE_LABELS: Record<InventoryOffice, string> = {
  Valencia: "Valencia",
  Miami: "Miami",
};

export const INVENTORY_EXIT_TYPE_LABELS: Record<InventoryExitType, string> = {
  allocation: "Asignación",
  consumption: "Consumo",
};

export const INVENTORY_ORDER_TYPE_LABELS: Record<InventoryOrderType, string> = {
  inbound: "Entrada",
  outbound: "Salida",
};

export interface InventoryAsset {
  id: number;
  name: string;
  sku: string;
  category: InventoryCategory;
  office: InventoryOffice;
  currentStock: number;
}

export interface InventoryOrder {
  id: number;
  orderType: InventoryOrderType;
  assetId: number;
  asset: Omit<InventoryAsset, "currentStock">;
  quantity: number;
  office: InventoryOffice;
  createdAt: string;
  creatorName: string | null;
  supplier: string | null;
  exitType: InventoryExitType | null;
  assignedTo: string | null;
}

export interface InboundOrderInput {
  assetId: number;
  quantity: number;
  supplier: string;
  office: InventoryOffice;
}

export interface OutboundOrderInput {
  assetId: number;
  quantity: number;
  exitType: InventoryExitType;
  assignedTo: string | null;
  office: InventoryOffice;
}
