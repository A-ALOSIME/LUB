import {HoursForm} from "@/features/hours/form";
import {DateRangeInput} from "@/features/forms/date-input";
import {FormField} from "@/components/form-field";
import {NativeSelect} from "@/components/ui/native-select";
import {Switch} from "@/components/ui/switch";
import {createTranslator} from "@/lib/i18n";
import type {Campaign,RenewalWorkspace} from "./repository";
import type {Locale} from "@/lib/preferences";
export function RenewalDraftForm({campaign,terms,locale}:{campaign:Campaign;terms:RenewalWorkspace["terms"];locale:Locale}){
 const c=createTranslator(locale);
 return <HoursForm operation="save-campaign" fields={{campaign:campaign.id}} label={c("حفظ التعديلات","Save changes")} locale={locale}><FormField label={c("الفصل الدراسي","Academic term")}><NativeSelect name="term" defaultValue={campaign.academic_term_id}>{terms.map(term=><option key={term.id} value={term.id}>{term.name_ar} · {term.academic_year}</option>)}</NativeSelect></FormField><DateRangeInput startName="opens" endName="closes" startValue={campaign.opens_at} endValue={campaign.closes_at} label={c("الفترة","Period")} required includeTime locale={locale}/><FormField label={c("استثناء القادة والنواب من التجديد","Exclude leaders and deputies from renewal")}><Switch name="leaders" value="on" defaultChecked={campaign.exclude_leadership}/></FormField></HoursForm>;
}
