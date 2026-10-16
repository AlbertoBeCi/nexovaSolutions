import { ApiRequestError, apiRequest, jsonInit, type ValidationIssue } from "../lib/api-client";
import type {
  InboundOrderInput,
  InventoryAsset,
  InventoryCategory,
  InventoryExitType,
  InventoryOffice,
  InventoryOrder,
  InventoryOrderType,
  OutboundOrderInput,
} from "../types/inventory";

interface AssetDto {
  id: number;
  name: string;
  sku: string;
  category: InventoryCategory;
  office: InventoryOffice;
  current_stock: number;
}

type AssetSummaryDto = Omit<AssetDto, "current_stock">;

interface OrderDto {
  id: number;
  order_type: InventoryOrderType;
  asset_id: number;
  asset: AssetSummaryDto;
  quantity: number;
  office: InventoryOffice;
  created_at: string;
  user_uuid: string;
  creator_name?: string | null;
  supplier?: string | null;
  exit_type?: InventoryExitType | null;
  assigned_to?: string | null;
}

interface CreatedOrderDto {
  id: number;
  asset_id: number;
  quantity: number;
  office: InventoryOffice;
  created_at: string;
  user_uuid: string;
  supplier?: string;
  exit_type?: InventoryExitType;
  assigned_to?: string | null;
}

export interface CreatedInventoryOrder {
  id: number;
  assetId: number;
  quantity: number;
  office: InventoryOffice;
  createdAt: string;
  userUuid: string;
}

function toAsset(dto: AssetDto): InventoryAsset {
  return {
    id: dto.id,
    name: dto.name,
    sku: dto.sku,
    category: dto.category,
    office: dto.office,
    currentStock: dto.current_stock,
  };
}

function toAssetSummary(dto: AssetSummaryDto): InventoryOrder["asset"] {
  return { id: dto.id, name: dto.name, sku: dto.sku, category: dto.category, office: dto.office };
}

function toOrder(dto: OrderDto): InventoryOrder {
  return {
    id: dto.id,
    orderType: dto.order_type,
    assetId: dto.asset_id,
    asset: toAssetSummary(dto.asset),
    quantity: dto.quantity,
    office: dto.office,
    createdAt: dto.created_at,
    userUuid: dto.user_uuid,
    creatorName: dto.creator_name ?? null,
    supplier: dto.supplier ?? null,
    exitType: dto.exit_type ?? null,
    assignedTo: dto.assigned_to ?? null,
  };
}

function toCreatedOrder(dto: CreatedOrderDto): CreatedInventoryOrder {
  return {
    id: dto.id,
    assetId: dto.asset_id,
    quantity: dto.quantity,
    office: dto.office,
    createdAt: dto.created_at,
    userUuid: dto.user_uuid,
  };
}

