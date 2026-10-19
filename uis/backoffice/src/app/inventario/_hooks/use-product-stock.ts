"use client";

import { useEffect, useState } from "react";

import { getInventoryProduct } from "../../../services/inventory-api";
import type { InventoryAsset } from "../../../types/inventory";

type StockResult =
  | { key: string; status: "success"; product: InventoryAsset }
  | { key: string; status: "error"; message: string };

export function useProductStock(assetId: number | null) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<StockResult | null>(null);
  const requestKey = assetId === null ? "" : `${assetId}:${reloadToken}`;
  const loading = assetId !== null && (result === null || result.key !== requestKey);

  useEffect(() => {
    if (assetId === null) return;
    let cancelled = false;
    getInventoryProduct(assetId)
      .then((product) => {
        if (!cancelled) setResult({ key: requestKey, status: "success", product });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            status: "error",
            message: error instanceof Error ? error.message : "No se pudo consultar el stock disponible.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, requestKey]);

  return {
    loading,
    product: !loading && result?.status === "success" && result.key === requestKey ? result.product : null,
    error: !loading && result?.status === "error" && result.key === requestKey ? result.message : null,
    retry: () => setReloadToken((value) => value + 1),
  };
}
