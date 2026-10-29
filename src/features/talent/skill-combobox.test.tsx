// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
const suggest=vi.hoisted(()=>vi.fn());vi.mock("./skill-search-actions",()=>({suggestTalentSkills:suggest}));
import {SkillCombobox} from "./skill-combobox";
afterEach(()=>{cleanup();vi.resetAllMocks();});
it("waits for two characters and preserves a custom skill or a selected canonical value",async()=>{
 suggest.mockResolvedValue([{name:"Python",label:"بايثون",uri:"http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d"}]);
 render(<SkillCombobox/>);const input=screen.getByRole("combobox",{name:"اسم المهارة"});
 fireEvent.change(input,{target:{value:"ب"}});await new Promise(r=>setTimeout(r,300));expect(suggest).not.toHaveBeenCalled();
 fireEvent.change(input,{target:{value:"با"}});await waitFor(()=>expect(suggest).toHaveBeenCalledWith("با","ar"));
 fireEvent.click(await screen.findByRole("option",{name:"بايثون"}));expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe("Python");expect((input as HTMLInputElement).value).toBe("بايثون");
 fireEvent.change(input,{target:{value:"مهارة جديدة"}});expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe("مهارة جديدة");expect((document.querySelector('input[name="escoUri"]') as HTMLInputElement).value).toBe("");
});
