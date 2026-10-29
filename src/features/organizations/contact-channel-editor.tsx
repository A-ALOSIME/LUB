"use client";

import {t as translateUi} from "@/lib/i18n";
import { useId, useRef, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ManagementActionFooter, ManagementActionSheet } from "@/components/management-action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { normalizeOrganizationContact, organizationContactKinds, organizationContactLabel, type OrganizationContactChannel, type OrganizationContactKind } from "./contact-channels";
import { useProfileFormState } from "./profile-form-state";
import { ContactChannelAddMenu } from "./contact-channel-add-menu";
import { OrganizationSocialIcon } from "./social-links";
import type { Locale } from "@/lib/preferences";
import {FormField} from "@/components/form-field";

const channelPlaceholder: Record<OrganizationContactKind, string> = {
  Behance: "https://behance.net/...", Website: "https://example.com", Email: "name@example.com", Phone: "+966 5X XXX XXXX",
  LinkedIn: "https://linkedin.com/company/...", GitHub: "https://github.com/...", Instagram: "https://instagram.com/...",
  X: "https://x.com/...", YouTube: "https://youtube.com/@...", TikTok: "https://tiktok.com/@...",
  WhatsApp: "https://wa.me/...", Telegram: "https://t.me/...",
};
const channelNamesAr: Partial<Record<OrganizationContactKind, string>> = { Website: "موقع", Email: "إيميل", Phone: "جوال", TikTok: "تيك توك", LinkedIn: "لينكدإن", X: "إكس" };

type EditableChannel = OrganizationContactChannel & { id: string };

function editableChannels(channels: OrganizationContactChannel[], prefix: string): EditableChannel[] {
  return channels.map((channel, index) => ({ ...channel, id: `${prefix}-${index}` }));
}

function invalidMessage(kind: OrganizationContactKind, en: boolean) {
  if (kind === "Email") return translateUi((en) ? "en" : "ar", "أدخل بريداً إلكترونياً صحيحاً.", "Enter a valid email address.");
  if (kind === "Phone") return translateUi((en) ? "en" : "ar", "أدخل رقم هاتف صحيحاً.", "Enter a valid phone number.");
  return translateUi((en) ? "en" : "ar", "أدخل رابط HTTPS صحيحاً.", "Enter a valid HTTPS link.");
}

function valueError(channel: OrganizationContactChannel, en: boolean) {
  if (!channel.value.trim()) return translateUi((en) ? "en" : "ar", "هذا الحقل مطلوب.", "This field is required.");
  return normalizeOrganizationContact(channel) ? "" : invalidMessage(channel.kind, en);
}

export function OrganizationContactChannelEditor(props: { initialChannels: OrganizationContactChannel[]; locale: Locale }) {
  const { resetKey, resetValues } = useProfileFormState();
  const initialChannels = Object.hasOwn(resetValues, "contacts")
    ? channelsFromSerialized(resetValues.contacts, props.initialChannels)
    : props.initialChannels;
  return <OrganizationContactChannelEditorState key={resetKey} initialChannels={initialChannels} locale={props.locale} />;
}

function channelsFromSerialized(value: string, fallback: OrganizationContactChannel[]): OrganizationContactChannel[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((item): item is OrganizationContactChannel => typeof item === "object" && item !== null && "kind" in item && organizationContactKinds.includes(item.kind as OrganizationContactKind) && "value" in item && typeof item.value === "string");
  } catch {
    return fallback;
  }
}

