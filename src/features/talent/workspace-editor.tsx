"use client";

import {t as translateUi} from "@/lib/i18n";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {Switch} from "@/components/ui/switch";
import {InputGroup,InputGroupInput,InputGroupAddon} from "@/components/ui/input-group";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import type { TalentPages, TalentWorkspace } from "./repository";
import { mutateTalent } from "./actions";
import type { WorkflowState } from "@/features/forms/actions";
import { TalentForm, NewProject, ProjectFields } from "./form";
import { TalentChannelIcon, talentAddableChannelKinds, talentChannelLabel, type TalentChannelKind } from "./contact-channel";
import { ContactChannelAddMenu } from "@/features/organizations/contact-channel-add-menu";
import { PhoneInput } from "@/components/phone-input";
import { useActionToast } from "@/components/action-toast";
import { TalentPagination } from "./view";
import { Textarea } from "@/components/ui/textarea";
import { ContactVisibilityButton } from "./contact-visibility-button";
import { SkillCombobox } from "./skill-combobox";
import { WorkspaceStickySaveBar } from "@/components/workspace-sticky-save-bar";

const channelPlaceholders: Partial<Record<TalentChannelKind, string>> = {
  Email: "name@example.com",
  Phone: "+966 5X XXX XXXX",
  Website: "https://example.com",
  LinkedIn: "https://linkedin.com/in/username",
  X: "https://x.com/username",
  TikTok: "https://tiktok.com/@username",
  Instagram: "https://instagram.com/username",
  GitHub: "https://github.com/username",
};
const channelKinds = talentAddableChannelKinds.map(value => ({ value, placeholder: channelPlaceholders[value] ?? "https://example.com" }));

function InlineEmpty({ children }: { children: string }) {
  return <Empty className="min-h-0 flex-none items-start gap-1 rounded-lg border border-dashed border-border p-3 text-start">
    <EmptyTitle className="text-xs font-normal text-muted-foreground">{children}</EmptyTitle>
  </Empty>;
}

function DeleteConfirmation({ id, operation, item, locale }: { id: string; operation: "remove-link" | "remove-skill"; item: string; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const en = locale === "en";
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={translateUi((en) ? "en" : "ar", `حذف ${item}`, `Delete ${item}`)} /> }>
      <Trash2 aria-hidden="true" />
    </AlertDialogTrigger>
    <AlertDialogContent dir={en ? "ltr" : "rtl"} className="font-sans">
      <AlertDialogHeader>
        <AlertDialogTitle>{translateUi((en) ? "en" : "ar", "حذف هذا العنصر؟", "Delete this item?")}</AlertDialogTitle>
        <AlertDialogDescription>{translateUi((en) ? "en" : "ar", `سيُحذف ${item} من ملفك.`, `This will remove ${item} from your profile.`)}</AlertDialogDescription>
      </AlertDialogHeader>
      <TalentForm
        operation={operation}
        fields={operation === "remove-link" ? { link: id } : { name: id }}
        label={translateUi((en) ? "en" : "ar", "حذف", "Delete")}
        buttonClassName="button button-compact bg-destructive text-destructive-foreground hover:bg-destructive/90"
        formClassName="flex flex-col gap-0"
        locale={locale}
        onSuccess={close}
        secondaryAction={<AlertDialogCancel>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</AlertDialogCancel>}
      />
    </AlertDialogContent>
  </AlertDialog>;
}

