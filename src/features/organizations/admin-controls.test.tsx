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
it("requires a separate confirmation before granting access and never offers self revocation",async()=>{
 const {container}=render(<AdminAccessManager currentUser="self" admins={[{userId:"self",fullName:"أنا"},{userId:"other",fullName:"سارة"}]} locale="ar"/>);
 expect(screen.getAllByRole("button",{name:"سحب الصلاحية"})).toHaveLength(1);
 fireEvent.change(screen.getByRole("textbox",{name:/بريد الحساب/}),{target:{value:"candidate@example.invalid"}});
 fireEvent.submit(container.querySelector("form")!);
 expect(screen.getByRole("alertdialog")).toBeTruthy();
 expect(mocks.mutate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"تأكيد"}));
 await waitFor(()=>expect(mocks.mutate).toHaveBeenCalledTimes(1));
 const form=mocks.mutate.mock.calls[0][1] as FormData;
 expect(form.get("operation")).toBe("grant-admin");expect(form.get("email")).toBe("candidate@example.invalid");expect(form.get("confirmed")).toBe("on");
});
it("confirms leader removal by name and sends only the validated operation to the server",async()=>{
 render(<AdminOrganizationDecision organization={{id:"org",nameAr:"نادي التقنية",slug:"tech",typeCode:"Club",statusCode:"Active",leaderName:"سارة"}} kind="remove-leader" locale="ar" onClose={()=>{}}/>);
 expect(screen.getByText(/ستنتهي صلاحية قيادة سارة/)).toBeTruthy();expect(mocks.mutate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"تأكيد"}));
 await waitFor(()=>expect(mocks.mutate).toHaveBeenCalledTimes(1));
 const form=mocks.mutate.mock.calls[0][1] as FormData;
 expect(form.get("operation")).toBe("remove-leader");expect(form.get("organizationId")).toBe("org");expect(form.get("confirmed")).toBe("on");
});
