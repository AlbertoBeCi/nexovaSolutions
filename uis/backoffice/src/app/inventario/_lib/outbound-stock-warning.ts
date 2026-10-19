export function getOutboundStockWarning(quantity: string, availableStock: number): string | null {
  if (!quantity.trim()) return null;
  const requested = Number(quantity);
  if (!Number.isSafeInteger(requested) || requested <= 0 || requested <= availableStock) return null;
  return `La cantidad supera el stock disponible (${availableStock} unidades).`;
}
