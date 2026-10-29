"use client";
import {t as translateUi} from "@/lib/i18n";
import {useRouter} from "next/navigation";
import {FilterTabs} from "@/components/ui/filter-tabs";
import type {Locale} from "@/lib/preferences";
export function AdminOrganizationFilters({value,locale}:{value:string;locale:Locale}) {
 const router=useRouter(),en=locale==="en";
 return <FilterTabs className="max-w-full" value={value||"all"} activeTone="secondary" dir={en?"ltr":"rtl"} ariaLabel={translateUi((en) ? "en" : "ar", "حالة الجهات", "Organization status")} options={[{value:"all",label:translateUi((en) ? "en" : "ar", "الكل", "All")},{value:"Active",label:translateUi((en) ? "en" : "ar", "نشطة", "Active")},{value:"Inactive",label:translateUi((en) ? "en" : "ar", "موقوفة", "Inactive")},{value:"Archived",label:translateUi((en) ? "en" : "ar", "مؤرشفة", "Archived")}]} onValueChange={status=>router.push(`/manage/organizations${status==="all"?"":`?status=${status}`}`)}/>;
}
