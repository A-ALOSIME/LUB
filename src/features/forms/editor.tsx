"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
  Upload,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
} from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { WorkspaceStickySaveBar } from "@/components/workspace-sticky-save-bar";
import { RowAction } from "@/components/row-action";
import { toast } from "@/components/ui/toast";
import {
  fieldTypes,
  fieldTypesEn,
  definitionSchema,
  type FormDefinition,
  type FormField,
} from "./definition";
import { WorkflowForm } from "./mutation-form";
import { mutateWorkflow } from "./actions";
import type { Locale } from "@/lib/preferences";

type Removal = {
  title: string;
  section: number;
  field?: number;
  option?: number;
};
export function FormEditor({
  version,
  revision,
  initial,
  locale = "ar",
  template,
}: {
  version: string;
  revision: number;
  initial: FormDefinition;
  locale?: Locale;
  template?: string;
}) {
  const en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar),
    id = useId(),
    formRef = useRef<HTMLFormElement>(null),
    expected = useRef(revision);
  const [definition, setDefinition] = useState(initial),
    [saved, setSaved] = useState(JSON.stringify(initial)),
    [drag, setDrag] = useState<{ section: number; field: number } | null>(null),
    [removal, setRemoval] = useState<Removal | null>(null),
    [publishOpen, setPublishOpen] = useState(false),
    [published, setPublished] = useState(false),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(definition) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  const update = (si: number, fi: number, patch: Partial<FormField>) =>
    setDefinition((d) => ({
      ...d,
      sections: d.sections.map((s, i) =>
        i === si
          ? {
              ...s,
              fields: s.fields.map((f, j) =>
                j === fi ? { ...f, ...patch } : f,
              ),
            }
          : s,
      ),
    }));
  function reorder(next: FormDefinition) {
    const seen = new Set<string>();
    for (const section of next.sections)
      for (const field of section.fields) {
        if (field.condition && !seen.has(field.condition.fieldId)) {
          toast.add({
            title: c(
              "لا يمكن نقل السؤال قبل السؤال الذي يعتمد عليه شرط ظهوره.",
              "Keep conditional questions after the answers they depend on.",
            ),
            type: "error",
            timeout: 0,
          });
          return;
        }
        seen.add(field.id);
      }
    setDefinition(next);
  }
  function move(si: number, fi: number, to: number) {
    if (to < 0 || to >= definition.sections[si].fields.length) return;
    const next = structuredClone(definition),
      fields = next.sections[si].fields;
    fields.splice(to, 0, fields.splice(fi, 1)[0]);
    reorder(next);
  }
  function moveSection(si: number, to: number) {
    if (to < 0 || to >= definition.sections.length) return;
    const next = structuredClone(definition);
    next.sections.splice(to, 0, next.sections.splice(si, 1)[0]);
    reorder(next);
  }
  function remove() {
    if (!removal) return;
    const next = structuredClone(definition),
      section = next.sections[removal.section],
      removed = new Set<string>();
    if (removal.field === undefined) {
      section.fields.forEach((f) => removed.add(f.id));
      next.sections.splice(removal.section, 1);
    } else if (removal.option === undefined) {
      removed.add(section.fields[removal.field].id);
      section.fields.splice(removal.field, 1);
    } else {
      section.fields[removal.field].options.splice(removal.option, 1);
    }
    for (const s of next.sections)
      for (const f of s.fields)
        if (
          f.condition &&
          (removed.has(f.condition.fieldId) ||
            !next.sections
              .flatMap((s) => s.fields)
              .some(
                (previous) =>
                  previous.id === f.condition?.fieldId &&
                  (!previous.options.length ||
                    previous.options.some(
                      (o) => o.value === f.condition?.value,
                    )),
              ))
        )
          delete f.condition;
    setDefinition(next);
    setRemoval(null);
  }
  function perform(publish = false) {
    if (!formRef.current?.reportValidity()) return;
    const checked = definitionSchema.safeParse(definition);
    if (!checked.success) {
      setError(
        c(
          "راجع الأسئلة والخيارات وشروط الظهور قبل الحفظ.",
          "Review questions, options and visibility conditions.",
        ),
      );
      return;
    }
    setError("");
    const snapshot = JSON.stringify(checked.data);
    startTransition(async () => {
      try {
        if (snapshot !== saved) {
          const form = new FormData();
          form.set("operation", "save-form");
          form.set("version", version);
          form.set("revision", String(expected.current));
          form.set("definition", snapshot);
          const result = await mutateWorkflow({}, form);
          if (result.error) throw new Error(result.error);
          expected.current++;
          setSaved(snapshot);
        }
        if (publish) {
          const form = new FormData();
          form.set("operation", "publish-form");
          form.set("version", version);
          const result = await mutateWorkflow({}, form);
          if (result.error) throw new Error(result.error);
          setPublished(true);
          setPublishOpen(false);
        }
        toast.add({
          title: publish
            ? c("تم نشر النسخة", "Version published")
            : c("تم حفظ المسودة", "Draft saved"),
          type: "success",
          timeout: 3000,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : c("تعذر الحفظ.", "Unable to save.");
        setError(message);
        toast.add({ title: message, type: "error", timeout: 0 });
      }
    });
  }
  const newField = (): FormField => ({
    id: crypto.randomUUID(),
    type: "ShortText",
    label: c("سؤال جديد", "New question"),
    help: "",
    required: false,
    options: [],
    maxLength: 300,
  });
  if (published)
    return (
      <div className="flex flex-col gap-4">
        <p role="status">
          {c(
            "تم نشر النسخة. هذه النسخة للقراءة فقط.",
            "Published. This version is read-only.",
          )}
        </p>
        <ul>
          {definition.sections
            .flatMap((s) => s.fields)
            .map((f) => (
              <li key={f.id}>{f.label}</li>
            ))}
        </ul>
        {template && (
          <WorkflowForm
            operation="draft-form"
            fields={{ template }}
            label={c("بدء مسودة نسخة جديدة", "Start a new draft version")}
            locale={locale}
          />
        )}
      </div>
    );
  return (
    <>
      <form
        id={id}
        ref={formRef}
        className="form-editor flex min-w-0 flex-col gap-5 pb-32"
        onSubmit={(event) => {
          event.preventDefault();
          perform();
        }}
      >
        <input
          type="hidden"
          name="definition"
          value={JSON.stringify(definition)}
        />
        <Field className="max-w-sm">
          <FieldLabel htmlFor={`${id}-layout`}>
            {c("طريقة العرض", "Layout")}
          </FieldLabel>
          <NativeSelect
            id={`${id}-layout`}
            value={definition.layout}
            onChange={(e) =>
              setDefinition({
                ...definition,
                layout: e.target.value as FormDefinition["layout"],
              })
            }
          >
            <option value="SinglePage">{c("صفحة واحدة", "Single page")}</option>
            <option value="Progressive">
              {c("قسم في كل خطوة", "One section per step")}
            </option>
          </NativeSelect>
        </Field>
        {definition.sections.map((section, si) => (
          <EditorSection
            key={section.id}
            title={`${c("القسم", "Section")} ${si + 1}: ${section.title}`}
            tools={
              <>
                <RowAction
                  label={`${c("رفع القسم", "Move section up")} ${si + 1}`}
                  disabled={!si}
                  onClick={() => moveSection(si, si - 1)}
                >
                  <ArrowUp />
                </RowAction>
                <RowAction
                  label={`${c("خفض القسم", "Move section down")} ${si + 1}`}
                  disabled={si === definition.sections.length - 1}
                  onClick={() => moveSection(si, si + 1)}
                >
                  <ArrowDown />
                </RowAction>
                <RowAction
                  danger
                  label={c("حذف القسم", "Delete section")}
                  disabled={definition.sections.length === 1}
                  onClick={() =>
                    setRemoval({ title: section.title, section: si })
                  }
                >
                  <Trash2 />
                </RowAction>
              </>
            }
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${section.id}-title`}>
                  {c("عنوان القسم", "Section title")}
                </FieldLabel>
                <Input
                  id={`${section.id}-title`}
                  required
                  maxLength={120}
                  value={section.title}
                  onChange={(e) =>
                    setDefinition({
                      ...definition,
                      sections: definition.sections.map((s, i) =>
                        i === si ? { ...s, title: e.target.value } : s,
                      ),
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${section.id}-description`}>
                  {c("وصف القسم", "Section description")}
                </FieldLabel>
                <Textarea
                  id={`${section.id}-description`}
                  maxLength={1000}
                  rows={2}
                  value={section.description}
                  onChange={(e) =>
                    setDefinition({
                      ...definition,
                      sections: definition.sections.map((s, i) =>
                        i === si ? { ...s, description: e.target.value } : s,
                      ),
                    })
                  }
                />
              </Field>
            </FieldGroup>
            <div className="flex flex-col gap-4">
              {section.fields.map((field, fi) => {
                const earlier = definition.sections
                  .flatMap((s, i) =>
                    i < si ? s.fields : i === si ? s.fields.slice(0, fi) : [],
                  )
                  .filter((f) => f.type !== "File");
                return (
                  <div
                    className="editor-question"
                    key={field.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (drag?.section === si) move(si, drag.field, fi);
                      setDrag(null);
                    }}
                  >
                    <div className="editor-question-heading">
                      <h4 className="font-medium">
                        {c("السؤال", "Question")} {fi + 1}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          draggable
                          aria-label={c(
                            "اسحب لإعادة ترتيب السؤال",
                            "Drag to reorder question",
                          )}
                          onDragStart={(event) => {
                            setDrag({ section: si, field: fi });
                            event.dataTransfer.setData("text/plain", field.id);
                          }}
                          onDragEnd={() => setDrag(null)}
                        >
                          <GripVertical />
                        </Button>
                        <RowAction
                          label={`${c("رفع السؤال", "Move question up")} ${fi + 1}`}
                          disabled={!fi}
                          onClick={() => move(si, fi, fi - 1)}
                        >
                          <ArrowUp />
                        </RowAction>
                        <RowAction
                          label={`${c("خفض السؤال", "Move question down")} ${fi + 1}`}
                          disabled={fi === section.fields.length - 1}
                          onClick={() => move(si, fi, fi + 1)}
                        >
                          <ArrowDown />
                        </RowAction>
                        <RowAction
                          danger
                          label={c("حذف السؤال", "Delete question")}
                          disabled={section.fields.length === 1}
                          onClick={() =>
                            setRemoval({
                              title: field.label,
                              section: si,
                              field: fi,
                            })
                          }
                        >
                          <Trash2 />
                        </RowAction>
                      </div>
                    </div>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={`${field.id}-label`}>
                          {c("السؤال", "Question")}
                        </FieldLabel>
                        <Input
                          id={`${field.id}-label`}
                          required
                          maxLength={300}
                          value={field.label}
                          onChange={(e) =>
                            update(si, fi, { label: e.target.value })
                          }
                        />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor={`${field.id}-type`}>
                            {c("نوع الإجابة", "Answer type")}
                          </FieldLabel>
                          <NativeSelect
                            id={`${field.id}-type`}
                            value={field.type}
                            onChange={(e) => {
                              const type = e.target.value as FormField["type"];
                              update(si, fi, {
                                type,
                                options: [
                                  "Select",
                                  "Radio",
                                  "MultiSelect",
                                ].includes(type)
                                  ? [
                                      {
                                        value: "option1",
                                        label: c(
                                          "الخيار الأول",
                                          "First option",
                                        ),
                                      },
                                      {
                                        value: "option2",
                                        label: c(
                                          "الخيار الثاني",
                                          "Second option",
                                        ),
                                      },
                                    ]
                                  : [],
                              });
                            }}
                          >
                            {Object.keys(fieldTypes).map((type) => (
                              <option key={type} value={type}>
                                {
                                  (en ? fieldTypesEn : fieldTypes)[
                                    type as keyof typeof fieldTypes
                                  ]
                                }
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                        {["ShortText", "LongText"].includes(field.type) && (
                          <Field>
                            <FieldLabel htmlFor={`${field.id}-max`}>
                              {c("الحد الأقصى للأحرف", "Maximum characters")}
                            </FieldLabel>
                            <Input
                              id={`${field.id}-max`}
                              type="number"
                              min={1}
                              max={2000}
                              value={field.maxLength}
                              onChange={(e) =>
                                update(si, fi, {
                                  maxLength: Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                        )}
                      </div>
                      <Field orientation="horizontal">
                        <Switch
                          id={`${field.id}-required`}
                          checked={field.required}
                          onCheckedChange={(required) =>
                            update(si, fi, { required })
                          }
                        />
                        <FieldLabel htmlFor={`${field.id}-required`}>
                          {c("إجابة مطلوبة", "Required answer")}
                        </FieldLabel>
                        {field.condition && (
                          <FieldDescription>
                            {c("يظهر بشرط", "Conditional")}
                          </FieldDescription>
                        )}
                      </Field>
                      {field.options.length > 0 && (
                        <FieldGroup>
                          {field.options.map((option, oi) => (
                            <Field key={option.value}>
                              <FieldLabel htmlFor={`${field.id}-option-${oi}`}>
                                {c("الخيار", "Option")} {oi + 1}
                              </FieldLabel>
                              <div className="flex items-center gap-2">
                                <Input
                                  id={`${field.id}-option-${oi}`}
                                  required
                                  maxLength={120}
                                  value={option.label}
                                  onChange={(e) =>
                                    update(si, fi, {
                                      options: field.options.map((o, i) =>
                                        i === oi
                                          ? { ...o, label: e.target.value }
                                          : o,
                                      ),
                                    })
                                  }
                                />
                                <RowAction
                                  danger
                                  label={c("حذف الخيار", "Delete option")}
                                  disabled={field.options.length <= 2}
                                  onClick={() =>
                                    setRemoval({
                                      title: option.label,
                                      section: si,
                                      field: fi,
                                      option: oi,
                                    })
                                  }
                                >
                                  <Trash2 />
                                </RowAction>
                              </div>
                            </Field>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            disabled={field.options.length >= 30}
                            onClick={() =>
                              update(si, fi, {
                                options: [
                                  ...field.options,
                                  {
                                    value: crypto.randomUUID(),
                                    label: c("خيار جديد", "New option"),
                                  },
                                ],
                              })
                            }
                          >
                            <Plus />
                            {c("إضافة خيار", "Add option")}
                          </Button>
                        </FieldGroup>
                      )}
                      {field.type === "Number" && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {(["min", "max"] as const).map((key) => (
                            <Field key={key}>
                              <FieldLabel htmlFor={`${field.id}-${key}`}>
                                {key === "min"
                                  ? c("أقل قيمة", "Minimum")
                                  : c("أعلى قيمة", "Maximum")}
                              </FieldLabel>
                              <Input
                                id={`${field.id}-${key}`}
                                type="number"
                                step="any"
                                value={field[key] ?? ""}
                                onChange={(e) =>
                                  update(si, fi, {
                                    [key]:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </Field>
                          ))}
                        </div>
                      )}
                      <Collapsible>
                        <CollapsibleTrigger
                          render={<Button type="button" variant="ghost" />}
                        >
                          <ChevronDown />
                          {c("خيارات متقدمة", "Advanced options")}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                          <FieldGroup>
                            <Field>
                              <FieldLabel htmlFor={`${field.id}-help`}>
                                {c("توضيح اختياري", "Optional help text")}
                              </FieldLabel>
                              <Input
                                id={`${field.id}-help`}
                                maxLength={1000}
                                value={field.help}
                                onChange={(e) =>
                                  update(si, fi, { help: e.target.value })
                                }
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`${field.id}-condition`}>
                                {c(
                                  "شرط ظهور السؤال",
                                  "Question visibility condition",
                                )}
                              </FieldLabel>
                              <NativeSelect
                                id={`${field.id}-condition`}
                                value={field.condition?.fieldId ?? ""}
                                onChange={(e) => {
                                  const previous = earlier.find(
                                    (f) => f.id === e.target.value,
                                  );
                                  update(si, fi, {
                                    condition: previous
                                      ? {
                                          fieldId: previous.id,
                                          operator: "Equals",
                                          value:
                                            previous.options[0]?.value ??
                                            "true",
                                        }
                                      : undefined,
                                  });
                                }}
                              >
                                <option value="">
                                  {c("يظهر دائمًا", "Always show")}
                                </option>
                                {earlier.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.label}
                                  </option>
                                ))}
                              </NativeSelect>
                            </Field>
                            {field.condition && (
                              <div className="grid gap-4 sm:grid-cols-2">
                                <Field>
                                  <FieldLabel
                                    htmlFor={`${field.id}-comparison`}
                                  >
                                    {c("المقارنة", "Comparison")}
                                  </FieldLabel>
                                  <NativeSelect
                                    id={`${field.id}-comparison`}
                                    value={field.condition.operator}
                                    onChange={(e) =>
                                      update(si, fi, {
                                        condition: {
                                          ...field.condition!,
                                          operator: e.target.value as
                                            "Equals" | "NotEquals",
                                        },
                                      })
                                    }
                                  >
                                    <option value="Equals">
                                      {c("يساوي", "Equals")}
                                    </option>
                                    <option value="NotEquals">
                                      {c("لا يساوي", "Does not equal")}
                                    </option>
                                  </NativeSelect>
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`${field.id}-value`}>
                                    {c("قيمة الإجابة", "Answer value")}
                                  </FieldLabel>
                                  {(() => {
                                    const previous = earlier.find(
                                        (f) =>
                                          f.id === field.condition?.fieldId,
                                      ),
                                      opts =
                                        previous?.type === "Checkbox"
                                          ? [
                                              {
                                                value: "true",
                                                label: c("موافق", "Agreed"),
                                              },
                                              {
                                                value: "false",
                                                label: c(
                                                  "غير موافق",
                                                  "Not agreed",
                                                ),
                                              },
                                            ]
                                          : (previous?.options ?? []);
                                    return opts.length ? (
                                      <NativeSelect
                                        id={`${field.id}-value`}
                                        value={field.condition.value}
                                        onChange={(e) =>
                                          update(si, fi, {
                                            condition: {
                                              ...field.condition!,
                                              value: e.target.value,
                                            },
                                          })
                                        }
                                      >
                                        {opts.map((o) => (
                                          <option key={o.value} value={o.value}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </NativeSelect>
                                    ) : (
                                      <Input
                                        id={`${field.id}-value`}
                                        required
                                        maxLength={120}
                                        value={field.condition.value}
                                        onChange={(e) =>
                                          update(si, fi, {
                                            condition: {
                                              ...field.condition!,
                                              value: e.target.value,
                                            },
                                          })
                                        }
                                      />
                                    );
                                  })()}
                                </Field>
                              </div>
                            )}
                          </FieldGroup>
                        </CollapsibleContent>
                      </Collapsible>
                    </FieldGroup>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={section.fields.length >= 30}
              onClick={() =>
                setDefinition({
                  ...definition,
                  sections: definition.sections.map((s, i) =>
                    i === si ? { ...s, fields: [...s.fields, newField()] } : s,
                  ),
                })
              }
            >
              <Plus />
              {c("إضافة سؤال", "Add question")}
            </Button>
          </EditorSection>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={definition.sections.length >= 12}
          onClick={() =>
            setDefinition({
              ...definition,
              sections: [
                ...definition.sections,
                {
                  id: crypto.randomUUID(),
                  title: c("قسم جديد", "New section"),
                  description: "",
                  fields: [newField()],
                },
              ],
            })
          }
        >
          <Plus />
          {c("إضافة قسم", "Add section")}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <WorkspaceStickySaveBar
          formId={id}
          locale={locale}
          visible
          pending={pending}
          onUndo={() => setDefinition(JSON.parse(saved))}
          message={
            dirty
              ? c("لديك تغييرات غير محفوظة", "You have unsaved changes")
              : c("المسودة محفوظة", "Draft saved")
          }
          actions={
            <>
              <Button
                type="submit"
                variant="outline"
                disabled={pending || !dirty}
              >
                <Save />
                {c("حفظ المسودة", "Save draft")}
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (formRef.current?.reportValidity()) setPublishOpen(true);
                }}
              >
                <Upload />
                {pending
                  ? c("جاري الحفظ", "Saving…")
                  : c("نشر النسخة", "Publish version")}
              </Button>
            </>
          }
        />
      </form>
      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent dir={en ? "ltr" : "rtl"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {c("نشر هذه النسخة؟", "Publish this version?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {c(
                "سنحفظ آخر تعديلاتك ثم نثبّت النسخة لتصبح للقراءة فقط. طلبات الطلاب السابقة تبقى مرتبطة بنسخها ولا تتغير.",
                "Your latest edits will be saved and this version locked. Earlier applications remain attached to their original versions.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction disabled={pending} onClick={() => perform(true)}>
              {c("نشر النسخة", "Publish version")}
            </AlertDialogAction>
            <AlertDialogCancel disabled={pending}>
              {c("إلغاء", "Cancel")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!removal}
        onOpenChange={(open) => {
          if (!open) setRemoval(null);
        }}
      >
        <AlertDialogContent dir={en ? "ltr" : "rtl"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {c(
                `حذف «${removal?.title ?? ""}»؟`,
                `Delete “${removal?.title ?? ""}”?`,
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {c(
                "سيُحذف هذا العنصر من المسودة. تُحفظ النسخ المنشورة والإجابات السابقة.",
                "This item will be removed from the draft. Published versions and previous answers are preserved.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction variant="danger-outline" onClick={remove}>
              {c("حذف", "Delete")}
            </AlertDialogAction>
            <AlertDialogCancel>{c("إلغاء", "Cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function EditorSection({
  title,
  tools,
  children,
}: {
  title: string;
  tools: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="gap-0">
        <CardHeader className="editor-section-header">
          <CardTitle className="min-w-0 break-words">{title}</CardTitle>
          <div className="flex flex-wrap gap-1">
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={open ? "طي القسم" : "فتح القسم"}
                />
              }
            >
              <ChevronDown className={open ? "rotate-180" : ""} />
            </CollapsibleTrigger>
            {tools}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-5 pt-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
