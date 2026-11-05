// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import {PrivateQueryProvider} from "@/components/private-query-provider";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("./admin-organization-table",()=>({AdminOrganizationTable:({organizations}:{organizations:Array<{id:string;nameAr:string}>})=><div data-testid="organizations">{organizations.map(item=><p key={item.id}>{item.nameAr}</p>)}</div>}));
vi.mock("./admin-opening-requests",()=>({AdminOpeningRequests:({items}:{items:Array<{id:string;name_ar:string}>})=><div data-testid="requests">{items.map(item=><p key={item.id}>{item.name_ar}</p>)}</div>}));
import {AdminDirectoryScreen} from "./admin-directory-screen";
import type {AdminDirectory} from "./admin-directory-repository";
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState(null,"","/");});
it("switches every primary tab and status ten times from one cached snapshot without calls or skeletons",()=>{
 const fetch=vi.fn();vi.stubGlobal("fetch",fetch);window.history.replaceState(null,"","/manage/organizations");
 const initial={organizations:[{id:"a",nameAr:"نشط للاختبار",statusCode:"Active"},{id:"b",nameAr:"موقوف للاختبار",statusCode:"Inactive"}],requests:[{id:"r",name_ar:"طلب تحت المراجعة",status_code:"Pending"}],counts:{}} as unknown as AdminDirectory;
 const {container}=render(<PrivateQueryProvider actorId="admin"><AdminDirectoryScreen initial={initial} initialSearch="" locale="ar"/></PrivateQueryProvider>);
 for(let cycle=0;cycle<10;cycle++){
 fireEvent.click(screen.getByRole("tab",{name:"نشطة"}));expect(screen.getByText("نشط للاختبار")).toBeTruthy();expect(screen.queryByText("موقوف للاختبار")).toBeNull();
 fireEvent.click(screen.getByRole("tab",{name:"موقوفة"}));expect(screen.getByText("موقوف للاختبار")).toBeTruthy();
 fireEvent.click(screen.getByRole("tab",{name:"طلبات فتح الأندية"}));fireEvent.click(screen.getByRole("tab",{name:"قيد المراجعة"}));expect(screen.getByText("طلب تحت المراجعة")).toBeTruthy();expect(screen.queryByRole("link",{name:"إضافة جهة"})).toBeNull();
 fireEvent.click(screen.getByRole("tab",{name:"مقبولة"}));expect(screen.queryByText("طلب تحت المراجعة")).toBeNull();
 fireEvent.click(screen.getByRole("tab",{name:"الجهات"}));
 }
 expect(fetch).not.toHaveBeenCalled();expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();expect(window.location.search).toContain("status=Inactive");
});
