"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { createInboundOrder } from "../../../services/inventory-api";
import { INVENTORY_FIELD_CLASS, INVENTORY_LABEL_CLASS, INVENTORY_BUTTON_CLASS, INVENTORY_ERROR_CLASS, INVENTORY_SUCCESS_CLASS, OfficeSelect, ProductSelect } from "./inventory-fields";
import { useInventoryProducts } from "../_hooks/use-inventory-products";
import type { InventoryOffice } from "../../../types/inventory";

export function InboundOrderForm({ initialProductId }: { initialProductId: string }) {
  const { loading: productsLoading, products, error: productsError, retry: retryProducts } = useInventoryProducts();
  const [selectedId, setSelectedId] = useState(initialProductId);
  const [officeOverride, setOfficeOverride] = useState<InventoryOffice | null>(null);
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const product = useMemo(
    () => products.find((item) => String(item.id) === selectedId) ?? null,
    [products, selectedId]
  );
  const office = officeOverride ?? product?.office ?? "Valencia";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const amount = Number(quantity);
    if (!product) {
      setErrorMessage("Selecciona un producto del inventario.");
      return;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setErrorMessage("La cantidad debe ser un número entero mayor que cero.");
      return;
    }
    if (!supplier.trim()) {
      setErrorMessage("Indica el proveedor de la entrega.");
      return;
    }
    if (supplier.trim().length > 160) {
      setErrorMessage("El proveedor no puede superar los 160 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createInboundOrder({
        assetId: product.id,
        quantity: amount,
        supplier: supplier.trim(),
        office,
      });
      setSuccessMessage(`Entrada de ${created.quantity} unidades de «${product.name}» registrada correctamente.`);
      setQuantity("");
      setSupplier("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo confirmar el registro. Consulta el historial antes de volver a intentarlo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-col gap-6 pb-8">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Registrar entrada</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Registra una entrega recibida para actualizar las existencias del producto.</p>
      </header>

      {productsLoading && <p role="status" className="text-sm text-zinc-500">Cargando productos…</p>}
      {productsError && (
        <div className={INVENTORY_ERROR_CLASS}><p role="alert">{productsError}</p><button type="button" onClick={retryProducts} className="mt-2 font-medium underline">Reintentar</button></div>
      )}
      {!productsLoading && !productsError && products.length === 0 && (
        <p className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">No hay productos disponibles. Añade un producto al inventario antes de registrar una entrada.</p>
      )}

      {!productsLoading && !productsError && products.length > 0 && (
        <form onSubmit={handleSubmit} noValidate className="flex max-w-2xl flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <ProductSelect products={products} value={product ? selectedId : ""} disabled={submitting} onChange={(value) => { setSelectedId(value); setOfficeOverride(null); setErrorMessage(null); setSuccessMessage(null); }} />
          <label className={INVENTORY_LABEL_CLASS}>
            Cantidad recibida
            <input type="number" min="1" step="1" inputMode="numeric" required value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={submitting} className={INVENTORY_FIELD_CLASS} />
          </label>
          <label className={INVENTORY_LABEL_CLASS}>
            Proveedor de la entrega
            <input type="text" maxLength={160} required value={supplier} onChange={(event) => setSupplier(event.target.value)} disabled={submitting} className={INVENTORY_FIELD_CLASS} />
          </label>
          <OfficeSelect value={office} onChange={setOfficeOverride} disabled={submitting} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">La fecha y la persona que registra la entrada se asignan automáticamente.</p>

          {errorMessage && <p role="alert" className={INVENTORY_ERROR_CLASS}>{errorMessage}</p>}
          {successMessage && <p role="status" className={INVENTORY_SUCCESS_CLASS}>{successMessage} <Link className="font-medium underline" href="/backoffice/inventory/orders">Ver historial</Link></p>}
          <button type="submit" disabled={submitting || !product} className={INVENTORY_BUTTON_CLASS}>{submitting ? "Guardando entrada…" : "Registrar entrada"}</button>
        </form>
      )}
    </main>
  );
}
