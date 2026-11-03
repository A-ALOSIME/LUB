"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Combobox,ComboboxTrigger,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from "@/components/ui/combobox";
import {FilterTabs} from "@/components/ui/filter-tabs";
import {useI18n} from "@/components/i18n-provider";
type Props={value:string;options:Array<{value:string;label:string;count?:number}>;onValueChange:(value:string)=>void;ariaLabel:string;dir?:"ltr"|"rtl"};
/** Short status sets remain tabs; longer sets share one searchable shadcn combobox. */
export function StatusFilter(props:Props){return props.options.length<=5?<FilterTabs {...props}/>:<SearchableStatuses {...props}/>;}
function SearchableStatuses({value,options,onValueChange,ariaLabel,dir}:Props){
 const [query,setQuery]=useState(""),{t}=useI18n(),selected=options.find(option=>option.value===value),label=(id:string)=>options.find(option=>option.value===id)?.label??"";
 return <Combobox value={value} items={options.map(option=>option.value)} itemToStringLabel={label} filter={null} onValueChange={next=>{if(next!==null)onValueChange(next);}} inputValue={query} onInputValueChange={setQuery} onOpenChange={open=>{if(open)setQuery("");}}>
  <ComboboxTrigger render={<Button type="button" variant="outline" className="min-w-44 max-w-full justify-between" aria-label={ariaLabel} dir={dir}/>}>{selected?.label??ariaLabel}{selected?.count!==undefined&&<Badge variant="secondary">{selected.count}</Badge>}</ComboboxTrigger>
  <ComboboxContent align="start"><ComboboxInput aria-label={t("بحث الحالات","Search statuses")} placeholder={t("ابحث عن حالة","Search statuses")} showTrigger={false}/><ComboboxList>{options.filter(option=>option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())).map(option=><ComboboxItem key={option.value} value={option.value}><span className="flex min-w-0 items-center gap-2">{option.label}{option.count!==undefined&&<Badge variant="secondary">{option.count}</Badge>}</span></ComboboxItem>)}<ComboboxEmpty>{t("لا توجد نتائج مطابقة","No matching results")}</ComboboxEmpty></ComboboxList></ComboboxContent>
 </Combobox>;
}
