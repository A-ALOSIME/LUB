// @vitest-environment jsdom
import {StrictMode} from "react";
import {cleanup,render,screen,fireEvent,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({mutate:vi.fn(),refresh:vi.fn()}));
vi.mock("./actions",()=>({mutateWorkflow:mocks.mutate}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
import {OpenPublishedEditor} from "./open-published-editor";
afterEach(()=>{cleanup();vi.resetAllMocks();});
it("requests the authorized draft once and refreshes directly into the editor",async()=>{
 mocks.mutate.mockResolvedValue({success:"تم"});
 render(<StrictMode><OpenPublishedEditor template="template" locale="ar"/></StrictMode>);
 await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledOnce());expect(mocks.mutate).toHaveBeenCalledOnce();
 const form=mocks.mutate.mock.calls[0][1] as FormData;expect(form.get("operation")).toBe("draft-form");expect(form.get("template")).toBe("template");
});
it("keeps a clear retry after a failed draft request",async()=>{
 mocks.mutate.mockResolvedValueOnce({error:"تعذّر فتح المحرر"}).mockResolvedValueOnce({success:"تم"});
 render(<OpenPublishedEditor template="template" locale="ar"/>);
 fireEvent.click(await screen.findByRole("button",{name:"إعادة المحاولة"}));
 await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledOnce());expect(mocks.mutate).toHaveBeenCalledTimes(2);
});
