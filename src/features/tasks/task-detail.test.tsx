// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,within} from "@testing-library/react";
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
 render(<TaskDetailView detail={{...d,summary:{participants:7,submitted:4},linkedEvent:{id:"event",title:"فعالية مرتبطة",status:"Published"},history:[{id:"revision",revision_number:1,snapshot_json:d.task,changed_at:"2026-10-12"}]}} page={0} teamPage={0} participant={null}/>);
 expect(screen.queryByText("سجل نسخ المهمة")).toBeNull();expect(screen.queryByText("إعدادات ارتباط الفعالية")).toBeNull();expect(screen.queryByText("إجراءات المهمة")).toBeNull();
 const headings=screen.getAllByRole("heading").map(h=>h.textContent);
 expect(headings.indexOf("مشاركتي")).toBeLessThan(headings.indexOf("تسليماتي"));expect(headings.indexOf("تسليماتي")).toBeLessThan(headings.indexOf("فريق المهمة"));
 expect(screen.queryByRole("textbox",{name:"وصف التسليم"})).toBeNull();expect(screen.getByRole("button",{name:"إضافة تسليم"}).compareDocumentPosition(screen.getByText("لا توجد تسليمات."))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"إضافة تسليم"}));expect(screen.getByRole("textbox",{name:"وصف التسليم"})).toBeTruthy();
});
it("retains manager history, event controls and task actions",()=>{render(<TaskDetailView detail={{...d,canManage:true}} page={0} teamPage={0} participant={null}/>);expect(screen.getByText("سجل نسخ المهمة")).toBeTruthy();expect(screen.getByText("إعدادات ارتباط الفعالية")).toBeTruthy();expect(screen.getByLabelText("إجراءات المهمة")).toBeTruthy();expect(document.querySelector("aside")).toBeNull();});

it("hides task version metadata from students even on past submissions and displays participation status only once",()=>{
 const submission={id:"submission",revision_number:1,message:"Work",status_code:"Submitted",submitted_at:"2026-10-30",review_note:null,reviewed_at:null,task_revision_id:"revision",task_revision_number:7,task_snapshot:d.task,assets:[{id:"asset",name:"%D9%85%D9%84%D9%81%20%D8%B9%D9%85%D9%84.pdf"}]};
 render(<TaskDetailView detail={{...d,submissions:[submission]}} page={0} teamPage={0} participant={null}/>);
 expect(screen.queryByText(/نسخة المهمة/)).toBeNull();expect(screen.queryByText("وصف المهمة وقت التسليم")).toBeNull();expect(screen.queryByRole("button",{name:"تفاصيل تقنية"})).toBeNull();expect(screen.getAllByText(/حالة المشاركة/)).toHaveLength(1);expect(screen.getByRole("link",{name:"ملف عمل.pdf"}).getAttribute("href")).toBe("/files/asset");expect(screen.queryByRole("button",{name:"حفظ قرار المراجعة"})).toBeNull();
});
it("places manager actions, statistics and participants before all submissions in a full-width column",()=>{
 render(<TaskDetailView detail={{...d,canManage:true,summary:{participants:2,submitted:1}}} page={0} teamPage={0} participant={null}/>);
 const actions=screen.getByLabelText("إجراءات المهمة"),stats=screen.getByText("نسبة التسليم");expect(actions.compareDocumentPosition(stats)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 const headings=screen.getAllByRole("heading").map(h=>h.textContent);expect(headings.indexOf("المطلوب")).toBeLessThan(headings.indexOf("المنضمون للمهمة"));expect(headings.indexOf("المنضمون للمهمة")).toBeLessThan(headings.indexOf("كل التسليمات"));expect(headings.indexOf("كل التسليمات")).toBeLessThan(headings.indexOf("فريق المهمة"));expect(document.querySelector("aside")).toBeNull();
});

it("starts with the uncropped poster, then the title, and keeps the add action in the submissions card header",()=>{
 const submission={id:"submission",revision_number:1,message:"المخرج السابق",status_code:"Rejected",submitted_at:"2026-10-30",review_note:"عدّل",reviewed_at:"2026-10-30",task_revision_id:"revision",task_revision_number:1,task_snapshot:d.task,assets:[]};
 render(<TaskDetailView detail={{...d,task:{...d.task,image_asset_id:"poster"},own:{...d.own!,status_code:"In_Progress"},submissions:[submission]}} page={0} teamPage={0} participant={null}/>);
 const poster=screen.getByRole("img"),heading=screen.getByRole("heading",{level:1});
 expect(poster.parentElement?.firstElementChild).toBe(poster);expect(poster.className).toContain("h-auto");expect(poster.className).not.toMatch(/max-h|object-cover|aspect/);expect(poster.nextElementSibling?.contains(heading)).toBe(true);
 expect(screen.getByRole("button",{name:"إضافة تسليم"}).compareDocumentPosition(screen.getByText("المخرج السابق"))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(screen.queryByRole("textbox",{name:"وصف التسليم"})).toBeNull();
 expect(screen.getByText("قيد العمل").className).toContain("organization-status-badge--positive");
});

it("keeps submission rows in a single flat card with status badges and file icons",()=>{
 const submission={id:"first",revision_number:1,message:"السطر الأول\nالسطر الثاني",status_code:"Submitted",submitted_at:"2026-10-30T10:00:00Z",review_note:null,reviewed_at:null,task_revision_id:"r",task_revision_number:7,task_snapshot:d.task,assets:[{id:"asset",name:"عمل.pdf"}]};
 const {container}=render(<TaskDetailView detail={{...d,submissions:[submission,{...submission,id:"second",revision_number:2,status_code:"Approved"},{...submission,id:"third",revision_number:3,status_code:"Rejected"}]}} page={0} teamPage={0} participant={null}/>);
 const section=container.querySelector("#submissions")!;expect(section.querySelectorAll('[data-slot="card"]')).toHaveLength(1);expect(section.querySelectorAll("article")).toHaveLength(3);expect(section.querySelectorAll('[data-slot="separator"]')).toHaveLength(2);expect(section.querySelector("article.panel")).toBeNull();
 expect(within(section as HTMLElement).getByText("قيد المراجعة").className).toContain("organization-status-badge--warning");expect(within(section as HTMLElement).getByText("معتمد").className).toContain("organization-status-badge--positive");expect(within(section as HTMLElement).getByText("مرفوض").className).toContain("organization-status-badge--negative");
 expect(within(section as HTMLElement).getAllByRole("link",{name:"عمل.pdf"})[0].querySelector("svg")).toBeTruthy();expect(section.querySelector("article p[dir=auto]")?.textContent).toBe(submission.message);expect(within(section as HTMLElement).queryByText("وصف المهمة وقت التسليم")).toBeNull();
});
it("keeps pinned revision metadata collapsed for reviewers",()=>{
 const submission={id:"submission",revision_number:1,message:"المخرج",status_code:"Submitted",submitted_at:"2026-10-30T10:00:00Z",review_note:null,reviewed_at:null,task_revision_id:"r",task_revision_number:7,task_snapshot:d.task,assets:[]};
 render(<TaskDetailView detail={{...d,canManage:true,submissions:[submission]}} page={0} teamPage={0} participant={null}/>);const row=screen.getByRole("article");expect(within(row).queryByText(/نسخة المهمة/)).toBeNull();expect(within(row).getByRole("button",{name:"حفظ قرار المراجعة"})).toBeTruthy();fireEvent.click(within(row).getByRole("button",{name:"تفاصيل تقنية"}));expect(within(row).getByText(/نسخة المهمة/).textContent).toContain("7");
});
