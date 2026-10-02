import { expect,it } from "vitest";
import { safeReturnPath } from "./return-path";
it("retains only the exact event registration route",()=>{expect(safeReturnPath("/events/00000000-0000-4000-8000-000000000001/register")).toBe("/events/00000000-0000-4000-8000-000000000001/register");expect(safeReturnPath("/events/00000000-0000-4000-8000-000000000001/register?next=https://example.com")).toBe("/me");});
it("allows only canonical application return paths",()=>{
 const good="/organizations/tech/apply/00000000-0000-4000-8000-000000000001";
 expect(safeReturnPath(good)).toBe(good);
 for(const value of ["//evil.test",good+"?next=//evil",good+"\n","https://evil.test",good.replace("/tech/","/%2f/"),"/manage",["/me"]]) expect(safeReturnPath(value)).toBe("/me");
});
