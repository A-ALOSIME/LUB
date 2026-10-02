// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("./actions",()=>({mutateHours:async()=>({error:"لم يُحفظ القرار"})}));
import {HoursForm} from "./form";
afterEach(cleanup);
it("preserves the correction reason and focuses the failure instead of losing the entered work",async()=>{
 render(<HoursForm operation="review" fields={{record:"00000000-0000-4000-8000-000000000001",status:"Voided"}} label="حفظ"><label>سبب التصحيح<textarea name="note"/></label></HoursForm>);
 fireEvent.change(screen.getByLabelText("سبب التصحيح"),{target:{value:"تصحيح الساعات المسجلة"}});fireEvent.click(screen.getByRole("button",{name:"حفظ"}));
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toBe("لم يُحفظ القرار"));expect((screen.getByLabelText("سبب التصحيح") as HTMLTextAreaElement).value).toBe("تصحيح الساعات المسجلة");await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole("alert")));
});
