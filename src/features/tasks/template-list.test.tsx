// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()}),usePathname:()=>"/manage/organizations/org/tasks",useSearchParams:()=>new URLSearchParams()}));
vi.mock("./actions",()=>({mutateTask:vi.fn().mockResolvedValue({success:"تم الحفظ"})}));
vi.mock("@/features/talent/activity-skill-actions",()=>({searchActivitySkills:vi.fn().mockResolvedValue([])}));
vi.mock("@/features/events/event-poster-field",()=>({EntityImageField:({initialPreview,purpose}:{initialPreview?:string;purpose:string})=><div data-testid="image-field" data-src={initialPreview} data-purpose={purpose}/>}));
import {TaskTemplateList} from "./template-list";
import type {TaskWorkspace} from "./repository";
const workspace:TaskWorkspace={name:"الجهة",scopes:[{id:null,name:"الجهة بالكامل",tasks:true,templates:true}],templates:[{id:"one",organization_id:"org",committee_id:null,name:"تصميم الهوية",description_template:"وصف المخرج",default_hours:"3",is_active:true,revision:2,image_asset_id:"image"},{id:"two",organization_id:"org",committee_id:null,name:"قالب متوقف",description_template:"وصف ثان",default_hours:"2",is_active:false,revision:1}]};
afterEach(()=>{cleanup();window.history.replaceState(null,"","/");});
it("uses the shared table and opens the same populated editor from the row or edit icon",()=>{
 render(<TaskTemplateList org="org" workspace={workspace} locale="ar"/>);
 const table=within(screen.getByRole("table"));expect(table.getAllByRole("row")).toHaveLength(3);expect(table.getAllByLabelText("إنشاء مهمة من القالب")[1].getAttribute("aria-disabled")==="true").toBeTruthy();
 fireEvent.click(table.getAllByRole("row")[1]);const dialog=within(screen.getByRole("dialog"));expect((dialog.getByRole("textbox",{name:/العنوان/}) as HTMLInputElement).value).toBe("تصميم الهوية");expect(dialog.getByTestId("image-field").getAttribute("data-src")).toBe("/files/image/preview");expect(dialog.getByTestId("image-field").getAttribute("data-purpose")).toBe("template-image");
 fireEvent.click(dialog.getByRole("button",{name:"إلغاء"}));fireEvent.click(table.getAllByRole("button",{name:"تعديل القالب"})[0]);expect(screen.getByRole("dialog")).toBeTruthy();
});
it("preserves URL-backed template filtering, pagination and sorting without a templates management dialog",()=>{
 render(<TaskTemplateList org="org" workspace={workspace} locale="en"/>);
 fireEvent.change(screen.getByRole("searchbox",{name:"Search templates"}),{target:{value:"تصميم"}});expect(window.location.search).toContain("templateSearch=");expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
 fireEvent.click(screen.getByRole("button",{name:"Template"}));expect(window.location.search).toContain("templateSort=name%3Adesc");expect(screen.queryByRole("button",{name:"Previous"})).toBeNull();expect(screen.queryByRole("button",{name:"Next"})).toBeNull();expect(screen.queryByRole("dialog")).toBeNull();
});
