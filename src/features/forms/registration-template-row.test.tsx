// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
const mocks=vi.hoisted(()=>({mutate:vi.fn(),refresh:vi.fn(),push:vi.fn(),toast:vi.fn()}));
vi.mock("./actions",()=>({mutateWorkflow:mocks.mutate}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh,push:mocks.push})}));
vi.mock("@/components/ui/toast",()=>({toast:{add:mocks.toast}}));
import {RegistrationTemplateRow} from "./registration-template-row";
import {TooltipProvider} from "@/components/ui/tooltip";
import {initialDefinition} from "./definition";
import type {Template} from "./repository";
const template:Template={id:"original",organization_id:"org",name:"طلب الانضمام",round_count:0,can_delete:true,versions:[{id:"version",version_number:1,status_code:"Draft",revision:1,definition:initialDefinition}]};
afterEach(()=>{cleanup();vi.clearAllMocks();});
function view(value=template){return render(<TooltipProvider><ul><RegistrationTemplateRow template={value} organization="org" locale="ar"/></ul></TooltipProvider>);}
it("disables deletion for used forms and offers the copied draft through the toast",async()=>{
 mocks.mutate.mockResolvedValue({success:"تم إنشاء نسخة",templateId:"copy"});view({...template,round_count:3,can_delete:false});
 expect(screen.getByRole("button",{name:"حذف النموذج"}).hasAttribute("disabled")).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:"تكرار النموذج"}));
 await waitFor(()=>expect(mocks.refresh).toHaveBeenCalled());
 const payload=mocks.mutate.mock.calls[0][1] as FormData;expect(payload.get("template")).toBe("original");expect(payload.get("operation")).toBe("duplicate-form");
 const notification=mocks.toast.mock.calls[0][0];expect(notification.title).toBe("تم إنشاء نسخة");expect(notification.actionProps.children).toBe("فتح");notification.actionProps.onClick();expect(mocks.push).toHaveBeenCalledWith("/manage/organizations/org/renewals?section=forms&template=copy");
});
it("requires a named irreversible-delete confirmation before requesting deletion",async()=>{
 mocks.mutate.mockResolvedValue({success:"تم الحذف"});view();fireEvent.click(screen.getByRole("button",{name:"حذف النموذج"}));
 const dialog=screen.getByRole("alertdialog");expect(dialog.textContent).toContain("طلب الانضمام");expect(dialog.textContent).toContain("ولا يمكن التراجع");expect(mocks.mutate).not.toHaveBeenCalled();
 fireEvent.click(within(dialog).getByRole("button",{name:"حذف النموذج"}));await waitFor(()=>expect(mocks.refresh).toHaveBeenCalled());expect((mocks.mutate.mock.calls[0][1] as FormData).get("operation")).toBe("delete-form");
 expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({title:"تم حذف النموذج",type:"success"}));
});

it("offers an explicit edit link before duplicate and delete without nesting them in the row link",()=>{
 view();const edit=screen.getByRole('link',{name:'تعديل النموذج'}),open=screen.getByRole('link',{name:'فتح النموذج طلب الانضمام'});
 expect(edit.getAttribute('href')).toBe(open.getAttribute('href'));expect(open.contains(edit)).toBe(false);
 const actions=document.querySelector('.registration-template-actions')!;expect([...actions.querySelectorAll('[aria-label]')].map(node=>node.getAttribute('aria-label'))).toEqual(['تعديل النموذج','تكرار النموذج','حذف النموذج']);
});
