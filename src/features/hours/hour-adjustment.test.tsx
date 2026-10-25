// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const mutate=vi.hoisted(()=>vi.fn());
vi.mock("./actions",()=>({mutateHours:mutate}));
import {HourAdjustment} from "./hour-adjustment";
import type {HourRecord} from "./repository";
afterEach(()=>{cleanup();vi.clearAllMocks();});
const record={id:"record",hours:"10"} as HourRecord;
it("does not preview or save empty/zero/excess decreases, then submits a valid signed adjustment",async()=>{
 mutate.mockResolvedValue({success:"تم الحفظ"});const done=vi.fn();
 render(<HourAdjustment record={record} locale="ar" onSuccess={done}/>);
 const save=screen.getByRole("button",{name:"حفظ التعديل"});
 expect(save.hasAttribute("disabled")).toBe(true);expect(screen.queryByRole("status")).toBeNull();
 fireEvent.click(screen.getByText("نقص"));
 fireEvent.change(screen.getByLabelText("عدد الساعات"),{target:{value:"11"}});
 expect(screen.getByRole("alert").textContent).toContain("النزول عن صفر");expect(save.hasAttribute("disabled")).toBe(true);
 fireEvent.change(screen.getByLabelText("عدد الساعات"),{target:{value:"2"}});
 expect(screen.getByRole("status").textContent).toContain("10 ← 8");expect(save.hasAttribute("disabled")).toBe(false);
 fireEvent.change(screen.getByLabelText(/سبب التعديل/),{target:{value:"تصحيح"}});
 fireEvent.click(save);await waitFor(()=>expect(mutate).toHaveBeenCalled());
 const payload=mutate.mock.calls[0][1] as FormData;expect(payload.get("delta")).toBe("-2");expect(payload.get("expected")).toBe("10");expect(payload.get("note")).toBe("تصحيح");await waitFor(()=>expect(done).toHaveBeenCalled());
});
