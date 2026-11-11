/** Read-only wire contract of services/reporting/router.py. */
export interface WeeklyOfficeProgramPerformanceEntry {
  office: "valencia" | "miami";
  programme_id: string;
  total_material_cost: number;
  kits_delivered_count: number;
  shortage_events_count: number;
  cost_variance_events_count: number;
  currency: "EUR" | "USD";
}

export interface WeeklyOfficeProgramPerformance {
  week_start: string;
  entries: WeeklyOfficeProgramPerformanceEntry[];
}
