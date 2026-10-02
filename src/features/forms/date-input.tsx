"use client";
import { useState } from "react";
import type {Locale} from "@/lib/preferences";
export function DateInput({name,label,required=false,value:initial,locale="ar"}:{name:string;label:string;required?:boolean;value?:string;locale?:Locale}) {
 const [value,setValue]=useState(()=>initial?new Date(new Date(initial).getTime()+3*60*60*1000).toISOString().slice(0,16):"");return <label>{label} ({locale==="en"?"Riyadh time":"توقيت الرياض"})<input type="datetime-local" required={required} value={value} onChange={e=>setValue(e.target.value)}/><input type="hidden" name={name} value={value ? value+":00+03:00" : ""}/></label>;
}
