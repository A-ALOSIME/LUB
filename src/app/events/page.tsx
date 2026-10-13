import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {z} from "zod";
import {PublicHeader} from "@/components/public-header";
import {listEvents} from "@/features/events/repository";
import {EventCards} from "@/features/events/view";
import {EventExamples} from "@/features/events/examples";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('الفعاليات','Events',{}, {index:true,canonical:"/events",description:{ar:"تصفح فعاليات الأندية والمجالس الطلابية المنشورة في لُبّ، واعرف مواعيدها ومواقعها وطريقة التسجيل.",en:"Explore published student club and council events on LUB, with event dates, locations, and registration details."}});}
export default async function EventsPage({searchParams}:{searchParams:Promise<{q?:string;period?:string;page?:string;org?:string}>}){
 const [s,{locale}]=await Promise.all([searchParams,getPreferences()]);const en=locale==="en";
 const parsedOrg=z.uuid().safeParse(s.org),org=parsedOrg.success?parsedOrg.data:null;
 const period=["upcoming","past","all"].includes(s.period??"")?s.period!:"upcoming",page=Math.min(10000,Math.max(0,Number(s.page)||0));
 const showExamples=period==="upcoming"&&!org&&page===0;
 const items=await listEvents("",period,Math.floor(page),org,period==="upcoming");
 const href=(p:number)=>`/events?${new URLSearchParams({page:String(p),...(period!=="upcoming"?{period}:{}),...(org?{org}:{})})}`;
 return <><PublicHeader/><main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><h1 className="text-3xl font-bold">{en?"Events":"الفعاليات"}</h1><p className="mt-4 text-muted">{en?"Explore events. An account is only needed to register.":"استكشف الفعاليات؛ تحتاج حسابًا عند التسجيل فقط."}</p>{org&&<p className="mt-4 text-sm text-muted">{en?"Showing events from one organization. ":"النتائج لجهة محددة. "}<Link className="text-link" href="/events">{en?"Show all organizations":"عرض كل الجهات"}</Link></p>}
 {showExamples&&<EventExamples locale={locale}/>}
 {items.length>0&&showExamples&&<h2 className="mb-5 mt-10 text-2xl font-bold">{en?"Upcoming events":"الفعاليات القادمة"}</h2>}
 {(items.length>0||!showExamples)&&<EventCards items={items.slice(0,24)} locale={locale}/>}
 <nav aria-label={en?"Event pages":"صفحات الفعاليات"} className="mt-6 flex gap-5">{page>0&&<Link className="text-link" href={href(page-1)}>{en?"Previous":"السابق"}</Link>}{items.length>24&&<Link className="text-link" href={href(page+1)}>{en?"Next":"التالي"}</Link>}</nav></main></>;
}