function translateInventoryIssue(issue: ValidationIssue): string {
  const field = issue.loc ? issue.loc[issue.loc.length - 1] : undefined;
  const detail = issue.msg?.replace(/^Value error,\s*/i, "") ?? "";

  if (detail.includes("asignacion")) return "Indica a quién se asigna el producto.";
  if (detail.includes("debe ser null")) return "El consumo no debe incluir destinatario.";
  if (detail.includes("supplier") && detail.includes("vacio")) {
    return "El proveedor es obligatorio.";
  }

  switch (field) {
    case "asset_id":
      return "Selecciona un producto válido.";
    case "quantity":
      if (issue.type === "missing") return "Indica la cantidad.";
      if (issue.type === "greater_than") return "La cantidad debe ser un número entero mayor que cero.";
      if (issue.type === "int_type") return "La cantidad debe ser un número entero.";
      return "Revisa la cantidad indicada.";
    case "supplier":
      return issue.type === "string_too_long"
        ? "El proveedor no puede superar los 160 caracteres."
        : "Indica el proveedor de la entrega.";
    case "office":
      return "Selecciona una oficina válida.";
    case "exit_type":
      return "Selecciona el tipo de salida.";
    case "assigned_to":
      return "Indica a quién se asigna el producto.";
    default: {
      const safeDetail = issue.msg
        ?.replace(/^Value error,\s*/i, "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 300);
      if (safeDetail && !/^\s*(?:<|\{|\[)/.test(safeDetail)) {
        return `La API indicó: ${safeDetail}`;
      }
      return "Revisa los datos indicados y vuelve a intentarlo.";
    }
  }
}

function translateError(error: unknown, fallback: string): Error {
  if (!(error instanceof ApiRequestError)) {
    return new Error(fallback);
  }
  const apiDetail = error.apiDetail;

  if (error.status === 400) {
    const stockError = (apiDetail ?? error.message).match(/Available:\s*(\d+),\s*requested:\s*(\d+)\./i);
    if (stockError) {
      return new ApiRequestError(
        `Stock insuficiente: hay ${stockError[1]} unidades disponibles y has solicitado ${stockError[2]}.`,
        400
      );
    }
    return new ApiRequestError(apiDetail ?? fallback, 400, apiDetail);
  }

  if (error.status === 404) {
    return new ApiRequestError(
      apiDetail ?? "El producto ya no está disponible. Actualiza la lista y selecciónalo de nuevo.",
      404,
      apiDetail
    );
  }
  if (error.status === 403) {
    return new ApiRequestError(apiDetail ?? "No tienes permisos para realizar esta operación.", 403, apiDetail);
  }
  if (error.status === 503) {
    return new ApiRequestError(
      apiDetail ?? "El inventario no está disponible ahora. Inténtalo de nuevo más tarde.",
      503,
      apiDetail
    );
  }
  if (error.status !== null && error.status >= 500) {
    return new ApiRequestError(apiDetail ?? fallback, error.status, apiDetail);
  }
  return error;
}

async function withInventoryErrors<T>(fallback: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw translateError(error, fallback);
  }
}

export function getInventoryProducts(office?: InventoryOffice): Promise<InventoryAsset[]> {
  return withInventoryErrors("No se pudo cargar el inventario.", async () => {
    const query = office ? `?office=${encodeURIComponent(office)}` : "";
    const response = await apiRequest(
      `/inventory/products${query}`,
      { method: "GET", cache: "no-store" },
      "No se pudo cargar el inventario.",
      translateInventoryIssue
    );
    return ((await response.json()) as AssetDto[]).map(toAsset);
  });
}

export function getInventoryProduct(assetId: number): Promise<InventoryAsset> {
  return withInventoryErrors("No se pudo consultar el stock disponible.", async () => {
    const response = await apiRequest(
      `/inventory/products/${assetId}`,
      { method: "GET", cache: "no-store" },
      "No se pudo consultar el stock disponible.",
      translateInventoryIssue
    );
    return toAsset((await response.json()) as AssetDto);
  });
}

export function getInventoryOrders(office?: InventoryOffice): Promise<InventoryOrder[]> {
  return withInventoryErrors("No se pudo cargar el historial de inventario.", async () => {
    const query = office ? `?office=${encodeURIComponent(office)}` : "";
    const response = await apiRequest(
      `/inventory/orders${query}`,
      { method: "GET", cache: "no-store" },
      "No se pudo cargar el historial de inventario.",
      translateInventoryIssue
    );
    return ((await response.json()) as OrderDto[]).map(toOrder);
  });
}

export function createInboundOrder(input: InboundOrderInput): Promise<CreatedInventoryOrder> {
  return withInventoryErrors("No se pudo registrar la entrada.", async () => {
    const response = await apiRequest(
      "/inventory/orders/inbound",
      jsonInit("POST", {
        asset_id: input.assetId,
        quantity: input.quantity,
        supplier: input.supplier,
        office: input.office,
      }),
      "No se pudo registrar la entrada.",
      translateInventoryIssue
    );
    return toCreatedOrder((await response.json()) as CreatedOrderDto);
  });
}

export function createOutboundOrder(input: OutboundOrderInput): Promise<CreatedInventoryOrder> {
  return withInventoryErrors("No se pudo registrar la salida.", async () => {
    const response = await apiRequest(
      "/inventory/orders/outbound",
      jsonInit("POST", {
        asset_id: input.assetId,
        quantity: input.quantity,
        exit_type: input.exitType,
        assigned_to: input.assignedTo,
        office: input.office,
      }),
      "No se pudo registrar la salida.",
      translateInventoryIssue
    );
    return toCreatedOrder((await response.json()) as CreatedOrderDto);
  });
}

export function inventoryErrorStatus(error: unknown): number | null {
  return error instanceof ApiRequestError ? error.status : null;
}
