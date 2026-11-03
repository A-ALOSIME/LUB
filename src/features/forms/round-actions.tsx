"use client";
import {CampaignLifecycleControls} from "@/features/renewals/lifecycle-controls";

import {createTranslator} from "@/lib/i18n";



import {Button} from "@/components/ui/button";


import {Alert,AlertDescription} from "@/components/ui/alert";

import {WorkflowForm} from "./mutation-form";
import {RegistrationRoundFields} from "./registration-round-fields";

import type {Round} from "./repository";
import type {Locale} from "@/lib/preferences";


export function RoundForm({organization,templates,locale,value,reopen=false,onSuccess}:{organization:string;templates:Array<{id:string;name:string}>;locale:Locale;value?:Round;reopen?:boolean;onSuccess?:()=>void}){
 const c=createTranslator((locale==="en") ? "en" : "ar");
 return <WorkflowForm operation={value?"save-round":"create-round"} fields={{org:organization,...(value?{round:value.id}:{}),...(!value||value.status_code==="Draft"||reopen?{publish:"on"}:{})}} label={value&&value.status_code!=="Draft"&&!reopen?c("حفظ التعديلات","Save changes"):c("نشر الآن","Publish now")} disabled={!templates.length} locale={locale} splitBody onSuccess={onSuccess} secondaryAction={!value||value.status_code==="Draft"?<Button type="submit" variant="outline" name="intent" value="draft" formNoValidate>{c("حفظ كمسودة","Save as draft")}</Button>:undefined}>
  {reopen&&<Alert><AlertDescription>{c("مدّد الفترة قبل إعادة فتح الجولة المنتهية.","Extend the period before reopening this expired round.")}</AlertDescription></Alert>}
  <RegistrationRoundFields templates={templates} locale={locale} value={value} formHref={`/manage/organizations/${organization}/renewals?section=forms${value?`&template=${value.form_template_id}`:""}`}/>
 </WorkflowForm>;
}

export function RoundActions({round,organization,templates,locale}:{round:Round;organization:string;templates:Array<{id:string;name:string}>;locale:Locale}){
 return <CampaignLifecycleControls kind="round" id={round.id} title={round.title} status={round.status_code} organization={organization} locale={locale} allowed editForm={<RoundForm value={round} organization={organization} templates={templates} locale={locale}/>}/>;
}
