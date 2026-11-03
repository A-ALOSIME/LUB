// @vitest-environment jsdom
import {act,renderHook} from "@testing-library/react";
import {expect,it} from "vitest";
import {useOptimisticRows} from "./optimistic-rows";
it("rolls back only the failed row while preserving a concurrent edit, then accepts fresh server rows",()=>{
 const rows=[{id:"a",status:"Draft"},{id:"b",status:"Draft"}],hook=renderHook(({items})=>useOptimisticRows(items,item=>item.id),{initialProps:{items:rows}});
 let undo=()=>{};act(()=>{undo=hook.result.current.change("a",row=>({...row,status:"Open"}));});act(()=>{hook.result.current.change("b",row=>({...row,status:"Open"}));});expect(hook.result.current.items.map(row=>row.status)).toEqual(["Open","Open"]);
 act(undo);expect(hook.result.current.items.map(row=>row.status)).toEqual(["Draft","Open"]);
 hook.rerender({items:[{id:"a",status:"Draft"},{id:"b",status:"Closed"}]});expect(hook.result.current.items[1].status).toBe("Closed");
});