function OrganizationContactChannelEditorState({ initialChannels, locale }: { initialChannels: OrganizationContactChannel[]; locale: Locale }) {
  const rowPrefix = useId();
  const { markChanged } = useProfileFormState();
  const [channels, setChannels] = useState(() => editableChannels(initialChannels, rowPrefix));
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [kind, setKind] = useState<OrganizationContactKind>("Website");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const valueId = useId();
  const nextId = useRef(initialChannels.length);
  const en = locale === "en";
  function addChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeOrganizationContact({ kind, value });
    if (!normalized) {
      setError(valueError({ kind, value }, en));
      return;
    }
    if (channels.some(channel => normalizeOrganizationContact(channel)?.url === normalized.url)) {
      setError(translateUi((en) ? "en" : "ar", "قناة التواصل هذه مضافة بالفعل.", "This contact channel already exists."));
      return;
    }
    if (channels.length >= 12) {
      setError(translateUi((en) ? "en" : "ar", "يمكنك إضافة 12 قناة على الأكثر.", "You can add up to 12 channels."));
      return;
    }
    setChannels(current => [...current, { kind: normalized.kind, value: normalized.value, id: `${rowPrefix}-${nextId.current++}` }]);
    markChanged();
    setValue("");
    setError("");
    setOpen(false);
  }

  function removeChannel() {
    if (!deleteId) return;
    setChannels(current => current.filter(channel => channel.id !== deleteId));
    markChanged();
    setTouched(current => new Set([...current].filter(id => id !== deleteId)));
    setDeleteId(null);
  }

  return <section className="organization-settings-field full organization-contact-editor" aria-labelledby="organization-contacts-title" dir={en ? "ltr" : "rtl"}>
    <div className="organization-contact-heading">
      <h3 id="organization-contacts-title">{translateUi((en) ? "en" : "ar", "قنوات التواصل", "Contact channels")}</h3>
      {channels.length < 12 && <ContactChannelAddMenu locale={locale} onSelect={channelKind => {
            setKind(channelKind);
            setValue("");
            setError("");
            setOpen(true);
          }} />}
    </div>
    <input type="hidden" name="contacts" value={JSON.stringify(channels.map(channel => ({ kind: channel.kind, value: channel.value })))} readOnly />
    {channels.length ? <ul className="organization-contact-list">
      {channels.map(channel => {
        const errorId = `organization-contact-error-${channel.id}`;
        const channelError = touched.has(channel.id) ? valueError(channel, en) : "";
        return <li className="organization-contact-row" key={channel.id}>
          <span className="organization-contact-label"><span className="organization-contact-icon" aria-hidden="true"><OrganizationSocialIcon kind={channel.kind} className="size-5" /></span><span>{en ? organizationContactLabel(channel.kind, true) : channelNamesAr[channel.kind] ?? organizationContactLabel(channel.kind, false)}</span></span>
          <div className="organization-contact-value">
            <div className="organization-contact-field-wrap">
              {channel.kind === "Phone" ? <PhoneInput value={channel.value} locale={locale} onChange={value => { setChannels(current => current.map(item => item.id === channel.id ? { ...item, value } : item)); markChanged(); }} onBlur={() => setTouched(current => new Set(current).add(channel.id))} aria-label={`${organizationContactLabel(channel.kind, en)} ${translateUi((en) ? "en" : "ar", "القيمة", "value")}`} aria-invalid={channelError ? true : undefined} aria-describedby={channelError ? errorId : undefined} required />
                : <Input value={channel.value} onChange={event => setChannels(current => current.map(item => item.id === channel.id ? { ...item, value: event.target.value } : item))} onBlur={() => setTouched(current => new Set(current).add(channel.id))} type={channel.kind === "Email" ? "email" : "url"} inputMode={channel.kind === "Email" ? "email" : "url"} dir="ltr" className={en?"text-left":"text-right"} aria-label={`${organizationContactLabel(channel.kind, en)} ${translateUi((en) ? "en" : "ar", "القيمة", "value")}`} aria-invalid={channelError ? true : undefined} aria-describedby={channelError ? errorId : undefined} required maxLength={2048} />}
              <Button type="button" variant="ghost" size="icon-sm" className="organization-contact-delete" aria-label={translateUi((en) ? "en" : "ar", `حذف ${organizationContactLabel(channel.kind, false)}`, `Remove ${organizationContactLabel(channel.kind, true)}`)} title={translateUi((en) ? "en" : "ar", `حذف ${organizationContactLabel(channel.kind, false)}`, `Remove ${organizationContactLabel(channel.kind, true)}`)} onClick={() => setDeleteId(channel.id)}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            {channelError && <p id={errorId} role="alert" className="organization-contact-error">{channelError}</p>}
          </div>
        </li>;
      })}
    </ul> : <p className="organization-contact-empty">{translateUi((en) ? "en" : "ar", "ما أُضيفت قنوات تواصل بعد.", "No public contact channels added.")}</p>}

    <ManagementActionSheet
      label=""
      title={translateUi((en) ? "en" : "ar", "إضافة قناة تواصل", "Add a contact channel")}
      locale={locale}
      open={open}
      onOpenChange={next => { setOpen(next); if (!next) setError(""); }}
      hideTrigger
    >
      <p className="text-sm leading-6 text-muted">{translateUi((en) ? "en" : "ar", "أدخل وسيلة التواصل التي ستظهر للزوار.", "Enter the public contact value.")}</p>
      <form noValidate onSubmit={event => { event.stopPropagation(); addChannel(event); }} className="grid gap-3">
        <FormField id={valueId} label={organizationContactLabel(kind, en)} required error={error}>
        {kind === "Phone" ? <PhoneInput id={valueId} autoFocus value={value} locale={locale} onChange={value => { setValue(value); setError(""); }} required /> : <Input id={valueId} autoFocus value={value} onChange={event => { setValue(event.target.value); setError(""); }} type={kind === "Email" ? "email" : "url"} inputMode={kind === "Email" ? "email" : "url"} dir="ltr" className={en?"text-left":"text-right"} placeholder={channelPlaceholder[kind]} maxLength={2048} required />}
        </FormField>
        <ManagementActionFooter label={translateUi((en) ? "en" : "ar", "إضافة القناة", "Add channel")} />
      </form>
    </ManagementActionSheet>

    <AlertDialog open={deleteId !== null} onOpenChange={next => { if (!next) setDeleteId(null); }}>
      <AlertDialogContent dir={en ? "ltr" : "rtl"}>
        <AlertDialogHeader>
          <AlertDialogTitle>{translateUi((en) ? "en" : "ar", `حذف قناة ${organizationContactLabel(channels.find(channel=>channel.id===deleteId)?.kind??"Website",false)}؟`, `Delete ${organizationContactLabel(channels.find(channel=>channel.id===deleteId)?.kind??"Website",true)}?`)}</AlertDialogTitle>
          <AlertDialogDescription>{translateUi((en) ? "en" : "ar", "ستُحذف القناة عند حفظ بيانات الجهة.", "This channel will be removed when you save the profile.")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction type="button" variant="danger-outline" onClick={removeChannel}>{translateUi((en) ? "en" : "ar", "حذف القناة", "Delete channel")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
