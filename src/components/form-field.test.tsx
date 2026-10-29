// @vitest-environment jsdom
import {afterEach,expect,it} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {I18nProvider} from "./i18n-provider";
import {FormField} from "./form-field";
import {Input} from "./ui/input";
afterEach(cleanup);
it("keeps existing control ids and connects helper/error messages while validating the first missing field",()=>{
 render(<form><FormField label="اسم الجولة" hint="اسم واضح"><div><Input id="existing-title" name="title" required/></div></FormField><FormField label="الوصف"><textarea name="description" required/></FormField></form>);
 const input=screen.getByRole("textbox",{name:"اسم الجولة"});expect(input.id).toBe("existing-title");expect(input.getAttribute("aria-describedby")).toContain("existing-title-hint");
 fireEvent.invalid(input);expect(screen.getByRole("alert").textContent).toBe("هذا الحقل مطلوب.");expect(document.activeElement).toBe(input);expect(input.getAttribute("aria-invalid")).toBe("true");
 fireEvent.input(input,{target:{value:"جولة جديدة"}});expect(screen.queryByRole("alert")).toBeNull();
});
it("associates a generated id with native controls and shows server field errors",()=>{
 render(<FormField label="النموذج" error="اختر نموذجًا"><select name="template" defaultValue=""><option value="">اختر</option></select></FormField>);
 const input=screen.getByLabelText("النموذج");expect(input.getAttribute("aria-describedby")).toBe(`${input.id}-error`);expect(screen.getByRole("alert").textContent).toBe("اختر نموذجًا");
});

it("uses the selected interface language for validation even without a field locale prop",()=>{render(<I18nProvider locale="en"><form><FormField label="Title"><Input name="title" required/></FormField></form></I18nProvider>);fireEvent.invalid(screen.getByRole("textbox"));expect(screen.getByRole("alert").textContent).toBe("This field is required.");});
