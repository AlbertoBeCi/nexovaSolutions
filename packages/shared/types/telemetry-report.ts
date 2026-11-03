/** Shared response contract for the telemetry report endpoint and backoffice. */
export interface TelemetryReport {
  period: { from: string; to: string };
  metrics: {
    events_per_day: Array<{ date: string; event_type: string; events: number }>;
    request_error_rate: Array<{
      date: string;
      route_template: string;
      requests: number;
      errors: number;
      error_rate: number;
    }>;
    latency_by_route: Array<{
      date: string;
      route_template: string;
      samples: number;
      mean_ms: number;
      p95_ms: number;
    }>;
    auth_failure_rate: Array<{
      date: string;
      attempts: number;
      failures: number;
      failure_rate: number;
    }>;
  };
}
