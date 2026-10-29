import {t as translateUi} from "@/lib/i18n";
import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getVerifiedUser } from "@/features/auth/session";
import { isSuperAdminUser } from "@/features/auth/authorization";
import { getRound } from "@/features/forms/repository";
import { ApplicationForm } from "@/features/forms/application-form";
import {StudentApplication} from "@/features/forms/student-application";

import { getPreferences } from "@/lib/preferences";
import { formatRiyadhDateTime } from "@/lib/datetime";
export async function generateMetadata(){return localizedMetadata('طلب الانضمام','Membership application');}
export default async function ApplyPage({params}:{params:Promise<{slug:string;round:string}>}) {
 const {slug,round}=await params;if(!z.uuid().safeParse(round).success)notFound();const [{locale},user]=await Promise.all([getPreferences(),getVerifiedUser()]);const en=locale==="en";if(user&&await isSuperAdminUser(user.id))redirect("/manage");
 const data=await getRound(round,user?.id);if(!data||data.slug!==slug||!data.version)notFound();
 const path=`/organizations/${slug}/apply/${round}`;const next=encodeURIComponent(path);
 const detail=data.application;
 const ready=Boolean(user&&data.onboarded&&data.accountStatus!=="Inactive");
 const applicationForm=<ApplicationForm key={detail&&detail.status_code!=="Withdrawn"?detail.id:data.version.id} round={round} version={detail&&detail.status_code!=="Withdrawn"?detail.version.id:data.version.id} definition={detail&&detail.status_code!=="Withdrawn"?detail.version.definition:data.version.definition} initial={detail?.status_code==="Withdrawn"?undefined:detail?.answers} application={detail?.status_code==="Withdrawn"?undefined:detail?.id} revision={detail?.status_code==="Withdrawn"?undefined:detail?.response_revision} committees={data.committees} locale={locale}/>;
 return <><main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:py-14"><Link href={`/organizations/${slug}`} className="text-link">{data.name}</Link><h1 dir="auto" className="mt-5 text-3xl font-bold">{data.title}</h1><p className="mt-3 mb-8 leading-8 text-muted">{en?data.open?"Applications are open.":"Applications are closed.":data.open?"التقديم متاح الآن.":"التقديم مغلق الآن."} {translateUi((en) ? "en" : "ar", "ينتهي في", "Closes on")} {formatRiyadhDateTime(data.closes_at, locale)}</p>

 {!ready?<section className="panel p-6">{data.version.definition.sections.some(s=>s.fields.length>0)&&<><h2 className="text-xl font-semibold">{translateUi((en) ? "en" : "ar", "أسئلة طلب الانضمام", "Application questions")}</h2><ol className="my-5 space-y-3">{data.version.definition.sections.flatMap(s=>s.fields).map(f=><li key={f.id} dir="auto">{f.label}{f.required?" *":""}{f.condition&&<span className="text-sm text-muted"> · {translateUi((en) ? "en" : "ar", "يظهر حسب إجاباتك", "Shown based on your answers")}</span>}</li>)}</ol></>}<p className="my-5 text-sm leading-7 text-muted">{translateUi((en) ? "en" : "ar", "لتقديم طلبك نحتاج دخولك وبياناتك الأساسية مرة واحدة.", "Sign in and complete your basic details once to apply.")}</p>{data.open&&<div className="flex flex-wrap gap-3">{user?<Link href={data.accountStatus==="Inactive"?"/account-unavailable":`/onboarding?next=${next}`} className="button">{en?data.accountStatus==="Inactive"?"Check your account status":"Complete your profile to apply":data.accountStatus==="Inactive"?"راجع حالة حسابك للتقديم":"أكمل بياناتك وقدّم الطلب"}</Link>:<><Link href={`/login?next=${next}`} className="button">{translateUi((en) ? "en" : "ar", "الدخول وتقديم الطلب", "Log in to apply")}</Link><Link href={`/signup?next=${next}`} className="button button-secondary">{translateUi((en) ? "en" : "ar", "إنشاء حساب", "Sign up")}</Link></>}</div>}</section>
 :detail?<StudentApplication detail={detail} form={applicationForm} canEdit={data.open&&['Submitted','Interview','Withdrawn'].includes(detail.status_code)} canWithdraw={data.open&&data.allow_withdrawal&&['Submitted','Interview'].includes(detail.status_code)} name={data.name} locale={locale}/>:data.open?<section className="panel p-6">{applicationForm}</section>:<p className="panel p-6">{translateUi((en) ? "en" : "ar", "لا تستقبل هذه الجولة طلبات جديدة الآن.", "This round is not accepting new applications now.")}</p>}</main></>;
}
