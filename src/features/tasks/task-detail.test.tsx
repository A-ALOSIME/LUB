// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,within} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn(),prefetch:vi.fn()})}));
vi.mock("./page-forms",()=>({TaskPageSubmission:()=> <label>وصف التسليم<textarea/></label>,TaskPageForm:({label}:{label:string})=><button>{label}</button>}));
vi.mock("./task-form",()=>({TaskForm:({label,children}:{label:string;children:React.ReactNode})=><form>{children}<button>{label}</button></form>}));
vi.mock("@/features/hours/actions",()=>({mutateHours:vi.fn()}));
import {TaskDetailView} from "./task-detail";
import type {TaskDetail,Submission} from "./repository";
const d:TaskDetail={asOf:"2026-10-25T12:00:00Z",task:{id:"task",organization_id:"org",committee_id:null,title:"تصميم الملصق",description:"وصف المهمة",starts_at:null,due_at:null,default_hours:"2",status_code:"Open",revision:1,task_template_id:null},canManage:false,current:true,own:{id:"participation",user_id:"student",status_code:"In_Progress",approved_hours_override:null,joined_at:"2026-10-20",closed_at:null},selected:null,lastRevision:0,team:[],submissions:[],history:[],linkedEvent:null,eventChoices:[]};
const submission:Submission={id:"submission",name:"سارة",major:"الحاسب",level:"5",revision_number:1,message:"السطر الأول\nالسطر الثاني",status_code:"Submitted",submitted_at:"2026-10-24T10:00:00Z",review_note:null,reviewed_at:null,task_revision_id:"revision",task_revision_number:7,task_snapshot:d.task,assets:[{id:"asset",name:"%D9%85%D9%84%D9%81%20%D8%B9%D9%85%D9%84.pdf"}]};
afterEach(()=>{cleanup();window.history.replaceState(null,"","/");});
function show(detail:TaskDetail=d){return render(<TaskDetailView detail={detail} page={0} teamPage={0} participant={null}/>);}
it("shows a full-width task and immediately visible submission form without the removed participation/settings/actions sections",()=>{
 show({...d,linkedEvent:{id:"event",title:"فعالية",status:"Published"},summary:{participants:4,submitted:2},history:[{id:"revision",revision_number:1,snapshot_json:d.task,changed_at:"2026-10-22"}]});
 expect(screen.getByRole("heading",{level:1}).textContent).toBe("تصميم الملصق");expect(screen.getByRole("textbox",{name:"وصف التسليم"})).toBeTruthy();expect(screen.queryByRole("button",{name:"إضافة تسليم"})).toBeNull();
 for(const label of ["مشاركتي","الفعالية المرتبطة","نسبة التسليم","إجراءات المهمة","سجل نسخ المهمة"])expect(screen.queryByText(label)).toBeNull();expect(screen.queryByRole("button",{name:"بدء العمل"})).toBeNull();expect(document.querySelector("aside")).toBeNull();
});
it("shows the uncropped poster before the heading and derives deadline progress from the server clock",()=>{
 const {container}=show({...d,task:{...d.task,image_asset_id:"poster",starts_at:"2026-10-24T12:00:00Z",due_at:"2026-10-26T12:00:00Z"}});const image=screen.getByRole("img");expect(container.firstElementChild?.firstElementChild).toBe(image);expect(image.className).toContain("h-auto");expect(image.className).not.toMatch(/object-cover|max-h|aspect/);expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
});
it("offers joining again only for an own withdrawal and preserves final closures",()=>{
 const view=show({...d,own:{...d.own!,status_code:"Closed",withdrawn_at:"2026-10-25",closed_at:"2026-10-25"}});expect(screen.getByRole("button",{name:"الانضمام للمهمة"})).toBeTruthy();view.rerender(<TaskDetailView detail={{...d,own:{...d.own!,status_code:"Closed",withdrawn_at:null,closed_at:"2026-10-25"}}} page={0} teamPage={0} participant={null}/>);expect(screen.queryByRole("button",{name:"الانضمام للمهمة"})).toBeNull();
});
it("keeps student submission details owner-visible with original file names and without task-version metadata",()=>{
 show({...d,submissions:[submission]});fireEvent.click(screen.getByRole("tab",{name:"تسليماتي"}));const table=within(screen.getByRole("table"));fireEvent.click(table.getAllByRole("row")[1]);const dialog=within(screen.getByRole("dialog"));expect(dialog.getByText("السطر الأول السطر الثاني")).toBeTruthy();expect(dialog.getByRole("link",{name:"ملف عمل.pdf"}).getAttribute("href")).toBe("/files/asset");expect(dialog.queryByText(/نسخة المهمة/)).toBeNull();expect(dialog.queryByText("وصف المهمة وقت التسليم")).toBeNull();expect(table.queryByRole("button",{name:"اعتماد"})).toBeNull();
});
it("renders participants and all submissions as tables, with decision icons and no hours or decision select in the review dialog",()=>{
 show({...d,canManage:true,submissions:[submission],team:[{id:"p",name:"سارة",major:"الحاسب",level:"5",joinedAt:"2026-10-20",status:"Submitted"}]});expect(screen.getByRole("tab",{name:"المنضمون للمهمة"})).toBeTruthy();expect(screen.queryByText("الفعالية المرتبطة")).toBeNull();expect(screen.queryByLabelText("إجراءات المهمة")).toBeNull();
 fireEvent.click(screen.getByRole("tab",{name:"كل التسليمات"}));const table=within(screen.getByRole("table"));expect(table.getAllByRole("columnheader").map(cell=>cell.textContent)).toEqual(["","الطالب","وقت التسليم","الحالة","الإجراءات"]);expect(table.getByRole("button",{name:"طلب تعديل وإعادة تسليم"})).toBeTruthy();fireEvent.click(table.getByRole("button",{name:"رفض"}));const dialog=within(screen.getByRole("alertdialog"));expect(dialog.getByRole("textbox",{name:/الملاحظة/})).toBeTruthy();expect(dialog.queryByRole("combobox")).toBeNull();expect(dialog.queryByRole("spinbutton")).toBeNull();
});
it("keeps management version history collapsed and out of the student presentation",()=>{
 const {container}=show({...d,canManage:true,history:[{id:"revision",revision_number:7,snapshot_json:{...d.task,description:"وصف محفوظ"},changed_at:"2026-10-22"}]});expect(container.textContent).not.toContain("وصف محفوظ");fireEvent.click(screen.getByRole("button",{name:"سجل نسخ المهمة"}));expect(screen.getByText("وصف محفوظ")).toBeTruthy();
});
