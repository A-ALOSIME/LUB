import Link from "next/link";
import {Button} from "@/components/ui/button";
import type {Locale} from "@/lib/preferences";
export function TaskPagination({page,more,base,query={},locale="ar",pageParam="page",onPageChange}:{page:number;more:boolean;base:string;query?:Record<string,string>;locale?:Locale;pageParam?:string;onPageChange?:(page:number)=>void}){
 const en=locale==="en";
 const url=(next:number)=>`${base}?${new URLSearchParams({...query,[pageParam]:String(next)})}`;
 if(page===0&&!more)return null;
 return <nav aria-label={en?"Record pages":"صفحات السجلات"} className="mt-6 flex flex-wrap items-center gap-4">{page>0&&(onPageChange?<Button variant="outline" onClick={()=>onPageChange(page-1)}>{en?"Previous":"السابق"}</Button>:<Link className="button button-secondary" href={url(page-1)}>{en?"Previous":"السابق"}</Link>)}<span>{en?`Page ${page+1}`:`الصفحة ${page+1}`}</span>{more&&(onPageChange?<Button variant="outline" onClick={()=>onPageChange(page+1)}>{en?"Next":"التالي"}</Button>:<Link className="button button-secondary" href={url(page+1)}>{en?"Next":"التالي"}</Link>)}</nav>;
}
