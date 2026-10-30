// @vitest-environment jsdom
import React from "react";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const save=vi.hoisted(()=>vi.fn<(previous:unknown,data:FormData)=>Promise<{error?:string;success?:string}>>(async()=>({error:"تعذّر حفظ التغيير"})));
vi.mock("./actions",()=>({mutateTask:save}));
import {TaskForm} from "./task-form";
import {ManagementActionProvider} from "@/components/management-action-sheet";
import {toast} from "@/components/ui/toast";
import {DateInput} from "@/features/forms/date-input";
afterEach(()=>{cleanup();vi.restoreAllMocks();save.mockReset().mockResolvedValue({error:"تعذّر حفظ التغيير"});});
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

it("shows joined status optimistically, keeps the panel open, and refreshes the confirmed participation",async()=>{
 let finish!:(state:{success:string})=>void;save.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const close=vi.fn(),refresh=vi.fn();
 render(<ManagementActionProvider locale="en" close={close} inlineForms refresh={refresh}><TaskForm operation="join" fields={{task:"task"}} label="Join task" locale="en"/></ManagementActionProvider>);
 fireEvent.submit(screen.getByRole("button",{name:"Join task"}).closest("form")!);
 await waitFor(()=>expect(save).toHaveBeenCalledOnce());expect(screen.getByRole("status").textContent).toBe("Status: Joined");expect((screen.getByRole("button",{name:"Start work"}) as HTMLButtonElement).disabled).toBe(true);expect(close).not.toHaveBeenCalled();
 finish({success:"تم حفظ التغيير."});await waitFor(()=>expect(refresh).toHaveBeenCalledOnce());expect(close).not.toHaveBeenCalled();expect(screen.queryByRole("button",{name:"Join task"})).toBeNull();
});
it("rolls an unsuccessful optimistic join back to the join action",async()=>{
 const close=vi.fn();render(<ManagementActionProvider locale="en" close={close} inlineForms><TaskForm operation="join" label="Join task" locale="en"/></ManagementActionProvider>);
 fireEvent.submit(screen.getByRole("button",{name:"Join task"}).closest("form")!);await screen.findByRole("alert");expect(screen.getByRole("button",{name:"Join task"})).toBeTruthy();expect(screen.queryByText("Status: Joined")).toBeNull();expect(close).not.toHaveBeenCalled();
});
it("shows one plain submission failure inside the form without an error toast",async()=>{
 const add=vi.spyOn(toast,"add");render(<TaskForm operation="submit" label="Send" locale="en"><textarea name="message" aria-label="Submission"/></TaskForm>);
 fireEvent.submit(screen.getByRole("button",{name:"Send"}).closest("form")!);expect((await screen.findAllByRole("alert"))).toHaveLength(1);expect(screen.getByRole("alert").textContent).toBe("Could not send your submission. Check the details and try again.");expect(add).not.toHaveBeenCalled();
});
