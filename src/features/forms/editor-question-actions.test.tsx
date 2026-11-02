// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("./actions",()=>({mutateWorkflow:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
import {FormEditor} from "./editor";
import type {FormDefinition} from "./definition";
afterEach(cleanup);
const initial:FormDefinition={layout:"SinglePage",sections:[{id:"00000000-0000-4000-8000-000000000001",title:"بيانات الطلب",description:"",fields:[{id:"00000000-0000-4000-8000-000000000002",label:"السؤال الأول",type:"ShortText",required:false,help:"",options:[],maxLength:300},{id:"00000000-0000-4000-8000-000000000003",label:"السؤال الثاني",type:"LongText",required:true,help:"",options:[],maxLength:1000}]}]};
function open(){render(<FormEditor version="version" revision={1} initial={initial}/>);fireEvent.click(screen.getByRole("button",{name:/بيانات الطلب/}));}
it("keeps question actions visible and reorders the actual questions with the arrows",()=>{
 open();
 expect(screen.queryByRole("button",{name:"أدوات السؤال 1"})).toBeNull();
 expect((screen.getByRole("button",{name:"تحريك لأعلى · السؤال 1"}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:"تحريك لأسفل · السؤال 1"}));
 expect(screen.getByRole("button",{name:/السؤال 1 · السؤال الثاني/})).toBeTruthy();
 expect(screen.getByRole("button",{name:/السؤال 2 · السؤال الأول/})).toBeTruthy();
});
it("opens a newly added question and keeps optional help empty until typed",()=>{
 open();fireEvent.click(screen.getByRole("button",{name:"إضافة سؤال"}));
 const question=screen.getByRole("textbox",{name:"السؤال"}).closest(".editor-question")!;
 expect((within(question as HTMLElement).getByRole("textbox",{name:"السؤال"}) as HTMLInputElement).value).toBe("سؤال جديد");
 fireEvent.click(within(question as HTMLElement).getByRole("button",{name:"خيارات متقدمة"}));
 expect((screen.getByPlaceholderText("توضيح يساعد الطالب على الإجابة") as HTMLInputElement).value).toBe("");
 expect(within(question as HTMLElement).getByRole("switch",{name:"إجابة مطلوبة"})).toBeTruthy();
});
it("requires a named confirmation before deleting a question",()=>{
 open();fireEvent.click(screen.getByRole("button",{name:"حذف السؤال · السؤال 2"}));
 expect(screen.getByRole("alertdialog").textContent).toContain("حذف «السؤال الثاني»؟");
 fireEvent.click(screen.getByRole("button",{name:"إلغاء"}));
 expect(screen.getByRole("button",{name:/السؤال 2 · السؤال الثاني/})).toBeTruthy();
});
it("uses an explicit answered condition for dynamic committees without requesting a raw answer value",()=>{
 const definition=structuredClone(initial);definition.sections[0].fields[0].type="Committee";
 render(<FormEditor version="version" revision={1} initial={definition}/>);
 fireEvent.click(screen.getByRole("button",{name:/بيانات الطلب/}));
 fireEvent.click(screen.getByRole("button",{name:/السؤال 2 · السؤال الثاني/}));
 fireEvent.click(screen.getByRole("button",{name:"خيارات متقدمة"}));
 fireEvent.change(document.querySelector('select[id$="-condition-form-value"]')!,{target:{value:definition.sections[0].fields[0].id}});
 expect(screen.getByRole("combobox",{name:"المقارنة"}).textContent).toContain("تمت الإجابة");
 expect(screen.queryByRole("textbox",{name:"قيمة الإجابة"})).toBeNull();
 const payload=JSON.parse((document.querySelector('input[name="definition"]') as HTMLInputElement).value) as FormDefinition;
 expect(payload.sections[0].fields[1].condition).toEqual({fieldId:definition.sections[0].fields[0].id,operator:"Answered",value:"true"});
});

it("exposes section actions directly without a menu",()=>{
 open();expect(screen.queryByRole("menu")).toBeNull();
 const copy=screen.getByRole("button",{name:/نسخ القسم/});fireEvent.click(copy);
 const definition=JSON.parse((document.querySelector('input[name="definition"]') as HTMLInputElement).value) as FormDefinition;
 expect(definition.sections.length).toBe(2);expect(definition.sections[0].id).not.toBe(definition.sections[1].id);
});

it("drags question backgrounds while protecting fields and direct actions",()=>{
 open();const cards=document.querySelectorAll<HTMLElement>('[data-question-draggable="true"]');expect(cards).toHaveLength(2);
 const transfer={setData:vi.fn(),effectAllowed:""};fireEvent.mouseDown(cards[0]);expect(cards[0].draggable).toBe(true);fireEvent.dragStart(cards[0],{dataTransfer:transfer});fireEvent.drop(cards[1],{dataTransfer:transfer});expect(screen.getByRole("button",{name:/السؤال 1 · السؤال الثاني/})).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:/السؤال 1 · السؤال الثاني/}));const field=screen.getByRole("textbox",{name:"السؤال"});const card=field.closest<HTMLElement>('[data-question-draggable="true"]')!;fireEvent.mouseDown(field);expect(card.draggable).toBe(false);fireEvent.change(field,{target:{value:"كتابة طبيعية"}});expect((field as HTMLInputElement).value).toBe("كتابة طبيعية");const button=screen.getByRole("button",{name:"نسخ السؤال · السؤال 1"});fireEvent.mouseDown(button);expect(card.draggable).toBe(false);fireEvent.click(button);expect(document.querySelectorAll('[data-question-draggable="true"]')).toHaveLength(3);
});
