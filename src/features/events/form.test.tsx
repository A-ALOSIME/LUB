// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({mutation:vi.fn()}));
vi.mock("./actions",()=>({mutateEvent:mocks.mutation}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("@/features/forms/actions",()=>({mutateWorkflow:vi.fn()}));
import {ManagementActionProvider} from "@/components/management-action-sheet";
import {EventForm,EventRegistrationForm} from "./form";
import {initialDefinition} from "@/features/forms/definition";
afterEach(()=>{cleanup();vi.resetAllMocks();});
it("uses the event action, retains answers on failure and excludes membership committee selection",async()=>{mocks.mutation.mockResolvedValue({error:"تعذّر التسجيل"});render(<EventRegistrationForm event="event" round="" version="version" definition={initialDefinition} committees={[]}/>);fireEvent.change(screen.getByLabelText("ليش ترغب بالانضمام؟ *"),{target:{value:"أبغى أحضر"}});fireEvent.submit(screen.getByRole("button",{name:"تسجيل في الفعالية"}).closest("form")!);await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole("alert")));expect(screen.getByRole("alert").textContent).toBe("تعذّر التسجيل");expect((screen.getByLabelText("ليش ترغب بالانضمام؟ *") as HTMLTextAreaElement).value).toBe("أبغى أحضر");expect(screen.queryByLabelText("اللجنة المطلوبة (اختياري)")).toBeNull();});

it("closes an event confirmation after success without leaving a reversed action open",async()=>{const close=vi.fn();mocks.mutation.mockResolvedValue({success:"تم الحفظ"});render(<ManagementActionProvider locale="ar" close={close}><EventForm operation="status" label="تأكيد"/></ManagementActionProvider>);fireEvent.submit(screen.getByRole("button",{name:"تأكيد"}).closest("form")!);await waitFor(()=>expect(close).toHaveBeenCalled());});
