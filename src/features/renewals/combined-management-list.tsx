import {createTranslator} from "@/lib/i18n";
import {Eye} from "lucide-react";
import type {ReactNode} from "react";
import {RowAction} from "@/components/row-action";
import {Badge} from "@/components/ui/badge";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@/components/ui/table";
import {RoundActions} from "@/features/forms/round-actions";
import type {Round} from "@/features/forms/repository";
import type {Campaign} from "./repository";
import type {Locale} from "@/lib/preferences";
import {formatRiyadhDateTime} from "@/lib/datetime";
import {formatCount} from "@/lib/display";

type Item={kind:"round";id:string;title:string;opens:string;closes:string;status:string;round:Round}|{kind:"campaign";id:string;title:string;opens:string;closes:string;status:string;campaign:Campaign};
export function CombinedManagementList({rounds,campaigns,organization,locale,canManageRounds,emptyAction,templates=[]}:{rounds:Round[];campaigns:Campaign[];organization:string;locale:Locale;canManageRounds:boolean;emptyAction?:ReactNode;templates?:Array<{id:string;name:string}>}){
 const c=createTranslator((locale==="en") ? "en" : "ar");
 const now=new Date().getTime();
 const current=rounds.filter(r=>["Open","Closed"].includes(r.status_code)&&Date.parse(r.closes_at)>now).sort((a,b)=>Number(b.status_code==="Open")-Number(a.status_code==="Open")||Date.parse(a.opens_at)-Date.parse(b.opens_at))[0];
 const items:Item[]=[...rounds.filter(r=>r.id!==current?.id).map(round=>({kind:"round" as const,id:round.id,title:round.title,opens:round.opens_at,closes:round.closes_at,status:round.status_code,round})),...campaigns.map(campaign=>({kind:"campaign" as const,id:campaign.id,title:campaign.name,opens:campaign.opens_at,closes:campaign.closes_at,status:campaign.status_code,campaign}))].sort((a,b)=>Date.parse(b.opens)-Date.parse(a.opens));
 const label=(status:string,opens:string,closes:string)=>status==="Archived"?c("مؤرشفة","Archived"):status==="Draft"?c("مسودة","Draft"):status==="Open"&&Date.parse(closes)>now?Date.parse(opens)>now?c("لم تبدأ بعد","Upcoming"):c("مفتوحة","Open"):c("مغلقة","Closed");
 const period=(opens:string,closes:string)=><div className="flex flex-col gap-1 text-sm text-muted-foreground"><span>{c("من","From")} <bdi>{formatRiyadhDateTime(opens,locale)}</bdi></span><span>{c("إلى","To")} <bdi>{formatRiyadhDateTime(closes,locale)}</bdi></span></div>;
 const actions=(item:Item)=>item.kind==="round"?canManageRounds?<RoundActions round={item.round} templates={templates} organization={organization} locale={locale}/>:null:<RowAction label={c("عرض الحملة","View campaign")} href={`/manage/organizations/${organization}/renewals?campaign=${item.id}`}><Eye/></RowAction>;
 if(!rounds.length&&!campaigns.length)return <section className="flex flex-col gap-4"><div><h2 className="font-semibold">{c("ابدأ جولة تسجيل أو حملة تجديد","Start a registration round or renewal campaign")}</h2><p className="text-sm text-muted-foreground">{c("اختر النوع المناسب للبدء.","Choose the type to create.")}</p></div>{emptyAction}</section>;
 return <div className="flex min-w-0 flex-col gap-6">
  {current&&<Card><CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle>{current.title}</CardTitle><Badge variant="secondary">{label(current.status_code,current.opens_at,current.closes_at)}</Badge></div></CardHeader><CardContent className="flex flex-wrap items-center gap-5">{period(current.opens_at,current.closes_at)}<span>{formatCount(current.application_count??0,"applications",locale)}</span>{canManageRounds&&<RoundActions round={current} organization={organization} templates={templates} locale={locale}/>}</CardContent></Card>}
  {items.length>0&&<section className="flex flex-col gap-3"><h2 className="text-base font-medium">{c("السابقة والمسودات والحملات","Previous rounds, drafts and campaigns")}</h2><div className="hidden rounded-lg border border-border md:block"><Table><TableHeader><TableRow><TableHead>{c("الاسم","Name")}</TableHead><TableHead>{c("النوع","Type")}</TableHead><TableHead>{c("الفترة","Period")}</TableHead><TableHead>{c("الحالة","Status")}</TableHead><TableHead>{c("الإجراءات","Actions")}</TableHead></TableRow></TableHeader><TableBody>{items.map(item=><TableRow key={item.id}><TableCell className="font-medium"><bdi>{item.title}</bdi>{item.kind==="round"&&<p className="text-sm font-normal text-muted-foreground">{formatCount(item.round.application_count??0,"applications",locale)}</p>}</TableCell><TableCell>{item.kind==="round"?c("جولة تسجيل","Registration round"):c("حملة تجديد","Renewal campaign")}</TableCell><TableCell>{period(item.opens,item.closes)}</TableCell><TableCell><Badge variant="outline">{label(item.status,item.opens,item.closes)}</Badge></TableCell><TableCell>{actions(item)}</TableCell></TableRow>)}</TableBody></Table></div><ul className="flex flex-col gap-3 md:hidden">{items.map(item=><li key={item.id}><Card><CardHeader><CardTitle>{item.title}</CardTitle><Badge variant="outline">{label(item.status,item.opens,item.closes)}</Badge></CardHeader><CardContent className="flex flex-col gap-3">{period(item.opens,item.closes)}{item.kind==="round"&&<p>{formatCount(item.round.application_count??0,"applications",locale)}</p>}{actions(item)}</CardContent></Card></li>)}</ul></section>}
 </div>;
}
