// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor,within} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const save=vi.hoisted(()=>vi.fn(async()=>({error:"internal"})));
vi.mock("./actions",()=>({mutateTask:save}));
import {SubmissionForm} from "./submission-form";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("shows a decoded filename and removes only the selected attachment through its small X action",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({id:"asset",name:"%D9%85%D9%84%D9%81.pdf"})})));
 const {container}=render(<SubmissionForm participant="p" revision={1} lastRevision={0}/>);
 fireEvent.change(screen.getByLabelText("مرفق التسليم"),{target:{files:[new File(["work"],"ملف.pdf",{type:"application/pdf"})]}});
 expect(await screen.findByRole("link",{name:"ملف.pdf"})).toBeTruthy();expect(container.querySelector('input[name="asset"]')).toBeTruthy();
 const remove=screen.getByRole("button",{name:"إزالة المرفق"});expect(remove.querySelector("svg")).toBeTruthy();fireEvent.click(remove);expect(screen.queryByRole("link",{name:"ملف.pdf"})).toBeNull();expect(container.querySelector('input[name="asset"]')).toBeNull();
});
it("keeps upload failures in the same warning area instead of duplicating a previous submission failure",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:503,json:async()=>({error:"upload_unavailable"})})));
 render(<SubmissionForm participant="p" revision={1} lastRevision={0}/>);
 fireEvent.submit(screen.getByRole("button",{name:"إرسال نسخة التسليم"}).closest("form")!);await screen.findByRole("alert");
 fireEvent.change(screen.getByLabelText("مرفق التسليم"),{target:{files:[new File(["work"],"work.pdf",{type:"application/pdf"})]}});
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("تعذّر الإرسال"));expect(screen.getAllByRole("alert")).toHaveLength(1);
});

it("retains both the original file and description after network failure, then retries the selected file",async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ok:true,status:200,json:async()=>({id:"asset"})});vi.stubGlobal("fetch",fetch);
 render(<SubmissionForm participant="p" revision={1} lastRevision={0}/>);fireEvent.change(screen.getByLabelText("وصف المخرج"),{target:{value:"الوصف المحفوظ"}});
 const file=new File(["work"],"تسليمي.pdf",{type:"application/pdf"});fireEvent.change(screen.getByLabelText("مرفق التسليم"),{target:{files:[file]}});await screen.findByRole("alert");expect(within(screen.getByRole("list")).getByText("تسليمي.pdf")).toBeTruthy();expect((screen.getByLabelText("وصف المخرج") as HTMLTextAreaElement).value).toBe("الوصف المحفوظ");
 fireEvent.submit(screen.getByRole("button",{name:"إرسال نسخة التسليم"}).closest("form")!);await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));const retried=fetch.mock.calls[1][1].body as FormData;expect((retried.get("file") as File).size).toBe(file.size);expect((retried.get("file") as File).name).toMatch(/^[0-9a-f-]{36}\.pdf$/);expect(retried.get("displayName")).toBe(file.name);await waitFor(()=>expect(screen.getByRole("link",{name:"تسليمي.pdf"})).toBeTruthy());expect((screen.getByLabelText("وصف المخرج") as HTMLTextAreaElement).value).toBe("الوصف المحفوظ");
});
it.each([["text/plain",10,"نوع الملف غير مدعوم"],["application/pdf",5*1024*1024+1,"5 ميجابايت"]])("explains invalid attachments without removing the original selection",async(type,size,message)=>{
 const fetch=vi.fn();vi.stubGlobal("fetch",fetch);const file=new File([new Uint8Array(Number(size))],"file.bin",{type:String(type)});render(<SubmissionForm participant="p" revision={1} lastRevision={0}/>);fireEvent.change(screen.getByLabelText("مرفق التسليم"),{target:{files:[file]}});expect((await screen.findByRole("alert")).textContent).toContain(message);expect(within(screen.getByRole("list")).getByText("file.bin")).toBeTruthy();expect(fetch).not.toHaveBeenCalled();
});
