"use client";
import Link from "next/link";
import {useState,useActionState} from "react";
import {FormField} from "@/components/form-field";
import {FieldGroup} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem,SelectGroup} from "@/components/ui/select";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {Spinner} from "@/components/ui/spinner";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {LeaderEmailSearch} from "./leader-email-search";
import {englishOrganizationSlug} from "./organization-slug";
import {organizationEnglishNameSchema} from "./validation";
import {mutateOrganization} from "./actions";
import {createTranslator} from "@/lib/i18n";
import {actionFeedback} from "@/lib/action-feedback";
import type {Locale} from "@/lib/preferences";
export function CreateOrganizationForm({locale}:{locale:Locale}){
 const t=createTranslator(locale),[name,setName]=useState(""),[english,setEnglish]=useState(""),[leaderValid,setLeaderValid]=useState(true),[touched,setTouched]=useState(false);
 const slug=englishOrganizationSlug(english),valid=organizationEnglishNameSchema.safeParse(english).success&&!!slug;
 const [state,action,pending]=useActionState(mutateOrganization,{});
 const validation=touched&&!valid?t("اكتب اسمًا بالإنجليزية بأحرف وأرقام ومسافات فقط.","Enter an English name using only letters, numbers and spaces."):undefined;
 const url=`lub.community/organizations/${slug}`,short=url.length>64?`${url.slice(0,35)}…${url.slice(-26)}`:url;
 return <form action={action} className="flex flex-col gap-6">
 <input type="hidden" name="operation" value="create-org"/>
 <FieldGroup><FormField label={t("اسم الجهة بالعربي","Arabic organization name")} required><Input name="nameAr" required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoFocus/></FormField>
 <FormField label={t("النوع","Type")} required><Select name="typeCode" defaultValue="Club" items={{Club:t("نادي","Club"),Council:t("مجلس","Council")}}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Club">{t("نادي","Club")}</SelectItem><SelectItem value="Council">{t("مجلس","Council")}</SelectItem></SelectGroup></SelectContent></Select></FormField>
 <FormField label={t("الاسم بالإنجليزي","English organization name")} required error={validation||state.fieldErrors?.nameEn?.map(value=>actionFeedback(value,locale)).join(" ")}><Input name="nameEn" dir="ltr" required maxLength={80} pattern="[A-Za-z0-9 ]+" value={english} aria-invalid={!!validation||!!state.fieldErrors?.nameEn} onBlur={()=>setTouched(true)} onChange={e=>setEnglish(e.target.value)}/><Tooltip><TooltipTrigger render={<span dir="ltr" className="block min-w-0 break-all text-sm text-muted-foreground"/>}>{short}</TooltipTrigger><TooltipContent>{url}</TooltipContent></Tooltip></FormField>
 <LeaderEmailSearch locale={locale} onValidityChange={setLeaderValid}/></FieldGroup>
 {state.error&&!state.fieldErrors?.nameEn&&<p role="alert" className="text-destructive">{actionFeedback(state.error,locale)}</p>}
 <Separator/><div className="flex flex-col gap-2 sm:flex-row"><Button type="submit" disabled={pending||name.trim().length<2||!valid||!leaderValid}>{pending&&<Spinner/>}{t("إنشاء الجهة","Create organization")}</Button><Button variant="secondary" nativeButton={false} render={<Link href="/manage/organizations?tab=organizations"/>}>{t("إلغاء","Cancel")}</Button></div>
 </form>;
}
