import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import { z } from "zod";
import { requireManagementUser } from "@/features/organizations/access";
import {AccountHeader} from "@/components/account-header";
import {taskNotifications,formatTaskDate} from "@/features/tasks/repository";
import {TaskForm} from "@/features/tasks/task-form";
import {TaskPagination} from "@/features/tasks/task-list";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('الإشعارات','Notifications');}
export default async function NotificationsPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const [user,{locale}]=await Promise.all([requireManagementUser(),getPreferences()]);const en=locale==="en";const query=await searchParams;const page=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.page??0);const rows=await taskNotifications(user.id,page);
 return <><AccountHeader/><main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><h1 className="mb-6 text-3xl font-bold">{en?"Notifications":"الإشعارات"}</h1>{rows.length?<ul className="space-y-4">{rows.slice(0,25).map(n=><li key={n.id} className="panel space-y-4 p-6"><h2 dir="auto" className="text-lg font-semibold">{n.title}</h2><p dir="auto" className="leading-8">{n.body}</p><p className="text-sm text-muted">{formatTaskDate(n.created_at)} · {en?n.read_at?"Read":"New":n.read_at?"مقروء":"جديد"}</p><Link className="text-link inline-block" href={n.target_url}>{en?"Open task":"فتح المهمة"}</Link>{!n.read_at&&<TaskForm operation="read" fields={{notification:n.id}} label={en?"Mark as read":"تحديد كمقروء"} locale={locale}/>}</li>)}</ul>:<p className="panel p-6">{en?"No notifications right now.":"لا توجد إشعارات الآن."}</p>}<TaskPagination page={page} more={rows.length>25} base="/notifications" locale={locale}/></main></>;
}
