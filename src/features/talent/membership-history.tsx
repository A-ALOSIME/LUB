import {mergeRolePeriods} from "./role-periods";
import {ContentText} from "@/components/content-text";
import {t as translateUi} from "@/lib/i18n";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { formatHours, formatCount } from "@/lib/display";
import { formatRiyadhDate } from "@/lib/datetime";
import type { Locale } from "@/lib/preferences";
import type { PublicTalent } from "./repository";
import { OrganizationAvatar } from "./organization-avatars";

export function roleLabel(code:string,type:string|undefined,locale:Locale){
 const council=type==="Council";
 return (locale==="en"?{OL:council?"Council leader":"Club leader",OD:"Deputy leader",CL:"Committee leader",CD:"Deputy committee leader",Member:"Member"}:{OL:council?"قائد المجلس":"قائد النادي",OD:council?"نائب قائد المجلس":"نائب قائد النادي",CL:"قائد اللجنة",CD:"نائب قائد اللجنة",Member:"عضو"})[code as "OL"|"OD"|"CL"|"CD"|"Member"]??(translateUi((locale==="en") ? "en" : "ar", "عضو", "Member"));
}
export function MembershipHistory({organizations,locale="ar"}:{organizations:PublicTalent["organizations"];locale?:Locale}){
 const en=locale==="en";
 return <ul className="flex flex-col divide-y divide-border">{organizations.map(o=>{
 const roles=mergeRolePeriods(o.memberships.flatMap(m=>m.roles.length?m.roles.map(r=>({...r,hours:r.hours??"0"})):[{code:"Member",starts:m.start_date,ends:m.end_date,hours:m.hours??"0"}]));
 const renderRole=(r:typeof roles[number],i:number)=><li key={`${r.code}-${r.starts}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 leading-relaxed"><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-muted-foreground"/><Badge variant={r.code==="OL"||r.code==="CL"?"default":"secondary"}>{roleLabel(r.code,o.type,locale)}</Badge><span className="text-sm text-muted-foreground">{formatRiyadhDate(r.starts,locale)} · {r.ends?formatRiyadhDate(r.ends,locale):translateUi((en) ? "en" : "ar", "حتى الآن", "Present")}</span><span className="text-sm text-muted-foreground">{formatHours(r.hours,locale)}</span></li>;
 return <li key={o.slug} className="flex min-w-0 items-start gap-3 py-5 first:pt-0 last:pb-0"><OrganizationAvatar name={o.name} logo={o.logo} locale={locale}/><div className="flex min-w-0 flex-1 flex-col gap-3"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Link className="break-words font-semibold hover:text-primary" href={`/organizations/${o.slug}`}><bdi><ContentText value={o.name}/></bdi></Link><span className="text-sm text-muted-foreground">{translateUi((en) ? "en" : "ar", "إجمالي الجهة:", "Organization total:")} {formatCount(o.hours??0,"hours",locale,"nominative","number")}</span></div><ul className="flex flex-col gap-3">{roles.slice(0,2).map(renderRole)}</ul>{roles.length>2&&<Collapsible><CollapsibleTrigger render={<Button variant="ghost" size="sm"/>}><ChevronDown/>{translateUi((en) ? "en" : "ar", "عرض المزيد", "Show more")}</CollapsibleTrigger><CollapsibleContent><ul className="flex flex-col gap-3 pt-3">{roles.slice(2).map(renderRole)}</ul></CollapsibleContent></Collapsible>}</div></li>;
 })}</ul>;
}
