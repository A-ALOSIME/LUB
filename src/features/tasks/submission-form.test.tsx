// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("./actions",()=>({mutateTask:vi.fn(async()=>({error:"internal"}))}));
import {SubmissionForm} from "./submission-form";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("shows a decoded filename and removes only the selected attachment through its small X action",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({id:"asset",name:"%D9%85%D9%84%D9%81.pdf"})})));
 const {container}=render(<SubmissionForm participant="p" revision={1} lastRevision={0}/>);
 fireEvent.change(screen.getByLabelText("مرفق التسليم"),{target:{files:[new File(["work"],"ملف.pdf",{type:"application/pdf"})]}});
 expect(await screen.findByRole("link",{name:"ملف.pdf"})).toBeTruthy();expect(container.querySelector('input[name="asset"]')).toBeTruthy();
 const remove=screen.getByRole("button",{name:"إزالة المرفق: ملف.pdf"});expect(remove.querySelector("svg")).toBeTruthy();fireEvent.click(remove);expect(screen.queryByRole("link",{name:"ملف.pdf"})).toBeNull();expect(container.querySelector('input[name="asset"]')).toBeNull();
});
it("keeps upload failures in the same warning area instead of duplicating a previous submission failure",async()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:503,json:async()=>({error:"upload_unavailable"})})));
 render(<SubmissionForm participant="p" revision={1} lastRevision={0}/>);
 fireEvent.submit(screen.getByRole("button",{name:"إرسال نسخة التسليم"}).closest("form")!);await screen.findByRole("alert");
 fireEvent.change(screen.getByLabelText("مرفق التسليم"),{target:{files:[new File(["work"],"work.pdf",{type:"application/pdf"})]}});
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("قائد الجهة"));expect(screen.getAllByRole("alert")).toHaveLength(1);
});
