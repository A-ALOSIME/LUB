// @vitest-environment jsdom
import {cleanup,render,screen} from "@testing-library/react";
import {afterEach,expect,it} from "vitest";
import {I18nProvider} from "./i18n-provider";
import {ContentText} from "./content-text";
afterEach(cleanup);
it("switches saved display text with locale while retaining source data and normalized digits",()=>{
 const source="المجلس الاستشاري الطلابي لنظم المعلومات";
 const view=render(<I18nProvider locale="ar"><p><ContentText value={source}/></p><output><ContentText value="١٢"/></output></I18nProvider>);
 expect(screen.getByText(source)).toBeTruthy();expect(screen.getByText("12")).toBeTruthy();
 view.rerender(<I18nProvider locale="en"><p><ContentText value={source}/></p><output><ContentText value="١٢"/></output></I18nProvider>);
 expect(screen.getByText("Information Systems Student Advisory Council")).toBeTruthy();expect(source).toBe("المجلس الاستشاري الطلابي لنظم المعلومات");
});

it("translates stored notification copy without modifying its Arabic source",()=>{
 render(<I18nProvider locale="en"><p><ContentText value="تم رفض طلب فتح الجهة"/></p><p><ContentText value="افتح طلبك للاطلاع على سبب الرفض."/></p></I18nProvider>);
 expect(screen.getByText("Organization request declined")).toBeTruthy();
 expect(screen.getByText("Open your request to see why it was declined.")).toBeTruthy();
});
