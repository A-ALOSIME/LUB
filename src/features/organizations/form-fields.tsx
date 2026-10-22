import type {Locale} from "@/lib/preferences";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
export function OrganizationTextFields({ prefix, value, locale="ar" }: { prefix: string; value?: { nameAr: string; summary: string; mission: string }; locale?:Locale }) {
  const en=locale==="en";
  return <>
    <div><label htmlFor={`${prefix}-name`}>{en?"Organization name":"اسم الجهة"}</label><input id={`${prefix}-name`} name="nameAr" dir={en?"ltr":"rtl"} placeholder={en?"e.g. Computer Science Club":"مثال: نادي علوم الحاسب"} required minLength={2} maxLength={120} defaultValue={value?.nameAr ?? ""} /></div>
    <div><label htmlFor={`${prefix}-summary`}>{en?"Short description":"نبذة مختصرة"}</label><textarea id={`${prefix}-summary`} name="summary" dir={en?"ltr":"rtl"} rows={3} maxLength={1000} placeholder={en?"A short introduction to the organization":"نبذة قصيرة عن الجهة"} defaultValue={value?.summary ?? ""} /></div>
    <div><label htmlFor={`${prefix}-mission`}>{en?"Mission":"رسالة الجهة"}</label><textarea id={`${prefix}-mission`} name="mission" dir={en?"ltr":"rtl"} rows={4} maxLength={3000} placeholder={en?"The organization's purpose and impact":"رسالة الجهة وأثرها"} defaultValue={value?.mission ?? ""} /></div>
  </>;
}
export function CommitteeFields({ prefix, value, locale="ar", parentOptions = [] }: { prefix: string; value?: { name: string; description: string; isPublic: boolean; parentCommitteeId?: string | null }; locale?:Locale; parentOptions?: Array<{ id: string; name: string }> }) {
  const en=locale==="en";
  return <>
    <div><label htmlFor={`${prefix}-name`}>{en?"Committee name":"اسم اللجنة"}</label><input id={`${prefix}-name`} name="name" dir={en?"ltr":"rtl"} placeholder={en?"e.g. Events Committee":"مثال: لجنة الفعاليات"} required minLength={2} maxLength={120} defaultValue={value?.name ?? ""} /></div>
    <div><label htmlFor={`${prefix}-description`}>{en?"Committee description":"وصف اللجنة"}</label><textarea id={`${prefix}-description`} name="description" dir={en?"ltr":"rtl"} rows={3} maxLength={2000} placeholder={en?"A short description of the committee":"وصف مختصر للجنة"} defaultValue={value?.description ?? ""} /></div>
    {parentOptions.length > 0 && <div className="organization-settings-field">
      <label htmlFor={`${prefix}-parent`}>{en ? "Parent committee" : "اللجنة الرئيسية"}</label>
      <NativeSelect id={`${prefix}-parent`} name="parentCommitteeId" defaultValue={value?.parentCommitteeId ?? ""}>
        <NativeSelectOption value="">{en ? "No parent committee" : "بدون لجنة رئيسية"}</NativeSelectOption>
        {parentOptions.map(parent => <NativeSelectOption key={parent.id} value={parent.id}>{parent.name}</NativeSelectOption>)}
      </NativeSelect>
    </div>}
    <label className="committee-visibility-row" htmlFor={`${prefix}-is-public`}>
      <span className="grid gap-1">
        <span className="font-medium">{en ? "Show committee publicly" : "إظهار اللجنة للعامة"}</span>
      </span>
      <Switch id={`${prefix}-is-public`} name="isPublic" value="on" defaultChecked={value?.isPublic ?? true} aria-label={en ? "Show committee publicly" : "إظهار اللجنة للعامة"} />
    </label>
  </>;
}
