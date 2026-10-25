"use client";
import {useState} from "react";
import {InputGroup, InputGroupInput, InputGroupAddon} from "@/components/ui/input-group";
import {NativeSelect} from "@/components/ui/native-select";
import {Field, FieldLabel} from "@/components/ui/field";
import type {Locale} from "@/lib/preferences";

export function CompactTimeInput({label,value,onChange,onValidity,locale}:{label:string;value:string;onChange:(value:string)=>void;onValidity:(valid:boolean)=>void;locale:Locale}) {
  const [hour,minute]=value.split(":").map(Number),period=hour>=12?"pm":"am";
  const [text,setText]=useState(`${hour%12||12}:${String(minute).padStart(2,"0")}`),[invalid,setInvalid]=useState(false);
  function update(next:string,nextPeriod:string) {
    const match=/^(0?[1-9]|1[0-2]):([0-5]\d)$/.exec(next),valid=!!match;
    setInvalid(!valid);onValidity(valid);
    if(match)onChange(`${String(Number(match[1])%12+(nextPeriod==="pm"?12:0)).padStart(2,"0")}:${match[2]}`);
  }
  return <Field data-invalid={invalid||undefined}><FieldLabel>{label}</FieldLabel><InputGroup className="compact-time-input" dir="ltr">
    <InputGroupInput aria-label={label} aria-invalid={invalid} value={text} inputMode="numeric" maxLength={5} placeholder="12:00" onChange={event=>{setText(event.target.value);update(event.target.value,period);}}/>
    <InputGroupAddon align="inline-end"><NativeSelect aria-label={`${label}: ${locale==="ar"?"الفترة":"period"}`} value={period} onChange={event=>update(text,event.target.value)}><option value="am">{locale==="ar"?"ص":"AM"}</option><option value="pm">{locale==="ar"?"م":"PM"}</option></NativeSelect></InputGroupAddon>
  </InputGroup></Field>;
}
