import {createTranslator} from "@/lib/i18n";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { Locale } from "@/lib/preferences";
import type { HoursExportWorkspace } from "./repository";
import { FormField } from "@/components/form-field";

export function HoursExportOnlyView({ data, org, term, committee, locale = "ar" }: {
  data: HoursExportWorkspace;
  org: string;
  term: string | null;
  committee: string | null;
  locale?: Locale;
}) {
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");

  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">{c("تنزيل سجل الساعات", "Download hours CSV")}</h2>
    <form action={`/manage/organizations/${org}/hours/export`} method="get" className="grid min-w-0 gap-4 rounded-xl border border-line bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:p-5">
      <FormField className="min-w-0" label={<>{c("نطاق التصدير", "Export scope")}</>}><NativeSelect name="committee" defaultValue={committee ?? data.scopes[0]?.id ?? ""}>{data.scopes.map(scope => <option key={scope.id ?? "organization"} value={scope.id ?? ""} dir="auto">{scope.name}</option>)}</NativeSelect></FormField>
      <FormField className="min-w-0" label={<>{c("الفصل الأكاديمي", "Academic term")}</>}><NativeSelect name="term" defaultValue={term ?? ""}><option value="">{c("كل الفصول", "All terms")}</option>{data.terms.map(item => <option key={item.id} value={item.id} dir="auto">{item.name_ar} · {item.academic_year}</option>)}</NativeSelect></FormField>
      <Button type="submit" className="w-full sm:w-auto"><FileSpreadsheet data-icon="inline-start" aria-hidden="true" />{c("تصدير CSV", "Export CSV")}</Button>
    </form>
  </section>;
}