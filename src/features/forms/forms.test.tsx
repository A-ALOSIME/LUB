// @vitest-environment jsdom
import { afterEach,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor,within } from "@testing-library/react";
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

it("confirms publication, saves the latest draft first and then makes it read-only",async()=>{
 action.mockResolvedValue({success:"تم الحفظ"});
 render(<FormEditor version="version" revision={1} initial={initialDefinition}/>);
 fireEvent.change(screen.getAllByLabelText("السؤال")[0],{target:{value:"سؤال معدّل"}});
 fireEvent.click(screen.getByRole("button",{name:"نشر النسخة"}));
 const dialog=screen.getByRole("alertdialog");expect(dialog.textContent).toContain("طلبات الطلاب السابقة");expect(action).not.toHaveBeenCalled();
 fireEvent.click(within(dialog).getByRole("button",{name:"نشر النسخة"}));
 await waitFor(()=>expect(screen.getByRole("status").textContent).toContain("للقراءة فقط"));
 expect(action.mock.calls.map(call=>(call[1] as FormData).get("operation"))).toEqual(["save-form","publish-form"]);
 expect(JSON.parse(String((action.mock.calls[0][1] as FormData).get("definition"))).sections[0].fields[0].label).toBe("سؤال معدّل");
});
it("reorders questions with their drag handle while retaining stable identifiers",()=>{
 render(<FormEditor version="version" revision={1} initial={initialDefinition}/>);
 const rows=document.querySelectorAll(".editor-question"),handles=screen.getAllByRole("button",{name:"اسحب لإعادة ترتيب السؤال"});
 fireEvent.dragStart(handles[1],{dataTransfer:{setData:vi.fn()}});fireEvent.drop(rows[0]);
 const definition=JSON.parse((document.querySelector('input[name="definition"]') as HTMLInputElement).value) as typeof initialDefinition;
 expect(definition.sections[0].fields.map(field=>field.id)).toEqual([...initialDefinition.sections[0].fields.map(field=>field.id)].reverse());
});
