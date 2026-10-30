
import {ContentText} from "@/components/content-text";
import {createTranslator} from "@/lib/i18n";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveFilterForm } from "@/components/live-filter-form";
import { getApplicationDetail, listApplications, countOrganizationApplicationStatuses, statuses, type Filters, type OrganizationRegistrationWorkspace } from "@/features/forms/repository";
import { ApplicationSelection } from "@/features/forms/application-selection";
import { ApplicationReviewStatusFilters } from "@/features/forms/application-review-status-filters";
import { DateRangeInput } from "@/features/forms/date-input";
import { decryptIdentifier } from "@/lib/identifiers";
import { searchApplications } from "@/features/forms/search-action";
import type { Locale } from "@/lib/preferences";
import { Filter } from "lucide-react";
import { FormField } from "@/components/form-field";

export async function ApplicationsTab({ organization, userId, workspace, locale, search }: {
  organization: string;
  userId: string;
  workspace: OrganizationRegistrationWorkspace;
  locale: Locale;
  search: Record<string, string | string[] | undefined>;
}) {
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");
  const value = (key: string) => typeof search[key] === "string" ? search[key] as string : "";
  let lookup = "";
  try {
    const saved = (await cookies()).get("lub-application-search")?.value;
    if (saved) {
      const hash = decryptIdentifier(saved, `application-search:${userId}:${organization}`);
      if (/^[a-f0-9]{64}$/.test(hash)) lookup = hash;
    }
  } catch { /* Invalid or expired lookup cookie is treated as no university filter. */ }

  const filters: Filters = {
    q: value("q").slice(0, 120),
    status: ["Submitted", "Interview", "Accepted", "Rejected", "Withdrawn"].includes(value("status")) ? value("status") : "",
    committee: z.uuid().safeParse(value("committee")).success ? value("committee") : "",
    major: value("major").slice(0, 120),
    level: value("level").slice(0, 20),
    from: /^\d{4}-\d{2}-\d{2}$/.test(value("from")) ? value("from") : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(value("to")) ? value("to") : "",
    page: Math.min(1000, Math.max(1, Math.floor(Number(value("page")) || 1))),
    lookup,
    round:z.uuid().safeParse(value("round")).success?value("round"):"",
    activity: ["prior", "first"].includes(value("activity")) ? value("activity") : "",
  };
  const selectedId = z.uuid().safeParse(value("application")).success ? value("application") : "";
  const [rows, statusCounts, detail] = await Promise.all([
    listApplications(userId, organization, filters),
    countOrganizationApplicationStatuses(userId, organization, { ...filters, status: "", page: 1 }),
    selectedId ? getApplicationDetail(userId, selectedId) : Promise.resolve(undefined),
  ]);
  if (workspace.accountStatus === "Inactive") redirect("/account-unavailable");
  if (!workspace.onboarded) redirect("/onboarding");
  if (!workspace.allowed.some(code => ["APPLICATIONS_VIEW", "APPLICATIONS_REVIEW", "APPLICATIONS_BULK_ACTION"].includes(code))) notFound();
  if (selectedId && (!detail || detail.organization_id !== organization || !detail.canStaff)) notFound();

  const query = new URLSearchParams({ section: "applications" });
  for (const key of ["q", "status", "round","committee", "major", "level", "from", "to", "activity", "page"]) if (value(key)) query.set(key, value(key));
  const queryString = query.toString();
  const filterStatuses = ["", "Submitted","Interview", "Accepted", "Rejected", "Withdrawn"];
  const statusLink = (status: string) => {
    const next = new URLSearchParams(queryString);
    next.delete("application");
    next.delete("page");
    if (status) next.set("status", status); else next.delete("status");
    return `?${next.toString()}`;
  };
  const pageHref = (page: number) => {
    const next = new URLSearchParams(queryString);
    next.set("page", String(page));
    return `?${next}`;
  };

  return <section className="min-w-0 space-y-4" aria-label={c("طلبات الانضمام", "Join requests")}>
    <ApplicationReviewStatusFilters value={filters.status} locale={locale} options={filterStatuses.map(status => ({
      value: status,
      label: status ? statuses[status] : c("الكل", "All"),
      count: status === "" ? statusCounts.all : statusCounts[status.toLowerCase() as "submitted" | "accepted" | "rejected" | "interview" | "withdrawn"]??0,
      href: statusLink(status),
    })).map(option => ({ ...option, count: option.count > 0 ? option.count : undefined }))} />
    <div className="application-review-controls" dir={en ? "ltr" : "rtl"}>
      <LiveFilterForm action={searchApplications} className="application-review-search-form">
        <input type="hidden" name="org" value={organization}/><input type="hidden" name="status" value={filters.status}/><input type="hidden" name="round" value={filters.round??""}/><input type="hidden" name="page" value="1"/>
        <Input name="q" type="search" dir={en ? "ltr" : "rtl"} className={en ? "text-left" : "text-right"} maxLength={120} defaultValue={filters.q} placeholder={c("ابحث بالاسم…", "Search by name…")} aria-label={c("بحث باسم الطالب", "Search by student name")} />
      </LiveFilterForm>
      <Popover>
        <PopoverTrigger render={<Button type="button" variant="outline" size="default"><Filter aria-hidden="true"/>{c("فلاتر", "Filters")}</Button>}/>
        <PopoverContent align={en ? "end" : "start"} className="w-[min(24rem,calc(100vw-1.5rem))] p-4">
          <div className="mb-2 font-medium">{c("فلاتر إضافية", "Additional filters")}</div>
          <LiveFilterForm action={searchApplications} className="grid gap-3">
            <input type="hidden" name="org" value={organization}/><input type="hidden" name="status" value={filters.status}/><input type="hidden" name="q" value={filters.q}/><input type="hidden" name="page" value="1"/>
            <FormField label={c("الجولة","Round")}><NativeSelect name="round" defaultValue={filters.round??""}><option value="">{c("كل الجولات","All rounds")}</option>{workspace.rounds.map(r=><option key={r.id} value={r.id}><ContentText value={r.title}/></option>)}</NativeSelect></FormField>
            <FormField  label={<>{c("اللجنة", "Committee")}</>}><NativeSelect name="committee" defaultValue={filters.committee}><option value="">{c("كل اللجان", "All committees")}</option>{workspace.committees.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></FormField>
            <FormField  label={<>{c("المستوى", "Level")}</>}><input name="level" maxLength={20} defaultValue={filters.level}/></FormField>
            <FormField  label={<>{c("التخصص", "Major")}</>}><input name="major" dir={en ? "ltr" : "rtl"} maxLength={120} defaultValue={filters.major}/></FormField>
            <DateRangeInput startName="from" endName="to" label={c("فترة التقديم", "Application period")} startValue={filters.from} endValue={filters.to} locale={locale}/>
            <FormField  label={<>{c("المشاركة السابقة", "Prior participation")}</>}><NativeSelect name="activity" defaultValue={filters.activity}><option value="">{c("الكل", "All")}</option><option value="prior">{c("له عضوية سابقة", "Previously a member")}</option><option value="first">{c("أول عضوية", "First membership")}</option></NativeSelect></FormField>
            <FormField  label={<>{c("البحث بالرقم الجامعي", "University number search")}</>}><input name="university" inputMode="numeric" maxLength={15} autoComplete="off"/></FormField>
          </LiveFilterForm>
        </PopoverContent>
      </Popover>
    </div>
    <ApplicationSelection rows={rows.slice(0, 25)} locale={locale} canBulk={workspace.allowed.includes("APPLICATIONS_BULK_ACTION")} selectedApplication={detail ? { detail, name: rows.find(application => application.id === detail.id)?.name ?? c("تفاصيل الطلب", "Application details") } : undefined} query={queryString}/>
    <nav aria-label={c("صفحات الطلبات", "Application pages")} className="flex gap-4">{filters.page > 1 && <Link className="text-link" href={pageHref(filters.page - 1)}>{c("السابق", "Previous")}</Link>}{rows.length > 25 && <Link className="text-link" href={pageHref(filters.page + 1)}>{c("التالي", "Next")}</Link>}</nav>
  </section>;
}
