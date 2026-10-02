import type {Locale} from "@/lib/preferences";
export function OrganizationTextFields({ prefix, value, locale="ar" }: { prefix: string; value?: { nameAr: string; summary: string; mission: string }; locale?:Locale }) {
  const en=locale==="en";
  return <>
    <div><label htmlFor={`${prefix}-name`}>{en?"Organization name":"اسم الجهة"}</label><input id={`${prefix}-name`} name="nameAr" dir="auto" required minLength={2} maxLength={120} defaultValue={value?.nameAr ?? ""} /></div>
    <div><label htmlFor={`${prefix}-summary`}>{en?"Short description":"نبذة مختصرة"}</label><textarea id={`${prefix}-summary`} name="summary" dir="auto" rows={3} maxLength={1000} defaultValue={value?.summary ?? ""} /></div>
    <div><label htmlFor={`${prefix}-mission`}>{en?"Mission":"رسالة الجهة"}</label><textarea id={`${prefix}-mission`} name="mission" dir="auto" rows={4} maxLength={3000} defaultValue={value?.mission ?? ""} /></div>
  </>;
}
export function CommitteeFields({ prefix, value, locale="ar" }: { prefix: string; value?: { name: string; description: string; isPublic: boolean }; locale?:Locale }) {
  const en=locale==="en";
  return <>
    <div><label htmlFor={`${prefix}-name`}>{en?"Committee name":"اسم اللجنة"}</label><input id={`${prefix}-name`} name="name" dir="auto" required minLength={2} maxLength={120} defaultValue={value?.name ?? ""} /></div>
    <div><label htmlFor={`${prefix}-description`}>{en?"Committee description":"وصف اللجنة"}</label><textarea id={`${prefix}-description`} name="description" dir="auto" rows={3} maxLength={2000} defaultValue={value?.description ?? ""} /></div>
    <label className="mb-0 flex items-center gap-3"><input type="checkbox" name="isPublic" defaultChecked={value?.isPublic ?? true} className="size-5 shrink-0 accent-action" />{en?"Show committee publicly":"إظهار اللجنة للعامة"}</label>
  </>;
}
