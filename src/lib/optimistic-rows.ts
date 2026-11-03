"use client";
import {useState} from "react";
/** An authoritative replacement wins over pending projections; rollback removes only its own edit. */
export function useOptimisticRows<T>(items:T[],id:(item:T)=>string){
 const [edits,setEdits]=useState<Array<{token:object;base:T[];target:string;update:(item:T)=>T|null}>>([]);
 function change(target:string,update:(item:T)=>T|null){
  const token={};setEdits(current=>[...current.filter(edit=>edit.base===items),{token,base:items,target,update}]);
  return ()=>setEdits(current=>current.filter(edit=>edit.token!==token));
 }
 const visible=edits.filter(edit=>edit.base===items).reduce((rows,edit)=>rows.flatMap(item=>{if(id(item)!==edit.target)return[item];const next=edit.update(item);return next?[next]:[];}),items);
 return {items:visible,change};
}
