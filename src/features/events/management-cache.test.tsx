// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {I18nProvider} from "@/components/i18n-provider";
import {OrganizationEventsCacheProvider,type OrganizationEventsSnapshot} from "./management-cache";
import {OrganizationEventsScreen} from "./management-screen";
const mocks=vi.hoisted(()=>({load:vi.fn(),version:vi.fn()}));
vi.mock("./management-cache-actions",()=>({loadOrganizationEvents:mocks.load,readOrganizationEventsVersion:mocks.version}));
vi.mock("./form",()=>({EventCreateForm:()=>null}));
vi.mock("./list-actions",()=>({EventListActions:()=>null}));
vi.mock("./registration-review",()=>({EventRegistrationReview:({items}:{items:Array<{id:string;name:string}>})=><ul>{items.map(r=><li key={r.id}>{r.name}</li>)}</ul>}));
vi.mock("@/features/organizations/events-announcements-actions",()=>({EventsAnnouncementsActions:()=>null}));
vi.mock("@/app/(workspace)/manage/organizations/[id]/announcement-dialog",()=>({AnnouncementDialog:()=>null}));
vi.mock("@/features/organizations/actions",()=>({mutateOrganization:vi.fn()}));
// Mutation dialogs and tooltips have separate suites; keep these cache regressions focused on data and filters.
vi.mock("@/components/row-action",()=>({RowAction:({label}:{label:string})=><button>{label}</button>}));
vi.mock("@/components/ui/alert-dialog",()=>({AlertDialog:()=>null,AlertDialogContent:()=>null,AlertDialogHeader:()=>null,AlertDialogTitle:()=>null,AlertDialogDescription:()=>null,AlertDialogFooter:()=>null,AlertDialogCancel:()=>null}));
const org="00000000-0000-4000-8000-000000000001",actor="manager";
const snapshot:OrganizationEventsSnapshot={actorId:actor,organization:org,version:"v1",workspace:{name:"Club",status:"Active",onboarded:true,canManage:true,canViewEvents:true,canManageAnnouncements:true,events:[],templates:[],announcements:Array.from({length:101},(_,i)=>({id:String(i),title:`Announcement ${i}`,body:"Text",published:i!==100,pinned:false,archived:i===99,createdAt:"2026-10-30"}))},registrations:{items:Array.from({length:28},(_,i)=>({id:String(i),event_id:"event",name:i===27?"أحمد":"Student "+i,major:"Computing",level:"5",title:"Event",created_at:"2026-10-30",review_status_code:i===26?"Pending":i===27?"Rejected":"Accepted",review_note:"",status_code:"Registered",attendance:"Pending",answers:null,definition:null,canReview:true,canAttend:false,canContribute:false,attendanceOpen:false,history:[]})),pending:1,accepted:26,rejected:1,options:[{id:"event",title:"Event"}]}};
function tree(visible=true,actorId=actor){return <I18nProvider locale="en"><OrganizationEventsCacheProvider actorId={actorId}>{visible?<OrganizationEventsScreen organization={org}/>:<p>Another page</p>}</OrganizationEventsCacheProvider></I18nProvider>;}
beforeEach(()=>{window.history.replaceState(null,"",`/manage/organizations/${org}/events?section=registrants&announcementStatus=draft`);mocks.load.mockResolvedValue(snapshot);mocks.version.mockResolvedValue("v1");});
afterEach(()=>{cleanup();vi.resetAllMocks();vi.restoreAllMocks();window.history.replaceState(null,"","/");});
it("keeps every registrant and announcement status locally cached through ten switches and a page revisit",async()=>{
 const view=render(tree());await screen.findByRole("tab",{name:"Event registrants"});
 // These controls stay mounted; retain their DOM references instead of repeatedly running expensive accessibility-name traversal.
 const registrants=screen.getByRole("tab",{name:"Event registrants"}),events=screen.getByRole("tab",{name:"Events"}),announcements=screen.getByRole("tab",{name:"Announcements"}),pending=screen.getByRole("tab",{name:/^Pending/}),rejected=screen.getByRole("tab",{name:/^Rejected/}),all=screen.getByRole("tab",{name:/^All/});
 fireEvent.click(announcements);const archived=screen.getByRole("tab",{name:/^Archived/}),draft=screen.getByRole("tab",{name:/^Draft/});fireEvent.click(registrants);
 for(let i=0;i<10;i++){
  fireEvent.click(pending);expect(screen.getByText("Student 26")).toBeTruthy();
  fireEvent.click(rejected);expect(screen.getByText("أحمد")).toBeTruthy();
  fireEvent.click(announcements);fireEvent.click(archived);expect(screen.getByText("Announcement 99")).toBeTruthy();fireEvent.click(draft);expect(screen.getByText("Announcement 100")).toBeTruthy();
  fireEvent.click(events);fireEvent.click(registrants);expect(document.querySelector('[data-slot=skeleton]')).toBeNull();
 }
 fireEvent.click(all);expect(screen.getByText("Student 0")).toBeTruthy();fireEvent.click(rejected);expect(registrants.isConnected).toBe(true);expect(mocks.load).toHaveBeenCalledOnce();expect(mocks.version).not.toHaveBeenCalled();
 fireEvent.change(screen.getByRole("searchbox",{name:"Search by student name"}),{target:{value:"احمد"}});expect(screen.getByText("أحمد")).toBeTruthy();expect(mocks.load).toHaveBeenCalledOnce();
 view.rerender(tree(false));view.rerender(tree());expect(screen.getByText("أحمد")).toBeTruthy();expect(screen.queryByLabelText("Loading organization events")).toBeNull();expect(mocks.load).toHaveBeenCalledOnce();
});
it("refreshes changed organization data silently and rejects lost access or another actor",async()=>{
 const view=render(tree());await screen.findByRole("tab",{name:"Event registrants"});let finish!:(value:OrganizationEventsSnapshot)=>void;mocks.load.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 fireEvent(window,new CustomEvent("organization-events-changed",{detail:{organization:org}}));await waitFor(()=>expect(mocks.load).toHaveBeenCalledTimes(2));expect(screen.getByText("Student 0")).toBeTruthy();expect(document.querySelector('[data-slot=skeleton]')).toBeNull();
 await act(async()=>finish({...snapshot,version:"v2"}));const now=Date.now();vi.spyOn(Date,"now").mockReturnValue(now+6000);mocks.version.mockResolvedValue(null);fireEvent.focus(window);expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.queryByText("Student 0")).toBeNull();
 view.rerender(tree(true,"another-manager"));expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.queryByRole("tab",{name:"Event registrants"})).toBeNull();
});
