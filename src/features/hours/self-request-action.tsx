"use client";
import {useState} from "react";
import {ClockPlus} from "lucide-react";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {FormField} from "@/components/form-field";
import {NativeSelect} from "@/components/ui/native-select";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import type {HoursData} from "./repository";
import {HoursForm} from "./form";
import {HoursFields} from "./view";
export function SelfHoursRequestAction({memberships,locale}:{memberships:HoursData["memberships"];locale:Locale}){
 const choices=memberships.filter(row=>row.self),[member,setMember]=useState(choices[0]?.id??""),c=createTranslator(locale),selected=choices.find(row=>row.id===member)??choices[0];
 if(!selected)return null;
 return <ManagementActionSheet label={c("طلب ساعات","Request hours")} title={c("طلب ساعات ذاتي","Request self-reported hours")} icon={<ClockPlus/>} variant="outline" rowAction locale={locale} mobileBottomSheet>
  <HoursForm key={selected.id} operation="self" fields={{member:selected.id}} label={c("إرسال للمراجعة","Submit for review")} locale={locale}>
  <FormField label={c("الجهة","Organization")}><NativeSelect value={selected.id} onChange={event=>setMember(event.target.value)}>{choices.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</NativeSelect></FormField>

   <FormField label={c("نطاق العمل","Work scope")}><NativeSelect name="committee"><option value="">{c("الجهة بالكامل","Entire organization")}</option>{selected.committees.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</NativeSelect></FormField>
   <HoursFields locale={locale}/>
  </HoursForm>
 </ManagementActionSheet>;
}
