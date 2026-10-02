import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {PublicHeader} from "@/components/public-header";
import {getVerifiedUser} from "@/features/auth/session";
import {eventDetail} from "@/features/events/repository";
import {EventContent} from "@/features/events/view";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('تفاصيل الفعالية','Event details');}
export default async function EventPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const {page:raw}=await searchParams;const page=Math.floor(Math.min(10000,Math.max(0,Number(raw)||0)));const [user,{locale}]=await Promise.all([getVerifiedUser(),getPreferences()]);const en=locale==="en";const data=await eventDetail(user?.id??null,id,page);if(!data)notFound();return <><PublicHeader/><main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><EventContent data={data} user={Boolean(user)} locale={locale}/><nav aria-label={en?"Registrant pages":"صفحات المسجلين"} className="mt-6 flex gap-5">{page>0&&<Link className="text-link" href={`/events/${id}?page=${page-1}`}>{en?"Previous":"السابق"}</Link>}{data.registrations.length>25&&<Link className="text-link" href={`/events/${id}?page=${page+1}`}>{en?"Next":"التالي"}</Link>}</nav></main></>;}
