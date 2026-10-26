import Link from "next/link";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/card";
import {formatRiyadhDateTime} from "@/lib/datetime";
import type {Locale} from "@/lib/preferences";
import {statuses} from "./repository";

export type PublicRound={id:string;title:string;open:boolean;opens_at:string;closes_at:string};
export function RegistrationCallToAction({round,slug,locale,signedIn,application}:{round:PublicRound;slug:string;locale:Locale;signedIn:boolean;application?:{id:string;status_code:string}|null}){
 const c=(ar:string,en:string)=>locale==="en"?en:ar;
 if(application)return <Button variant="outline" nativeButton={false} render={<Link href="/applications"/>}>{c("حالة طلبك","Your application")}: {locale==="en"?application.status_code:statuses[application.status_code]??application.status_code}</Button>;
 if(!round.open)return null;
 const path=`/organizations/${slug}/apply/${round.id}`;
 return <Button size="lg" nativeButton={false} render={<Link href={signedIn?path:`/login?next=${encodeURIComponent(path)}`}/>}>{c("قدّم الآن","Apply now")}</Button>;
}
export function PublicRegistration({round,slug,locale,signedIn,application}:{round?:PublicRound;slug:string;locale:Locale;signedIn:boolean;application?:{id:string;status_code:string}|null}){
 const c=(ar:string,en:string)=>locale==="en"?en:ar;
 return <Card><CardHeader><CardTitle>{c("التقديم للانضمام","Apply to join")}</CardTitle>{!round&&<><CardDescription>{c("التسجيل مغلق حاليًا","Registration is currently closed")}</CardDescription><p className="text-sm text-muted-foreground">{c("تابع هذه الصفحة لمعرفة موعد الجولة القادمة.","Check this page for the next registration round.")}</p></>}</CardHeader>{round&&<CardContent className="flex flex-col items-start gap-4"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{round.title}</h3><Badge variant="secondary">{round.open?c("التسجيل مفتوح","Registration open"):c("لم تبدأ بعد","Upcoming")}</Badge></div><p className="text-muted-foreground">{round.open?c("فترة التسجيل","Registration period"):c("يفتح التسجيل في","Registration opens on")} <bdi>{formatRiyadhDateTime(round.opens_at,locale)}</bdi></p><p className="text-muted-foreground">{c("يغلق التسجيل في","Registration closes on")} <bdi>{formatRiyadhDateTime(round.closes_at,locale)}</bdi></p><RegistrationCallToAction round={round} slug={slug} signedIn={signedIn} locale={locale} application={application}/></CardContent>}</Card>;
}
