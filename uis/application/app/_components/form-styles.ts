/**
 * NEXOVA SOLUTIONS - app/_components/form-styles.ts
 * Clases Tailwind compartidas por los formularios de auth (login,
 * forgot-password, reset-password, change-password). Mismas clases que ya
 * usa suppliers/_components/supplier-form.tsx, extraídas para no repetirlas
 * en 4 archivos.
 */

export const FIELD_CLASS =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-zinc-50";

export const LABEL_CLASS = "flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300";

export const PRIMARY_BUTTON_CLASS =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50";

export const ERROR_CLASS =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";

export const SUCCESS_CLASS =
  "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
