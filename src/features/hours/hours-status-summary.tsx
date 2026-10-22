import { Card, CardContent } from "@/components/ui/card";
import type { HoursStatusTotals } from "./repository";
import type { Locale } from "@/lib/preferences";

export function HoursStatusSummary({ totals, locale = "ar" }: { totals: HoursStatusTotals; locale?: Locale }) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const formatHours = (value: string) => new Intl.NumberFormat(en ? "en-US" : "ar-SA-u-nu-latn", { maximumFractionDigits: 2 }).format(Number(value));
  const cards = [
    { id: "approved", title: c("الساعات المعتمدة", "Approved hours"), value: totals.approved },
    { id: "pending", title: c("بانتظار الاعتماد", "Pending approval"), value: totals.pending },
    { id: "rejected", title: c("الساعات المرفوضة", "Rejected hours"), value: totals.rejected },
  ];

  return <section className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label={c("ملخص الساعات", "Hours summary")}>
    {cards.map(item => <Card key={item.id} size="sm" className="min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-1 py-3">
        <p className="min-h-8 text-xs leading-4 text-muted-foreground">{item.title}</p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-1"><bdi className="min-w-0 break-words text-2xl font-bold tabular-nums sm:text-3xl">{formatHours(item.value)}</bdi><span className="shrink-0 text-xs text-muted-foreground">{c("ساعة", "hours")}</span></p>
      </CardContent>
    </Card>)}
  </section>;
}
