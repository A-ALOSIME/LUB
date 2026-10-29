import {t as translateUi} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
export function OrganizationTextFields({ prefix, value, locale="ar" }: { prefix: string; value?: { nameAr: string; summary: string; mission: string }; locale?:Locale }) {
  const en=locale==="en";
  return <>
    <FormField  id={`${prefix}-name`} label={<>{translateUi((en) ? "en" : "ar", "اسم الجهة", "Organization name")}</>}><input id={`${prefix}-name`} name="nameAr" dir={en?"ltr":"rtl"} placeholder={translateUi((en) ? "en" : "ar", "مثال: نادي علوم الحاسب", "e.g. Computer Science Club")} required minLength={2} maxLength={120} defaultValue={value?.nameAr ?? ""} /></FormField>
    <FormField  id={`${prefix}-summary`} label={<>{translateUi((en) ? "en" : "ar", "نبذة مختصرة", "Short description")}</>}><textarea id={`${prefix}-summary`} name="summary" dir={en?"ltr":"rtl"} rows={3} maxLength={1000} placeholder={translateUi((en) ? "en" : "ar", "نبذة قصيرة عن الجهة", "A short introduction to the organization")} defaultValue={value?.summary ?? ""} /></FormField>
    <FormField  id={`${prefix}-mission`} label={<>{translateUi((en) ? "en" : "ar", "رسالة الجهة", "Mission")}</>}><textarea id={`${prefix}-mission`} name="mission" dir={en?"ltr":"rtl"} rows={4} maxLength={3000} placeholder={translateUi((en) ? "en" : "ar", "رسالة الجهة وأثرها", "The organization's purpose and impact")} defaultValue={value?.mission ?? ""} /></FormField>
  </>;
}
export function CommitteeFields({ prefix, value, locale="ar", parentOptions = [] }: { prefix: string; value?: { name: string; description: string; isPublic: boolean; parentCommitteeId?: string | null }; locale?:Locale; parentOptions?: Array<{ id: string; name: string }> }) {
  const en=locale==="en";
  return <>
    <FormField  id={`${prefix}-name`} label={<>{translateUi((en) ? "en" : "ar", "اسم اللجنة", "Committee name")}</>}><input id={`${prefix}-name`} name="name" dir={en?"ltr":"rtl"} placeholder={translateUi((en) ? "en" : "ar", "مثال: لجنة الفعاليات", "e.g. Events Committee")} required minLength={2} maxLength={120} defaultValue={value?.name ?? ""} /></FormField>
    <FormField  id={`${prefix}-description`} label={<>{translateUi((en) ? "en" : "ar", "وصف اللجنة", "Committee description")}</>}><textarea id={`${prefix}-description`} name="description" dir={en?"ltr":"rtl"} rows={3} maxLength={2000} placeholder={translateUi((en) ? "en" : "ar", "وصف مختصر للجنة", "A short description of the committee")} defaultValue={value?.description ?? ""} /></FormField>
    {parentOptions.length > 0 && <FormField className="organization-settings-field" id={`${prefix}-parent`} label={<>{translateUi((en) ? "en" : "ar", "اللجنة الرئيسية", "Parent committee")}</>}>
      <NativeSelect id={`${prefix}-parent`} name="parentCommitteeId" defaultValue={value?.parentCommitteeId ?? ""}>
        <NativeSelectOption value="">{translateUi((en) ? "en" : "ar", "بدون لجنة رئيسية", "No parent committee")}</NativeSelectOption>
        {parentOptions.map(parent => <NativeSelectOption key={parent.id} value={parent.id}>{parent.name}</NativeSelectOption>)}
      </NativeSelect>
    </FormField>}
    <label className="committee-visibility-row" htmlFor={`${prefix}-is-public`}>
      <span className="grid gap-1">
        <span className="font-medium">{translateUi((en) ? "en" : "ar", "إظهار اللجنة للعامة", "Show committee publicly")}</span>
      </span>
      <Switch id={`${prefix}-is-public`} name="isPublic" value="on" defaultChecked={value?.isPublic ?? true} aria-label={translateUi((en) ? "en" : "ar", "إظهار اللجنة للعامة", "Show committee publicly")} />
    </label>
  </>;
}
