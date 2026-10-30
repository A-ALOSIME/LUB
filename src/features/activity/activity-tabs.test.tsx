// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const nav=vi.hoisted(()=>({push:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>nav,useSearchParams:()=>new URLSearchParams()}));
import {ActivityTabs} from "./activity-tabs";
afterEach(()=>{cleanup();nav.push.mockClear();window.history.replaceState(null,"","/");});
it("keeps all preloaded activity panels mounted while switching ten times without a server navigation",()=>{
 window.history.replaceState(null,"","/activity?tab=tasks&taskFilter=mine");
 render(<ActivityTabs initialTab="tasks" activeHref="/activity?tab=tasks&taskFilter=mine" locale="en" tasks={<label>Draft<input/></label>} events={<p>Events panel</p>} hours={<p>Hours panel</p>}/>);
 fireEvent.change(screen.getByRole("textbox"),{target:{value:"Keep this"}});
 for(let i=0;i<10;i++)fireEvent.click(screen.getByRole("tab",{name:i%2?"Tasks":"Hours"}));
 expect(nav.push).not.toHaveBeenCalled();expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Keep this");
 expect(window.location.search).toBe("?tab=tasks&taskFilter=mine");
 window.history.replaceState(null,"","/activity?tab=events");fireEvent.popState(window);
 expect(screen.getByRole("tab",{name:"Events"}).getAttribute("aria-selected")).toBe("true");
});
