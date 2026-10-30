// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("./task-panel-actions",()=>({loadTaskPanel:vi.fn()}));
vi.mock("./actions",()=>({mutateTask:vi.fn()}));
vi.mock("./task-panel-action",()=>({TaskPanelAction:({open}:{open?:boolean})=>open?<div role="dialog">Task details</div>:null}));
import {TaskCardSurface} from "./task-card";
import {TaskList} from "./task-list";
import type {TaskCard} from "./repository";
afterEach(cleanup);
const task:TaskCard={task:{id:"task",organization_id:"org",committee_id:null,title:"مهمة التصميم",description:"الوصف",default_hours:"2",status_code:"Open",revision:1,starts_at:null,due_at:null,task_template_id:null},org_name:"المجلس",participant:null,historical:false,can_manage:false,latest_submission:null,approved_hours:null};
it("opens the panel from the task rectangle and retains the eye shortcut",()=>{
 render(<TaskList items={[task]} mode="available"/>);
 fireEvent.click(screen.getByRole("button",{name:"عرض المهمة: مهمة التصميم"}));
 expect(screen.getByRole("dialog").textContent).toContain("Task details");
 expect(screen.getByRole("button",{name:"عرض التفاصيل"})).toBeTruthy();
});

it("keeps other actions independent of the rectangle button",()=>{
 render(<TaskCardSurface task="task" title="Design" locale="en" actions={<button>Other action</button>}><h2>Design</h2></TaskCardSurface>);
 fireEvent.click(screen.getByRole("button",{name:"Other action"}));expect(screen.queryByRole("dialog")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"View details"}));expect(screen.getByRole("dialog")).toBeTruthy();
});

it("places the task thumbnail at the start and the status beside the title for leaders too",()=>{
 const {container}=render(<TaskList items={[{...task,can_manage:true,task:{...task.task,status_code:"Draft",image_asset_id:"poster"}}]} mode="all"/>);
 const image=container.querySelector('img')!;expect(image.getAttribute("src")).toBe("/files/poster/preview");expect(image.className).toContain("object-contain");
 const title=screen.getByText("مهمة التصميم");expect(title.closest('[data-slot=card-title]')?.textContent).toContain("مسودة");fireEvent.click(screen.getByRole("button",{name:"عرض المهمة: مهمة التصميم"}));expect(screen.getByRole("dialog")).toBeTruthy();
});
