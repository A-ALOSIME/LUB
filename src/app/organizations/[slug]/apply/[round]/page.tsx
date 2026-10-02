import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PublicHeader } from "@/components/public-header";
import { getVerifiedUser } from "@/features/auth/session";
import { getRound } from "@/features/forms/repository";
import { ApplicationForm } from "@/features/forms/application-form";
import { ApplicationDetail } from "@/features/forms/application-detail";
import { WorkflowForm } from "@/features/forms/mutation-form";
import { getPreferences } from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('طلب الانضمام','Membership application');}
export default async function ApplyPage({params}:{params:Promise<{slug:string;round:string}>}) {
 const {slug,round}=await params;if(!z.uuid().safeParse(round).success)notFound();const [{locale},user]=await Promise.all([getPreferences(),getVerifiedUser()]);const en=locale==="en";
 const data=await getRound(round,user?.id);if(!data||data.slug!==slug||!data.version)notFound();
 const path=`/organizations/${slug}/apply/${round}`;const next=encodeURIComponent(path);
 const detail=data.application;
 const ready=Boolean(user&&data.onboarded&&data.accountStatus!=="Inactive");
 return <><PublicHeader/><main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:py-14"><Link href={`/organizations/${slug}`} className="text-link">{data.name}</Link><h1 dir="auto" className="mt-5 text-3xl font-bold">{data.title}</h1><p className="mt-3 mb-8 leading-8 text-muted">{en?data.open?"Applications are open.":"Applications are closed.":data.open?"التقديم متاح الآن.":"التقديم مغلق الآن."} {en?"Closes on":"ينتهي في"} {new Date(data.closes_at).toLocaleString(en?"en-US":"ar-SA",{timeZone:"Asia/Riyadh",calendar:"gregory"})}</p>
 {detail&&<section className="panel mb-6 p-6"><ApplicationDetail detail={detail} locale={locale}/></section>}
 {!ready?<section className="panel p-6">{data.version.definition.sections.some(s=>s.fields.length>0)&&<><h2 className="text-xl font-semibold">{en?"Application questions":"أسئلة طلب الانضمام"}</h2><ol className="my-5 space-y-3">{data.version.definition.sections.flatMap(s=>s.fields).map(f=><li key={f.id} dir="auto">{f.label}{f.required?" *":""}{f.condition&&<span className="text-sm text-muted"> · {en?"Shown based on your answers":"يظهر حسب إجاباتك"}</span>}</li>)}</ol></>}<p className="my-5 text-sm leading-7 text-muted">{en?"Sign in and complete your basic details once to apply.":"لتقديم طلبك نحتاج دخولك وبياناتك الأساسية مرة واحدة."}</p>{data.open&&<div className="flex flex-wrap gap-3">{user?<Link href={data.accountStatus==="Inactive"?"/account-unavailable":`/onboarding?next=${next}`} className="button">{en?data.accountStatus==="Inactive"?"Check your account status":"Complete your profile to apply":data.accountStatus==="Inactive"?"راجع حالة حسابك للتقديم":"أكمل بياناتك وقدّم الطلب"}</Link>:<><Link href={`/login?next=${next}`} className="button">{en?"Log in to apply":"الدخول وتقديم الطلب"}</Link><Link href={`/signup?next=${next}`} className="button button-secondary">{en?"Sign up":"إنشاء حساب"}</Link></>}</div>}</section>
 :data.open&&(!detail||["Submitted","Interview"].includes(detail.status_code))?<section className="panel p-6"><ApplicationForm key={detail?.id??data.version.id} round={round} version={detail?.version.id??data.version.id} definition={detail?.version.definition??data.version.definition} initial={detail?.answers} application={detail?.id} revision={detail?.response_revision} committee={detail?.requested_committee_id} committees={data.committees} locale={locale}/></section>:!detail?<p className="panel p-6">{en?"This round is not accepting new applications now.":"لا تستقبل هذه الجولة طلبات جديدة الآن."}</p>:null}
 {detail&&data.open&&data.allow_withdrawal&&["Submitted","Interview"].includes(detail.status_code)&&<section className="panel mt-6 p-6"><WorkflowForm operation="withdraw" fields={{application:detail.id}} label={en?"Withdraw application":"سحب الطلب"} locale={locale}><p className="text-sm leading-7 text-muted">{en?"Withdrawing closes this application. You cannot apply again in this round.":"السحب يقفل الطلب؛ لا يمكنك تقديم طلب ثانٍ في الجولة نفسها."}</p></WorkflowForm></section>}</main></>;
}
