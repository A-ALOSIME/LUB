import { Clock3 } from "lucide-react";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/preferences";
import { HoursRecordTable } from "./hours-record-table";
import type { HoursWorkspace } from "./repository";
import { SelfReportPolicy } from "./self-report-policy";

export function HoursWorkspaceView({ data, org, locale }: { data: HoursWorkspace; org: string; locale: Locale }) {
  const t = createTranslator(locale);
  return <section className="min-w-0 space-y-4" aria-label={t("الساعات بانتظار الاعتماد", "Hours pending approval")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{t("الساعات بانتظار الاعتماد", "Hours pending approval")}</h2>
      {data.canPolicy && <SelfReportPolicy org={org} enabled={data.selfEnabled} locale={locale}/>}
    </div>
    {data.records.length
      ? <HoursRecordTable items={data.records} locale={locale}/>
      : <WorkspaceEmptyState icon={Clock3} title={t("لا توجد ساعات بانتظار الاعتماد", "No hours pending approval")} description={t("تظهر الطلبات والإضافات التي تحتاج مراجعتك هنا.", "Requests and entries that need your review appear here.")}/>}
  </section>;
}
