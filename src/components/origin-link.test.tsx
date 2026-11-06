// @vitest-environment jsdom
import {act,cleanup,render,screen} from "@testing-library/react";
import {afterEach,expect,it} from "vitest";
import {OriginLink} from "./origin-link";

afterEach(()=>{cleanup();window.history.replaceState(null,"","/");});
it("keeps the active list filter in a link after an in-place tab change",()=>{
 window.history.replaceState(null,"","/activity?tab=events&eventStatus=Accepted");
 render(<OriginLink href="/events/123">View event</OriginLink>);
 const target=()=>new URL(screen.getByRole("link").getAttribute("href")!,"https://lub.community").searchParams.get("returnTo");
 expect(target()).toBe("/activity?tab=events&eventStatus=Accepted");
 act(()=>{window.history.pushState(null,"","/activity?tab=events&eventStatus=Pending");window.dispatchEvent(new Event("activity-tab-change"));});
 expect(target()).toBe("/activity?tab=events&eventStatus=Pending");
});
