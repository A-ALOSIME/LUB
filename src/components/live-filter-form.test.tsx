// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
const navigation=vi.hoisted(()=>({replace:vi.fn()}));vi.mock("next/navigation",()=>({useRouter:()=>navigation}));
import {LiveFilterForm} from "./live-filter-form";
afterEach(()=>{cleanup();vi.clearAllMocks();window.history.replaceState(null,"","/");});
it("uses a client transition for GET filters and does not reload or navigate twice to the same URL",()=>{
 window.history.replaceState(null,"","/activity?tab=hours");render(<LiveFilterForm><input name="tab" value="hours" readOnly/><label>Search<input name="q" defaultValue="Ahmad"/></label><button>Filter</button></LiveFilterForm>);
 fireEvent.submit(screen.getByRole("button").closest("form")!);expect(navigation.replace).toHaveBeenCalledWith("/activity?tab=hours&q=Ahmad",{scroll:false});expect(window.location.search).toBe("?tab=hours");
 window.history.replaceState(null,"","/activity?tab=hours&q=Ahmad");fireEvent.submit(screen.getByRole("button").closest("form")!);expect(navigation.replace).toHaveBeenCalledTimes(1);
});
it("coalesces rapid typing into one navigation",async()=>{render(<LiveFilterForm debounceMs={20}><label>Search<input name="q" type="search"/></label></LiveFilterForm>);fireEvent.change(screen.getByRole("searchbox"),{target:{value:"A"}});fireEvent.change(screen.getByRole("searchbox"),{target:{value:"Ah"}});await waitFor(()=>expect(navigation.replace).toHaveBeenCalledTimes(1));expect(navigation.replace).toHaveBeenCalledWith("/?q=Ah",{scroll:false});});
