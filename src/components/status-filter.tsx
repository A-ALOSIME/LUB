"use client";
import {FilterTabs} from "@/components/ui/filter-tabs";
type Props={value:string;options:Array<{value:string;label:string;count?:number}>;onValueChange:(value:string)=>void;ariaLabel:string;dir?:"ltr"|"rtl"};
/** Every status set uses the same compact, unnumbered control. */
export function StatusFilter(props:Props){return <FilterTabs {...props}/>;}
