// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {FilePickerInput} from "./file-picker-input";
afterEach(cleanup);
it("keeps the native file control out of layout and opens it through the accessible button",()=>{
 const changed=vi.fn();render(<FilePickerInput accept="application/pdf" locale="en" onChange={changed}/>);
 const input=document.querySelector<HTMLInputElement>('input[type="file"]')!;
 expect(input.hidden).toBe(true);expect(input.classList.contains("sr-only")).toBe(false);
 const choose=vi.spyOn(input,"click");fireEvent.click(screen.getByRole("button",{name:"Choose file"}));expect(choose).toHaveBeenCalledOnce();
 fireEvent.change(input,{target:{files:[new File(["test"],"project.pdf",{type:"application/pdf"})]}});
 expect(changed).toHaveBeenCalledOnce();expect(screen.getByText("project.pdf")).toBeTruthy();
});
