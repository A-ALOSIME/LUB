// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("./actions",()=>({mutateEvent:async()=>({error:"تعذّر التسجيل"})}));
vi.mock("@/features/forms/actions",()=>({mutateWorkflow:vi.fn()}));
import {EventRegistrationForm} from "./form";
import {initialDefinition} from "@/features/forms/definition";
afterEach(cleanup);
it("uses the event action, retains answers on failure and excludes membership committee selection",async()=>{render(<EventRegistrationForm event="event" round="" version="version" definition={initialDefinition} committees={[]}/>);fireEvent.change(screen.getByLabelText("ليش ترغب بالانضمام؟ *"),{target:{value:"أبغى أحضر"}});fireEvent.submit(screen.getByRole("button",{name:"تسجيل في الفعالية"}).closest("form")!);await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole("alert")));expect(screen.getByRole("alert").textContent).toBe("تعذّر التسجيل");expect((screen.getByLabelText("ليش ترغب بالانضمام؟ *") as HTMLTextAreaElement).value).toBe("أبغى أحضر");expect(screen.queryByLabelText("اللجنة المطلوبة (اختياري)")).toBeNull();});
