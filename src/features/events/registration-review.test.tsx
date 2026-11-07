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
const row:EventRegistrant={id:"registration",event_id:"event",name:"سارة",major:"الحاسب",level:"5",title:"الورشة",created_at:"2026-11-03T12:00:00Z",review_status_code:"Accepted",review_note:"",status_code:"Registered",attendance:"Pending",answers:null,definition:null,canReview:true,canAttend:false,canRemove:true,attendanceOpen:false,history:[{status_code:"Accepted",reason:"تمت المراجعة",created_at:"2026-11-03T12:30:00Z"}]};
beforeEach(()=>{mocks.mutate.mockResolvedValue({success:"تم الحفظ"});});afterEach(()=>{cleanup();vi.clearAllMocks();});
function show(items=[row]){return render(<PrivateQueryProvider actorId="actor"><EventRegistrationReview items={items} locale="ar"/></PrivateQueryProvider>);}
it("opens read-only registration details with the decision timeline",()=>{
 show();const table=within(screen.getByRole("table"));expect(table.getByText("مقبول")).toBeTruthy();fireEvent.click(table.getAllByRole("row")[1]);
 const dialog=within(screen.getByRole("dialog"));
 expect(dialog.getByText("تمت المراجعة")).toBeTruthy();
 expect(dialog.queryByRole("button",{name:"إزالة التسجيل"})).toBeNull();
 expect(table.queryByRole("button",{name:/إثبات مساهمة/})).toBeNull();
});
it("sends attendance separately for an accepted registration after the event",async()=>{
 show([{...row,canAttend:true,attendanceOpen:true}]);
 fireEvent.click(within(screen.getByRole("table")).getByRole("button",{name:"مراجعة الحضور"}));
 const dialog=within(screen.getByRole("dialog"));
 fireEvent.click(dialog.getByRole("combobox"));
 const option=await screen.findByRole("option",{name:"حاضر"});
 fireEvent.pointerDown(option);
 fireEvent.click(option);
 fireEvent.submit(dialog.getByRole("button",{name:"حفظ الحضور"}).closest("form")!);
 await waitFor(()=>expect(mocks.mutate).toHaveBeenCalledOnce());
 const payload=mocks.mutate.mock.calls[0][1] as FormData;
 expect(payload.get("operation")).toBe("attendance");
 expect(payload.get("status")).toBe("Present");
 expect(payload.get("registration")).toBe("registration");
});
it("disables attendance for pending registrations while keeping approval available",()=>{
 show([{...row,review_status_code:"Pending",canAttend:true,attendanceOpen:true}]);
 const table=within(screen.getByRole("table"));
 expect(table.getByRole("button",{name:"مراجعة الحضور"}).hasAttribute("disabled")).toBe(true);
 expect(table.getByRole("button",{name:"قبول"}).hasAttribute("disabled")).toBe(false);
});
