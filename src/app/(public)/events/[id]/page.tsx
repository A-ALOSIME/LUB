import {BackLink} from "@/components/back-link";
import {listReturnPath} from "@/lib/return-navigation";
import {localizedMetadata} from "@/lib/localized-metadata";

import {notFound} from "next/navigation";
import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {isSuperAdminUser} from "@/features/auth/authorization";
import {eventDetail,publicEventMetadata} from "@/features/events/repository";
import {EventContent} from "@/features/events/view";
import {getPreferences} from "@/lib/preferences";
import {JsonLd} from "@/lib/json-ld";
import {toMetaDescription} from "@/lib/seo";
import {translatePublicContent} from "@/lib/public-content-translation";

export async function generateMetadata({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)return localizedMetadata("فعالية غير موجودة","Event not found");
 try{
  const event=await publicEventMetadata(id);
  if(!event||event.status_code==="Draft")return localizedMetadata("تفاصيل الفعالية","Event details");
  const description=toMetaDescription(event.description,`فعالية منشورة من ${event.org_name} على منصة لُبّ.`);
  const title=`${event.title} | ${event.org_name}`,{locale}=await getPreferences();
  const [englishTitle,englishOrganizer,englishDescription]=locale==='en'?await Promise.all([translatePublicContent(event.title),translatePublicContent(event.org_name),translatePublicContent(event.description)]):[event.title,event.org_name,event.description];
  const englishSummary=toMetaDescription(englishDescription,`An event by ${englishOrganizer} on LUB.`);
  return localizedMetadata(title,`${englishTitle} | ${englishOrganizer}`,{}, {index:true,canonical:`/events/${event.id}`,description:{ar:description,en:englishSummary}});
 }catch{return localizedMetadata("تفاصيل الفعالية","Event details");}
}

export default async function EventPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}){
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)notFound();
 const [user,{locale}]=await Promise.all([getVerifiedUser(),getPreferences()]);

 const query=await searchParams;
 const superAdmin=user?await isSuperAdminUser(user.id):false;
 const data=await eventDetail(superAdmin?null:user?.id??null,id);
 if(!data||(data.event.status_code==="Draft"&&!data.canManage))notFound();

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

 return <>{schema&&<JsonLd data={schema}/>}<main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10"><BackLink className="mb-6" href={listReturnPath(query.returnTo,"/events/discover")}>{locale==="ar"?"رجوع للفعاليات":"Back to events"}</BackLink><EventContent data={data} user={Boolean(user&&!superAdmin)} superAdmin={superAdmin} locale={locale}/></main></>;
}
