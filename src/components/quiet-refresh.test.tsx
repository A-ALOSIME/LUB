// @vitest-environment jsdom
import {act,cleanup,fireEvent,render} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const router=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>router}));
import {QuietRefresh} from "./quiet-refresh";
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();router.refresh.mockClear();});
it("keeps data mounted and refreshes only after a changed server fingerprint",async()=>{
 vi.useFakeTimers();vi.spyOn(document,"visibilityState","get").mockReturnValue("visible");
 const read=vi.fn().mockResolvedValueOnce("one").mockResolvedValue("two");
 render(<QuietRefresh version="one" readVersion={read}/>);
 expect(read).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.focus(window);});expect(router.refresh).not.toHaveBeenCalled();
 await act(async()=>{vi.advanceTimersByTime(30000);});expect(router.refresh).toHaveBeenCalledTimes(1);
 await act(async()=>{vi.advanceTimersByTime(30000);});expect(router.refresh).toHaveBeenCalledTimes(1);
});
