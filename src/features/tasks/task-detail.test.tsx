// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
vi.mock("./task-composer",()=>({TaskComposer:()=>null}));
vi.mock("./task-decision",()=>({TaskDecision:({kind}:{kind:string})=><button>{kind}</button>}));
vi.mock("./task-form",()=>({TaskForm:({label}:{label:string})=><button>{label}</button>}));
vi.mock("./submission-form",()=>({SubmissionForm:()=> <label>وصف التسليم<textarea/></label>}));
vi.mock("./event-link",()=>({TaskEventLink:()=> <div>إعدادات ارتباط الفعالية</div>}));
import {TaskDetailView} from "./task-detail";
import type {TaskDetail} from "./repository";
afterEach(cleanup);
const d:TaskDetail={task:{id:"task",organization_id:"org",committee_id:null,title:"تصميم الملصق",description:"وصف المهمة",starts_at:null,due_at:null,default_hours:"2",status_code:"Open",revision:1,task_template_id:null},canManage:false,current:true,own:{id:"participation",user_id:"student",status_code:"Joined",approved_hours_override:null,joined_at:"2026-10-20",closed_at:null},selected:null,lastRevision:0,team:[],submissions:[],history:[],linkedEvent:null,eventChoices:[]};
it("keeps the student panel in one column with participation then submissions then team, without management history or settings",()=>{
 render(<TaskDetailView detail={d} page={0} teamPage={0} participant={null}/>);
 expect(screen.queryByText("سجل نسخ المهمة")).toBeNull();expect(screen.queryByText("إعدادات ارتباط الفعالية")).toBeNull();expect(screen.queryByText("إجراءات المهمة")).toBeNull();
 const headings=screen.getAllByRole("heading").map(h=>h.textContent);
 expect(headings.indexOf("مشاركتي")).toBeLessThan(headings.indexOf("تسليماتي"));expect(headings.indexOf("تسليماتي")).toBeLessThan(headings.indexOf("فريق المهمة"));
 expect(screen.getByText("لا توجد تسليمات.").parentElement?.textContent).toContain("إضافة تسليم");fireEvent.click(screen.getByRole("button",{name:"إضافة تسليم"}));expect(screen.getByRole("textbox",{name:"وصف التسليم"})).toBeTruthy();
});
it("retains manager history, event controls and task actions",()=>{render(<TaskDetailView detail={{...d,canManage:true}} page={0} teamPage={0} participant={null}/>);expect(screen.getByText("سجل نسخ المهمة")).toBeTruthy();expect(screen.getByText("إعدادات ارتباط الفعالية")).toBeTruthy();expect(screen.getByText("إجراءات المهمة")).toBeTruthy();});
