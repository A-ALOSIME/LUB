"use client";

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

const channelPlaceholder: Record<OrganizationContactKind, string> = {
  Website: "https://example.com", Email: "name@example.com", Phone: "+966 5X XXX XXXX",
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
  if (kind === "Email") return en ? "Enter a valid email address." : "أدخل بريداً إلكترونياً صحيحاً.";
  if (kind === "Phone") return en ? "Enter a valid phone number." : "أدخل رقم هاتف صحيحاً.";
  return en ? "Enter a valid HTTPS link." : "أدخل رابط HTTPS صحيحاً.";
}

function valueError(channel: OrganizationContactChannel, en: boolean) {
  if (!channel.value.trim()) return en ? "This field is required." : "هذا الحقل مطلوب.";
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
      setError(en ? "This contact channel already exists." : "قناة التواصل هذه مضافة بالفعل.");
      return;
    }
    if (channels.length >= 12) {
      setError(en ? "You can add up to 12 channels." : "يمكنك إضافة 12 قناة على الأكثر.");
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
      <h3 id="organization-contacts-title">{en ? "Contact channels" : "قنوات التواصل"}</h3>
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
              {channel.kind === "Phone" ? <PhoneInput value={channel.value} locale={locale} onChange={value => { setChannels(current => current.map(item => item.id === channel.id ? { ...item, value } : item)); markChanged(); }} onBlur={() => setTouched(current => new Set(current).add(channel.id))} aria-label={`${organizationContactLabel(channel.kind, en)} ${en ? "value" : "القيمة"}`} aria-invalid={channelError ? true : undefined} aria-describedby={channelError ? errorId : undefined} required />
                : <Input value={channel.value} onChange={event => setChannels(current => current.map(item => item.id === channel.id ? { ...item, value: event.target.value } : item))} onBlur={() => setTouched(current => new Set(current).add(channel.id))} type={channel.kind === "Email" ? "email" : "url"} inputMode={channel.kind === "Email" ? "email" : "url"} dir="ltr" className="text-right" aria-label={`${organizationContactLabel(channel.kind, en)} ${en ? "value" : "القيمة"}`} aria-invalid={channelError ? true : undefined} aria-describedby={channelError ? errorId : undefined} required maxLength={2048} />}
              <Button type="button" variant="ghost" size="icon-sm" className="organization-contact-delete" aria-label={en ? `Remove ${organizationContactLabel(channel.kind, true)}` : `حذف ${organizationContactLabel(channel.kind, false)}`} title={en ? `Remove ${organizationContactLabel(channel.kind, true)}` : `حذف ${organizationContactLabel(channel.kind, false)}`} onClick={() => setDeleteId(channel.id)}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            {channelError && <p id={errorId} role="alert" className="organization-contact-error">{channelError}</p>}
          </div>
        </li>;
      })}
    </ul> : <p className="organization-contact-empty">{en ? "No public contact channels added." : "ما أُضيفت قنوات تواصل بعد."}</p>}

    <ManagementActionSheet
      label=""
      title={en ? "Add a contact channel" : "إضافة قناة تواصل"}
      locale={locale}
      open={open}
      onOpenChange={next => { setOpen(next); if (!next) setError(""); }}
      hideTrigger
    >
      <p className="text-sm leading-6 text-muted">{en ? "Enter the public contact value." : "أدخل وسيلة التواصل التي ستظهر للزوار."}</p>
      <form noValidate onSubmit={event => { event.stopPropagation(); addChannel(event); }} className="grid gap-3">
        <label htmlFor={valueId} className="text-sm font-semibold">{organizationContactLabel(kind, en)}</label>
        {kind === "Phone" ? <PhoneInput id={valueId} autoFocus value={value} locale={locale} onChange={value => { setValue(value); setError(""); }} required /> : <Input id={valueId} autoFocus value={value} onChange={event => { setValue(event.target.value); setError(""); }} type={kind === "Email" ? "email" : "url"} inputMode={kind === "Email" ? "email" : "url"} dir="ltr" className="text-right" placeholder={channelPlaceholder[kind]} maxLength={2048} required />}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <ManagementActionFooter label={en ? "Add channel" : "إضافة القناة"} />
      </form>
    </ManagementActionSheet>

    <AlertDialog open={deleteId !== null} onOpenChange={next => { if (!next) setDeleteId(null); }}>
      <AlertDialogContent dir={en ? "ltr" : "rtl"}>
        <AlertDialogHeader>
          <AlertDialogTitle>{en ? "Delete contact channel?" : "حذف قناة التواصل؟"}</AlertDialogTitle>
          <AlertDialogDescription>{en ? "This channel will be removed when you save the profile." : "ستُحذف القناة عند حفظ بيانات الجهة."}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{en ? "Cancel" : "إلغاء"}</AlertDialogCancel>
          <AlertDialogAction type="button" variant="destructive" onClick={removeChannel}>{en ? "Delete channel" : "حذف القناة"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
