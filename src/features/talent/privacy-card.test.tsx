// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import {TalentPrivacyCard} from "./privacy-card";
import {saveTalentPrivacy} from "./actions";
vi.mock("./actions",()=>({saveTalentPrivacy:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const initial={enabled:true,indexable:true,slug:"public-slug"};
it("disables indexing immediately when hidden, saves directly and does not expose preview or copy while private",async()=>{
 vi.mocked(saveTalentPrivacy).mockResolvedValue({settings:{...initial,enabled:false,indexable:false}});render(<TalentPrivacyCard initial={initial} locale="ar"/>);
 fireEvent.click(screen.getByRole("switch",{name:"ملفي العام"}));expect(screen.getByRole("switch",{name:"فهرسة محركات البحث"}).getAttribute("aria-checked")).toBe("false");expect(screen.getByRole("switch",{name:"فهرسة محركات البحث"}).hasAttribute("data-disabled")).toBe(true);
 await waitFor(()=>expect(saveTalentPrivacy).toHaveBeenCalledWith(false,false));expect((screen.getByRole("button",{name:"نسخ الرابط"}) as HTMLButtonElement).disabled).toBe(true);expect(screen.queryByRole("link",{name:/معاينة/})).toBeNull();
});
it("rolls back optimistic privacy state when the save fails",async()=>{
 vi.mocked(saveTalentPrivacy).mockResolvedValue({error:true});render(<TalentPrivacyCard initial={initial} locale="en"/>);fireEvent.click(screen.getByRole("switch",{name:"My public profile"}));await screen.findByRole("alert");expect(screen.getByRole("switch",{name:"My public profile"}).getAttribute("aria-checked")).toBe("true");expect(screen.getByRole("switch",{name:"Search engine indexing"}).getAttribute("aria-checked")).toBe("true");expect(screen.getByRole("link",{name:"Preview as a visitor"}).getAttribute("href")).toBe('/talent/public-slug');
});
it("enables the public profile with indexing still off until opted in",async()=>{
 vi.mocked(saveTalentPrivacy).mockResolvedValue({settings:{...initial,indexable:false}});render(<TalentPrivacyCard initial={{...initial,enabled:false,indexable:false}} locale="en"/>);fireEvent.click(screen.getByRole("switch",{name:"My public profile"}));await waitFor(()=>expect(saveTalentPrivacy).toHaveBeenCalledWith(true,false));expect(screen.getByRole("switch",{name:"Search engine indexing"}).getAttribute("aria-checked")).toBe("false");
});
