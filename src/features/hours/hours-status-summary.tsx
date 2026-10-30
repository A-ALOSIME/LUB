
import {ContentText} from "@/components/content-text";
import {createTranslator,t as translateUi} from "@/lib/i18n";
import { formatHours,recordCount,formatCount } from "@/lib/display";
import { Card, CardContent } from "@/components/ui/card";
import type { HoursStatusTotals } from "./repository";
import type { Locale } from "@/lib/preferences";

export function HoursStatusSummary({ totals, locale = "ar" }: { totals: HoursStatusTotals; locale?: Locale }) {
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");
  const cards = [
    { id: "approved", title: c("الساعات المعتمدة", "Approved hours"), count:totals.approvedCount, value: totals.approved },
    { id: "pending", title: c("بانتظار الاعتماد", "Pending approval"), count:totals.pendingCount, value: totals.pending },
    { id: "rejected", title: c("الساعات المرفوضة", "Rejected hours"), count:totals.rejectedCount, value: totals.rejected },
  ];

  return <section className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label={c("ملخص الساعات", "Hours summary")}>
    {cards.map(item => <Card key={item.id} size="sm" className="hours-stat-card min-w-0" data-status={item.id}>
      <CardContent className="flex min-w-0 flex-col gap-1 py-3">
        <p className="hours-stat-title text-xs leading-5 text-muted-foreground"><span aria-hidden="true" className="hours-stat-dot"/><ContentText value={item.title}/></p>
        <p className="min-w-0 break-words text-xl font-bold tabular-nums">{Number(item.value)===0?(translateUi((en) ? "en" : "ar", "0 ساعة", "0 hours")):formatHours(item.value,locale)}</p>
        {item.count!==undefined&&<p className="text-xs text-muted-foreground">{translateUi((en) ? "en" : "ar", item.count===0?"لا سجلات":`من ${formatCount(item.count,"records",locale,"oblique")}`, `From ${recordCount(item.count,locale)}`)}</p>}
      </CardContent>
    </Card>)}
  </section>;
}
