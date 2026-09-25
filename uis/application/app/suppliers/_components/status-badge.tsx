/**
 * NEXOVA SOLUTIONS - suppliers/_components/status-badge.tsx
 * Insignia de estado del proveedor: verde «Activo», ámbar «Suspendido».
 */

import { STATUS_LABELS, type SupplierStatus } from "@/types/supplier";

const STATUS_STYLES: Record<SupplierStatus, { badge: string; dot: string }> = {
  active: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/30",
    dot: "bg-emerald-500",
  },
  suspended: {
    badge: "bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/30",
    dot: "bg-amber-500",
  },
};

export function StatusBadge({ status }: { status: SupplierStatus }) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${styles.badge}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${styles.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
