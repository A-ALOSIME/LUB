import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {AccountHeader} from "@/components/account-header";
import {requireUser} from "@/features/auth/session";
import {checkReadiness} from "@/features/hours/view";
import {myEvents} from "@/features/events/repository";
import {eventLabels,eventDate} from "@/features/events/view";
import {eventLabelsEn,eventDateEn} from "@/features/events/display";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('فعالياتي','My events');}
export default async function MyEvents({searchParams}:{searchParams:Promise<{page?:string}>}){const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);const en=locale==="en",labels=en?eventLabelsEn:eventLabels,date=en?eventDateEn:eventDate;const s=await searchParams;const page=Math.floor(Math.min(10000,Math.max(0,Number(s.page)||0)));const data=await myEvents(user.id,page);checkReadiness(data);return <><AccountHeader/><main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><h1 className="mb-6 text-3xl font-bold">{en?"My events":"فعالياتي"}</h1><ul className="space-y-5">{data.events.slice(0,25).map(e=><li className="panel p-6" key={e.id}><Link dir="auto" className="text-link font-semibold" href={`/events/${e.id}`}>{e.title}</Link><p className="mt-3">{date(e.starts_at)}</p><p className="mt-3 text-muted">{labels[e.status_code]} · {labels[e.registration]} · {labels[e.attendance]}</p></li>)}</ul>{!data.events.length&&<p className="panel p-6 text-muted">{en?"You have not registered for an event yet. ":"ما سجلت في فعالية بعد. "}<Link href="/events" className="text-link">{en?"Explore events":"استكشف الفعاليات"}</Link></p>}<nav aria-label={en?"My event pages":"صفحات فعالياتي"} className="mt-6 flex gap-5">{page>0&&<Link className="text-link" href={`?page=${page-1}`}>{en?"Previous":"السابق"}</Link>}{data.events.length>25&&<Link className="text-link" href={`?page=${page+1}`}>{en?"Next":"التالي"}</Link>}</nav></main></>;}