function AddContactDialog({ locale, disabled }: { locale: Locale; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TalentChannelKind>("Email");
  const close = useCallback(() => setOpen(false), []);
  const en = locale === "en";
  const selected = channelKinds.find((item) => item.value === kind)!;
  const valueId = "talent-contact-value";

  return <>
    <ContactChannelAddMenu kinds={talentAddableChannelKinds} locale={locale} disabled={disabled} onSelect={nextKind => { setKind(nextKind as TalentChannelKind); setOpen(true); }} />
    <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent dir={en ? "ltr" : "rtl"} className="talent-form-dialog font-sans sm:max-w-lg" showCloseButton={false}>
      <DialogHeader className="text-start">
        <DialogTitle>{translateUi((en) ? "en" : "ar", "إضافة قناة تواصل", "Add a contact channel")}</DialogTitle>
      </DialogHeader>
      <TalentForm operation="link" label={translateUi((en) ? "en" : "ar", "إضافة القناة", "Add channel")} buttonClassName="button button-compact w-fit" formClassName="flex flex-col gap-4" locale={locale} onSuccess={close}>
        <input type="hidden" name="kind" value={kind} readOnly />
        <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={valueId}>{en ? talentChannelLabel(kind, true) : talentChannelLabel(kind, false)}</FieldLabel>
          {kind === "Phone" ? <PhoneInput id={valueId} name="value" locale={locale} required /> : <InputGroup><InputGroupAddon><TalentChannelIcon kind={kind}/></InputGroupAddon><InputGroupInput id={valueId} name="value" type={kind==="Email"?"email":"text"} inputMode={kind==="Email"?"email":"url"} placeholder={selected.placeholder} dir="ltr" className={en?"text-left":"text-right"} required maxLength={2048} autoComplete="off"/></InputGroup>}

        </Field>

        </FieldGroup>
      </TalentForm>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</DialogClose>
      </DialogFooter>
    </DialogContent>
    </Dialog>
  </>;
}

function EditContactDialog({ link, locale }: { link: TalentWorkspace["links"][number]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const close = useCallback(() => { setOpen(false); router.refresh(); }, [router]);
  const en = locale === "en";
  const label = talentChannelLabel(link.link_type, en);
  const valueId = useId();
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={translateUi((en) ? "en" : "ar", "تعديل القناة", "Edit contact")} title={translateUi((en) ? "en" : "ar", "تعديل", "Edit")} />}>
      <Pencil aria-hidden="true" />
    </DialogTrigger>
    <DialogContent dir={en ? "ltr" : "rtl"} className="talent-form-dialog font-sans" showCloseButton={false}>
      <DialogHeader className="text-start">
        <DialogTitle>{translateUi((en) ? "en" : "ar", "تعديل قناة التواصل", "Edit contact channel")}</DialogTitle>
      </DialogHeader>
      <TalentForm
        operation="update-link"
        fields={{ link: link.id, kind: link.link_type, label: link.label }}
        label={translateUi((en) ? "en" : "ar", "حفظ التعديلات", "Save changes")}
        buttonClassName="button button-compact w-fit"
        formClassName="flex flex-col gap-4"
        locale={locale}
        onSuccess={close}
      >
        <Field>
          <FieldLabel htmlFor={valueId}>{label}</FieldLabel>
          {link.link_type === "Phone" ? <PhoneInput id={valueId} name="value" defaultValue={link.url_or_value} locale={locale} required /> : <InputGroup><InputGroupAddon><TalentChannelIcon kind={link.link_type}/></InputGroupAddon><InputGroupInput id={valueId} name="value" defaultValue={link.url_or_value} type={link.link_type==="Email"?"email":"text"} inputMode={link.link_type==="Email"?"email":"url"} dir="ltr" className={en?"text-left":"text-right"} required maxLength={2048} autoComplete="off"/></InputGroup>}

        </Field>

      </TalentForm>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function AddSkillDialog({ locale, disabled }: { locale: Locale; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const en = locale === "en";
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-2" />}>
      <Plus aria-hidden="true" />{translateUi((en) ? "en" : "ar", "إضافة مهارة", "Add skill")}
    </DialogTrigger>
    <DialogContent dir={en ? "ltr" : "rtl"} className="talent-form-dialog font-sans" showCloseButton={false}>
      <DialogHeader className="text-start">
        <DialogTitle>{translateUi((en) ? "en" : "ar", "إضافة مهارة", "Add a skill")}</DialogTitle>
      </DialogHeader>
      <TalentForm operation="skill" label={translateUi((en) ? "en" : "ar", "إضافة المهارة", "Add skill")} buttonClassName="button button-compact w-fit" formClassName="flex flex-col gap-4" locale={locale} onSuccess={close}>
        <FieldGroup className="gap-4">
          <SkillCombobox locale={locale}/>

        </FieldGroup>
      </TalentForm>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function AddProjectDialog({ sources, locale }: { sources: TalentWorkspace["sources"]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const en = locale === "en";
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="gap-2" />}>
      <Plus aria-hidden="true" />{translateUi((en) ? "en" : "ar", "إضافة إنجاز", "Add achievement")}
    </DialogTrigger>
    <DialogContent dir={en ? "ltr" : "rtl"} className="talent-form-dialog font-sans sm:max-w-lg" showCloseButton={false}>
      <DialogHeader className="text-start">
        <DialogTitle>{translateUi((en) ? "en" : "ar", "إضافة إنجاز موثق", "Add a verified achievement")}</DialogTitle>
      </DialogHeader>
      <NewProject sources={sources.slice(0, 25)} locale={locale} onSuccess={close} />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ProfileSettingsForm({ data, pages, locale }: { data: TalentWorkspace; user: string; pages: TalentPages; locale: Locale }) {
  const message = useRef<HTMLParagraphElement>(null);
  const [dirty, setDirty] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const submit = useCallback(async (previous: WorkflowState, form: FormData) => {
    const result = await mutateTalent(previous, form);
    if (result.success) {
      setDirty(false);
      setShowSuccess(true);
    }
    return result;
  }, []);
  const [state, action, pending] = useActionState<WorkflowState, FormData>(submit, {});
  useActionToast(state, locale);
  const en = locale === "en";
  const publishLabel = translateUi((en) ? "en" : "ar", "نشر ملفي في اكتشاف المواهب", "Publish my profile in talent discovery");
  const markDirty = useCallback(() => { setDirty(true); setShowSuccess(false); }, []);

  useEffect(() => {
    if (state.error) message.current?.focus();
  }, [state.error]);
  return <form id="talent-settings-form" action={action} dir={en ? "ltr" : "rtl"} className="talent-settings-page min-w-0" onReset={(event) => event.preventDefault()} onInputCapture={markDirty} onChangeCapture={markDirty}>
    <input type="hidden" name="operation" value="profile" />
    <Card className="overflow-hidden p-0">
      <CardContent className="flex flex-col gap-5 p-4 pt-3">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="talent-bio">{translateUi((en) ? "en" : "ar", "نبذة عني", "About me")}</FieldLabel>
                <Textarea id="talent-bio" name="bio" rows={4} maxLength={1000} defaultValue={data.bio} placeholder={translateUi((en) ? "en" : "ar", "اكتب نبذة قصيرة عنك…", "A short introduction…")} />
              </Field>
            </FieldGroup>

            <section aria-labelledby="talent-contact-heading" className="flex flex-col gap-3 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 id="talent-contact-heading" className="text-sm font-semibold">{translateUi((en) ? "en" : "ar", "قنوات التواصل", "Contact channels")}</h3>
                </div>
                <AddContactDialog locale={locale} disabled={data.links.length >= 10} />
              </div>
              {data.links.length ? <ul className="flex min-w-0 flex-wrap gap-2">
                {data.links.map((link) => {
                  const fields = `link_${link.id}_`;
                  const label = talentChannelLabel(link.link_type, en);
                  return <li key={link.id} className="flex w-fit max-w-full items-center gap-1.5 rounded-lg border border-border bg-background p-1.5">
                    <span title={label} aria-label={label} className="organization-contact-icon"><TalentChannelIcon kind={link.link_type} /></span>
                    <span className="sr-only">{label}</span>
                    <input type="hidden" name="linkId" value={link.id} />
                    <input type="hidden" name={`${fields}kind`} value={link.link_type} />
                    <input type="hidden" name={`${fields}label`} value={link.label} />
                    <input type="hidden" name={`${fields}value`} value={link.url_or_value} />
                    <EditContactDialog link={link} locale={locale} />
                    <DeleteConfirmation id={link.id} operation="remove-link" item={label} locale={locale} />
                  </li>;
                })}
              </ul> : <InlineEmpty>{translateUi((en) ? "en" : "ar", "لم تتم إضافة قنوات تواصل بعد.", "No contact channels have been added.")}</InlineEmpty>}
            </section>

            <section className="flex flex-col gap-3 border-t border-border/60 pt-4" aria-labelledby="talent-skills-heading">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="talent-skills-heading" className="text-sm font-semibold">{translateUi((en) ? "en" : "ar", "المهارات", "Skills")}</h3>
                </div>
                <AddSkillDialog locale={locale} disabled={data.skills.length >= 30} />
              </div>
              {data.skills.length ? <>
                <input type="hidden" name="skillCount" value={data.skills.length} />
                <ul className="flex min-w-0 flex-wrap gap-2">
                {data.skills.map((skill, index) => {
                  return <li key={skill.name} className="flex w-fit max-w-full items-center gap-1.5 rounded-lg border border-border bg-background p-1.5">
                    <span dir="auto" className="min-w-0 break-words px-1 text-sm font-medium">{skill.name}</span>
                    <input type="hidden" name={`skill_${index}_name`} value={skill.name} />
                    <DeleteConfirmation id={skill.name} operation="remove-skill" item={skill.name} locale={locale} />
                  </li>;
                })}
                </ul>
              </> : <InlineEmpty>{translateUi((en) ? "en" : "ar", "لم تتم إضافة مهارات بعد.", "No skills have been added.")}</InlineEmpty>}
            </section>

            <section className="flex flex-col gap-3 border-t border-border pt-4" aria-labelledby="talent-achievements-heading">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="talent-achievements-heading" className="text-sm font-semibold">{translateUi((en) ? "en" : "ar", "الإنجازات", "Achievements")}</h3>
                </div>
                {data.sources.length > 0 && <AddProjectDialog sources={data.sources} locale={locale} />}
              </div>
              {data.projects.length ? <div className="flex flex-col gap-2">
                <input type="hidden" name="projectCount" value={Math.min(data.projects.length, 25)} />
                {data.projects.slice(0, 25).map((project, index) => <details key={project.id} className="group rounded-lg border border-border bg-background">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
                    <span dir="auto" className="min-w-0 break-words text-sm font-medium">{project.display_title}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span>{project.is_featured ? translateUi((en) ? "en" : "ar", "مثبت", "Featured") : translateUi((en) ? "en" : "ar", "موثق", "Verified")}</span><ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" /></span>
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-border p-3">
                    <input type="hidden" name={`project_${index}_id`} value={project.id} />
                    {project.task_participant_id && <input type="hidden" name={`project_${index}_participant`} value={project.task_participant_id} />}
                    {project.event_contribution_id && <input type="hidden" name={`project_${index}_contribution`} value={project.event_contribution_id} />}
                    <ProjectFields locale={locale} namePrefix={`project_${index}_`} value={project} />
                  </div>
                </details>)}
              </div> : <InlineEmpty>{translateUi((en) ? "en" : "ar", "لم تتم إضافة إنجازات بعد.", "No achievements have been added.")}</InlineEmpty>}
              <TalentPagination pages={pages} keyName="projects" more={data.projects.length > 25} locale={locale} />
              <TalentPagination pages={pages} keyName="sources" more={data.sources.length > 25} locale={locale} />
            </section>
      </CardContent>
      {state.error && <p ref={message} tabIndex={-1} role="alert" className="error-message mx-4 mb-3">{actionFeedback(state.error, locale)}</p>}
      {showSuccess && state.success && <p role="status" className="mx-4 mb-3 text-sm text-action">{actionFeedback(state.success, locale)}</p>}
      <CardFooter className="flex-wrap items-center justify-start gap-3 border-t border-border bg-card p-4">
        <div className="flex w-fit min-w-fit shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-sm font-medium">{translateUi((en) ? "en" : "ar", "نشر ملفي", "Publish my profile")}</span>
          <ContactVisibilityButton
            name="enabled"
            label={publishLabel}
            visible={data.settings.public_profile_enabled}
            locale={locale}
            hideLabel={translateUi((en) ? "en" : "ar", "إيقاف نشر ملفي المهاري", "Unpublish my talent profile")}
            showLabel={translateUi((en) ? "en" : "ar", "نشر ملفي المهاري", "Publish my talent profile")}
            onVisibilityChange={markDirty}
          />
        </div>
        <Field orientation="horizontal"><FieldLabel htmlFor="talent-indexing">{translateUi((en) ? "en" : "ar", "السماح لمحركات البحث بفهرسة ملفي العام", "Allow search engines to index my public profile")}</FieldLabel><Switch id="talent-indexing" name="indexable" value="true" defaultChecked={data.settings.allow_indexing??false} onCheckedChange={markDirty}/></Field>
        {data.settings.public_profile_enabled && data.settings.public_slug && <Button render={<Link href={`/talent/${data.settings.public_slug}`} />} variant="outline" size="sm" className="w-fit shrink-0 gap-1.5 no-underline" aria-label={translateUi((en) ? "en" : "ar", "عرض الملف العام", "View public profile")}>
          <Eye aria-hidden="true" data-icon="inline-start" /><span>{translateUi((en) ? "en" : "ar", "عرض الملف العام", "View profile")}</span>
        </Button>}
      </CardFooter>
    </Card>
    <WorkspaceStickySaveBar formId="talent-settings-form" locale={locale} visible={dirty} pending={pending} onUndo={() => window.location.reload()} />
  </form>;
}

export function TalentWorkspaceEditor({ data, user, pages, locale = "ar" }: { data: TalentWorkspace; user: string; pages: TalentPages; locale?: Locale }) {
  const en = locale === "en";
  return <main id="main" dir={en ? "ltr" : "rtl"} className="workspace-content talent-settings-page flex min-w-0 flex-col gap-4">
    <header className="workspace-page-header">
      <h1>{translateUi((en) ? "en" : "ar", "ملفي المهاري", "My talent profile")}</h1>
    </header>
    <ProfileSettingsForm data={data} user={user} pages={pages} locale={locale} />
  </main>;
}
