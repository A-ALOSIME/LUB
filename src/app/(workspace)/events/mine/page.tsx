import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {requireStudentUser as requireUser} from "@/features/auth/authorization";
import {checkReadiness} from "@/features/hours/view";
import {myEvents} from "@/features/events/repository";
import {eventLabels,eventDate} from "@/features/events/view";
import {eventLabelsEn,eventDateEn} from "@/features/events/display";
import {getPreferences} from "@/lib/preferences";
import {buttonVariants} from "@/components/ui/button";
export async function generateMetadata(){return localizedMetadata('فعالياتي','My events');}
const eventExamples=[
 {id:"sample-event-open",title:"لقاء التعريف بالمجتمع التقني (مثال)",starts_at:"2026-10-18T16:00:00+03:00",status_code:"Published",registration:"Registered",attendance:"Pending"},
 {id:"sample-event-present",title:"ورشة بناء السيرة الذاتية (مثال)",starts_at:"2026-10-08T18:00:00+03:00",status_code:"Completed",registration:"Registered",attendance:"Present"},
 {id:"sample-event-excused",title:"جلسة تطوير المشاريع الطلابية (مثال)",starts_at:"2026-10-03T17:00:00+03:00",status_code:"Completed",registration:"Registered",attendance:"Excused"},
];
export default async function MyEvents({searchParams}:{searchParams:Promise<{page?:string|string[];preview?:string|string[]}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]);
 const en=locale==="en",labels=en?eventLabelsEn:eventLabels,date=en?eventDateEn:eventDate,s=await searchParams;
 const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
 const preview=first(s.preview)==="1",page=preview?0:Math.floor(Math.min(10000,Math.max(0,Number(first(s.page))||0)));
 const data=await myEvents(user.id,page);checkReadiness(data);
 const events=preview?eventExamples:data.events;
 return <main id="main" dir={en?"ltr":"rtl"} className="w-full max-w-4xl space-y-6">
  <header className="flex flex-wrap items-end justify-between gap-3">
   <div><h1 className="text-2xl font-semibold tracking-tight">{en?"My events":"فعالياتي"}</h1><p className="mt-1 text-sm leading-6 text-muted">{en?"Review your event registrations and attendance.":"راجع تسجيلاتك وحضورك في الفعاليات."}</p></div>
   <Link className={buttonVariants({variant:"outline",size:"sm"})} href={preview?"/events/mine":"/events/mine?preview=1"}>{en?(preview?"Back to my events":"See examples"):(preview?"العودة إلى فعالياتي":"معاينة أمثلة")}</Link>
  </header>
  {preview&&<aside role="note" className="panel p-4 text-sm leading-6 text-muted">{en?"These are sample event registrations for display only. They are not saved, and event pages or registration actions are disabled.":"هذه مشاركات فعاليات نموذجية للعرض فقط؛ غير محفوظة، وروابط الفعاليات أو التسجيل غير مفعّلة."}</aside>}
  {events.length>0?<ul className="flex flex-col gap-4">{events.slice(0,25).map(e=><li className="panel min-w-0 p-5 sm:p-6" key={e.id}>
   <h2 dir="auto" className="font-semibold">{preview?e.title:<Link className="text-link" href={`/events/${e.id}`}>{e.title}</Link>}</h2>
   <p className="mt-3 text-sm">{date(e.starts_at)}</p>
   <p className="mt-3 text-sm text-muted">{labels[e.status_code]} · {labels[e.registration]} · {labels[e.attendance]}</p>
  </li>)}</ul>:<p className="panel p-5 text-sm text-muted">{en?"You have not registered for an event yet. ":"ما سجلت في فعالية بعد. "}<Link href="/events" className="text-link">{en?"Explore events":"استكشف الفعاليات"}</Link></p>}
  {!preview&&<nav aria-label={en?"My event pages":"صفحات فعالياتي"} className="mt-6 flex gap-5">{page>0&&<Link className="text-link" href={`?page=${page-1}`}>{en?"Previous":"السابق"}</Link>}{data.events.length>25&&<Link className="text-link" href={`?page=${page+1}`}>{en?"Next":"التالي"}</Link>}</nav>}
 </main>;
}
