// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MyRequestsTabs } from "./my-requests-tabs";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(()=>window.history.replaceState(null,"","/applications?tab=applications"));
afterEach(() => {
  cleanup();
  push.mockClear();
});

it("renders request sections as shadcn tabs and keeps their URL routes", () => {
  render(<MyRequestsTabs activeTab="applications" locale="ar" panels={{applications:<div>محتوى الطلبات</div>,renewals:<div>التجديد</div>,organizations:<div>فتح الأندية</div>}}/>);

  const tablist = screen.getByRole("tablist", { name: "أنواع طلباتي" });
  expect(tablist.parentElement?.classList.contains("workspace-filter-scroll")).toBe(true);
  expect(tablist.parentElement?.getAttribute("dir")).toBe("rtl");
  const applicationsTab = within(tablist).getByRole("tab", { name: "طلبات الانضمام" });
  expect(applicationsTab.getAttribute("aria-selected")).toBe("true");
  expect(applicationsTab.className).toContain("data-active:bg-primary");
  fireEvent.click(within(tablist).getByRole("tab", { name: "طلبات التجديد" }));
  expect(push).not.toHaveBeenCalled();
  expect(window.location.search).toBe("?tab=renewals");
  expect(screen.getByText("محتوى الطلبات")).toBeTruthy();
});

it("lets the applications preview return to the saved requests view", () => {
  render(<MyRequestsTabs activeTab="applications" preview locale="ar" panels={{applications:<div>المعاينة</div>,renewals:null,organizations:null}}/>);
  fireEvent.click(screen.getByRole("tab", { name: "طلبات الانضمام" }));
  expect(push).toHaveBeenCalledWith("/applications?tab=applications");
});
it('opens the organization request category with a persistent URL',()=>{render(<MyRequestsTabs activeTab="applications" locale="ar" panels={{applications:<div>طلباتي</div>,renewals:null,organizations:<div>قائمة الطلبات</div>}}/>);fireEvent.click(screen.getByRole('tab',{name:'طلبات فتح الأندية'}));expect(push).not.toHaveBeenCalled();expect(window.location.search).toBe('?tab=organizations');expect(screen.getByText('قائمة الطلبات')).toBeTruthy();});

it("switches preloaded panels without a route fetch and retains entered values",()=>{
 window.history.replaceState(null,"","/applications?tab=applications&status=accepted");
 render(<MyRequestsTabs activeTab="applications" locale="en" activeHref="/applications?tab=applications&status=accepted" panels={{applications:<label>Notes<input/></label>,renewals:<p>Renewal panel</p>,organizations:<p>Organization panel</p>}}/>);
 fireEvent.change(screen.getByRole("textbox",{name:"Notes"}),{target:{value:"Keep my draft"}});
 fireEvent.click(screen.getByRole("tab",{name:"Renewals"}));
 expect(push).not.toHaveBeenCalled();expect(window.location.search).toBe("?tab=renewals");
 expect(screen.getByRole("tab",{name:"Renewals"}).getAttribute("aria-selected")).toBe("true");
 fireEvent.click(screen.getByRole("tab",{name:"Applications"}));
 expect(window.location.search).toBe("?tab=applications&status=accepted");expect((screen.getByRole("textbox",{name:"Notes"}) as HTMLInputElement).value).toBe("Keep my draft");
 window.history.replaceState(null,"","/applications?tab=organizations");fireEvent.popState(window);
 expect(screen.getByRole("tab",{name:"Organization requests"}).getAttribute("aria-selected")).toBe("true");
});
