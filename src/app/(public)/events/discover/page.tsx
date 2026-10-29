import {t as translateUi} from "@/lib/i18n";
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
 return <><main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><h1 className="text-3xl font-bold">{translateUi((en) ? "en" : "ar", "الفعاليات", "Events")}</h1><p className="mt-4 text-muted">{translateUi((en) ? "en" : "ar", "استكشف الفعاليات؛ تحتاج حسابًا عند التسجيل فقط.", "Explore events. An account is only needed to register.")}</p>{org&&<p className="mt-4 text-sm text-muted">{translateUi((en) ? "en" : "ar", "النتائج لجهة محددة. ", "Showing events from one organization. ")}<Link className="text-link" href="/events/discover">{translateUi((en) ? "en" : "ar", "عرض كل الجهات", "Show all organizations")}</Link></p>}
 {items.length > 0 ? <div className="mt-8"><EventCards items={items.slice(0,24)} locale={locale}/></div> : <p role="status" className="mt-6 text-sm text-muted">{translateUi((en) ? "en" : "ar", "لا توجد فعاليات منشورة حالياً.", "No published events are available right now.")}</p>}
 <nav aria-label={translateUi((en) ? "en" : "ar", "صفحات الفعاليات", "Event pages")} className="mt-6 flex gap-5">{page>0&&<Link className="text-link" href={href(page-1)}>{translateUi((en) ? "en" : "ar", "السابق", "Previous")}</Link>}{items.length>24&&<Link className="text-link" href={href(page+1)}>{translateUi((en) ? "en" : "ar", "التالي", "Next")}</Link>}</nav></main></>;
}
