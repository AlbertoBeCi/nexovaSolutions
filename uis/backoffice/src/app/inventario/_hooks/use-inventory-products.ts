"use client";

import { useEffect, useState } from "react";

import { getInventoryProducts } from "../../../services/inventory-api";
import type { InventoryAsset } from "../../../types/inventory";

type ProductResult =
  | { key: number; status: "success"; products: InventoryAsset[] }
  | { key: number; status: "error"; message: string };

export function useInventoryProducts() {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<ProductResult | null>(null);
  const loading = result === null || result.key !== reloadKey;

  useEffect(() => {
    let cancelled = false;
    getInventoryProducts()
      .then((products) => {
        if (!cancelled) setResult({ key: reloadKey, status: "success", products });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            key: reloadKey,
            status: "error",
            message: error instanceof Error ? error.message : "No se pudo cargar el inventario.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return {
    loading,
    products: !loading && result.status === "success" ? result.products : [],
    error: !loading && result.status === "error" ? result.message : null,
    retry: () => setReloadKey((value) => value + 1),
  };
}
