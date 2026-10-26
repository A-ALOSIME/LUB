"use client";

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
import {Badge} from "@/components/ui/badge";
import {Switch} from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
    <AlertDialogTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={en ? `Delete ${item}` : `حذف ${item}`} /> }>
      <Trash2 aria-hidden="true" />
    </AlertDialogTrigger>
    <AlertDialogContent dir={en ? "ltr" : "rtl"} className="font-sans">
      <AlertDialogHeader>
        <AlertDialogTitle>{en ? "Delete this item?" : "حذف هذا العنصر؟"}</AlertDialogTitle>
        <AlertDialogDescription>{en ? `This will remove ${item} from your profile.` : `سيُحذف ${item} من ملفك.`}</AlertDialogDescription>
      </AlertDialogHeader>
      <TalentForm
        operation={operation}
        fields={operation === "remove-link" ? { link: id } : { name: id }}
        label={en ? "Delete" : "حذف"}
        buttonClassName="button button-compact bg-destructive text-destructive-foreground hover:bg-destructive/90"
        formClassName="flex flex-col gap-0"
        locale={locale}
        onSuccess={close}
        secondaryAction={<AlertDialogCancel>{en ? "Cancel" : "إلغاء"}</AlertDialogCancel>}
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
  const visibilityLabel = en ? "Show this contact publicly" : "إظهار قناة التواصل للعامة";

  return <>
    <ContactChannelAddMenu kinds={talentAddableChannelKinds} locale={locale} disabled={disabled} onSelect={nextKind => { setKind(nextKind as TalentChannelKind); setOpen(true); }} />
    <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent dir={en ? "ltr" : "rtl"} className="talent-form-dialog font-sans sm:max-w-lg" showCloseButton={false}>
      <DialogHeader className="text-start">
        <DialogTitle>{en ? "Add a contact channel" : "إضافة قناة تواصل"}</DialogTitle>
      </DialogHeader>
      <TalentForm operation="link" label={en ? "Add channel" : "إضافة القناة"} buttonClassName="button button-compact w-fit" formClassName="flex flex-col gap-4" locale={locale} onSuccess={close}>
        <input type="hidden" name="kind" value={kind} readOnly />
        <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={valueId}>{en ? talentChannelLabel(kind, true) : talentChannelLabel(kind, false)}</FieldLabel>
          <div className="relative">
            {kind !== "Phone" && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">
              <TalentChannelIcon kind={kind} className="size-4" />
            </span>}
            {kind === "Phone" ? <PhoneInput id={valueId} name="value" locale={locale} required /> : <Input
              id={valueId}
              name="value"
              type={kind === "Email" ? "email" : "text"}
              inputMode={kind === "Email" ? "email" : "url"}
              placeholder={selected.placeholder}
              dir="ltr"
              className="ps-9 text-right font-sans"
              required
              maxLength={2048}
              autoComplete="off"
            />}
          </div>
        </Field>
        <Field orientation="horizontal" className="items-center justify-between gap-4 border-t border-border pt-3">
          <FieldLabel>{visibilityLabel}</FieldLabel>
          {kind === "Phone" ? <Badge variant="outline">{en?"Private phone number":"رقم جوال خاص"}</Badge> : <ContactVisibilityButton
            name="visible"
            label={talentChannelLabel(kind, en)}
            visible={false}
            locale={locale}
            hideLabel={en ? "Make this contact private" : "إخفاء قناة التواصل عن العامة"}
            showLabel={en ? "Show this contact publicly" : "إظهار قناة التواصل للعامة"}
          />}
        </Field>
        </FieldGroup>
      </TalentForm>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{en ? "Cancel" : "إلغاء"}</DialogClose>
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
  const visibilityLabel = en ? "Show this contact publicly" : "إظهار قناة التواصل للعامة";
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={en ? "Edit contact" : "تعديل القناة"} title={en ? "Edit" : "تعديل"} />}>
      <Pencil aria-hidden="true" />
    </DialogTrigger>
    <DialogContent dir={en ? "ltr" : "rtl"} className="talent-form-dialog font-sans" showCloseButton={false}>
      <DialogHeader className="text-start">
        <DialogTitle>{en ? "Edit contact channel" : "تعديل قناة التواصل"}</DialogTitle>
      </DialogHeader>
      <TalentForm
        operation="update-link"
        fields={{ link: link.id, kind: link.link_type, label: link.label }}
        label={en ? "Save changes" : "حفظ التعديلات"}
        buttonClassName="button button-compact w-fit"
        formClassName="flex flex-col gap-4"
        locale={locale}
        onSuccess={close}
      >
        <Field>
          <FieldLabel htmlFor={valueId}>{label}</FieldLabel>
          <div className="relative">
            {link.link_type === "Phone" ? <PhoneInput id={valueId} name="value" defaultValue={link.url_or_value} locale={locale} required /> : <><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground"><TalentChannelIcon kind={link.link_type} className="size-4" /></span>
            <Input id={valueId} name="value" defaultValue={link.url_or_value} type={link.link_type === "Email" ? "email" : "text"} inputMode={link.link_type === "Email" ? "email" : "url"} dir="ltr" className="ps-9 text-right font-sans" required maxLength={2048} autoComplete="off" /></>}
          </div>
        </Field>
        <Field orientation="horizontal" className="items-center justify-between gap-4 border-t border-border pt-3">
          <FieldLabel>{visibilityLabel}</FieldLabel>
          {link.link_type === "Phone" ? <Badge variant="outline">{en?"Private phone number":"رقم جوال خاص"}</Badge> : <ContactVisibilityButton name="visible" label={label} visible={link.is_public} locale={locale} />}
        </Field>
      </TalentForm>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{en ? "Cancel" : "إلغاء"}</DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function AddSkillDialog({ locale, disabled }: { locale: Locale; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const en = locale === "en";
  const visibilityLabel = en ? "Show skill publicly" : "إظهار المهارة للعامة";
  const nameId = "talent-new-skill";
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-2" />}>
      <Plus aria-hidden="true" />{en ? "Add skill" : "إضافة مهارة"}
    </DialogTrigger>
    <DialogContent dir={en ? "ltr" : "rtl"} className="talent-form-dialog font-sans" showCloseButton={false}>
      <DialogHeader className="text-start">
        <DialogTitle>{en ? "Add a skill" : "إضافة مهارة"}</DialogTitle>
      </DialogHeader>
      <TalentForm operation="skill" label={en ? "Add skill" : "إضافة المهارة"} buttonClassName="button button-compact w-fit" formClassName="flex flex-col gap-4" locale={locale} onSuccess={close}>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor={nameId}>{en ? "Skill name" : "اسم المهارة"}</FieldLabel>
            <Input id={nameId} name="name" required minLength={2} maxLength={80} autoComplete="off" />
          </Field>
          <Field orientation="horizontal" className="items-center justify-between gap-4 border-t border-border pt-3">
            <FieldLabel>{visibilityLabel}</FieldLabel>
            <ContactVisibilityButton
              name="visible"
              label={en ? "skill" : "المهارة"}
              visible={false}
              locale={locale}
              hideLabel={en ? "Make this skill private" : "إخفاء المهارة عن العامة"}
              showLabel={en ? "Show this skill publicly" : "إظهار المهارة للعامة"}
            />
          </Field>
        </FieldGroup>
      </TalentForm>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{en ? "Cancel" : "إلغاء"}</DialogClose>
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
      <Plus aria-hidden="true" />{en ? "Add achievement" : "إضافة إنجاز"}
    </DialogTrigger>
    <DialogContent dir={en ? "ltr" : "rtl"} className="talent-form-dialog font-sans sm:max-w-lg" showCloseButton={false}>
      <DialogHeader className="text-start">
        <DialogTitle>{en ? "Add a verified achievement" : "إضافة إنجاز موثق"}</DialogTitle>
      </DialogHeader>
      <NewProject sources={sources.slice(0, 25)} locale={locale} onSuccess={close} />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{en ? "Cancel" : "إلغاء"}</DialogClose>
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
  const publishLabel = en ? "Publish my profile in talent discovery" : "نشر ملفي في اكتشاف المواهب";
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
                <FieldLabel htmlFor="talent-bio">{en ? "About me" : "نبذة عني"}</FieldLabel>
                <Textarea id="talent-bio" name="bio" rows={4} maxLength={1000} defaultValue={data.bio} placeholder={en ? "A short introduction…" : "اكتب نبذة قصيرة عنك…"} />
              </Field>
            </FieldGroup>

            <section aria-labelledby="talent-contact-heading" className="flex flex-col gap-3 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 id="talent-contact-heading" className="text-sm font-semibold">{en ? "Contact channels" : "قنوات التواصل"}</h3>
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
                    {link.link_type === "Phone" ? <Badge variant="outline">{en?"Private phone number":"رقم جوال خاص"}</Badge> : <ContactVisibilityButton key={`${link.id}-${link.is_public}`} name={`${fields}visible`} label={label} visible={link.is_public} locale={locale} onVisibilityChange={markDirty} />}
                    <EditContactDialog link={link} locale={locale} />
                    <DeleteConfirmation id={link.id} operation="remove-link" item={label} locale={locale} />
                  </li>;
                })}
              </ul> : <InlineEmpty>{en ? "No contact channels have been added." : "لم تتم إضافة قنوات تواصل بعد."}</InlineEmpty>}
            </section>

            <section className="flex flex-col gap-3 border-t border-border/60 pt-4" aria-labelledby="talent-skills-heading">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="talent-skills-heading" className="text-sm font-semibold">{en ? "Skills" : "المهارات"}</h3>
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
                    <ContactVisibilityButton key={`${skill.name}-${skill.public}`} name={`skill_${index}_visible`} label={skill.name} visible={skill.public} locale={locale} onVisibilityChange={markDirty} />
                    <DeleteConfirmation id={skill.name} operation="remove-skill" item={skill.name} locale={locale} />
                  </li>;
                })}
                </ul>
              </> : <InlineEmpty>{en ? "No skills have been added." : "لم تتم إضافة مهارات بعد."}</InlineEmpty>}
            </section>

            <section className="flex flex-col gap-3 border-t border-border pt-4" aria-labelledby="talent-achievements-heading">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="talent-achievements-heading" className="text-sm font-semibold">{en ? "Achievements" : "الإنجازات"}</h3>
                </div>
                {data.sources.length > 0 && <AddProjectDialog sources={data.sources} locale={locale} />}
              </div>
              {data.projects.length ? <div className="flex flex-col gap-2">
                <input type="hidden" name="projectCount" value={Math.min(data.projects.length, 25)} />
                {data.projects.slice(0, 25).map((project, index) => <details key={project.id} className="group rounded-lg border border-border bg-background">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
                    <span dir="auto" className="min-w-0 break-words text-sm font-medium">{project.display_title}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><span>{project.is_featured ? en ? "Featured" : "مثبت" : en ? "Verified" : "موثق"}</span><ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" /></span>
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-border p-3">
                    <input type="hidden" name={`project_${index}_id`} value={project.id} />
                    {project.task_participant_id && <input type="hidden" name={`project_${index}_participant`} value={project.task_participant_id} />}
                    {project.event_contribution_id && <input type="hidden" name={`project_${index}_contribution`} value={project.event_contribution_id} />}
                    <ProjectFields locale={locale} namePrefix={`project_${index}_`} value={project} />
                  </div>
                </details>)}
              </div> : <InlineEmpty>{en ? "No achievements have been added." : "لم تتم إضافة إنجازات بعد."}</InlineEmpty>}
              <TalentPagination pages={pages} keyName="projects" more={data.projects.length > 25} locale={locale} />
              <TalentPagination pages={pages} keyName="sources" more={data.sources.length > 25} locale={locale} />
            </section>
      </CardContent>
      {state.error && <p ref={message} tabIndex={-1} role="alert" className="error-message mx-4 mb-3">{actionFeedback(state.error, locale)}</p>}
      {showSuccess && state.success && <p role="status" className="mx-4 mb-3 text-sm text-action">{actionFeedback(state.success, locale)}</p>}
      <CardFooter className="flex-wrap items-center justify-start gap-3 border-t border-border bg-card p-4">
        <div className="flex w-fit min-w-fit shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-sm font-medium">{en ? "Publish my profile" : "نشر ملفي"}</span>
          <ContactVisibilityButton
            name="enabled"
            label={publishLabel}
            visible={data.settings.public_profile_enabled}
            locale={locale}
            hideLabel={en ? "Unpublish my talent profile" : "إيقاف نشر ملفي المهاري"}
            showLabel={en ? "Publish my talent profile" : "نشر ملفي المهاري"}
            onVisibilityChange={markDirty}
          />
        </div>
        <Field orientation="horizontal"><FieldLabel htmlFor="talent-indexing">{en?"Allow search engines to index my public profile":"السماح لمحركات البحث بفهرسة ملفي العام"}</FieldLabel><Switch id="talent-indexing" name="indexable" value="true" defaultChecked={data.settings.allow_indexing??false} onCheckedChange={markDirty}/></Field>
        {data.settings.public_profile_enabled && data.settings.public_slug && <Button render={<Link href={`/talent/${data.settings.public_slug}`} />} variant="outline" size="sm" className="w-fit shrink-0 gap-1.5 no-underline" aria-label={en ? "View public profile" : "عرض الملف العام"}>
          <Eye aria-hidden="true" data-icon="inline-start" /><span>{en ? "View profile" : "عرض الملف العام"}</span>
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
      <h1>{en ? "My talent profile" : "ملفي المهاري"}</h1>
    </header>
    <ProfileSettingsForm data={data} user={user} pages={pages} locale={locale} />
  </main>;
}
