import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {z} from "zod";
import {listEvents} from "@/features/events/repository";
import {EventCards} from "@/features/events/view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('الفعاليات','Events',{}, {index:true,canonical:"/events/discover",description:{ar:"تصفح فعاليات الأندية والمجالس الطلابية المنشورة في لُبّ، واعرف مواعيدها ومواقعها وطريقة التسجيل.",en:"Explore published student club and council events on LUB, with event dates, locations, and registration details."}});}
export default async function EventsPage({searchParams}:{searchParams:Promise<{q?:string;period?:string;page?:string;org?:string}>}){
 const [s,{locale}]=await Promise.all([searchParams,getPreferences()]);const en=locale==="en";
 const parsedOrg=z.uuid().safeParse(s.org),org=parsedOrg.success?parsedOrg.data:null;
 const period=["upcoming","past","all"].includes(s.period??"")?s.period!:"upcoming",page=Math.min(10000,Math.max(0,Number(s.page)||0));
 const items=await listEvents("",period,Math.floor(page),org,period==="upcoming");
 const href=(p:number)=>`/events/discover?${new URLSearchParams({page:String(p),...(period!=="upcoming"?{period}:{}),...(org?{org}:{})})}`;
 return <><main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><h1 className="text-3xl font-bold">{en?"Events":"الفعاليات"}</h1><p className="mt-4 text-muted">{en?"Explore events. An account is only needed to register.":"استكشف الفعاليات؛ تحتاج حسابًا عند التسجيل فقط."}</p>{org&&<p className="mt-4 text-sm text-muted">{en?"Showing events from one organization. ":"النتائج لجهة محددة. "}<Link className="text-link" href="/events/discover">{en?"Show all organizations":"عرض كل الجهات"}</Link></p>}
 {items.length > 0 ? <div className="mt-8"><EventCards items={items.slice(0,24)} locale={locale}/></div> : <p role="status" className="mt-6 text-sm text-muted">{en?"No published events are available right now.":"لا توجد فعاليات منشورة حالياً."}</p>}
 <nav aria-label={en?"Event pages":"صفحات الفعاليات"} className="mt-6 flex gap-5">{page>0&&<Link className="text-link" href={href(page-1)}>{en?"Previous":"السابق"}</Link>}{items.length>24&&<Link className="text-link" href={href(page+1)}>{en?"Next":"التالي"}</Link>}</nav></main></>;
}
