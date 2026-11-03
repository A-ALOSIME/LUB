"use client";
import {useState} from "react";
import {useQuery,useQueryClient,queryOptions} from "@tanstack/react-query";
import {Pencil} from "lucide-react";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import {useQueryActor} from "@/components/private-query-provider";
import {privateJson} from "@/lib/private-query";
import {createTranslator} from "@/lib/i18n";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Skeleton} from "@/components/ui/skeleton";
import {Button} from "@/components/ui/button";
import {EventForm,EventFields} from "./form";
import {EventDraftPreview} from "./draft-preview";
import type {EventEditorData} from "./editor-repository";
import type {Locale} from "@/lib/preferences";
export function EventEditorAction({organization,event,locale,disabled=false,hint,open:controlled,onOpenChange,hideTrigger=false}:{organization:string;event:string;locale:Locale;disabled?:boolean;hint?:string;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean}){
 const [local,setLocal]=useState(false),open=controlled??local,setOpen=onOpenChange??setLocal,actor=useQueryActor(),client=useQueryClient(),c=createTranslator(locale);
 const options=queryOptions({queryKey:["event-editor",actor,organization,event],queryFn:({signal})=>privateJson<EventEditorData>(`/api/organizations/${organization}/events/${event}`,signal)}),response=useQuery({...options,enabled:open}),data=response.data;
 return <ManagementActionSheet rowAction icon={<Pencil/>} width="wide" mobileBottomSheet label={c("تعديل","Edit")} title={c("تعديل الفعالية","Edit event")} locale={locale} open={open} onOpenChange={setOpen} hideTrigger={hideTrigger} disabled={disabled} hint={hint}>
  {response.isPending&&<Skeleton className="h-40 w-full"/>}
  {response.isError&&<Alert><AlertDescription>{c("تعذّر تحميل الفعالية. حاول مجددًا.","The event could not be loaded. Try again.")}</AlertDescription><Button variant="outline" onClick={()=>void response.refetch()}>{c("إعادة المحاولة","Retry")}</Button></Alert>}
  {data&&<EventForm operation="save" fields={{org:organization,event,revision:String(data.event.revision)}} label={c("حفظ التعديل","Save changes")} locale={locale} splitBody onSuccess={()=>{void client.invalidateQueries({queryKey:options.queryKey});}} secondaryAction={<EventDraftPreview locale={locale}/>}><EventFields value={data.event} organization={organization} templates={data.templates} locale={locale}/></EventForm>}
 </ManagementActionSheet>;
}
