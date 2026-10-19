import type { ReactNode, SelectHTMLAttributes } from "react";
import { stageLabels, statusLabels } from "../../../types/candidate";
import type { CandidateStage, CandidateStatus } from "../../../types/candidate";

export const STATUS_OPTIONS = Object.entries(statusLabels) as [CandidateStatus, string][];
export const STAGE_OPTIONS = Object.entries(stageLabels) as [CandidateStage, string][];

interface CandidateSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> {
  id: string;
  label: ReactNode;
  options: readonly (readonly [string, string])[];
  emptyLabel?: string;
  hideLabel?: boolean;
}

/** Selector nativo y etiquetado; conserva los códigos de API solo como valores. */
export function CandidateSelect({
  id, label, options, emptyLabel, hideLabel = false, className = "", ...props
}: CandidateSelectProps) {
  return (
    <div>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"}>
        {label}
      </label>
      <select
        {...props}
        id={id}
        className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${className}`}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </div>
  );
}
