"use client";
import {useState} from "react";
import Link from "next/link";
import {Copy,Check,Eye} from "lucide-react";
import {Card,CardHeader,CardTitle,CardContent,CardFooter} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Field,FieldContent,FieldLabel,FieldDescription} from "@/components/ui/field";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Separator} from "@/components/ui/separator";
import {toast} from "@/components/ui/toast";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {saveTalentPrivacy,type TalentPrivacyState} from "./actions";
export function TalentPrivacyCard({initial,locale}:{initial:TalentPrivacyState;locale:Locale}){
 const c=createTranslator(locale),[state,setState]=useState(initial),[pending,setPending]=useState(false),[error,setError]=useState(false),[saved,setSaved]=useState(false),[copied,setCopied]=useState(false);
 async function change(next:TalentPrivacyState){const before=state;setState(next);setPending(true);setError(false);setSaved(false);try{const result=await saveTalentPrivacy(next.enabled,next.indexable);if(!result.settings)throw new Error("save");setState(result.settings);setSaved(true);toast.add({title:c("تم الحفظ","Saved"),type:"success",timeout:3000});}catch{setState(before);setError(true);}finally{setPending(false);}}
 const href=`/talent/${state.slug}`,available=state.enabled&&!!state.slug;
 return <Card dir={locale==="ar"?"rtl":"ltr"} data-talent-privacy=""><CardHeader><CardTitle>{c("الخصوصية والظهور","Privacy and visibility")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
 <Field orientation="horizontal" className="items-start"><div className="flex shrink-0 items-center gap-2"><Switch id="profile-public" checked={state.enabled} disabled={pending} onCheckedChange={enabled=>change({...state,enabled,indexable:enabled&&state.indexable})}/><span className="text-sm text-muted-foreground">{state.enabled?c("مفعّل","On"):c("متوقف","Off")}</span></div><FieldContent><FieldLabel htmlFor="profile-public">{c("ملفي العام","My public profile")}</FieldLabel><FieldDescription>{c("يظهر في المواهب ولمن يملك الرابط.","Visible in talent discovery and to anyone with the link.")}</FieldDescription></FieldContent></Field>
 <Separator className="h-px"/>
 <Field orientation="horizontal" className="items-start"><div className="flex shrink-0 items-center gap-2"><Switch id="profile-indexing" checked={state.indexable} disabled={pending||!state.enabled} onCheckedChange={indexable=>change({...state,indexable})}/><span className="text-sm text-muted-foreground">{state.indexable?c("مفعّل","On"):c("متوقف","Off")}</span></div><FieldContent><FieldLabel htmlFor="profile-indexing">{c("فهرسة محركات البحث","Search engine indexing")}</FieldLabel><FieldDescription>{state.enabled?c("يسمح لمحركات البحث بإظهار ملفك العام.","Allow search engines to list your public profile."):c("فعّل ملفك العام أولًا للسماح بالفهرسة.","Enable your public profile first to allow indexing.")}</FieldDescription></FieldContent></Field>
 {error&&<Alert variant="destructive"><AlertDescription>{c("تعذّر الحفظ. أعدنا الإعدادات السابقة؛ حاول مجددًا.","Could not save. Previous settings were restored; try again.")}</AlertDescription></Alert>}
 <p role="status" className="text-sm text-muted-foreground">{pending?c("جاري الحفظ…","Saving…"):saved?c("تم الحفظ","Saved"):""}</p>
 </CardContent><CardFooter className="flex flex-wrap gap-2 border-t border-border pt-4">{available?<Button nativeButton={false} role="link" variant="secondary" render={<Link href={href}/> }><Eye/>{c("معاينة كما يراه الزوار","Preview as a visitor")}</Button>:<Button variant="secondary" disabled><Eye/>{c("معاينة كما يراه الزوار","Preview as a visitor")}</Button>}<Button variant="outline" disabled={!available||pending} onClick={async()=>{try{await navigator.clipboard.writeText(new URL(href,window.location.origin).href);setCopied(true);toast.add({title:c("تم نسخ الرابط","Link copied"),type:"success",timeout:3000});}catch{toast.add({title:c("تعذّر نسخ الرابط","Could not copy link"),type:"error",timeout:0});}}}>{copied?<Check/>:<Copy/>}{c("نسخ الرابط","Copy link")}</Button></CardFooter></Card>;
}
