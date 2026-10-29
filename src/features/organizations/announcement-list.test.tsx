// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const mutation=vi.hoisted(()=>vi.fn<(previous:unknown,form:FormData)=>Promise<{success:string}>>(async()=>({success:"تم الحفظ"})));
vi.mock("./actions",()=>({mutateOrganization:mutation}));
import {AnnouncementList} from "./announcement-list";
const items=[{id:"first",title:"الإعلان المنشور",body:"تفاصيل الإعلان",published:true,pinned:true,createdAt:"2026-10-27T12:00:00Z"},{id:"second",title:"مسودة جديدة",body:"محتوى المسودة",published:false,pinned:false,createdAt:"2026-10-27T12:00:00Z"}];
beforeEach(()=>mutation.mockClear());afterEach(cleanup);
it("filters drafts without claiming the organization has no announcements",()=>{
 render(<AnnouncementList org="org" items={items}/>);fireEvent.click(screen.getByRole("tab",{name:/مسودة\s*١/}));
 expect(screen.getByRole("heading",{name:"مسودة جديدة"})).toBeTruthy();expect(screen.queryByRole("heading",{name:"الإعلان المنشور"})).toBeNull();
 fireEvent.click(screen.getByRole("tab",{name:/مؤرشف\s*٠/}));expect(screen.getByRole("status").textContent).toContain("بهذه الحالة");expect(screen.queryByText("لا توجد إعلانات بعد")).toBeNull();
});
it("requires named confirmation before archiving",async()=>{
 render(<AnnouncementList org="org" items={[items[0]]}/>);fireEvent.click(screen.getByRole("button",{name:"أرشفة الإعلان"}));
 expect(screen.getByRole("alertdialog").textContent).toContain("الإعلان المنشور");expect(mutation).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("alertdialog").querySelector('button[data-slot="button"]')!);await waitFor(()=>expect(mutation).toHaveBeenCalledOnce());expect(mutation.mock.calls[0][1].get("operation")).toBe("archive-announcement");expect(mutation.mock.calls[0][1].get("confirmed")).toBe("on");
});
it("offers distinct publish and draft submissions in the wide editor",async()=>{
 render(<AnnouncementList org="org" items={[]}/>);fireEvent.click(screen.getByRole("button",{name:"إعلان جديد"}));
 fireEvent.change(screen.getByRole("textbox",{name:/العنوان/}),{target:{value:"إعلان تجريبي"}});fireEvent.change(screen.getByRole("textbox",{name:/النص/}),{target:{value:"محتوى تجريبي"}});
 fireEvent.click(screen.getByRole("button",{name:"حفظ كمسودة"}));await waitFor(()=>expect(mutation).toHaveBeenCalledOnce());expect(mutation.mock.calls[0][1].get("intent")).toBe("draft");
});
