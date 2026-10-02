// @vitest-environment jsdom
import React from "react";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("./actions",()=>({mutateTask:async()=>({error:"تعذّر حفظ التغيير"})}));
import {TaskForm} from "./task-form";
import {DateInput} from "@/features/forms/date-input";
afterEach(cleanup);
it("retains typed submission text and focuses the failure message",async()=>{
 render(<TaskForm operation="submit" label="إرسال"><label>المخرج<textarea name="message"/></label></TaskForm>);
 fireEvent.change(screen.getByLabelText("المخرج"),{target:{value:"تسليمي المحفوظ"}});fireEvent.submit(screen.getByRole("button",{name:"إرسال"}).closest("form")!);
 await waitFor(()=>expect(screen.getByRole("alert")).toBe(document.activeElement));expect((screen.getByLabelText("المخرج") as HTMLTextAreaElement).value).toBe("تسليمي المحفوظ");
});
it("initializes editing dates in Riyadh and submits the explicit timezone",()=>{
 const {container}=render(<DateInput name="due" label="الموعد" value="2026-09-27T09:30:00Z"/>);
 expect((screen.getByLabelText("الموعد (توقيت الرياض)") as HTMLInputElement).value).toBe("2026-09-27T12:30");expect((container.querySelector('input[name="due"]') as HTMLInputElement).value).toBe("2026-09-27T12:30:00+03:00");
});
