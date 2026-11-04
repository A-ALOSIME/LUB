import {privateJson} from "./private-query";

type PageShape={path:string[];size:number;pageKey?:string;sentinel?:boolean;totalKey?:string;startPage?:number};
function listShape(url:string):PageShape{
 const parsed=new URL(url,"http://local"),q=parsed.searchParams,path=parsed.pathname;
 if(path.endsWith("/event-lists")){const section=q.get("section");return section==="registrants"?{path:["registrations","items"],size:25,pageKey:"registrationPage",sentinel:true}:section==="announcements"?{path:["workspace","announcements"],size:25,pageKey:"announcementPage",sentinel:true}:{path:["workspace","events"],size:25,sentinel:true};}
 if(path==="/api/activity"){const tab=q.get("tab");return tab==="hours"?{path:["records"],size:25,sentinel:true}:tab==="events"?{path:[q.get("view")==="available"?"available":"events"],size:q.get("view")==="available"?24:25,sentinel:true}:{path:["items"],size:25};}
 if(path.endsWith("/applications/data"))return{path:["items"],size:25,startPage:1};
 if(path.endsWith("/members"))return{path:["members"],size:25,totalKey:"rowTotal"};
 if(path.endsWith("/hours"))return{path:["records"],size:25,sentinel:true};
 return{path:["items"],size:25};
}
function rowsAt(value:unknown,path:string[]):unknown[]{let node=value;for(const key of path){if(!node||typeof node!=="object")return [];node=(node as Record<string,unknown>)[key];}return Array.isArray(node)?node:[];}
function replaceAt(value:unknown,path:string[],rows:unknown[]):unknown{if(!path.length)return rows;const object=value as Record<string,unknown>,[key,...rest]=path;return {...object,[key]:replaceAt(object[key],rest,rows)};}
/** Preserve the scoped server pages; combine them once in the account-scoped query cache. */
export async function completeList<T>(url:string,signal:AbortSignal,shape:PageShape=listShape(url)):Promise<T>{
 const parsed=new URL(url,"http://local"),pageKey=shape.pageKey??"page";parsed.searchParams.set(pageKey,"0");
 const read=(page:number)=>{parsed.searchParams.set(pageKey,String(page));return privateJson<T>(`${parsed.pathname}${parsed.search}`,signal);};
 let first:T|undefined;const collected:unknown[]=[];
 for(let page=0;page<=10000;page++){
  signal.throwIfAborted();const result=await read(page+(shape.startPage??0));first??=result;
  const rows=rowsAt(result,shape.path),meta=result as Record<string,unknown>,more=shape.totalKey?Number(meta[shape.totalKey]??rows.length)>(page+1)*shape.size:shape.sentinel?rows.length>shape.size:typeof meta.more==="boolean"?meta.more:rows.length>shape.size;
  collected.push(...rows.slice(0,shape.sentinel||rows.length>shape.size?shape.size:rows.length));
  if(!more)return {...replaceAt(first,shape.path,collected) as T,more:false};
 }
 throw new Error("List exceeds the supported range");
}
