// @vitest-environment jsdom
vi.mock("@/features/talent/activity-skill-actions",()=>({searchActivitySkills:vi.fn().mockResolvedValue([])}));
import {cleanup,fireEvent,render as rtlRender,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const navigation=vi.hoisted(()=>({push:vi.fn(),prefetch:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>navigation}));
vi.mock("./task-panel-actions",()=>({loadTaskPanel:vi.fn()}));
vi.mock("./actions",()=>({mutateTask:vi.fn()}));
vi.mock("./task-panel-action",()=>({TaskPanelAction:({open,submission}:{open?:boolean;submission?:boolean})=>open?<div role="dialog">Task details</div>:submission?<button aria-label="تسليم العمل"/>:null}));
import {TaskCardSurface} from "./task-card";
import {TaskList} from "./task-list";
import type {TaskCard} from "./repository";
import {PrivateQueryProvider} from "@/components/private-query-provider";
import type {ReactElement} from "react";
const render=(ui:ReactElement)=>rtlRender(<PrivateQueryProvider actorId="test-actor">{ui}</PrivateQueryProvider>);
afterEach(()=>{cleanup();navigation.push.mockClear();navigation.prefetch.mockClear();});
const task:TaskCard={task:{id:"task",organization_id:"org",committee_id:null,title:"مهمة التصميم",description:"الوصف",default_hours:"2",status_code:"Open",revision:1,starts_at:null,due_at:null,task_template_id:null},org_name:"المجلس",participant:null,historical:false,can_manage:false,latest_submission:null,approved_hours:null};
it("opens task details in place from the rectangle and retains the eye shortcut",()=>{
 render(<TaskList items={[task]} mode="available"/>);
 fireEvent.click(screen.getAllByRole("row",{name:"عرض تفاصيل المهمة"})[0]);
 expect(navigation.push).not.toHaveBeenCalled();expect(screen.getByRole("dialog")).toBeTruthy();
 expect(screen.getAllByRole("button",{name:"عرض التفاصيل"})[0]).toBeTruthy();
});

it("keeps other actions independent of the rectangle button",()=>{
 render(<TaskCardSurface task="task" title="Design" locale="en" actions={<button>Other action</button>}><h2>Design</h2></TaskCardSurface>);
 fireEvent.click(screen.getByRole("button",{name:"Other action"}));expect(screen.queryByRole("dialog")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"View details"}));expect(navigation.push).not.toHaveBeenCalled();expect(screen.getByRole("dialog")).toBeTruthy();
});

it("places the task thumbnail at the start and the status beside the title for leaders too",()=>{
 const {container}=render(<TaskList items={[{...task,can_manage:true,task:{...task.task,status_code:"Draft",image_asset_id:"poster"}}]} mode="all"/>);
 const image=container.querySelector('img')!;expect(image.getAttribute("src")).toBe("/files/poster/preview?thumbnail=1");expect(image.parentElement?.className).toContain("w-20");expect(image.className).toContain("object-contain");
 const title=screen.getAllByText("مهمة التصميم")[0];expect(title.closest('tr')?.textContent).toContain("مسودة");fireEvent.click(screen.getAllByRole("row",{name:"عرض تفاصيل المهمة"})[0]);expect(navigation.push).not.toHaveBeenCalled();expect(screen.getByRole("dialog")).toBeTruthy();
});

it("shows only view and join for unjoined students and hides the published badge",()=>{
 render(<TaskList items={[task]} mode="available"/>);expect(screen.getAllByRole("button",{name:"الانضمام للمهمة"})[0]).toBeTruthy();expect(screen.getAllByRole("button",{name:"عرض التفاصيل"})[0]).toBeTruthy();expect(screen.queryByRole("button",{name:"الانسحاب"})).toBeNull();expect(screen.queryByRole("button",{name:"تسليم العمل"})).toBeNull();expect(screen.queryByText("منشورة")).toBeNull();expect(screen.getAllByText("غير منضم")[0]).toBeTruthy();
});
it("uses the same submission and withdrawal actions in available and participation lists",()=>{
 const joined={...task,participant:{id:"p",user_id:"u",status_code:"Joined",approved_hours_override:null,joined_at:"2026-10-31",closed_at:null}};
 const view=render(<TaskList items={[joined]} mode="available"/>);expect(screen.getAllByRole("button",{name:"تسليم العمل"})[0]).toBeTruthy();expect(screen.getAllByRole("button",{name:"الانسحاب"})[0].className).toContain("row-action--danger");expect(screen.queryByRole("button",{name:"الانضمام للمهمة"})).toBeNull();expect(screen.queryByText("منشورة")).toBeNull();
 view.rerender(<PrivateQueryProvider actorId="test-actor"><TaskList items={[joined]} mode="mine"/></PrivateQueryProvider>);expect(screen.getAllByRole("button",{name:"تسليم العمل"})[0]).toBeTruthy();expect(screen.getAllByRole("button",{name:"الانسحاب"})[0]).toBeTruthy();
});
it("keeps historical cards readable and clickable without action icons",()=>{render(<TaskList items={[{...task,historical:true}]} mode="mine"/>);expect(screen.getAllByText(/من سجلك السابق/)[0]).toBeTruthy();expect(screen.queryByRole("button",{name:"عرض التفاصيل"})).toBeNull();fireEvent.click(screen.getAllByRole("row",{name:"عرض تفاصيل المهمة"})[0]);expect(navigation.push).not.toHaveBeenCalled();expect(screen.getByRole("dialog")).toBeTruthy();});
