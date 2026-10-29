"use client";
import {createTranslator} from "@/lib/i18n";
import {useState,useActionState} from "react";
import {Megaphone,Pencil,Link as LinkIcon} from "lucide-react";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Field,FieldGroup,FieldLabel} from "@/components/ui/field";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import {FormField} from "@/components/form-field";
import {EntityImageField} from "@/features/events/event-poster-field";
import {useActionToast} from "@/components/action-toast";
import {mutateOrganization} from "@/features/organizations/actions";
import type {ManagedAnnouncement} from "@/features/organizations/announcement-types";
import type {MutationState} from "@/features/organizations/validation";
import type {Locale} from "@/lib/preferences";
export function AnnouncementDialog({organizationId,announcement,locale,open:controlledOpen,onOpenChange,showTrigger=true,triggerLabel}:{organizationId:string;announcement?:ManagedAnnouncement;locale:Locale;open?:boolean;onOpenChange?:(open:boolean)=>void;showTrigger?:boolean;triggerLabel?:string}){
 const [localOpen,setLocalOpen]=useState(false),open=controlledOpen??localOpen,setOpen=onOpenChange??setLocalOpen,en=locale==="en",c=createTranslator(en ? "en" : "ar");
 const [state,action,pending]=useActionState<MutationState,FormData>(async(previous,form)=>{const result=await mutateOrganization(previous,form);if(result.success)setOpen(false);return result;},{});useActionToast(state,locale);
 return <ManagementActionSheet width="wide" locale={locale} title={announcement?c("تعديل الإعلان","Edit announcement"):c("إعلان جديد","New announcement")} label={triggerLabel??c("إعلان جديد","New announcement")} rowAction={Boolean(announcement)} icon={announcement?<Pencil/>:<Megaphone/>} variant={announcement?"outline":"default"} open={open} onOpenChange={setOpen} hideTrigger={!showTrigger}>
 <form action={action} onReset={event=>event.preventDefault()} className="workflow-split-form"><input type="hidden" name="operation" value="save-announcement"/><input type="hidden" name="organizationId" value={organizationId}/>{announcement&&<input type="hidden" name="announcementId" value={announcement.id}/>}
 <div className="workflow-form-body"><fieldset disabled={pending}><FieldGroup>
 <FormField label={c("العنوان","Title")} error={state.fieldErrors?.title?.[0]} required><Input name="title" required minLength={2} maxLength={120} defaultValue={announcement?.title}/></FormField>
 <FormField label={c("النص","Text")} error={state.fieldErrors?.body?.[0]} required><Textarea name="body" required rows={7} maxLength={5000} defaultValue={announcement?.body}/></FormField>
 <FormField label={c("رابط خارجي (اختياري)","External URL (optional)")} error={state.fieldErrors?.externalUrl?.[0]}><InputGroup><InputGroupInput name="externalUrl" type="url" dir="ltr" className="text-end" maxLength={2000} placeholder="https://" defaultValue={announcement?.externalUrl??""}/><InputGroupAddon><LinkIcon/></InputGroupAddon></InputGroup></FormField>
 <EntityImageField key={`${announcement?.id??"new"}-${open}`} organization={organizationId} locale={locale} purpose="announcement-image" initialPreview={announcement?.imageAssetId?`/files/${announcement.imageAssetId}/preview`:""}/>
 <Field orientation="horizontal"><Switch id={`pin-${announcement?.id??"new"}`} name="pinned" defaultChecked={announcement?.pinned??false}/><FieldLabel htmlFor={`pin-${announcement?.id??"new"}`}>{c("تثبيت الإعلان","Pin announcement")}</FieldLabel></Field>
 </FieldGroup></fieldset>
 {state.error&&<p role="alert" className="error-message">{state.error}</p>}</div>
 <div className="management-action-footer is-modal-footer flex-wrap"><Button type="submit" name="intent" value="publish" disabled={pending}>{pending?c("جارٍ الحفظ…","Saving…"):c("نشر الإعلان","Publish announcement")}</Button><Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>{c("حفظ كمسودة","Save draft")}</Button><Button type="button" variant="ghost" className="sm:ms-auto" disabled={pending} onClick={()=>setOpen(false)}>{c("إلغاء","Cancel")}</Button></div>
 </form></ManagementActionSheet>;
}
