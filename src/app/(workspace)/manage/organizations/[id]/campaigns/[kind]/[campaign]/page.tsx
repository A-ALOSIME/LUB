import {notFound} from "next/navigation";
import Link from "next/link";
import {z} from "zod";
import {ArrowRight} from "lucide-react";
import {requireManagementUser} from "@/features/organizations/access";
import {getWorkspace,managedRound} from "@/features/forms/repository";
import {RoundActions} from "@/features/forms/round-actions";
import {renewalWorkspace} from "@/features/renewals/repository";
import {RenewalDraftForm} from "@/features/renewals/draft-form";
import {RenewalWorkspaceView} from "@/features/renewals/view";
import {CampaignLifecycleControls} from "@/features/renewals/lifecycle-controls";
import {getPreferences} from "@/lib/preferences";
import {createTranslator} from "@/lib/i18n";
import {formatRiyadhDateTime} from "@/lib/datetime";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {ContentText} from "@/components/content-text";
export default async function CampaignPage({params}:{params:Promise<{id:string;kind:string;campaign:string}>}){
 const [route,user,{locale}]=await Promise.all([params,requireManagementUser(),getPreferences()]),c=createTranslator(locale);
 if(!z.uuid().safeParse(route.id).success||!z.uuid().safeParse(route.campaign).success||!["round","renewal"].includes(route.kind))notFound();
 const base=`/manage/organizations/${route.id}/renewals`;
 if(route.kind==="renewal"){
  const data=await renewalWorkspace(user.id,route.id,route.campaign,0,0);if(!data?.selected)notFound();
  return <div className="flex min-w-0 flex-col gap-4"><Button variant="ghost" nativeButton={false} render={<Link href={base}/>} className="self-start"><ArrowRight className="ltr:rotate-180"/>{c("رجوع للحملات","Back to campaigns")}</Button><CampaignLifecycleControls kind="renewal" id={data.selected.id} title={data.selected.name} status={data.selected.status_code} organization={route.id} locale={locale} allowed={data.allowed} editForm={<RenewalDraftForm campaign={data.selected} terms={data.terms} locale={locale}/>}/><RenewalWorkspaceView data={data} org={route.id} page={0} memberPage={0} locale={locale} hideNewCampaign hideCampaignList hideCampaignActions/></div>;
 }
 const [data,round]=await Promise.all([getWorkspace(user.id,route.id,null),managedRound(user.id,route.id,route.campaign)]);
 if(!data||!round||!data.allowed.includes("REGISTRATION_ROUNDS_MANAGE"))notFound();
 return <div className="flex min-w-0 flex-col gap-4"><Button variant="ghost" nativeButton={false} render={<Link href={base}/>} className="self-start"><ArrowRight className="ltr:rotate-180"/>{c("رجوع للحملات","Back to campaigns")}</Button><Card><CardHeader><CardTitle><ContentText value={round.title}/></CardTitle><Badge variant="outline" className="self-start">{({Draft:c("مسودة","Draft"),Open:c("مفتوحة","Open"),Paused:c("متوقفة","Paused"),Closed:c("مغلقة","Closed"),Archived:c("مؤرشفة","Archived")})[round.status_code]??round.status_code}</Badge></CardHeader><CardContent className="flex flex-col gap-4"><p>{formatRiyadhDateTime(round.opens_at,locale)} · {formatRiyadhDateTime(round.closes_at,locale)}</p><RoundActions round={round} organization={route.id} templates={data.templates.filter(t=>t.versions.some(v=>v.status_code==="Published"))} locale={locale}/><Button variant="outline" nativeButton={false} className="self-start" render={<Link href={`/manage/organizations/${route.id}/members?section=applications&round=${round.id}`}/>}>{c("طلبات الانضمام","Applications")}</Button></CardContent></Card></div>;
}
