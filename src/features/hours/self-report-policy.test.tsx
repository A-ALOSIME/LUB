// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
const mutate=vi.hoisted(()=>vi.fn());
vi.mock("./actions",()=>({mutateHours:mutate}));
import {SelfReportPolicy} from "./self-report-policy";
import {toast} from "@/components/ui/toast";
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("optimistically changes the policy and rolls back a failed server save",async()=>{
 let resolve!:(value:{error:string})=>void;mutate.mockReturnValue(new Promise(r=>{resolve=r;}));const add=vi.spyOn(toast,"add");
 render(<SelfReportPolicy org="org" enabled={false} locale="ar"/>);const control=screen.getByRole("button");fireEvent.click(control);expect(control.getAttribute("aria-pressed")).toBe("true");
 await waitFor(()=>expect(mutate).toHaveBeenCalled());const form=mutate.mock.calls[0][1] as FormData;expect(form.get("operation")).toBe("self-policy");expect(form.get("enabled")).toBe("on");resolve({error:"Denied"});
 await waitFor(()=>expect(control.getAttribute("aria-pressed")).toBe("false"));await waitFor(()=>expect(add).toHaveBeenCalledWith(expect.objectContaining({type:"error",timeout:0})));
});
it("keeps the saved policy and shows a short success notification",async()=>{
 mutate.mockResolvedValue({success:"Saved"});const add=vi.spyOn(toast,"add");render(<SelfReportPolicy org="org" enabled={true} locale="en"/>);fireEvent.click(screen.getByRole("button"));
 await waitFor(()=>expect(add).toHaveBeenCalledWith(expect.objectContaining({type:"success",timeout:3000})));expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
});
