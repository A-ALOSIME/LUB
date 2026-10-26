"use client";
import type {ReactNode} from "react";
import {Separator} from "@/components/ui/separator";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveFilterForm } from "@/components/live-filter-form";
import { FormField } from "@/components/form-field";
import { academicTerm } from "@/lib/display";
import type { HoursWorkspace } from "./repository";
import type { HoursFilters } from "./workspace-view";
import type { Locale } from "@/lib/preferences";
export function HoursAdvancedFilters({data, filters, locale, settingsAction}: {data: Pick<HoursWorkspace,"terms"|"scopes">; filters: HoursFilters; locale: Locale; settingsAction?:ReactNode}) {
  const en=locale==="en";
  return <Popover><PopoverTrigger render={<Button variant="outline" type="button" size="sm"/>}><SlidersHorizontal/>{en?"Filters":"فلاتر"}</PopoverTrigger><PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]" dir={en?"ltr":"rtl"}><LiveFilterForm className="grid gap-4">
    <input type="hidden" name="section" value="hours"/><input type="hidden" name="hoursPage" value="0"/>{filters.q&&<input type="hidden" name="q" value={filters.q}/ >}{filters.status&&<input type="hidden" name="hourStatus" value={filters.status}/>}
    <FormField label={en?"Academic term":"الفصل الدراسي"}><NativeSelect name="term" defaultValue={filters.term??""}><option value="">{en?"All terms":"كل الفصول"}</option>{data.terms.map(term=><option key={term.id} value={term.id}>{academicTerm(term.name_ar,locale)} · {term.academic_year}</option>)}</NativeSelect></FormField>
    <FormField label={en?"Committee":"اللجنة"}><NativeSelect name="committee" defaultValue={filters.committee??""}><option value="">{en?"All committees":"كل اللجان"}</option>{data.scopes.filter(scope=>scope.id).map(scope=><option key={scope.id} value={scope.id!}>{scope.name}</option>)}</NativeSelect></FormField>
  </LiveFilterForm>{settingsAction&&<><Separator/>{settingsAction}</>}</PopoverContent></Popover>;
}
