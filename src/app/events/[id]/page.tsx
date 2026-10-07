import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {PublicHeader} from "@/components/public-header";
import {getVerifiedUser} from "@/features/auth/session";
import {eventDetail,publicEventMetadata} from "@/features/events/repository";
import {EventContent} from "@/features/events/view";
import {getPreferences} from "@/lib/preferences";
import {JsonLd} from "@/lib/json-ld";
import {toMetaDescription} from "@/lib/seo";

export async function generateMetadata({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)return localizedMetadata("فعالية غير موجودة","Event not found");
 try{
  const event=await publicEventMetadata(id);
  if(!event||event.status_code==="Draft")return localizedMetadata("تفاصيل الفعالية","Event details");
  const description=toMetaDescription(event.description,`فعالية منشورة من ${event.org_name} على منصة لُبّ.`);
  const title=`${event.title} | ${event.org_name}`;
  return localizedMetadata(title,title,{}, {index:true,canonical:`/events/${event.id}`,description:{ar:description,en:description}});
 }catch{return localizedMetadata("تفاصيل الفعالية","Event details");}
}

export default async function EventPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)notFound();
 const {page:raw}=await searchParams;
 const page=Math.floor(Math.min(10000,Math.max(0,Number(raw)||0)));
 const [user,{locale}]=await Promise.all([getVerifiedUser(),getPreferences()]);
 const en=locale==="en";
 const data=await eventDetail(user?.id??null,id,page);
 if(!data)notFound();

 const event=data.event;
 const schemaStatus:Record<string,string>={Published:"EventScheduled",Cancelled:"EventCancelled"};
 const attendanceMode:Record<string,string>={In_Person:"OfflineEventAttendanceMode",Online:"OnlineEventAttendanceMode",Hybrid:"MixedEventAttendanceMode"};
 const imageUrls=(event.public_photos??[]).filter(url=>{try{return new URL(url).protocol==="https:";}catch{return false;}});
 const schema=event.status_code!=="Draft"?{
  "@context":"https://schema.org",
  "@type":"Event",
  name:event.title,
  description:event.description,
  url:`https://lub.community/events/${event.id}`,
  startDate:new Date(event.starts_at).toISOString(),
  endDate:new Date(event.ends_at).toISOString(),
  ...(schemaStatus[event.status_code]?{eventStatus:`https://schema.org/${schemaStatus[event.status_code]}`}:{ }),
  ...(attendanceMode[event.location_type_code]?{eventAttendanceMode:`https://schema.org/${attendanceMode[event.location_type_code]}`}:{ }),
  ...(event.location_type_code!=="Online"?{location:{"@type":"Place",name:event.location_text||"الرياض"}}:{}),
  organizer:{"@type":"Organization",name:data.org_name,url:`https://lub.community/organizations/${data.slug}`},
  ...(imageUrls.length?{image:imageUrls}:{}),
 }:null;

 return <><PublicHeader/>{schema&&<JsonLd data={schema}/>}<main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><EventContent data={data} user={Boolean(user)} locale={locale}/><nav aria-label={en?"Registrant pages":"صفحات المسجلين"} className="mt-6 flex gap-5">{page>0&&<Link className="text-link" href={`/events/${id}?page=${page-1}`}>{en?"Previous":"السابق"}</Link>}{data.registrations.length>25&&<Link className="text-link" href={`/events/${id}?page=${page+1}`}>{en?"Next":"التالي"}</Link>}</nav></main></>;
}
