// @vitest-environment jsdom
import {cleanup,render,screen} from "@testing-library/react";
import {afterEach,it,expect} from "vitest";
import {I18nProvider} from "./i18n-provider";
import {NumberText} from "./number-text";
import {Sheet,SheetContent,SheetTitle} from "./ui/sheet";
import {Toaster} from "./ui/toast";
afterEach(cleanup);
it("mirrors the horizontal sheet and formats numbers in English",()=>{render(<I18nProvider locale="en"><NumberText value={1234}/><Sheet open><SheetContent><SheetTitle>Details</SheetTitle></SheetContent></Sheet></I18nProvider>);expect(screen.getByText("1,234")).toBeTruthy();expect(screen.getByRole("dialog").getAttribute("data-side")).toBe("right");expect(screen.getByRole("button",{name:"Close"})).toBeTruthy();});
it("uses Western numerals with Arabic notification labels",()=>{render(<I18nProvider locale="ar"><NumberText value={1234}/><Toaster/></I18nProvider>);expect(screen.getByText("1,234")).toBeTruthy();expect(screen.getByRole("region",{name:"الإشعارات"})).toBeTruthy();});
