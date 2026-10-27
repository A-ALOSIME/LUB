"use client";
import {useRouter} from "next/navigation";
import {FilterTabs} from "@/components/ui/filter-tabs";
import type {Locale} from "@/lib/preferences";
export function AdminOrganizationFilters({value,locale}:{value:string;locale:Locale}) {
 const router=useRouter(),en=locale==="en";
 return <FilterTabs className="max-w-full" value={value||"all"} activeTone="secondary" dir={en?"ltr":"rtl"} ariaLabel={en?"Organization status":"حالة الجهات"} options={[{value:"all",label:en?"All":"الكل"},{value:"Active",label:en?"Active":"نشطة"},{value:"Inactive",label:en?"Inactive":"موقوفة"},{value:"Archived",label:en?"Archived":"مؤرشفة"}]} onValueChange={status=>router.push(`/manage/organizations${status==="all"?"":`?status=${status}`}`)}/>;
}
