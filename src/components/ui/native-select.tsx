"use client";

import * as React from "react";
import { DirectionProvider, useDirection } from "@base-ui/react/direction-provider";
import { cn } from "cn";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./select";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size" | "multiple" | "ref"> & {size?: "sm" | "default"};
type Option = {value:string;label:React.ReactNode;disabled:boolean;group?:string};
function optionsFrom(children: React.ReactNode, group?:string, disabled=false): Option[] {
  return React.Children.toArray(children).flatMap(child=>{
    if(!React.isValidElement<{value?:string|number;children?:React.ReactNode;label?:string;disabled?:boolean}>(child))return [];
    const props=child.props;
    if(props.value!==undefined)return [{value:String(props.value),label:props.children,disabled:disabled||!!props.disabled,group}];
    return optionsFrom(props.children,props.label??group,disabled||!!props.disabled);
  });
}
// Retain native form data, validation, reset and bubbling change events. The native
// control is only a form bridge; every visible picker uses the shared shadcn Select.
function NativeSelect({className,size="default",children,value,defaultValue,id,dir,disabled,required,onChange,style,autoFocus,...props}:NativeSelectProps) {
  const options=optionsFrom(children), initial=String(defaultValue??options[0]?.value??"");
  const [local,setLocal]=React.useState(initial);
  const selected=String(value??local), native=React.useRef<HTMLSelectElement>(null),trigger=React.useRef<HTMLButtonElement>(null);
  const inheritedDirection=useDirection(), direction=dir==="ltr"||dir==="rtl"?dir:inheritedDirection;
  const groups=[...new Set(options.map(option=>option.group))];
  React.useEffect(()=>{
    const form=native.current?.form;if(!form)return;
    const reset=(event:Event)=>{queueMicrotask(()=>{if(!event.defaultPrevented){if(native.current)native.current.value=String(value??initial);if(value===undefined)setLocal(initial);}});};
    form.addEventListener("reset",reset);return()=>form.removeEventListener("reset",reset);
  },[initial,value]);
  return <DirectionProvider direction={direction}><div data-slot="native-select-wrapper" data-size={size} className={cn("relative w-full min-w-0",className)} style={style}>
    <select {...props} id={id?`${id}-form-value`:undefined} ref={native} tabIndex={-1} aria-hidden="true" value={selected} disabled={disabled} required={required}
      style={{position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none",insetInlineStart:0,bottom:0}}
      onFocus={()=>trigger.current?.focus()} onChange={event=>{if(value===undefined)setLocal(event.currentTarget.value);onChange?.(event);}}>
      {options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    <Select value={selected} items={options.map(option=>({value:option.value,label:option.label}))} disabled={disabled}
      onValueChange={next=>{if(next===null||!native.current)return;native.current.value=next;native.current.dispatchEvent(new Event("change",{bubbles:true}));}}>
      <SelectTrigger ref={trigger} id={id} size={size} dir={direction} className="w-full" disabled={disabled} autoFocus={autoFocus} aria-required={required||undefined} aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]} aria-invalid={props["aria-invalid"]}>
        <SelectValue placeholder={options.find(option=>option.value==="")?.label}/>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} dir={direction}>{groups.map((group,index)=><SelectGroup key={group??index}>{group&&<SelectLabel>{group}</SelectLabel>}{options.filter(option=>option.group===group).map(option=><SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectGroup>)}</SelectContent>
    </Select>
  </div></DirectionProvider>;
}
function NativeSelectOption(props:React.ComponentProps<"option">){return <option {...props}/>;}
function NativeSelectOptGroup(props:React.ComponentProps<"optgroup">){return <optgroup {...props}/>;}
export {NativeSelect,NativeSelectOption,NativeSelectOptGroup};
