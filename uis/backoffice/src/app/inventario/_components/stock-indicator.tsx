export function StockIndicator({ stock }: { stock: number }) {
  // Umbrales acordados para operaciones: 0 sin existencias, 1–5 bajo, más de 5 disponible.
  if (stock === 0) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
        Sin existencias · 0
      </span>
    );
  }

  if (stock <= 5) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Existencias bajas · {stock}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
      Disponible · {stock}
    </span>
  );
}
