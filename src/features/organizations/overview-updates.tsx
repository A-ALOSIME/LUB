import "server-only";
import Link from "next/link";
import {sql} from "drizzle-orm";
import {CalendarDays,ClipboardCheck,Clock,Inbox} from "lucide-react";
import {withUser} from "@/db/client";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ContentText} from "@/components/content-text";
import {OrganizationStatusBadge,statusTone} from "./organization-status-badge";
import {createTranslator} from "@/lib/i18n";
import {formatHours} from "@/lib/display";
import type {Locale} from "@/lib/preferences";
type Update={title:string;titleEn?:string|null;status:string};
export type OverviewUpdates={tasks:Update[];events:Update[];hours:Array<Update&{hours:string}>;requests:Update[]};

export async function getOverviewUpdates(user: string): Promise<OverviewUpdates> {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ data: OverviewUpdates }>(sql`select lub.own_overview_updates() as data`);
    return row.data;
  });
}

export function OverviewUpdatesView({data,locale}:{data:OverviewUpdates;locale:Locale}){
 const t=createTranslator(locale),labels:Record<string,string>={Available:t("متاحة","Available"),Joined:t("منضم","Joined"),In_Progress:t("قيد العمل","In progress"),Submitted:t("قيد المراجعة","Under review"),Pending:t("قيد المراجعة","Under review"),Accepted:t("مقبول","Accepted"),Approved:t("معتمد","Approved"),Rejected:t("مرفوض","Rejected"),Withdrawn:t("مسحوب","Withdrawn"),Interview:t("مقابلة","Interview"),RenewalPending:t("دعوة تجديد","Renewal invitation"),Renewed:t("تم التجديد","Renewed"),Declined:t("اعتذار","Declined"),Closed:t("مغلقة","Closed"),Completed:t("مكتملة","Completed"),Cancelled:t("ملغاة","Cancelled"),Voided:t("ملغى","Voided"),Changes_Requested:t("طلب تعديل","Changes requested")};
 const groups=[{key:"tasks" as const,title:t("المهام","Tasks"),Icon:ClipboardCheck,href:"/activity?tab=tasks",empty:t("لا توجد مهام متاحة الآن","No tasks available right now")},{key:"events" as const,title:t("الفعاليات","Events"),Icon:CalendarDays,href:"/activity?tab=events",empty:t("لا توجد تسجيلات فعاليات","No event registrations")},{key:"hours" as const,title:t("الساعات","Hours"),Icon:Clock,href:"/activity?tab=hours",empty:t("لا توجد تحديثات للساعات","No hours updates")},{key:"requests" as const,title:t("الطلبات","Requests"),Icon:Inbox,href:"/applications",empty:t("لا توجد طلبات أو دعوات تجديد","No requests or renewal invitations")}];
 return <section className="grid gap-4 md:grid-cols-2" aria-label={t("أهم تحديثاتك","Your latest updates")}>{groups.map(({key,title,Icon,href,empty})=><Card key={key}><CardHeader><CardTitle className="flex items-center gap-2"><Icon aria-hidden/>{title}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{data[key].length?<ul className="flex flex-col gap-3">{data[key].map((item,index)=><li key={index} className="flex min-w-0 flex-wrap items-center justify-between gap-2"><Link href={item.status==="RenewalPending"?"/applications?tab=renewals":href} className="min-w-0 break-words hover:underline focus-visible:outline-2 focus-visible:outline-ring"><ContentText value={locale==="en"?(item.titleEn?.trim()||item.title):item.title}/>{"hours" in item&&<> · {formatHours(item.hours as string,locale)}</>}</Link><OrganizationStatusBadge status={item.status==="Interview"?"interview":statusTone(item.status==="Available"?"Open":item.status==="RenewalPending"?"Pending":item.status)}>{labels[item.status]??item.status}</OrganizationStatusBadge></li>)}</ul>:<p className="text-sm text-muted-foreground">{empty}</p>}<Button variant="ghost" size="sm" className="self-start" nativeButton={false} render={<Link href={href}/>}>{t("عرض الكل","View all")}</Button></CardContent></Card>)}</section>;
}
