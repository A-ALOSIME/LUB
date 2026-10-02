import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import { z } from "zod";
import { requireManagementUser } from "@/features/organizations/access";
import { AccountHeader } from "@/components/account-header";
import { listTasks } from "@/features/tasks/repository";
import { TaskList,TaskPagination } from "@/features/tasks/task-list";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('المهام','Tasks');}
export default async function TasksPage({searchParams}:{searchParams:Promise<{mine?:string;page?:string}>}){
 const [user,{locale}]=await Promise.all([requireManagementUser(),getPreferences()]);const en=locale==="en";const query=await searchParams;const page=z.coerce.number().int().min(0).max(10000).catch(0).parse(query.page??0);const mine=query.mine==="1";const data=await listTasks(user.id,{mine,page});
 return <><AccountHeader/><main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">{en?"Tasks":"المهام"}</h1><p className="mt-3 text-muted">{en?"Join a task, submit your work, and follow its review.":"انضم للعمل، وارفع مخرجك وتابع مراجعته."}</p></div><Link className="button button-secondary" href="/notifications">{en?"Notifications":"الإشعارات"}</Link></div>
 <nav aria-label={en?"Task filters":"تصفية المهام"} className="mb-6 flex flex-wrap gap-4"><Link className="text-link" aria-current={!mine?"page":undefined} href="/tasks">{en?"Available tasks and my record":"المهام المتاحة وسجلي"}</Link><Link className="text-link" aria-current={mine?"page":undefined} href="/tasks?mine=1">{en?"My participation only":"مشاركاتي فقط"}</Link></nav><TaskList items={data.items} locale={locale}/><TaskPagination page={page} more={data.more} base="/tasks" query={mine?{mine:"1"}:{}} locale={locale}/></main></>;
}
