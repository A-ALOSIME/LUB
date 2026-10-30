"use client";
import {localizeDigits,t as translateUi} from "@/lib/i18n";
import {normalizeDigits} from "@/lib/validation";
import {useState} from "react";
import {InputGroup, InputGroupInput, InputGroupAddon} from "@/components/ui/input-group";
import {NativeSelect} from "@/components/ui/native-select";
import {Field, FieldLabel} from "@/components/ui/field";
import type {Locale} from "@/lib/preferences";

export function CompactTimeInput({label,value,onChange,onValidity,locale}:{label:string;value:string;onChange:(value:string)=>void;onValidity:(valid:boolean)=>void;locale:Locale}) {
  const [hour,minute]=value.split(":").map(Number),period=hour>=12?"pm":"am";
  const [text,setText]=useState(`${hour%12||12}:${String(minute).padStart(2,"0")}`),[invalid,setInvalid]=useState(false);
  function update(next:string,nextPeriod:string) {
    const formatted=/^\d{3,4}$/.test(next)?`${next.slice(0,-2)}:${next.slice(-2)}`:next;
    const match=/^(0?[1-9]|1[0-2]):([0-5]\d)$/.exec(formatted),valid=!!match;
    setInvalid(!valid);onValidity(valid);
    if(match)onChange(`${String(Number(match[1])%12+(nextPeriod==="pm"?12:0)).padStart(2,"0")}:${match[2]}`);
  }
  return <Field data-invalid={invalid||undefined}><FieldLabel>{label}</FieldLabel><InputGroup className="compact-time-input" dir="ltr">
    <InputGroupInput aria-label={label} aria-invalid={invalid} value={localizeDigits(text)} inputMode="numeric" maxLength={5} placeholder={localizeDigits("12:00")} onBlur={()=>{if(/^\d{3,4}$/.test(text))setText(`${text.slice(0,-2)}:${text.slice(-2)}`);}} onChange={event=>{const next=normalizeDigits(event.target.value);setText(next);update(next,period);}}/>
    <InputGroupAddon align="inline-end"><NativeSelect aria-label={`${label}: ${translateUi((locale==="ar") ? "ar" : "en", "الفترة", "period")}`} value={period} onChange={event=>update(text,event.target.value)}><option value="am">{translateUi((locale==="ar") ? "ar" : "en", "ص", "AM")}</option><option value="pm">{translateUi((locale==="ar") ? "ar" : "en", "م", "PM")}</option></NativeSelect></InputGroupAddon>
  </InputGroup></Field>;
}
