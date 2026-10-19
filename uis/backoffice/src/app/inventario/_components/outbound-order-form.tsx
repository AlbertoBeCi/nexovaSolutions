"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { createOutboundOrder, getInventoryProduct, inventoryErrorStatus } from "../../../services/inventory-api";
import {
  INVENTORY_EXIT_TYPE_LABELS,
  INVENTORY_EXIT_TYPES,
  type InventoryExitType,
  type InventoryOffice,
} from "../../../types/inventory";
import { useInventoryProducts } from "../_hooks/use-inventory-products";
import { useProductStock } from "../_hooks/use-product-stock";
import { getOutboundStockWarning } from "../_lib/outbound-stock-warning";
import { StockIndicator } from "./stock-indicator";
import {
  INVENTORY_BUTTON_CLASS,
  INVENTORY_ERROR_CLASS,
  INVENTORY_FIELD_CLASS,
  INVENTORY_LABEL_CLASS,
  INVENTORY_SUCCESS_CLASS,
  OfficeSelect,
  ProductSelect,
} from "./inventory-fields";

export function OutboundOrderForm({ initialProductId }: { initialProductId: string }) {
  const { loading: productsLoading, products, error: productsError, retry: retryProducts } = useInventoryProducts();
  const [selectedId, setSelectedId] = useState(initialProductId);
  const [officeOverride, setOfficeOverride] = useState<InventoryOffice | null>(null);
  const [quantity, setQuantity] = useState("");
  const [exitType, setExitType] = useState<InventoryExitType>("consumption");
  const [assignedTo, setAssignedTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const product = useMemo(
    () => products.find((item) => String(item.id) === selectedId) ?? null,
    [products, selectedId]
  );
  const office = officeOverride ?? product?.office ?? "Valencia";
  const { loading: stockLoading, product: stockProduct, error: stockError, retry: retryStock } =
    useProductStock(product?.id ?? null);
  const stockWarning = stockProduct ? getOutboundStockWarning(quantity, stockProduct.currentStock) : null;
  const exceedsAvailableStock = stockWarning !== null;
  const quantityDescriptionIds = [
    stockWarning ? "outbound-stock-warning" : null,
    quantityError ? "outbound-quantity-error" : null,
  ].filter(Boolean).join(" ");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setQuantityError(null);
    setSuccessMessage(null);
    const amount = Number(quantity);
    if (!product) {
      setErrorMessage("Selecciona un producto del inventario.");
      return;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setQuantityError("La cantidad debe ser un número entero mayor que cero.");
      return;
    }
    if (stockProduct && amount > stockProduct.currentStock) {
      setQuantityError(
        `Stock insuficiente: hay ${stockProduct.currentStock} unidades disponibles y has solicitado ${amount}.`
      );
      return;
    }
    if (exitType === "allocation" && !assignedTo.trim()) {
      setErrorMessage("Indica a quién se asigna el producto.");
      return;
    }
    if (exitType === "allocation" && assignedTo.trim().length > 160) {
      setErrorMessage("El destinatario no puede superar los 160 caracteres.");
      return;
    }

    setSubmitting(true);
    setCheckingStock(true);
    try {
      const latestProduct = await getInventoryProduct(product.id);
      if (amount > latestProduct.currentStock) {
        setQuantityError(
          `Stock insuficiente: hay ${latestProduct.currentStock} unidades disponibles y has solicitado ${amount}.`
        );
        retryStock();
        return;
      }

      const created = await createOutboundOrder({
        assetId: product.id,
        quantity: amount,
        exitType,
        assignedTo: exitType === "allocation" ? assignedTo.trim() : null,
        office,
      });
      setSuccessMessage(`Salida de ${created.quantity} unidades de «${product.name}» registrada correctamente.`);
      setQuantity("");
      setAssignedTo("");
      retryStock();
    } catch (error) {
      const status = inventoryErrorStatus(error);
      const message = status === null
        ? "No se pudo confirmar si la salida se registró. Consulta el historial antes de volver a enviarla."
        : error instanceof Error
          ? error.message
          : "No se pudo registrar la salida.";
      if (status === 400) {
        setQuantityError(message);
        retryStock();
      } else {
        setErrorMessage(message);
      }
    } finally {
      setCheckingStock(false);
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting &&
    !productsLoading &&
    !productsError &&
    products.length > 0 &&
    Boolean(product) &&
    !stockLoading &&
    !stockError &&
    stockProduct !== null &&
    stockProduct.currentStock > 0;

  return (
    <main className="flex flex-col gap-6 pb-8">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Registrar salida</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Registra una asignación o un consumo y comprueba antes las existencias disponibles.</p>
      </header>

      {productsLoading && <p role="status" className="text-sm text-zinc-500">Cargando productos…</p>}
      {productsError && <div className={INVENTORY_ERROR_CLASS}><p role="alert">{productsError}</p><button type="button" onClick={retryProducts} className="mt-2 font-medium underline">Reintentar</button></div>}
      {!productsLoading && !productsError && products.length === 0 && (
        <p className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">No hay productos disponibles para registrar una salida.</p>
      )}

      {!productsLoading && !productsError && products.length > 0 && (
        <form onSubmit={handleSubmit} noValidate className="flex max-w-2xl flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <ProductSelect products={products} value={product ? selectedId : ""} disabled={submitting} onChange={(value) => { setSelectedId(value); setOfficeOverride(null); setErrorMessage(null); setQuantityError(null); setSuccessMessage(null); }} />

          {!product && <p className="text-sm text-zinc-500 dark:text-zinc-400">Selecciona un producto para consultar sus existencias.</p>}
          {product && stockLoading && <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">Consultando existencias…</p>}
          {product && stockError && <div className={INVENTORY_ERROR_CLASS}><p role="alert">{stockError}</p><button type="button" onClick={retryStock} className="mt-2 font-medium underline">Actualizar existencias</button></div>}
          {stockProduct && !stockLoading && !checkingStock && <div role="status" className="flex flex-col items-start gap-2"><span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Stock disponible</span><StockIndicator stock={stockProduct.currentStock} /><button type="button" onClick={retryStock} disabled={submitting} className="text-sm font-medium text-blue-700 underline disabled:opacity-60 dark:text-blue-400">Actualizar existencias</button></div>}

          <label className={INVENTORY_LABEL_CLASS}>
            Cantidad que sale
            <input
              id="outbound-quantity"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              required
              value={quantity}
              onChange={(event) => { setQuantity(event.target.value); setErrorMessage(null); setQuantityError(null); }}
              disabled={submitting || !stockProduct}
              aria-invalid={Boolean(quantityError || exceedsAvailableStock)}
              aria-describedby={quantityDescriptionIds || undefined}
              className={INVENTORY_FIELD_CLASS}
            />
            {exceedsAvailableStock && (
              <span id="outbound-stock-warning" role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
                {stockWarning}
              </span>
            )}
            {quantityError && (
              <span id="outbound-quantity-error" role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
                {quantityError}
              </span>
            )}
          </label>

          <label className={INVENTORY_LABEL_CLASS}>
            Tipo de salida
            <select value={exitType} onChange={(event) => { setExitType(event.target.value as InventoryExitType); setAssignedTo(""); setErrorMessage(null); }} disabled={submitting} className={INVENTORY_FIELD_CLASS}>
              {INVENTORY_EXIT_TYPES.map((value) => <option key={value} value={value}>{INVENTORY_EXIT_TYPE_LABELS[value]}</option>)}
            </select>
          </label>

          {exitType === "allocation" && (
            <label className={INVENTORY_LABEL_CLASS}>
              Asignar a
              <input type="text" maxLength={160} required value={assignedTo} onChange={(event) => { setAssignedTo(event.target.value); setErrorMessage(null); }} disabled={submitting} className={INVENTORY_FIELD_CLASS} />
            </label>
          )}

          <OfficeSelect value={office} onChange={setOfficeOverride} disabled={submitting} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">La fecha y la persona que registra la salida se asignan automáticamente.</p>

          {checkingStock && <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">Verificando existencias antes de guardar…</p>}
          {errorMessage && <p role="alert" className={INVENTORY_ERROR_CLASS}>{errorMessage}</p>}
          {successMessage && <p role="status" className={INVENTORY_SUCCESS_CLASS}>{successMessage} <Link className="font-medium underline" href="/backoffice/inventory/orders">Ver historial</Link></p>}
          <button type="submit" disabled={!canSubmit || exceedsAvailableStock} className={INVENTORY_BUTTON_CLASS}>{submitting ? "Guardando salida…" : "Registrar salida"}</button>
        </form>
      )}
    </main>
  );
}
