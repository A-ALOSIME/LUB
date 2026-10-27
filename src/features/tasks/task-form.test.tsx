// @vitest-environment jsdom
import React from "react";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const save=vi.hoisted(()=>vi.fn<(previous:unknown,data:FormData)=>Promise<{error:string}>>(async()=>({error:"تعذّر حفظ التغيير"})));
vi.mock("./actions",()=>({mutateTask:save}));
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
 expect((screen.getByLabelText("الموعد") as HTMLInputElement).value).toContain("12:30");expect((container.querySelector('input[name="due"]') as HTMLInputElement).value).toBe("2026-09-27T12:30:00+03:00");
 expect(container.querySelector('input[type="time"]')).toBeNull();
 expect(screen.queryByRole("button",{name:/اختيار التاريخ/})).toBeNull();
 fireEvent.click(screen.getByLabelText("الموعد"));
 expect(screen.getByText("كل الأوقات بتوقيت الرياض")).toBeTruthy();
 expect(document.querySelector('[data-week-start="sunday"]')).toBeTruthy();
});

it("requires a confirmation and retains the chosen creation intent",async()=>{
 save.mockClear();render(<TaskForm operation="save-task" label="حفظ" creationActions canSaveTemplate><label>العنوان<input name="title" defaultValue="تصميم منشور"/></label></TaskForm>);
 fireEvent.click(screen.getByRole("button",{name:"حفظ كقالب"}));expect(screen.getByRole("alertdialog")).toBeTruthy();expect(save).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"تأكيد"}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());
 expect(save.mock.calls[0][1].get("intent")).toBe("template");expect(save.mock.calls[0][1].get("title")).toBe("تصميم منشور");
});
