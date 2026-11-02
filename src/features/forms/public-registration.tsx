"use client";
import {useEffect,useState} from "react";
import {ContentText} from "@/components/content-text";
import {createTranslator} from "@/lib/i18n";
import Link from "next/link";
import {Check,TriangleAlert} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Progress} from "@/components/ui/progress";
import {OrganizationStatusBadge} from "@/features/organizations/organization-status-badge";
import {formatRiyadhDateTime} from "@/lib/datetime";
import {formatCount,majorLabel} from "@/lib/display";
import type {Locale} from "@/lib/preferences";
import type {RegistrationReadiness} from "./repository";
import {registrationTiming,registrationEligibility,type PublicRound} from "./registration-presentation";
export type {PublicRound} from "./registration-presentation";
function useRegistrationClock(now:number){const [clock,setClock]=useState(now);useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer);},[]);return clock;}
export function RegistrationStatusBadge({round,locale,now}:{round?:PublicRound;locale:Locale;now:number}){
 const c=createTranslator(locale),clock=useRegistrationClock(now),{status}=registrationTiming(round,clock);
 const label=status==="open"?c("مفتوح","Open"):status==="closing"?c("يغلق خلال 3 أيام أو أقل","Closes within 3 days"):status==="upcoming"?c("قادم","Upcoming"):c("مغلق","Closed");
 return <OrganizationStatusBadge status={status==="open"?"open":status==="closing"?"draft":status==="upcoming"?"interview":"closed"}>{label}</OrganizationStatusBadge>;
}
type Props={round?:PublicRound;slug:string;locale:Locale;signedIn:boolean;application?:{id:string;status_code:string}|null;readiness?:RegistrationReadiness|null;blockedReason?:string;now:number};
export function RegistrationCallToAction({round,slug,locale,signedIn,application,readiness,blockedReason,now}:Props){
 const c=createTranslator(locale),timing=registrationTiming(round,now),eligibility=registrationEligibility(round,readiness),own=readiness?.application??application;
 const path=round?`/organizations/${slug}/apply/${round.id}`:"";
 let label=c("قدّم الآن","Apply now"),reason="",href:string|undefined;
 if(readiness?.member||own?.status_code==="Accepted")label=c("أنت عضو في هذه الجهة","You are a member of this organization");
 else if(own&&["Submitted","Interview"].includes(own.status_code))label=c("طلبك قيد المراجعة","Your application is under review");
 else if(own?.status_code==="Rejected"){label=c("طلبك مرفوض","Your application was declined");reason=c("رُفض طلبك في هذه الجولة.","Your application for this round was declined.");}
 else if(own?.status_code==="Withdrawn"){label=c("طلبك مسحوب","Your application was withdrawn");reason=c("راجع طلباتك لإمكانية التقديم مجددًا.","Check your applications for reapplication options.");}
 else if(timing.status==="closed"||timing.status==="upcoming"){label=c("التسجيل مغلق حاليًا","Registration is currently closed");reason=timing.status==="upcoming"?c("يمكنك التقديم عند بدء التسجيل.","You can apply when registration opens."):c("لم يُعلن موعد الجولة القادمة بعد.","The next round has not been announced yet.");}
 else if(!signedIn){label=c("سجّل الدخول للتقديم","Sign in to apply");href=`/login?next=${encodeURIComponent(path)}`;}
 else if(blockedReason){label=c("التقديم غير متاح","Application unavailable");reason=blockedReason;}
 else if(!readiness){label=c("تعذّر التحقق من الأهلية","Could not verify eligibility");reason=c("حدّث الصفحة وحاول مجددًا.","Refresh the page and try again.");}
 else if(!eligibility.ready){label=c("أكمل بياناتك للتقديم","Complete your profile to apply");reason=c("يلزم حساب نشط وبريد مؤكد وبيانات ملف مكتملة.","An active account, verified email and completed profile are required.");}
 else if(!eligibility.hoursMet||!eligibility.majorMet){label=c("شروط التقديم غير مستوفاة","Application requirements not met");reason=c("راجع شروط الساعات والتخصص أعلاه.","Check the hours and major requirements above.");}
 else href=path;
 return <div className="flex flex-col items-start gap-2">{href?<Button size="lg" nativeButton={false} role="link" render={<Link href={href}/>}>{label}</Button>:<Button size="lg" disabled>{label}</Button>}{reason&&<p className="text-sm text-muted-foreground">{reason}</p>}{own&&<Link href="/applications?tab=applications" className="text-sm text-primary underline underline-offset-4">{c("عرض طلبي","View my application")}</Link>}</div>;
}
export function PublicRegistration({now,...props}:Props){
 const {round,locale,readiness}=props,c=createTranslator(locale),clock=useRegistrationClock(now),timing=registrationTiming(round,clock),eligibility=registrationEligibility(round,readiness),open=timing.status==="open"||timing.status==="closing";
 const checks=[{ok:eligibility.hoursMet,text:eligibility.minimum>0?c(`الحد الأدنى: ${formatCount(eligibility.minimum,"hours",locale)}`,`Minimum: ${formatCount(eligibility.minimum,"hours",locale)}`):c("لا يُشترط حد أدنى للساعات","No minimum hours required"),detail:readiness?c(`ساعاتك المعتمدة: ${formatCount(readiness.hours,"hours",locale)}`,`Your approved hours: ${formatCount(readiness.hours,"hours",locale)}`):c("سجّل الدخول للتحقق من ساعاتك.","Sign in to check your hours.")},{ok:eligibility.majorMet,text:eligibility.majors.length?c(`التخصصات المسموحة: ${eligibility.majors.map(m=>majorLabel(m,locale)).join("، ")}`,`Allowed majors: ${eligibility.majors.map(m=>majorLabel(m,locale)).join(", ")}`):c("جميع التخصصات متاحة","All majors are eligible"),detail:readiness?.major?c(`تخصصك: ${majorLabel(readiness.major,locale)}`,`Your major: ${majorLabel(readiness.major,locale)}`):c("سجّل الدخول للتحقق من تخصصك.","Sign in to check your major.")}];
 return <Card data-public-registration="" dir={locale==="ar"?"rtl":"ltr"}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{round?<ContentText autoTranslate value={round.title}/>:c("التقديم للانضمام","Apply to join")}</CardTitle><RegistrationStatusBadge round={round} locale={locale} now={clock}/></div></CardHeader><CardContent className="flex flex-col gap-6">
 {open?<div className="flex flex-col gap-2"><Progress value={timing.progress} aria-label={c("مدة التسجيل","Registration period")}/><p className="text-sm">{c(`باقي ${formatCount(timing.days,"days",locale,"nominative","number")} و${formatCount(timing.hours,"hours",locale,"nominative","number")}`,`${formatCount(timing.days,"days",locale)} and ${formatCount(timing.hours,"hours",locale)} remaining`)}</p><p className="text-sm text-muted-foreground">{c("من","From")} <bdi>{formatRiyadhDateTime(round!.opens_at,locale)}</bdi> {c("إلى","to")} <bdi>{formatRiyadhDateTime(round!.closes_at,locale)}</bdi> · {c("بتوقيت الرياض","Riyadh time")}</p></div>:<p className="text-sm text-muted-foreground">{c("يفتح في:","Opens on:")} {timing.status==="upcoming"&&round?<bdi>{formatRiyadhDateTime(round.opens_at,locale)}</bdi>:c("لم يُحدد موعد بعد","Not announced yet")}</p>}
 <section className="flex flex-col gap-3"><h3 className="font-medium">{c("قبل أن تقدّم","Before you apply")}</h3><ul className="flex flex-col gap-3">{checks.map((item,index)=><li key={index} className="flex items-start gap-2">{item.ok?<Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true"/>:<TriangleAlert className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true"/>}<div className="min-w-0"><p className="text-sm">{item.text}</p><p className="text-sm text-muted-foreground">{item.detail}</p></div></li>)}</ul></section>
 <RegistrationCallToAction {...props} now={clock}/>
 </CardContent></Card>;
}
