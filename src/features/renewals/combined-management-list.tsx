import { Archive,LockKeyhole,Play,Eye } from "lucide-react";
import { RowAction } from "@/components/row-action";
import { Badge } from "@/components/ui/badge";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import type { ReactNode } from "react";
import { WorkflowForm } from "@/features/forms/mutation-form";
import type { Round } from "@/features/forms/repository";
import type { Campaign } from "./repository";
import type { Locale } from "@/lib/preferences";
import { formatRiyadhDateTime } from "@/lib/datetime";

type Item =
  | { kind: "round"; id: string; title: string; opens: string; closes: string; status: string; round: Round }
  | { kind: "campaign"; id: string; title: string; opens: string; closes: string; status: string; campaign: Campaign };

function statusLabel(status: string, locale: Locale) {
  if (locale === "en") return status === "Archived" ? "Closed" : status;
  return status === "Draft" ? "مسودة" : status === "Open" ? "مفتوحة" : "مغلقة";
}

function dateRange(from: string, to: string, locale: Locale) {
  const format = (value: string) => formatRiyadhDateTime(value, locale);
  return locale === "en" ? `From ${format(from)} to ${format(to)}` : `من ${format(from)} إلى ${format(to)}`;
}

export function CombinedManagementList({ rounds, campaigns, organization, locale, canManageRounds, emptyAction }: {
  rounds: Round[];
  campaigns: Campaign[];
  organization: string;
  locale: Locale;
  canManageRounds: boolean;
  emptyAction?: ReactNode;
}) {
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const items: Item[] = [
    ...rounds.map(round => ({ kind: "round" as const, id: round.id, title: round.title, opens: round.opens_at, closes: round.closes_at, status: round.status_code, round })),
    ...campaigns.map(campaign => ({ kind: "campaign" as const, id: campaign.id, title: campaign.name, opens: campaign.opens_at, closes: campaign.closes_at, status: campaign.status_code, campaign })),
  ].sort((a, b) => Date.parse(b.opens) - Date.parse(a.opens));

  if (!items.length) return <section className="space-y-4">
    <div className="space-y-1">
      <h2 className="text-base font-semibold">{c("ابدأ جولة تسجيل أو حملة تجديد", "Start a registration round or renewal campaign")}</h2>
      <p className="text-sm text-muted-foreground">{c("اختر النوع المناسب للبدء.", "Choose the type you want to create.")}</p>
    </div>
    {emptyAction}
  </section>;

  return <div className="rounded-lg border border-border min-w-0"><div className="hidden md:block">
    <table className="w-full text-start text-sm">
      <thead><tr>
        <th className="px-3 py-2 font-medium">{c("النوع", "Type")}</th>
        <th className="px-3 py-2 font-medium">{c("الاسم", "Name")}</th>
        <th className="px-3 py-2 font-medium">{c("التواريخ", "Dates")}</th>
        <th className="px-3 py-2 font-medium">{c("الحالة", "Status")}</th>
        <th className="px-3 py-2 font-medium">{c("الإجراءات", "Actions")}</th>
      </tr></thead>
      <tbody className="divide-y divide-line">{items.map(item => <tr key={`${item.kind}-${item.id}`}>
        <td className="px-3 py-3"><Badge variant="outline">{item.kind === "round" ? c("جولة تسجيل", "Registration round") : c("حملة تجديد", "Renewal campaign")}</Badge></td>
        <td className="max-w-64 px-3 py-3 font-medium" dir="auto">{item.kind === "campaign"
          ? <a className="text-link break-words" href={`/manage/organizations/${organization}/renewals?campaign=${item.id}`}>{item.title}</a>
          : <span className="break-words">{item.title}</span>}</td>
        <td className="px-3 py-3 text-muted">{dateRange(item.opens, item.closes, locale)}</td>
        <td className="px-3 py-3 whitespace-nowrap"><Badge variant={item.status === "Open" ? "secondary" : "outline"}>{statusLabel(item.status, locale)}</Badge></td>
        <td className="px-3 py-3"><div className="flex items-center gap-1">{item.kind==="campaign"&&<RowAction href={`/manage/organizations/${organization}/renewals?campaign=${item.id}`} label={c("عرض الحملة","View campaign")}><Eye/></RowAction>}{item.kind === "round" && canManageRounds && ["Open", "Closed", "Archived"].map(status => {
          if(!(item.status === "Draft" ? ["Open", "Archived"] : item.status === "Open" ? ["Closed"] : item.status === "Closed" ? ["Archived"] : []).includes(status))return <span key={status} className="row-action-space" aria-hidden="true"/>;
          const label = en ? status === "Open" ? "Open" : status === "Closed" ? "Close" : "Archive" : status === "Open" ? "فتح" : status === "Closed" ? "إغلاق" : "أرشفة";
          return <ManagementActionSheet key={status} rowAction icon={status==="Open"?<Play/>:status==="Closed"?<LockKeyhole/>:<Archive/>} label={label} title={en ? `${label} registration round ${item.title}?` : `${label} جولة ${item.title}؟`} locale={locale}>
            <WorkflowForm operation="round-status" fields={{ round: item.round.id, status }} label={en ? `Confirm ${label.toLocaleLowerCase()}` : `تأكيد ${label} الجولة`} locale={locale}>
              <label className="flex items-start gap-2"><input type="checkbox" name="confirm" required className="mt-1 size-4"/>{en ? "I confirm this status change." : "أؤكد تغيير حالة الجولة."}</label>
            </WorkflowForm>
          </ManagementActionSheet>;
        })}</div></td>
      </tr>)}</tbody>
    </table></div><ul className="grid gap-3 p-3 md:hidden">{items.map(item=><li key={item.id} className="rounded-lg border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-medium">{item.title}</h3><Badge variant="outline">{statusLabel(item.status,locale)}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{dateRange(item.opens,item.closes,locale)}</p><div className="mt-3 border-t border-border pt-2"><div className="flex items-center gap-1">{item.kind==="campaign"&&<RowAction href={`/manage/organizations/${organization}/renewals?campaign=${item.id}`} label={c("عرض الحملة","View campaign")}><Eye/></RowAction>}{item.kind === "round" && canManageRounds && ["Open", "Closed", "Archived"].map(status => {
          if(!(item.status === "Draft" ? ["Open", "Archived"] : item.status === "Open" ? ["Closed"] : item.status === "Closed" ? ["Archived"] : []).includes(status))return <span key={status} className="row-action-space" aria-hidden="true"/>;
          const label = en ? status === "Open" ? "Open" : status === "Closed" ? "Close" : "Archive" : status === "Open" ? "فتح" : status === "Closed" ? "إغلاق" : "أرشفة";
          return <ManagementActionSheet key={status} rowAction icon={status==="Open"?<Play/>:status==="Closed"?<LockKeyhole/>:<Archive/>} label={label} title={en ? `${label} registration round ${item.title}?` : `${label} جولة ${item.title}؟`} locale={locale}>
            <WorkflowForm operation="round-status" fields={{ round: item.round.id, status }} label={en ? `Confirm ${label.toLocaleLowerCase()}` : `تأكيد ${label} الجولة`} locale={locale}>
              <label className="flex items-start gap-2"><input type="checkbox" name="confirm" required className="mt-1 size-4"/>{en ? "I confirm this status change." : "أؤكد تغيير حالة الجولة."}</label>
            </WorkflowForm>
          </ManagementActionSheet>;
        })}</div></div></li>)}</ul></div>;
}
