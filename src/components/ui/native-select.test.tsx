// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NativeSelect} from "./native-select";
import {FormField} from "@/components/form-field";
import {LiveFilterForm} from "@/components/live-filter-form";
beforeEach(()=>{Element.prototype.scrollIntoView=vi.fn();});
afterEach(cleanup);
it("uses a styled popup and keeps native form submission and change events",async()=>{
 const changed=vi.fn();const {container}=render(<form onChange={changed}><FormField label="نوع الإجابة"><NativeSelect name="type" defaultValue="Text"><option value="Text">نص قصير</option><option value="Number">رقم</option></NativeSelect></FormField></form>);
 expect(container.querySelector('[data-slot=select-trigger]')).toBeTruthy();
 fireEvent.click(screen.getByRole("combobox",{name:"نوع الإجابة"}));const option=await screen.findByRole("option",{name:"رقم"});fireEvent.pointerDown(option);fireEvent.click(option);
 await waitFor(()=>expect(new FormData(container.querySelector('form')!).get('type')).toBe('Number'));expect(changed).toHaveBeenCalledOnce();expect(screen.getByRole('combobox').textContent).toContain('رقم');
});
it("retains required validation and focuses its visible trigger",async()=>{
 const {container}=render(<form><FormField label="الفصل" required><NativeSelect name="term" required defaultValue=""><option value="">اختر الفصل</option><option value="one">الأول</option></NativeSelect></FormField></form>);
 expect(container.querySelector('form')!.checkValidity()).toBe(false);expect(document.activeElement).toBe(screen.getByRole('combobox'));await waitFor(()=>expect(screen.getByText('هذا الحقل مطلوب.')).toBeTruthy());
});
it("submits a live filter once with the newly selected value",async()=>{
 const request=vi.spyOn(HTMLFormElement.prototype,'requestSubmit').mockImplementation(()=>{});
 const {container}=render(<LiveFilterForm><NativeSelect name="term" aria-label="الفصل" defaultValue=""><option value="">الكل</option><option value="one">الأول</option></NativeSelect></LiveFilterForm>);
 fireEvent.click(screen.getByRole('combobox'));const option=await screen.findByRole('option',{name:'الأول'});fireEvent.pointerDown(option);fireEvent.click(option);await waitFor(()=>expect(request).toHaveBeenCalledOnce());expect(new FormData(container.querySelector('form')!).get('term')).toBe('one');request.mockRestore();
});

it("restores the configured default on reset even when the value was not edited",async()=>{
 const {container}=render(<form><NativeSelect name="choice" defaultValue="second"><option value="first">الأول</option><option value="second">الثاني</option></NativeSelect><button type="reset">إعادة</button></form>);
 fireEvent.click(screen.getByRole('button',{name:'إعادة'}));await waitFor(()=>expect(new FormData(container.querySelector('form')!).get('choice')).toBe('second'));expect(screen.getByRole('combobox').textContent).toContain('الثاني');
});
