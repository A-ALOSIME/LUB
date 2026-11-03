// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import {PrivateQueryProvider} from "@/components/private-query-provider";
import {I18nProvider} from "@/components/i18n-provider";
const reads=vi.hoisted(()=>({get:vi.fn()}));
vi.mock("@/lib/private-query",()=>({privateJson:reads.get}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:vi.fn(),push:vi.fn()})}));
vi.mock("./search-action",()=>({searchApplications:vi.fn()}));
vi.mock("./application-selection",()=>({ApplicationSelection:({rows}:{rows:Array<{id:string}>})=><p>{rows[0]?.id}</p>}));
import {OrganizationApplicationList} from "./organization-application-list";
const filters={q:"",status:"",committee:"",major:"",level:"",from:"",to:"",page:1,lookup:"",round:"",activity:""};
const initial={items:[],counts:{all:0,submitted:0,interview:0,accepted:0,rejected:0,withdrawn:0},more:false};
function mount(){return render(<PrivateQueryProvider actorId="verified"><I18nProvider locale="en"><OrganizationApplicationList organization="org" initial={initial} initialFilters={filters} locale="en" canBulk={false} extraFilters={null}/></I18nProvider></PrivateQueryProvider>);}
afterEach(()=>{cleanup();vi.resetAllMocks();window.history.replaceState(null,"","/");});
it("prefetches finite statuses once and restores URL filters without repeated requests",async()=>{
 window.history.replaceState(null,"","/manage/organizations/org/members?section=applications");
 reads.get.mockResolvedValue(initial);mount();await waitFor(()=>expect(reads.get).toHaveBeenCalledTimes(5));
 for(let i=0;i<10;i++)for(const name of ["Under review","Interview","Accepted","Rejected","Withdrawn","All"]){fireEvent.click(screen.getByRole("combobox",{name:"Application status"}));fireEvent.click(screen.getByRole("option",{name:new RegExp(`^${name}`)}));}
 expect(reads.get).toHaveBeenCalledTimes(5);expect(screen.queryByText(/loading/i)).toBeNull();
 fireEvent.click(screen.getByRole("combobox",{name:"Application status"}));fireEvent.click(screen.getByRole("option",{name:/^Interview/}));expect(new URLSearchParams(window.location.search).get("status")).toBe("Interview");
});
it("aborts an in-flight private list request on unmount",async()=>{
 const aborted=vi.fn();reads.get.mockImplementation((_url:string,signal:AbortSignal)=>new Promise((_resolve,reject)=>{signal.addEventListener("abort",()=>{aborted();reject(new DOMException("Aborted","AbortError"));},{once:true});}));
 const view=mount();await waitFor(()=>expect(reads.get).toHaveBeenCalled());view.unmount();expect(aborted).toHaveBeenCalledTimes(5);
});
