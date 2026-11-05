// @vitest-environment jsdom
import {afterEach,it,expect,vi} from "vitest";
import {cleanup,render,screen,fireEvent} from "@testing-library/react";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));vi.mock("./actions",()=>({mutateHours:vi.fn()}));
import {TermForm} from "./term-form";
afterEach(cleanup);
it("starts empty with a single date-only range and no public code input",()=>{const {container}=render(<TermForm locale="ar"/>);expect(screen.queryByLabelText("رمز الفصل")).toBeNull();expect(container.querySelector('input[name="code"]')).toBeNull();expect(container.querySelector<HTMLInputElement>('input[name="starts"]')!.value).toBe("");expect(container.querySelector<HTMLInputElement>('input[name="ends"]')!.value).toBe("");expect(screen.getByRole("button",{name:"تعريف الفصل"}).hasAttribute("disabled")).toBe(true);fireEvent.click(screen.getByRole("button",{name:"فترة الفصل"}));expect(document.querySelectorAll('[data-week-start="sunday"]')).toHaveLength(1);expect(screen.queryByRole("textbox",{name:"البداية"})).toBeNull();expect(screen.queryByText("بتوقيت الرياض")).toBeNull();});
