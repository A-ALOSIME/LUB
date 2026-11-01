import {normalizeMajor} from "@/lib/student-identity";
import type {RegistrationReadiness} from "./repository";
export type PublicRound={id:string;title:string;open:boolean;opens_at:string;closes_at:string;status_code?:string;minimum_approved_hours?:string|number;allowed_majors?:string[]};
export function registrationTiming(round:PublicRound|undefined,now:number){
 const opens=Date.parse(round?.opens_at??""),closes=Date.parse(round?.closes_at??"");
 const upcoming=!!round&&Number.isFinite(opens)&&opens>now&&round.status_code!=="Closed";
 const open=!!round&&(round.status_code?round.status_code==="Open":round.open)&&opens<=now&&closes>now;
 const remaining=Math.max(0,closes-now);
 return {status:upcoming?"upcoming" as const:!open?"closed" as const:remaining<=3*86400000?"closing" as const:"open" as const,progress:open?Math.max(0,Math.min(100,(now-opens)/(closes-opens)*100)):0,days:Math.floor(remaining/86400000),hours:Math.floor(remaining%86400000/3600000)};
}
export function registrationEligibility(round:PublicRound|undefined,readiness:RegistrationReadiness|null|undefined){
 const minimum=Number(round?.minimum_approved_hours??0),majors=round?.allowed_majors??[];
 return {minimum,majors,hoursMet:!!readiness&&readiness.hours>=minimum,majorMet:!!readiness&&(!majors.length||!!readiness.major&&majors.includes(normalizeMajor(readiness.major))),ready:!!readiness&&readiness.active&&readiness.onboarded};
}
