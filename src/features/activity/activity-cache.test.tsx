// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {I18nProvider} from "@/components/i18n-provider";
import type {ActivitySnapshot} from "./activity-data";
const mocks=vi.hoisted(()=>({load:vi.fn(),version:vi.fn()}));
vi.mock("./activity-data-actions",()=>({loadActivitySnapshot:mocks.load}));
vi.mock("./freshness-actions",()=>({readActivityVersion:mocks.version}));
vi.mock("@/features/tasks/task-browser",()=>({TaskBrowser:({initialView,availableItems,mineItems,onViewChange}:{initialView:string;availableItems:Array<{task:{title:string}}> ;mineItems:Array<{task:{title:string}}> ;onViewChange:(v:string)=>void})=><div><button onClick={()=>onViewChange("mine")}>My participation</button><button onClick={()=>onViewChange("available")}>Available</button>{(initialView==="mine"?mineItems:availableItems).map(x=><p key={x.task.title}>{x.task.title}</p>)}</div>}));
vi.mock("./activity-views",()=>({ActivityEventRows:({events}:{events:Array<{id:string;title:string}>})=><div>{events.map(e=><p key={e.id}>{e.title}</p>)}</div>,ActivityHours:({data,onFiltersChange}:{data:ActivitySnapshot["hours"];onFiltersChange:(v:{status:string;term?:string|null})=>void})=><div>{["all","approved","pending","rejected"].map(status=><button key={status} onClick={()=>onFiltersChange({status})}>{status} hours</button>)}<button onClick={()=>onFiltersChange({status:"all",term:"later"})}>Later term</button>{data.records.map(r=><p key={r.id}>{r.description}</p>)}</div>}));
import {ActivityCacheProvider} from "./activity-cache";
import {ActivityScreen} from "./activity-screen";
const snapshot:ActivitySnapshot={actorId:"student",version:"v1",tasks:[],mine:[],events:Array.from({length:28},(_,i)=>({id:String(i),title:`Event ${i}`,starts_at:"2026-10-30",status_code:"Published",registration:"Registered",review_status:i===26?"Pending":i===27?"Rejected":"Approved",attendance:"Pending"})),hours:{account:{status:"Active",onboarded:true},terms:[{id:"later",name_ar:"الفصل الثاني",academic_year:"2026",term_code:"T2",start_date:"2026-10-01",end_date:"2027-01-01"}],memberships:[],total:"26",hoursByStatus:{approved:"26",pending:"1",rejected:"1"},byOrg:[],records:Array.from({length:28},(_,i)=>({id:String(i),organization_id:"org",organization_membership_id:"membership",committee_id:null,academic_term_id:i===27?"later":"first",hours:"1",activity_date:"2026-10-30",description:`Hour ${i}`,status_code:i===26?"Pending":i===27?"Rejected":"Approved",source_code:"Manual",created_at:"2026-10-30",owner:"Student",org_name:"Club",term_name:"Term",canReview:false,decisions:[]}))}};
function tree(show=true,actor="student"){return <I18nProvider locale="en"><ActivityCacheProvider actorId={actor}>{show?<ActivityScreen/>:<p>Another page</p>}</ActivityCacheProvider></I18nProvider>;}
beforeEach(()=>{window.history.replaceState(null,"","/activity");mocks.load.mockResolvedValue(snapshot);mocks.version.mockResolvedValue("v1");});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.resetAllMocks();window.history.replaceState(null,"","/");});
it("loads the complete snapshot once, filters records beyond page one locally, and preserves it across ten tab/filter switches and a page revisit",async()=>{
 const view=render(tree());await screen.findByRole("tab",{name:"Hours"});
 for(let i=0;i<10;i++){
  fireEvent.click(screen.getByRole("tab",{name:"Hours"}));fireEvent.click(screen.getByRole("button",{name:"pending hours"}));expect(screen.getByText("Hour 26")).toBeTruthy();expect(screen.queryByText("Hour 0")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"rejected hours"}));expect(screen.getByText("Hour 27")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab",{name:"Events"}));fireEvent.click(screen.getByRole("tab",{name:/^Pending/}));expect(screen.getByText("Event 26")).toBeTruthy();expect(screen.queryByText("Event 0")).toBeNull();
  fireEvent.click(screen.getByRole("tab",{name:"Tasks"}));fireEvent.click(screen.getByRole("button",{name:"My participation"}));
  expect(screen.queryByLabelText("Loading activity")).toBeNull();expect(document.querySelector('[data-slot=skeleton]')).toBeNull();
 }
 expect(mocks.load).toHaveBeenCalledOnce();expect(mocks.version).not.toHaveBeenCalled();
 view.rerender(tree(false));expect(screen.getByText("Another page")).toBeTruthy();view.rerender(tree());
 expect(screen.getByRole("tab",{name:"Tasks"})).toBeTruthy();expect(screen.queryByLabelText("Loading activity")).toBeNull();expect(mocks.load).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole("tab",{name:"Hours"}));expect(screen.getByText("Hour 27")).toBeTruthy();expect(window.location.search).toContain("hourStatus=rejected");
});
it("retains visible cached data during a changed-version background refresh and on transient failures",async()=>{
 render(tree());await screen.findByRole("tab",{name:"Events"});fireEvent.click(screen.getByRole("tab",{name:"Events"}));
 let finish!:(value:ActivitySnapshot)=>void;mocks.load.mockImplementationOnce(()=>new Promise<ActivitySnapshot>(resolve=>{finish=resolve;}));mocks.version.mockResolvedValue("v2");
 const now=Date.now();vi.spyOn(Date,"now").mockReturnValue(now+6000);fireEvent.focus(window);await waitFor(()=>expect(mocks.load).toHaveBeenCalledTimes(2));
 expect(screen.getByText("Event 0")).toBeTruthy();expect(screen.queryByLabelText("Loading activity")).toBeNull();
 await act(async()=>finish({...snapshot,version:"v2",events:[{...snapshot.events[0],title:"Updated event"}]}));expect(screen.getByText("Updated event")).toBeTruthy();
 mocks.load.mockRejectedValueOnce(new Error("offline"));fireEvent(window,new Event("activity-changed"));await waitFor(()=>expect(mocks.load).toHaveBeenCalledTimes(3));
 expect(screen.getByText("Updated event")).toBeTruthy();expect(screen.queryByRole("alert")).toBeNull();
});
it("never reuses a previous actor's data and rejects a mismatched snapshot",async()=>{
 const view=render(tree());await screen.findByRole("tab",{name:"Events"});fireEvent.click(screen.getByRole("tab",{name:"Events"}));expect(screen.getByText("Event 0")).toBeTruthy();
 mocks.load.mockResolvedValueOnce(snapshot);view.rerender(tree(true,"different-student"));expect(screen.queryByText("Event 0")).toBeNull();
 expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.queryByRole("tab",{name:"Events"})).toBeNull();
});
