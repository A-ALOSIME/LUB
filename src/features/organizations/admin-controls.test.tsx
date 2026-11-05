// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const mocks=vi.hoisted(()=>({mutate:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
vi.mock("./actions",()=>({mutateOrganization:mocks.mutate}));
vi.mock("./admin-organization-actions",()=>({findOrganizationLeader:vi.fn(async()=>[])}));
import {AdminAccessManager} from "./admin-access-manager";
import {AdminOrganizationDecision} from "./admin-organization-decision";
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();mocks.mutate.mockResolvedValue({success:"تم الحفظ"});});
it("grants through an email-only dialog and keeps the administrator table read-only",async()=>{
 render(<AdminAccessManager currentUser="self" admins={[{userId:"self",fullName:"أنا",email:"self@example.invalid"},{userId:"other",fullName:"سارة",email:"other@example.invalid"}]} locale="ar"/>);
 expect(screen.queryByRole("button",{name:"سحب الصلاحية"})).toBeNull();expect(screen.queryByRole("textbox")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"إضافة مشرف"}));
 fireEvent.change(screen.getByRole("textbox",{name:"البريد"}),{target:{value:"candidate@example.invalid"}});
 fireEvent.submit(document.querySelector('[role="dialog"] form')!);
 await waitFor(()=>expect(mocks.mutate).toHaveBeenCalledTimes(1));
 const form=mocks.mutate.mock.calls[0][1] as FormData;
 expect(form.get("operation")).toBe("grant-admin");expect(form.get("email")).toBe("candidate@example.invalid");expect(form.get("confirmed")).toBe("on");
 await waitFor(()=>expect(screen.queryByRole("textbox")).toBeNull());expect(screen.getAllByText("self@example.invalid").length).toBeGreaterThan(0);
});
it("retains an invalid grant email in the open dialog and shows its error below the field",async()=>{
 mocks.mutate.mockResolvedValue({error:"Verified account required"});render(<AdminAccessManager currentUser="self" admins={[]} locale="en"/>);
 fireEvent.click(screen.getByRole("button",{name:"Add administrator"}));fireEvent.change(screen.getByRole("textbox",{name:"Email"}),{target:{value:"candidate@example.invalid"}});fireEvent.submit(document.querySelector('[role="dialog"] form')!);
 await waitFor(()=>expect(screen.getByRole("textbox",{name:"Email"}).getAttribute("aria-invalid")).toBe("true"));expect((screen.getByRole("textbox",{name:"Email"}) as HTMLInputElement).value).toBe("candidate@example.invalid");expect(mocks.refresh).not.toHaveBeenCalled();
});
it("confirms leader removal by name and sends only the validated operation to the server",async()=>{
 render(<AdminOrganizationDecision organization={{id:"org",nameAr:"نادي التقنية",slug:"tech",typeCode:"Club",statusCode:"Active",leaderName:"سارة"}} kind="remove-leader" locale="ar" onClose={()=>{}}/>);
 expect(screen.getByText(/ستنتهي صلاحية قيادة سارة/)).toBeTruthy();expect(mocks.mutate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"تأكيد"}));
 await waitFor(()=>expect(mocks.mutate).toHaveBeenCalledTimes(1));
 const form=mocks.mutate.mock.calls[0][1] as FormData;
 expect(form.get("operation")).toBe("remove-leader");expect(form.get("organizationId")).toBe("org");expect(form.get("confirmed")).toBe("on");
});
it("archives only after a named confirmation and preserves the organization instead of deleting it",async()=>{
 render(<AdminOrganizationDecision organization={{id:"org",nameAr:"نادي التقنية",slug:"tech",typeCode:"Club",statusCode:"Active",leaderName:"سارة"}} kind="archive" locale="ar" onClose={()=>{}}/>);
 expect(screen.getByRole("alertdialog").textContent).toContain("أرشفة نادي التقنية؟");
 expect(screen.getByText(/مع الاحتفاظ بصفحتها/)).toBeTruthy();expect(mocks.mutate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"تأكيد"}));
 await waitFor(()=>expect(mocks.mutate).toHaveBeenCalledOnce());
 const form=mocks.mutate.mock.calls[0][1] as FormData;
 expect(form.get("operation")).toBe("org-status");expect(form.get("status")).toBe("Archived");expect(form.get("confirmed")).toBe("on");
});
