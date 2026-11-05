// @vitest-environment jsdom
import {render,screen,cleanup} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
const route=vi.hoisted(()=>({path:"/manage/organizations/org/tasks"}));
vi.mock("next/navigation",()=>({usePathname:()=>route.path}));
import {OrganizationManagementFrame} from "./organization-management-frame";
afterEach(cleanup);
it("keeps the tasks-and-hours heading on the list",()=>{
 route.path="/manage/organizations/org/tasks";render(<OrganizationManagementFrame locale="ar"><p>القائمة</p></OrganizationManagementFrame>);
 expect(screen.getByRole("heading",{level:1}).textContent).toBe("المهام والساعات");
});
it("lets a full task page own its heading without a second page title",()=>{
 route.path="/manage/organizations/org/tasks/task";render(<OrganizationManagementFrame locale="en"><h1>Task title</h1></OrganizationManagementFrame>);
 expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);expect(screen.queryByText("Tasks and hours")).toBeNull();
});
