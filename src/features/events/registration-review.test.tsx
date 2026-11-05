// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({mutate:vi.fn()}));
vi.mock("./actions",()=>({mutateEvent:mocks.mutate}));
vi.mock("@/features/forms/actions",()=>({mutateWorkflow:vi.fn()}));
vi.mock("@/features/talent/activity-skill-actions",()=>({searchActivitySkills:vi.fn().mockResolvedValue([])}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn(),prefetch:vi.fn()})}));
import {PrivateQueryProvider} from "@/components/private-query-provider";
import {EventRegistrationReview} from "./registration-review";
import type {EventRegistrant} from "./review-repository";
const row:EventRegistrant={id:"registration",event_id:"event",name:"سارة",major:"الحاسب",level:"5",title:"الورشة",created_at:"2026-11-03T12:00:00Z",review_status_code:"Accepted",review_note:"",status_code:"Registered",attendance:"Pending",answers:null,definition:null,canReview:true,canAttend:false,canContribute:true,attendanceOpen:false,history:[],has_contribution:true,contributions:[{kind:"Presenter",title:"شرح الورشة"}]};
beforeEach(()=>{mocks.mutate.mockResolvedValue({success:"تم الحفظ"});});afterEach(()=>{cleanup();vi.clearAllMocks();});
function show(items=[row]){return render(<PrivateQueryProvider actorId="actor"><EventRegistrationReview items={items} locale="ar"/></PrivateQueryProvider>);}
it("opens registrant details in a dialog, shows recorded contributions and exposes direct contribution icons without a select",async()=>{
 show();const table=within(screen.getByRole("table"));expect(table.getByText("مرصودة")).toBeTruthy();fireEvent.click(table.getAllByRole("row")[1]);const dialog=within(screen.getByRole("dialog"));expect(dialog.getByText("مقدم · شرح الورشة")).toBeTruthy();expect(screen.getByRole("dialog").getAttribute("data-slot")).toBe("dialog-content");fireEvent.click(dialog.getByRole("button",{name:"إغلاق"}));
 for(const name of ["مقدم","مدرب","مساهم أساسي"])expect(table.getByRole("button",{name:`إثبات مساهمة: ${name}`}).hasAttribute("disabled")).toBe(true);
});
it("records a contribution only for an accepted registration without previous evidence",async()=>{
 show([{...row,has_contribution:false,contributions:[]}]);const table=within(screen.getByRole("table")); fireEvent.click(table.getByRole("button",{name:"إثبات مساهمة: مدرب"}));const formDialog=within(screen.getByRole("dialog"));expect(formDialog.queryByRole("combobox")).toBeNull();fireEvent.change(formDialog.getByRole("textbox",{name:/وصف المساهمة/}),{target:{value:"تدريب عملي"}});fireEvent.submit(formDialog.getByRole("button",{name:"إثبات المساهمة"}).closest("form")!);await waitFor(()=>expect(mocks.mutate).toHaveBeenCalledOnce());expect(mocks.mutate.mock.calls[0][1].get("kind")).toBe("Trainer");expect(mocks.mutate.mock.calls[0][1].get("registration")).toBe("registration");await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
});
it("keeps contribution actions disabled with an explanatory tooltip before acceptance",()=>{
 show([{...row,review_status_code:"Pending",has_contribution:false,contributions:[]}]);const table=within(screen.getByRole("table"));for(const name of ["مقدم","مدرب","مساهم أساسي"])expect(table.getByRole("button",{name:`إثبات مساهمة: ${name}`}).hasAttribute("disabled")).toBe(true);expect(table.getByRole("button",{name:"قبول"}).hasAttribute("disabled")).toBe(false);
});
