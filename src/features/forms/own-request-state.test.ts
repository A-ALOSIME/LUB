import {expect,it} from "vitest";
import {withdrawRequestPage} from "./own-request-state";
import type {OwnRequestPage,OwnRequestRow} from "./own-request-types";
it("updates the status, counters and filtered page without mutating the rollback snapshot",()=>{
 const row:OwnRequestRow={id:"request",status:"Submitted",canWithdraw:true,name:"Club",title:"Term",created_at:"2026-11-03",reason:"",slug:null,logo:null,round:null,canRespond:false,summary:"",mission:"",interests:[],opens:null,closes:null};
 const page:OwnRequestPage={items:[row],counts:{Submitted:1},total:1,more:false};
 const all=withdrawRequestPage(page,row.id,"all");expect(all.items[0].status).toBe("Withdrawn");expect(all.counts).toEqual({Submitted:0,Withdrawn:1});expect(all.total).toBe(1);
 const filtered=withdrawRequestPage(page,row.id,"Submitted");expect(filtered.items).toEqual([]);expect(filtered.total).toBe(0);expect(page.items[0].status).toBe("Submitted");expect(page.counts.Submitted).toBe(1);
 expect(withdrawRequestPage(all,row.id,"all")).toBe(all);
});
