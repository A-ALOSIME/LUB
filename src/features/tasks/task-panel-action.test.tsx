// @vitest-environment jsdom
import {cleanup,fireEvent,render as rtlRender,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({load:vi.fn(),mutate:vi.fn(),refresh:vi.fn()}));
vi.mock("./task-panel-actions",()=>({loadTaskPanel:mocks.load}));
vi.mock("./actions",()=>({mutateTask:mocks.mutate}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
vi.mock("./task-detail",async()=>{const {TaskPageForm}=await import("./page-forms");return {TaskDetailView:({detail,onNavigate}:{detail:{own?:unknown};onNavigate:(query:unknown)=>void})=><div>تفاصيل المهمة كاملة<button onClick={()=>onNavigate({page:1})}>صفحة التسليم التالية</button>{detail.own?<p>تم الانضمام بنجاح</p>:<TaskPageForm operation="join" fields={{task:"task"}} label="الانضمام للمهمة"/>}</div>};});
vi.mock("./task-composer",()=>({TaskEditorForm:()=> <label>عنوان المهمة<input defaultValue="التصميم"/></label>}));
import {PrivateQueryProvider} from "@/components/private-query-provider";
import type {ReactElement} from "react";
import {privateJson} from "@/lib/private-query";
const render=(ui:ReactElement)=>rtlRender(<PrivateQueryProvider actorId="test-actor">{ui}</PrivateQueryProvider>);
vi.mock("@/lib/private-query",()=>({privateJson:vi.fn((url:string)=>{const search=new URL(url,"http://localhost").searchParams;return mocks.load("task",{page:Number(search.get("page")),teamPage:Number(search.get("teamPage")),eventPage:Number(search.get("eventPage")),participant:search.get("participant")});})}));
import {TaskPanelAction} from "./task-panel-action";
afterEach(()=>{cleanup();mocks.load.mockReset();mocks.mutate.mockReset();mocks.refresh.mockClear();vi.mocked(privateJson).mockClear();});
const detail={task:{organization_id:"org"},canManage:true};
it("opens cached student details in a left sheet without navigating",async()=>{
 mocks.load.mockResolvedValue({detail:{...detail,canManage:false}});
 render(<TaskPanelAction task="task" title="التصميم"/>);
 fireEvent.click(screen.getByRole("button",{name:"عرض التفاصيل"}));
 expect(await screen.findByText("تفاصيل المهمة كاملة",{}, {timeout:5000})).toBeTruthy();
 expect(screen.getByRole("dialog").getAttribute("data-side")).toBe("left");
 expect(screen.queryByRole("link",{name:"عرض التفاصيل"})).toBeNull();
 expect(vi.mocked(privateJson).mock.calls[0][0]).toContain("purpose=student");
 fireEvent.click(screen.getByRole("button",{name:"إغلاق"}));
 fireEvent.click(screen.getByRole("button",{name:"عرض التفاصيل"}));
 expect(await screen.findByText("تفاصيل المهمة كاملة",{}, {timeout:5000})).toBeTruthy();expect(mocks.load).toHaveBeenCalledTimes(1);
});
it("opens the authorized prefilled editor in a dialog",async()=>{
 mocks.load.mockResolvedValue({detail,workspace:{name:"org"}});
 render(<TaskPanelAction task="task" title="التصميم" edit/>);
 fireEvent.click(screen.getByRole("button",{name:"تعديل المهمة"}));
 expect((await screen.findByRole("textbox",{name:"عنوان المهمة"}) as HTMLInputElement).value).toBe("التصميم");
 expect(screen.getByRole("dialog").getAttribute("data-side")).toBeNull();
});
it("keeps a failed request retryable and prevents editing without server permission",async()=>{
 mocks.load.mockResolvedValueOnce({error:"تعذّر التحميل"}).mockResolvedValueOnce({detail:{...detail,canManage:false}});
 render(<TaskPanelAction task="task" title="التصميم" edit/>);
 fireEvent.click(screen.getByRole("button",{name:"تعديل المهمة"}));
 fireEvent.click(await screen.findByRole("button",{name:"إعادة المحاولة"}));
 expect(await screen.findByText("لا تملك صلاحية تعديل هذه المهمة.")).toBeTruthy();
 expect(screen.queryByRole("textbox")).toBeNull();
});

it("shows a localized retryable editor error without leaking the server text",async()=>{
 mocks.load.mockResolvedValue({error:"Private service error"});render(<TaskPanelAction task="task" title="Design" locale="en" edit/>);fireEvent.click(screen.getByRole("button",{name:"Edit task"}));
 expect(await screen.findByText("The task could not be loaded. Try again.")).toBeTruthy();expect(screen.queryByText("Private service error")).toBeNull();expect(screen.getByRole("button",{name:"Retry"})).toBeTruthy();
});

it("keeps the sheet open after joining and refreshes its data without a route refresh",async()=>{
 mocks.load.mockResolvedValueOnce({detail:{...detail,canManage:false,own:null}}).mockResolvedValue({detail:{...detail,canManage:false,own:{id:"participant"}}});mocks.mutate.mockResolvedValue({success:"تم الحفظ"});
 render(<TaskPanelAction task="task" title="التصميم"/>);fireEvent.click(screen.getByRole("button",{name:"عرض التفاصيل"}));
 fireEvent.submit((await screen.findByRole("button",{name:"الانضمام للمهمة"})).closest("form")!);
 expect(await screen.findByText("تم الانضمام بنجاح")).toBeTruthy();expect(screen.getByRole("dialog",{name:"التصميم"})).toBeTruthy();expect(mocks.refresh).not.toHaveBeenCalled();await waitFor(()=>expect(mocks.load).toHaveBeenCalledTimes(2));
});
