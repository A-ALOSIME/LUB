"use client";
import {ContentText} from "@/components/content-text";
import {useState} from "react";
import {ChevronDown} from "lucide-react";
import {Combobox,ComboboxTrigger,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxGroup,ComboboxLabel,ComboboxEmpty} from "@/components/ui/combobox";
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from "@/components/ui/collapsible";
import {Button} from "@/components/ui/button";
import {createTranslator} from "@/lib/i18n";
import {arabicSearchKey} from "@/features/talent/skill-normalization";
import type {Locale} from "@/lib/preferences";
export type EventFilterOption={id:string;title:string;starts_at?:string;status_code?:string};
export function EventFilter({options,value,onChange,locale}:{options:EventFilterOption[];value:string;onChange:(id:string)=>void;locale:Locale}){
 const [now]=useState(()=>Date.now());
 const c=createTranslator(locale),[q,setQ]=useState(""),[archive,setArchive]=useState(false),selected=options.find(e=>e.id===value),matches=(row:EventFilterOption)=>arabicSearchKey(row.title).includes(arabicSearchKey(q));
 const ordered=[...options].sort((a,b)=>Number(Date.parse(b.starts_at??"")>=now)-Number(Date.parse(a.starts_at??"")>=now)||(Date.parse(b.starts_at??"")||0)-(Date.parse(a.starts_at??"")||0));
 const current=ordered.filter(row=>row.status_code!=="Archived"&&matches(row)),archived=ordered.filter(row=>row.status_code==="Archived"&&matches(row));
 return <Combobox items={["",...options.map(e=>e.id)]} filter={null} itemToStringLabel={id=>options.find(row=>row.id===id)?.title??c("كل الفعاليات","All events")} onOpenChange={open=>{if(open)setQ("");}} value={value} onValueChange={id=>{if(id!==null)onChange(id);}} inputValue={q} onInputValueChange={setQ}><ComboboxTrigger render={<Button variant="outline" className="h-auto min-h-10 w-72 max-w-full justify-between text-start" aria-label={c("الفعالية","Event")}/> }><span className="min-w-0 whitespace-normal break-words">{selected?<ContentText value={selected.title}/>:c("كل الفعاليات","All events")}</span></ComboboxTrigger><ComboboxContent><ComboboxInput showTrigger={false} placeholder={c("ابحث باسم الفعالية","Search event name")} aria-label={c("بحث الفعاليات في القائمة","Search event options")}/><ComboboxList><ComboboxItem value="">{c("كل الفعاليات","All events")}</ComboboxItem><ComboboxGroup><ComboboxLabel>{c("الفعاليات","Events")}</ComboboxLabel>{current.map(row=><ComboboxItem key={row.id} value={row.id}><span className="whitespace-normal break-words"><ContentText value={row.title}/></span></ComboboxItem>)}</ComboboxGroup>{archived.length>0&&<Collapsible open={archive||Boolean(q)} onOpenChange={setArchive}><CollapsibleTrigger render={<Button variant="ghost" size="sm" className="w-full justify-between"/>}>{c("الأرشيف","Archive")}<ChevronDown/></CollapsibleTrigger><CollapsibleContent><ComboboxGroup>{archived.map(row=><ComboboxItem key={row.id} value={row.id}><span className="whitespace-normal break-words"><ContentText value={row.title}/></span></ComboboxItem>)}</ComboboxGroup></CollapsibleContent></Collapsible>}<ComboboxEmpty>{c("لا توجد نتائج مطابقة","No matching results")}</ComboboxEmpty></ComboboxList></ComboboxContent></Combobox>;
}
