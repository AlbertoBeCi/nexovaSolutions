import { ReportingPageContent } from "./reporting-dashboard";

export default async function ReportingPage({ searchParams }: {
  searchParams: Promise<{ week_start?: string | string[] }>;
}) {
  const query = await searchParams;
  const weekStart = Array.isArray(query.week_start) ? "invalid" : query.week_start;
  return <ReportingPageContent weekStart={weekStart} />;
}
