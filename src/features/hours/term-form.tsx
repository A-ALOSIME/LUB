"use client";
import {useState,useCallback,useActionState} from "react";
import {useRouter} from "next/navigation";
import {FormField} from "@/components/form-field";
import {FieldGroup} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {toast} from "@/components/ui/toast";
import {DateRangeInput} from "@/features/forms/date-input";
import {mutateHours,type HoursState} from "./actions";
import {createTranslator} from "@/lib/i18n";
import {actionFeedback} from "@/lib/action-feedback";
import type {Locale} from "@/lib/preferences";
export function TermForm({locale}:{locale:Locale}){
 const t=createTranslator(locale),router=useRouter(),[name,setName]=useState(""),[year,setYear]=useState(""),[range,setRange]=useState({start:"",end:""});
 const update=useCallback((start:string,end:string)=>setRange({start,end}),[]);
 const [state,action,pending]=useActionState(async(previous:HoursState,form:FormData)=>{const result=await mutateHours(previous,form);if(result.success){router.refresh();toast.add({title:t("تم تعريف الفصل","Term created"),type:"success"});}return result;},{});
 return <form action={action} className="flex flex-col gap-6"><input type="hidden" name="operation" value="term"/><FieldGroup>
 <FormField label={t("اسم الفصل","Term name")} required><Input name="name" required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></FormField>
 <FormField label={t("السنة الأكاديمية","Academic year")} required><Input name="year" required minLength={2} maxLength={20} placeholder="2026-2027" dir="ltr" value={year} onChange={e=>setYear(e.target.value)}/></FormField>
 <DateRangeInput startName="starts" endName="ends" label={t("فترة الفصل","Term period")} required locale={locale} onValueChange={update} error={state.error?actionFeedback(state.error,locale):undefined}/>
 </FieldGroup><Button type="submit" className="self-start" disabled={pending||name.trim().length<2||year.trim().length<2||!range.start||!range.end||range.end<range.start}>{pending&&<Spinner/>}{t("تعريف الفصل","Create term")}</Button></form>;
}
