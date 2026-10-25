// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import {SiteNavigation} from "./site-navigation";
let pathname="/ai";
vi.mock("next/navigation",()=>({usePathname:()=>pathname}));
afterEach(cleanup);
it.each([['/organizations/club','الأندية والمجالس'],['/events/discover','الفعاليات'],['/talent/member','المواهب'],['/ai','اسأل لُبّ']])("marks the current page for %s without changing navigation names",(path,label)=>{
 pathname=path;const {container}=render(<SiteNavigation en={false}/>);
 expect(screen.getAllByRole("link")).toHaveLength(4);expect(screen.getByRole("link",{name:label}).getAttribute("aria-current")).toBe("page");expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
 expect(container.querySelectorAll('.site-nav-size-label[aria-hidden="true"]')).toHaveLength(4);
});
it("leaves all public links inactive outside their routes",()=>{pathname='/privacy';const {container}=render(<SiteNavigation en/>);expect(container.querySelector('[aria-current]')).toBeNull();expect(screen.getByRole('link',{name:'Ask LUB'})).toBeTruthy();});
