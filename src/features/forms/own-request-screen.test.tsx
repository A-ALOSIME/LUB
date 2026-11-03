// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
const mutate=vi.hoisted(()=>vi.fn());
vi.mock("./actions",()=>({mutateWorkflow:vi.fn()}));
vi.mock("@/features/hours/actions",()=>({mutateHours:mutate}));
vi.mock("@/features/organization-requests/actions",()=>({mutateOpeningRequest:vi.fn()}));
import {OwnRequestScreen} from "./own-request-screen";
import {PrivateQueryProvider} from "@/components/private-query-provider";
import {I18nProvider} from "@/components/i18n-provider";
import {toast} from "@/components/ui/toast";
import type {OwnRequestPage,OwnRequestRow} from "./own-request-types";
const row:OwnRequestRow={id:"invite",name:"Data Club",title:"Renewal",status:"Pending",created_at:"2026-11-03T10:00:00Z",reason:"",slug:"data",logo:null,round:null,canWithdraw:false,canRespond:true,summary:"Invitation",mission:"",interests:[],opens:null,closes:null};
const page:OwnRequestPage={items:[row],counts:{Pending:1},total:1,more:false},empty:OwnRequestPage={items:[],counts:{},total:0,more:false};
function mount(){render(<I18nProvider locale="en"><PrivateQueryProvider actorId="student"><OwnRequestScreen initial={{applications:empty,renewals:page,organizations:empty}} filters={{tab:"renewals",status:"all",q:"",sort:"desc",page:0}} selectedPage={page} locale="en"/></PrivateQueryProvider></I18nProvider>);}
beforeEach(()=>{window.history.replaceState(null,"","/applications?tab=renewals");mutate.mockReset();vi.stubGlobal("fetch",vi.fn(async()=>Response.json(page)));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();window.history.replaceState(null,"","/");});
it("uses direct renewal response icons and a regular dialog, without a response select or withdrawal action",()=>{
 mount();expect(screen.getAllByRole("button",{name:"Accept renewal"})).toHaveLength(2);expect(screen.getAllByRole("button",{name:"Decline renewal"})).toHaveLength(2);expect(screen.queryByRole("button",{name:"Withdraw request"})).toBeNull();
 fireEvent.click(screen.getAllByRole("button",{name:"View details"})[0]);expect(screen.getByRole("dialog")).toBeTruthy();expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();expect(screen.queryByRole("combobox")).toBeNull();expect(screen.queryByRole("button",{name:"Save response"})).toBeNull();
});
it("updates a response optimistically and restores it when the owner-checked save fails",async()=>{
 let resolve!:(value:{error:string})=>void;mutate.mockReturnValue(new Promise(r=>{resolve=r;}));const add=vi.spyOn(toast,"add");mount();fireEvent.click(screen.getAllByRole("button",{name:"Accept renewal"})[0]);
 await waitFor(()=>expect(mutate).toHaveBeenCalledOnce());expect(screen.getAllByText("Renewed").length).toBeGreaterThan(0);const form=mutate.mock.calls[0][1] as FormData;expect(form.get("operation")).toBe("respond");expect(form.get("response")).toBe("invite");expect(form.get("decision")).toBe("Renewed");resolve({error:"Permission required"});
 await waitFor(()=>expect(screen.getAllByRole("button",{name:"Accept renewal"})[0]).toHaveProperty("disabled",false));expect(within(screen.getByRole("table")).queryByText("Renewed")).toBeNull();await waitFor(()=>expect(add).toHaveBeenCalledWith(expect.objectContaining({type:"error",timeout:0})));
});
