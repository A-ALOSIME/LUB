export type MembershipRolePeriod={code:string;starts:string;ends:string|null;hours:string};
export function mergeRolePeriods(periods:MembershipRolePeriod[]):MembershipRolePeriod[]{
 const roles=new Map<string,MembershipRolePeriod>();
 for(const period of periods){const previous=roles.get(period.code);
  roles.set(period.code,previous?{code:period.code,starts:previous.starts<period.starts?previous.starts:period.starts,ends:previous.ends===null||period.ends===null?null:previous.ends>period.ends?previous.ends:period.ends,hours:String(Math.round((Number(previous.hours)+Number(period.hours))*100)/100)}:{...period});
 }
 return [...roles.values()].sort((a,b)=>b.starts.localeCompare(a.starts));
}
