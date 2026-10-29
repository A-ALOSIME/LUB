// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("./task-panel-actions",()=>({loadTaskPanel:mocks.load}));
vi.mock("./actions",()=>({mutateTask:vi.fn()}));
vi.mock("./task-detail",()=>({TaskDetailView:({onNavigate}:{onNavigate:(query:unknown)=>void})=><div>تفاصيل المهمة كاملة<button onClick={()=>onNavigate({page:1})}>صفحة التسليم التالية</button></div>}));
vi.mock("./task-composer",()=>({TaskEditorForm:()=> <label>عنوان المهمة<input defaultValue="التصميم"/></label>}));
import {TaskPanelAction} from "./task-panel-action";
afterEach(()=>{cleanup();vi.resetAllMocks();});
const detail={task:{organization_id:"org"},canManage:true};
it("opens details and paginates inside a left sheet without changing the URL",async()=>{
 mocks.load.mockResolvedValue({detail});const url=window.location.href;
 render(<TaskPanelAction task="task" title="التصميم"/>);
 fireEvent.click(screen.getByRole("button",{name:"عرض التفاصيل"}));
 expect(await screen.findByText("تفاصيل المهمة كاملة")).toBeTruthy();
 expect(screen.getByRole("dialog").getAttribute("data-side")).toBe("left");
 fireEvent.click(screen.getByRole("button",{name:"صفحة التسليم التالية"}));
 await waitFor(()=>expect(mocks.load).toHaveBeenLastCalledWith("task",{page:1,teamPage:0,eventPage:0,participant:null}));
 expect(window.location.href).toBe(url);
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

it("translates server-returned panel errors in the selected language",async()=>{
 mocks.load.mockResolvedValue({error:"المهمة غير متاحة أو لا تملك صلاحية عرضها."});
 render(<TaskPanelAction task="task" title="Design" locale="en"/>);
 fireEvent.click(screen.getByRole("button",{name:"View details"}));
 expect(await screen.findByText("This task is unavailable or you do not have access to it.")).toBeTruthy();
 expect(screen.queryByText("المهمة غير متاحة أو لا تملك صلاحية عرضها.")).toBeNull();
});
