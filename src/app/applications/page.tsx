import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import { requireUser } from "@/features/auth/session";
import { listApplications,statuses } from "@/features/forms/repository";
import { AccountHeader } from "@/components/account-header";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('طلباتي','My applications');}
export default async function Applications({searchParams}:{searchParams:Promise<{page?:string}>}) {
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);const en=locale==="en";const {page:input}=await searchParams;const page=Math.min(1000,Math.max(1,Math.floor(Number(input)||1)));
 const rows=await listApplications(user.id,undefined,{page,q:"",status:"",committee:"",major:"",level:"",from:"",to:"",lookup:""});
 return <><AccountHeader/><main id="main" className="mx-auto max-w-3xl px-5 py-10"><h1 className="mb-8 text-3xl font-bold">{en?"Applications":"طلبات الانضمام"}</h1><section className="panel p-6">{rows.length?<ul className="divide-y divide-line">{rows.slice(0,25).map(a=><li key={a.id} className="py-5"><Link dir="auto" className="text-link" href={`/organizations/${a.slug}/apply/${a.round_id}`}>{a.title}</Link><p className="mt-2 text-muted">{en?a.status_code:statuses[a.status_code]}</p></li>)}</ul>:<p className="leading-8 text-muted">{en?"You have no applications yet. ":"ما عندك طلبات حتى الآن. "}<Link href="/organizations" className="text-link">{en?"Explore organizations":"استكشف الجهات"}</Link></p>}</section><nav aria-label={en?"Application pages":"صفحات الطلبات"} className="mt-5 flex gap-5">{page>1&&<Link href={`?page=${page-1}`} className="text-link">{en?"Previous":"السابق"}</Link>}{rows.length>25&&<Link href={`?page=${page+1}`} className="text-link">{en?"Next":"التالي"}</Link>}</nav></main></>;
}
