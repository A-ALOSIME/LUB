"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { displaySkills, skillKey } from "./skill-normalization";
export function TalentSearch({query, skill, options, en}: {query: string; skill: string; options: string[]; en: boolean}) {
  const router=useRouter(), [text,setText]=useState(query), [selected,setSelected]=useState(skillKey(skill));
  const [previous,setPrevious]=useState({query,skill});
  if(previous.query!==query||previous.skill!==skill){
    if(text===previous.query)setText(query);
    if(selected===skillKey(previous.skill))setSelected(skillKey(skill));
    setPrevious({query,skill});
  }
  useEffect(()=>{
    if(text===query && selected===skillKey(skill))return;
    const timer=setTimeout(()=>{const params=new URLSearchParams();if(text.trim())params.set("q",text.trim());if(selected)params.set("skill",selected);router.replace(`/talent${params.size?`?${params}`:""}`,{scroll:false});},250);
    return()=>clearTimeout(timer);
  },[text,selected,router,query,skill]);
  return <form className="talent-search my-6 grid gap-3" action="/talent" onSubmit={event=>event.preventDefault()}>
    <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute z-10 start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input type="search" name="q" value={text} onChange={event=>setText(event.target.value)} maxLength={120} className="ps-10" aria-label={en?"Search by name, major or skill":"البحث بالاسم أو التخصص أو المهارة"} placeholder={en?"Search by name, major or skill…":"ابحث بالاسم أو التخصص أو المهارة…"}/></div>
    <div className="w-full sm:max-w-64"><NativeSelect name="skill" aria-label={en?"Filter by skill (optional)":"فلتر المهارة (اختياري)"} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">{en?"All skills (optional)":"كل المهارات (اختياري)"}</option>{displaySkills([...options,...(skill?[skill]:[])]).map(value=><option key={skillKey(value)} value={skillKey(value)}>{value}</option>)}</NativeSelect></div>
  </form>;
}
