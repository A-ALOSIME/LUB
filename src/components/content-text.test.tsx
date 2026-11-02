// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {I18nProvider} from "./i18n-provider";
import {ContentText} from "./content-text";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('renders complete Latin organization names immediately without requesting or showing a mixed-script name',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(<I18nProvider locale="en"><p><ContentText autoTranslate value="نادي تكنيشن"/></p><p><ContentText autoTranslate value="نادي الإنجاز"/></p><p><ContentText autoTranslate value="نادي ظهير"/></p></I18nProvider>);
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
it('translates opted-in English content, deduplicates identical text, and retains the cache on remount',async()=>{
 const fetcher=vi.fn(async()=>Response.json({translated_text:'University Technology Club'}));vi.stubGlobal('fetch',fetcher);
 const element=<I18nProvider locale="en"><ContentText autoTranslate value="نادي التقنية الجامعي"/><ContentText autoTranslate value="نادي التقنية الجامعي"/></I18nProvider>;
 const first=render(element);await waitFor(()=>expect(screen.getAllByText(/University Technology Club/)).toHaveLength(1));expect(fetcher).toHaveBeenCalledTimes(1);
 first.unmount();render(element);expect(screen.getByText(/University Technology Club/)).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(1);
});
it('leaves the exact Arabic original visible on a remote failure',async()=>{
 const fetcher=vi.fn(async()=>Response.json({error:'unavailable'},{status:503}));vi.stubGlobal('fetch',fetcher);
 await act(async()=>{render(<I18nProvider locale="en"><ContentText autoTranslate value="نادي إنجاز التجريبي للترجمة"/></I18nProvider>);});
 expect(screen.getByText('نادي إنجاز التجريبي للترجمة')).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(1);
});
it('never sends Arabic-mode content, private default content, or fixed UI to the provider',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(<><I18nProvider locale="ar"><ContentText autoTranslate value="نادي بالعربية فقط"/></I18nProvider><I18nProvider locale="en"><ContentText value="اسم طالب خاص"/><ContentText value="حفظ"/></I18nProvider></>);
 expect(fetcher).not.toHaveBeenCalled();expect(screen.getByText(/نادي بالعربية فقط/)).toBeTruthy();
});
