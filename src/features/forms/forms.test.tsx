// @vitest-environment jsdom
import { afterEach,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
const action=vi.hoisted(()=>vi.fn());
vi.mock("./actions",()=>({mutateWorkflow:action}));
import { initialDefinition } from "./definition";
import { ApplicationForm } from "./application-form";
import { FormEditor } from "./editor";
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("keeps typed answers and focuses failure feedback after a rejected submission",async()=>{
 action.mockResolvedValue({error:"راجع الإجابات."});
 render(<ApplicationForm round="round" version="version" definition={initialDefinition} committees={[]}/>);
 const input=screen.getByLabelText("ليش ترغب بالانضمام؟ *");fireEvent.change(input,{target:{value:"أرغب بالمشاركة"}});
 fireEvent.submit(screen.getByRole("button",{name:"إرسال طلب الانضمام"}).closest("form")!);
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toBe("راجع الإجابات."));
 expect((input as HTMLTextAreaElement).value).toBe("أرغب بالمشاركة");await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole("alert")));
});
it("reorders stable questions by keyboard buttons without losing labels or identifiers",()=>{
 render(<FormEditor version="version" revision={1} initial={initialDefinition}/>);
 fireEvent.click(screen.getByRole("button",{name:"خفض السؤال 1"}));
 const payload=screen.getByRole("button",{name:"حفظ المسودة"}).closest("form")!.querySelector<HTMLInputElement>('input[name="definition"]')!;
 const saved=JSON.parse(payload.value) as typeof initialDefinition;
 expect(saved.sections[0].fields.map(f=>f.id)).toEqual(initialDefinition.sections[0].fields.map(f=>f.id).reverse());
 expect(saved.sections[0].fields[1].label).toBe("ليش ترغب بالانضمام؟");
});
it("switches progressive sections without destroying answers on earlier steps",()=>{
 const definition=structuredClone(initialDefinition);definition.layout="Progressive";
 const second=structuredClone(definition.sections[0]);second.id="40000000-0000-4000-8000-000000000001";second.title="القسم التالي";second.fields=second.fields.map((f,i)=>({...f,id:`40000000-0000-4000-8000-00000000000${i+2}`,label:f.label+" ثاني"}));definition.sections.push(second);
 render(<ApplicationForm round="round" version="version" definition={definition} committees={[]}/>);
 fireEvent.change(screen.getByLabelText("ليش ترغب بالانضمام؟ *"),{target:{value:"باقية"}});
 fireEvent.click(screen.getByRole("button",{name:"التالي"}));expect(screen.getByText("القسم 2 من 2")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"السابق"}));expect((screen.getByLabelText("ليش ترغب بالانضمام؟ *") as HTMLTextAreaElement).value).toBe("باقية");
});
