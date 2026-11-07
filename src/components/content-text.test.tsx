// @vitest-environment jsdom
import {cleanup,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {I18nProvider} from "./i18n-provider";
import {ContentText} from "./content-text";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('renders complete Latin organization names immediately without requesting or showing a mixed-script name',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(<I18nProvider locale="en"><p><ContentText value="نادي تكنيشن"/></p><p><ContentText value="نادي الإنجاز"/></p><p><ContentText value="نادي ظهير"/></p></I18nProvider>);
 expect(screen.getByText('TechNation Club')).toBeTruthy();expect(screen.getByText('Enjaz Club')).toBeTruthy();expect(screen.getByText('Dhaheer Club')).toBeTruthy();expect(fetcher).not.toHaveBeenCalled();
});
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
it("keeps unmapped authored text on mount and remount without a provider",()=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 const text="معرض جديد للطلاب المستجدين";
 const element=<I18nProvider locale="en"><p><ContentText value={text}/></p></I18nProvider>;
 const first=render(element);expect(screen.getByText(text)).toBeTruthy();
 first.unmount();render(element);expect(screen.getByText(text)).toBeTruthy();expect(fetcher).not.toHaveBeenCalled();
});
it("preserves unknown Arabic alongside manually stored English without waiting on a provider",()=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 render(<I18nProvider locale="en"><p><ContentText value="تفاصيل من كاتب الفعالية"/></p><p><ContentText value="English overview"/></p></I18nProvider>);
 expect(screen.getByText("تفاصيل من كاتب الفعالية")).toBeTruthy();expect(screen.getByText("English overview")).toBeTruthy();expect(fetcher).not.toHaveBeenCalled();
});

it('never sends Arabic-mode content, private default content, or fixed UI to the provider',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(<><I18nProvider locale="ar"><ContentText value="نادي بالعربية فقط"/></I18nProvider><I18nProvider locale="en"><ContentText value="اسم طالب خاص"/><ContentText value="حفظ"/></I18nProvider></>);
 expect(fetcher).not.toHaveBeenCalled();expect(screen.getByText(/نادي بالعربية فقط/)).toBeTruthy();
});
