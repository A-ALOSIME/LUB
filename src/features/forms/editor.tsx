"use client";

import {useRouter} from "next/navigation";
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
  Copy,
  Ellipsis,
} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuGroup,DropdownMenuItem,DropdownMenuSeparator} from "@/components/ui/dropdown-menu";
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
  type FormField as QuestionField,
} from "./definition";
import { mutateWorkflow } from "./actions";
import type { Locale } from "@/lib/preferences";
import { FormField } from "@/components/form-field";

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
  returnHref,
}: {
  version: string;
  revision: number;
  initial: FormDefinition;
  locale?: Locale;
  returnHref?: string;
}) {
  const router=useRouter();
  const en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar),
    id = useId(),
    formRef = useRef<HTMLFormElement>(null),
    expected = useRef(revision);
  const [definition, setDefinition] = useState(initial),
    [saved, setSaved] = useState(JSON.stringify(initial)),
    [drag, setDrag] = useState<{ section: number; field?: number } | null>(null),
    [openedSections,setOpenedSections]=useState<string[]>([]),
    [openedQuestions,setOpenedQuestions]=useState<string[]>([]),
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
  const update = (si: number, fi: number, patch: Partial<QuestionField>) =>
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
                  (f.condition?.operator === "Answered" || !previous.options.length ||
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
          if(returnHref)router.push(returnHref);
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
  const newField = (): QuestionField => ({
    id: crypto.randomUUID(),
    type: "ShortText",
    label: c("سؤال جديد", "New question"),
    help: "",
    required: false,
    options: [],
    maxLength: 300,
  });
  function addQuestion(si:number) {
    const field=newField();setOpenedQuestions(previous=>[...previous,field.id]);
    setDefinition(d=>({...d,sections:d.sections.map((section,i)=>i===si?{...section,fields:[...section.fields,field]}:section)}));
  }
  function addSection() {
    const section={id:crypto.randomUUID(),title:c("قسم جديد","New section"),description:"",fields:[newField()]};
    setOpenedSections(previous=>[...previous,section.id]);setOpenedQuestions(previous=>[...previous,section.fields[0].id]);
    setDefinition(d=>({...d,sections:[...d.sections,section]}));
  }
  function copyQuestion(si:number,fi:number) {
    const next=structuredClone(definition),field={...next.sections[si].fields[fi],id:crypto.randomUUID()};
    next.sections[si].fields.splice(fi+1,0,field);setOpenedQuestions(previous=>[...previous,field.id]);setDefinition(next);
  }
  function copySection(si:number) {
    const next=structuredClone(definition),section=structuredClone(next.sections[si]);section.id=crypto.randomUUID();
    const ids=new Map(section.fields.map(field=>[field.id,crypto.randomUUID()]));
    section.fields=section.fields.map(field=>({...field,id:ids.get(field.id)!,...(field.condition?{condition:{...field.condition,fieldId:ids.get(field.condition.fieldId)??field.condition.fieldId}}:{})}));
    next.sections.splice(si+1,0,section);setOpenedSections(previous=>[...previous,section.id]);setDefinition(next);
  }
  if(published)return <p role="status">{c("تم نشر النسخة","Version published")}</p>;
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
          <ToggleGroup id={`${id}-layout`} aria-label={c("طريقة العرض","Layout")} variant="outline" value={[definition.layout]} onValueChange={values=>{if(values[0])setDefinition({...definition,layout:values[0] as FormDefinition["layout"]});}}><ToggleGroupItem value="SinglePage">{c("صفحة واحدة","Single page")}</ToggleGroupItem><ToggleGroupItem value="Progressive">{c("قسم في كل خطوة","One section per step")}</ToggleGroupItem></ToggleGroup>
        </Field>
        {definition.sections.map((section, si) => (
          <EditorSection
            key={section.id}
            title={`${c("القسم", "Section")} ${si + 1}: ${section.title}`}
            defaultOpen={openedSections.includes(section.id)}
            onDrop={event=>{event.preventDefault();if(drag&&drag.field===undefined)moveSection(drag.section,si);setDrag(null);}}
            tools={<><Button type="button" variant="ghost" size="icon-sm" draggable aria-label={c("اسحب لإعادة ترتيب القسم","Drag to reorder section")} onDragStart={event=>{setDrag({section:si});event.dataTransfer.setData("text/plain",section.id);}} onDragEnd={()=>setDrag(null)}><GripVertical/></Button><EditorMenu label={`${c("أدوات القسم","Section actions")} ${si+1}`} locale={locale} upDisabled={!si} downDisabled={si===definition.sections.length-1} copyDisabled={definition.sections.length>=12} deleteDisabled={definition.sections.length===1} onUp={()=>moveSection(si,si-1)} onDown={()=>moveSection(si,si+1)} onCopy={()=>copySection(si)} onDelete={()=>setRemoval({title:section.title,section:si})}/></>}
          >
            <FieldGroup>
              <FormField  id={`${section.id}-title`} label={<>
                  {c("عنوان القسم", "Section title")}
                </>}>
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
              </FormField>
              <FormField  id={`${section.id}-description`} label={<>
                  {c("وصف القسم", "Section description")}
                </>}>
                <Textarea
                  id={`${section.id}-description`}
                  placeholder={c("وصف قصير يوضح محتوى هذا القسم", "Briefly describe this section")}
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
              </FormField>
            </FieldGroup>
            <div className="flex flex-col gap-4">
              {section.fields.map((field, fi) => {
                const earlier = definition.sections
                  .flatMap((s, i) =>
                    i < si ? s.fields : i === si ? s.fields.slice(0, fi) : [],
                  )
                  .filter((f) => f.type !== "File");
                const conditionSource=earlier.find(previous=>previous.id===field.condition?.fieldId);
                const answeredCondition=field.condition?.operator==="Answered" || (conditionSource?.type==="Committee" && field.condition?.operator==="Equals" && field.condition.value==="true");
                return (
                  <EditorSection key={field.id} kind="question" defaultOpen={openedQuestions.includes(field.id)} title={<><span className="min-w-0 truncate">{c("السؤال","Question")} {fi+1} · {field.label}</span><Badge variant="outline" className="editor-question-type">{en?fieldTypesEn[field.type]:fieldTypes[field.type]}</Badge>{field.required&&<Badge variant="secondary">{c("مطلوب","Required")}</Badge>}</>}
                    onDrop={event=>{event.preventDefault();event.stopPropagation();if(drag?.section===si&&drag.field!==undefined)move(si,drag.field,fi);setDrag(null);}}
                    tools={<><Button type="button" variant="ghost" size="icon-sm" draggable aria-label={c("اسحب لإعادة ترتيب السؤال","Drag to reorder question")} onDragStart={event=>{setDrag({section:si,field:fi});event.dataTransfer.setData("text/plain",field.id);}} onDragEnd={()=>setDrag(null)}><GripVertical/></Button><QuestionActions label={`${c("السؤال","Question")} ${fi+1}`} locale={locale} upDisabled={!fi} downDisabled={fi===section.fields.length-1} copyDisabled={section.fields.length>=30} deleteDisabled={section.fields.length===1} onUp={()=>move(si,fi,fi-1)} onDown={()=>move(si,fi,fi+1)} onCopy={()=>copyQuestion(si,fi)} onDelete={()=>setRemoval({title:field.label,section:si,field:fi})}/></>}
                  >
                    <FieldGroup>
                      <FormField  id={`${field.id}-label`} label={<>
                          {c("السؤال", "Question")}
                        </>}>
                        <Input
                          id={`${field.id}-label`}
                          required
                          maxLength={300}
                          value={field.label}
                          onChange={(e) =>
                            update(si, fi, { label: e.target.value })
                          }
                        />
                      </FormField>
                      <div className="grid items-end gap-4 sm:grid-cols-2">
                        <Field>
                          <div className="flex flex-wrap items-center justify-between gap-2"><FieldLabel htmlFor={`${field.id}-type`}>{c("نوع الإجابة", "Answer type")}</FieldLabel>
                            <div className="flex shrink-0 items-center gap-2">
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
                            </div>
                          </div>
                          <NativeSelect
                            id={`${field.id}-type`}
                            value={field.type}
                            onChange={(e) => {
                              const type = e.target.value as QuestionField["type"];
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
                          <FormField  id={`${field.id}-max`} label={<>
                              {c("الحد الأقصى للأحرف", "Maximum characters")}
                            </>}>
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
                          </FormField>
                        )}
                      </div>
                      {field.type === "Committee" && <FieldDescription>{c("تُحدّث الخيارات تلقائيًا من لجان الجهة الرئيسية والفرعية المتاحة للمتقدمين.","Choices stay in sync with the organization’s public committees and subcommittees.")}</FieldDescription>}
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
                            <FormField key={key} id={`${field.id}-${key}`} label={<>
                                {key === "min"
                                  ? c("أقل قيمة", "Minimum")
                                  : c("أعلى قيمة", "Maximum")}
                              </>}>
                              <Input
                                id={`${field.id}-${key}`}
                                placeholder={c("بدون حد", "No limit")}
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
                            </FormField>
                          ))}
                        </div>
                      )}
                      <Collapsible>
                        <CollapsibleTrigger className="group flex w-full items-center gap-2 py-2 text-start text-sm font-medium">
                          <ChevronDown className="size-4 transition-transform group-data-panel-open:rotate-180" />
                          {c("خيارات متقدمة", "Advanced options")}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                          <FieldGroup>
                            <FormField  id={`${field.id}-help`} label={<>
                                {c("توضيح اختياري", "Optional help text")}
                              </>}>
                              <Input
                                id={`${field.id}-help`}
                                placeholder={c("توضيح يساعد الطالب على الإجابة", "Help the student answer this question")}
                                maxLength={1000}
                                value={field.help}
                                onChange={(e) =>
                                  update(si, fi, { help: e.target.value })
                                }
                              />
                            </FormField>
                            <FormField  id={`${field.id}-condition`} label={<>
                                {c(
                                  "شرط ظهور السؤال",
                                  "Question visibility condition",
                                )}
                              </>}>
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
                                          operator: previous.type==="Committee"?"Answered":"Equals",
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
                            </FormField>
                            {field.condition && (
                              <div className="grid gap-4 sm:grid-cols-2">
                                <FormField  id={`${field.id}-comparison`} label={<>
                                    {c("المقارنة", "Comparison")}
                                  </>}>
                                  <NativeSelect
                                    id={`${field.id}-comparison`}
                                    value={answeredCondition?"Answered":field.condition.operator}
                                    onChange={(e) =>
                                      update(si, fi, {
                                        condition: {
                                          ...field.condition!,
                                          operator: e.target.value as NonNullable<QuestionField["condition"]>["operator"],
                                          value:e.target.value==="Answered"?"true":conditionSource?.options[0]?.value??"true",
                                        },
                                      })
                                    }
                                  >
                                    <option value="Answered">{c("تمت الإجابة", "Has an answer")}</option>
                                    {(conditionSource?.type!=="Committee" || !answeredCondition)&&<><option value="Equals">{c("يساوي", "Equals")}</option><option value="NotEquals">{c("لا يساوي", "Does not equal")}</option></>}
                                  </NativeSelect>
                                </FormField>
                                {!answeredCondition&&<Field>
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
                                </Field>}
                                {answeredCondition&&<FieldDescription>{c("يظهر هذا السؤال بعد الإجابة عن السؤال المحدد.","Show this question after the selected question has an answer.")}</FieldDescription>}
                              </div>
                            )}
                          </FieldGroup>
                        </CollapsibleContent>
                      </Collapsible>
                    </FieldGroup>
                  </EditorSection>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              className="editor-add-question"
              disabled={section.fields.length >= 30}
              onClick={() => addQuestion(si)}
            >
              <Plus />
              {c("إضافة سؤال", "Add question")}
            </Button>
          </EditorSection>
        ))}
        <Button
          type="button"
          variant="outline"
          className="editor-add-section"
          disabled={definition.sections.length >= 12}
          onClick={addSection}
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
              ? <Badge variant="secondary">{c("غير محفوظ","Unsaved")}</Badge>
              : c("المسودة محفوظة", "Draft saved")
          }
          actions={
            <>

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
              <Button
                type="submit"
                variant="outline"
                disabled={pending || !dirty}
              >
                <Save />
                {c("حفظ المسودة", "Save draft")}
              </Button>
            </>
          }
        />
      </form>
      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent className="editor-confirmation" dir={en ? "ltr" : "rtl"}>
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
        <AlertDialogContent className="editor-confirmation" dir={en ? "ltr" : "rtl"}>
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
function EditorSection({title,tools,children,defaultOpen=false,kind="section",onDrop}:{title:React.ReactNode;tools:React.ReactNode;children:React.ReactNode;defaultOpen?:boolean;kind?:"section"|"question";onDrop?:React.DragEventHandler<HTMLDivElement>}) {
 const [open,setOpen]=useState(defaultOpen);
 return <Collapsible open={open} onOpenChange={setOpen} className={`editor-panel editor-${kind}`} onDragOver={event=>event.preventDefault()} onDrop={onDrop}>
  <Card className="gap-0 py-0"><CardHeader className="editor-section-header"><CardTitle className="min-w-0 flex-1"><CollapsibleTrigger render={<Button type="button" variant="ghost" className="editor-collapse-heading"/>}><ChevronDown className={open?"rotate-180":""}/><span className="editor-heading-summary">{title}</span></CollapsibleTrigger></CardTitle><div className="editor-panel-tools">{tools}</div></CardHeader><CollapsibleContent className="editor-section-content"><CardContent className="flex flex-col gap-5 py-4">{children}</CardContent></CollapsibleContent></Card>
 </Collapsible>;
}
function EditorMenu({label,locale,upDisabled,downDisabled,copyDisabled,deleteDisabled,onUp,onDown,onCopy,onDelete}:{label:string;locale:Locale;upDisabled:boolean;downDisabled:boolean;copyDisabled:boolean;deleteDisabled:boolean;onUp:()=>void;onDown:()=>void;onCopy:()=>void;onDelete:()=>void}) {
 const en=locale==="en";
 return <DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={label}/>}><Ellipsis/></DropdownMenuTrigger><DropdownMenuContent align="end" className="form-editor-menu"><DropdownMenuGroup><DropdownMenuItem disabled={upDisabled} onClick={onUp}><ArrowUp/>{en?"Move up":"تحريك لأعلى"}</DropdownMenuItem><DropdownMenuItem disabled={downDisabled} onClick={onDown}><ArrowDown/>{en?"Move down":"تحريك لأسفل"}</DropdownMenuItem><DropdownMenuItem disabled={copyDisabled} onClick={onCopy}><Copy/>{en?"Duplicate":"نسخ"}</DropdownMenuItem></DropdownMenuGroup><DropdownMenuSeparator/><DropdownMenuGroup><DropdownMenuItem variant="destructive" disabled={deleteDisabled} onClick={onDelete}><Trash2/>{en?"Delete":"حذف"}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>;
}

function QuestionActions({label,locale,upDisabled,downDisabled,copyDisabled,deleteDisabled,onUp,onDown,onCopy,onDelete}:{label:string;locale:Locale;upDisabled:boolean;downDisabled:boolean;copyDisabled:boolean;deleteDisabled:boolean;onUp:()=>void;onDown:()=>void;onCopy:()=>void;onDelete:()=>void}){
 const en=locale==="en";
 return <>{[
  {name:en?"Move up":"تحريك لأعلى",Icon:ArrowUp,disabled:upDisabled,run:onUp},
  {name:en?"Move down":"تحريك لأسفل",Icon:ArrowDown,disabled:downDisabled,run:onDown},
  {name:en?"Duplicate question":"نسخ السؤال",Icon:Copy,disabled:copyDisabled,run:onCopy},
  {name:en?"Delete question":"حذف السؤال",Icon:Trash2,disabled:deleteDisabled,run:onDelete,danger:true},
 ].map(({name,Icon,disabled,run,danger})=><RowAction key={name} label={`${name} · ${label}`} hint={name} disabled={disabled} danger={danger} onClick={run}><Icon/></RowAction>)}</>;
}
