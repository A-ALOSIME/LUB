import "server-only";
import Link from "next/link";
import {sql} from "drizzle-orm";
import {CalendarDays,ClipboardCheck,Clock,Inbox} from "lucide-react";
import {withUser} from "@/db/client";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ContentText} from "@/components/content-text";
import {Badge} from "@/components/ui/badge";
import {createTranslator} from "@/lib/i18n";
import {formatHours} from "@/lib/display";
import type {Locale} from "@/lib/preferences";
type Update={title:string;status:string};
export type OverviewUpdates={tasks:Update[];events:Update[];hours:Array<Update&{hours:string}>;requests:Update[]};

export async function getOverviewUpdates(user:string):Promise<OverviewUpdates>{
 return withUser(user,async tx=>{
  const [row]=await tx.execute(sql`select
   coalesce((select jsonb_agg(x) from(select t.title,case when p.withdrawn_at is not null then 'Available' else coalesce(p.status_code,'Available') end as status from lub.tasks t left join lub.task_participants p on p.task_id=t.id and p.user_id=${user} where t.deleted_at is null and t.status_code='Open' and lub.can_read_task(t.id) order by t.created_at desc,t.id limit 2)x),'[]') as tasks,
   coalesce((select jsonb_agg(x) from(select e.title,case when r.status_code='Cancelled' then 'Withdrawn' else r.review_status_code end as status from lub.event_registrations r join lub.events e on e.id=r.event_id where r.user_id=${user} order by r.registered_at desc,r.id limit 2)x),'[]') as events,
   coalesce((select jsonb_agg(x) from(select o.name_ar as title,h.status_code as status,h.hours::text from lub.hour_records h join lub.organization_memberships m on m.id=h.organization_membership_id join lub.organizations o on o.id=h.organization_id where m.user_id=${user} order by coalesce(h.reviewed_at,h.created_at) desc,h.id limit 2)x),'[]') as hours,
   coalesce((select jsonb_agg(jsonb_build_object('title',x.title,'status',x.status)) from(select * from(
    select o.name_ar as title,a.status_code as status,a.created_at as at from lub.membership_applications a join lub.registration_rounds r on r.id=a.registration_round_id join lub.organizations o on o.id=r.organization_id where a.applicant_user_id=${user}
    union all select r.name_ar,r.status_code,r.created_at from lub.organization_opening_requests r where r.applicant_user_id=${user}
    union all select o.name_ar,case when r.response_code='Pending' then 'RenewalPending' else r.response_code end,c.created_at from lub.membership_renewals r join lub.organization_memberships m on m.id=r.organization_membership_id join lub.renewal_campaigns c on c.id=r.renewal_campaign_id join lub.organizations o on o.id=m.organization_id where m.user_id=${user} and c.status_code in('Open','Paused')
   )u order by (status='RenewalPending') desc,at desc limit 3)x),'[]') as requests`);
  return row as unknown as OverviewUpdates;
 });
}

export function OverviewUpdatesView({data,locale}:{data:OverviewUpdates;locale:Locale}){
 const t=createTranslator(locale),labels:Record<string,string>={Available:t("متاحة","Available"),Joined:t("منضم","Joined"),In_Progress:t("قيد العمل","In progress"),Submitted:t("قيد المراجعة","Under review"),Pending:t("قيد المراجعة","Under review"),Accepted:t("مقبول","Accepted"),Approved:t("معتمد","Approved"),Rejected:t("مرفوض","Rejected"),Withdrawn:t("مسحوب","Withdrawn"),Interview:t("مقابلة","Interview"),RenewalPending:t("دعوة تجديد","Renewal invitation"),Renewed:t("تم التجديد","Renewed"),Declined:t("اعتذار","Declined"),Closed:t("مغلقة","Closed"),Completed:t("مكتملة","Completed"),Cancelled:t("ملغاة","Cancelled"),Voided:t("ملغى","Voided"),Changes_Requested:t("طلب تعديل","Changes requested")};
 const groups=[{key:"tasks" as const,title:t("المهام","Tasks"),Icon:ClipboardCheck,href:"/activity?tab=tasks",empty:t("لا توجد مهام متاحة الآن","No tasks available right now")},{key:"events" as const,title:t("الفعاليات","Events"),Icon:CalendarDays,href:"/activity?tab=events",empty:t("لا توجد تسجيلات فعاليات","No event registrations")},{key:"hours" as const,title:t("الساعات","Hours"),Icon:Clock,href:"/activity?tab=hours",empty:t("لا توجد تحديثات للساعات","No hours updates")},{key:"requests" as const,title:t("الطلبات","Requests"),Icon:Inbox,href:"/applications",empty:t("لا توجد طلبات أو دعوات تجديد","No requests or renewal invitations")}];
 return <section className="grid gap-4 md:grid-cols-2" aria-label={t("أهم تحديثاتك","Your latest updates")}>{groups.map(({key,title,Icon,href,empty})=><Card key={key}><CardHeader><CardTitle className="flex items-center gap-2"><Icon aria-hidden/>{title}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{data[key].length?<ul className="flex flex-col gap-3">{data[key].map((item,index)=><li key={index} className="flex min-w-0 flex-wrap items-center justify-between gap-2"><Link href={item.status==="RenewalPending"?"/applications?tab=renewals":href} className="min-w-0 break-words hover:underline focus-visible:outline-2 focus-visible:outline-ring"><ContentText value={item.title}/>{"hours" in item&&<> · {formatHours(item.hours as string,locale)}</>}</Link><Badge variant="outline">{labels[item.status]??item.status}</Badge></li>)}</ul>:<p className="text-sm text-muted-foreground">{empty}</p>}<Button variant="ghost" size="sm" className="self-start" nativeButton={false} render={<Link href={href}/>}>{t("عرض الكل","View all")}</Button></CardContent></Card>)}</section>;
}
