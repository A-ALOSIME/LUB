import { z } from "zod";

export const fieldTypes = { ShortText: "نص قصير", LongText: "نص طويل", Number: "رقم", Email: "بريد", Date: "تاريخ", Select: "قائمة اختيار", Radio: "اختيار واحد", MultiSelect: "اختيارات متعددة", Checkbox: "موافقة", File: "مرفق" } as const;
export const fieldTypesEn:Record<keyof typeof fieldTypes,string> = { ShortText: "Short text", LongText: "Long text", Number: "Number", Email: "Email", Date: "Date", Select: "Dropdown", Radio: "Single choice", MultiSelect: "Multiple choices", Checkbox: "Agreement", File: "Attachment" };
const option = z.object({ value: z.string().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/), label: z.string().trim().min(1).max(120) }).strict();
const field = z.object({
  id: z.uuid().regex(/^[0-9a-f-]+$/), type: z.enum(Object.keys(fieldTypes) as [keyof typeof fieldTypes, ...Array<keyof typeof fieldTypes>]),
  label: z.string().trim().min(1).max(300), help: z.string().trim().max(1000), required: z.boolean(),
  options: z.array(option).max(30), maxLength: z.number().int().min(1).max(2000),
  min: z.number().finite().optional(), max: z.number().finite().optional(),
  condition: z.object({ fieldId: z.uuid().regex(/^[0-9a-f-]+$/), operator: z.enum(["Equals", "NotEquals"]), value: z.string().min(1).max(120) }).strict().optional(),
}).strict();
export const definitionSchema = z.object({ layout: z.enum(["SinglePage", "Progressive"]), sections: z.array(z.object({ id: z.uuid().regex(/^[0-9a-f-]+$/), title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000), fields: z.array(field).min(1).max(30) }).strict()).min(1).max(12) }).strict().superRefine((definition, ctx) => {
  const seen = new Map<string, z.infer<typeof field>>(); const ids = new Set<string>(); let total = 0;
  for (const section of definition.sections) {
    if (ids.has(section.id)) ctx.addIssue({ code: "custom", message: "المعرّفات مكررة." }); ids.add(section.id);
    for (const entry of section.fields) {
      if (ids.has(entry.id)) ctx.addIssue({ code: "custom", message: "المعرّفات مكررة." }); ids.add(entry.id); total++;
      const choices = ["Select", "Radio", "MultiSelect"].includes(entry.type);
      if ((choices && entry.options.length < 2) || (!choices && entry.options.length !== 0) || new Set(entry.options.map(o => o.value)).size !== entry.options.length) ctx.addIssue({ code: "custom", message: "راجع خيارات السؤال." });
      if (entry.min !== undefined && entry.max !== undefined && entry.min > entry.max) ctx.addIssue({ code: "custom", message: "الحدود غير صحيحة." });
      if (entry.condition) {
        const previous = seen.get(entry.condition.fieldId);
        if (!previous || previous.type === "File" || (previous.options.length && !previous.options.some(o => o.value === entry.condition?.value)) || (previous.type === "Checkbox" && !["true", "false"].includes(entry.condition.value))) ctx.addIssue({ code: "custom", message: "الشرط يجب أن يعتمد على إجابة صالحة لسؤال سابق." });
      }
      seen.set(entry.id, entry);
    }
  }
  if (total > 60 || JSON.stringify(definition).length > 64000) ctx.addIssue({ code: "custom", message: "النموذج تجاوز الحجم المسموح." });
});
export type FormDefinition = z.infer<typeof definitionSchema>;
export type FormField = z.infer<typeof field>;
export type Answers = Record<string, string | number | boolean | string[]>;

export function visibleFields(definition: FormDefinition, answers: Answers) {
  const visible = new Set<string>();
  for (const section of definition.sections) for (const entry of section.fields) {
    if (!entry.condition) { visible.add(entry.id); continue; }
    const condition = entry.condition; const value = answers[condition.fieldId];
    if (!visible.has(condition.fieldId) || value === undefined || value === "" || (Array.isArray(value) && !value.length)) continue;
    const equal = Array.isArray(value) ? value.includes(condition.value) : String(value) === condition.value;
    if (condition.operator === "Equals" ? equal : !equal) visible.add(entry.id);
  }
  return visible;
}

export function validateAnswers(definition: FormDefinition, input: unknown): Answers {
  const raw = z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.string()).max(30)])).parse(input);
  const fields = definition.sections.flatMap(section => section.fields); const known = new Set(fields.map(entry => entry.id));
  if (Object.keys(raw).some(id => !known.has(id)) || JSON.stringify(raw).length > 128000) throw new Error("راجع إجابات النموذج.");
  const visible = visibleFields(definition, raw); const output: Answers = {};
  for (const entry of fields) {
    if (!visible.has(entry.id)) continue;
    const value = raw[entry.id];
    const empty = value === undefined || value === "" || (Array.isArray(value) && !value.length) || (entry.type === "Checkbox" && entry.required && value !== true);
    if (empty) { if (entry.required) throw new Error(`أكمل: ${entry.label}`); continue; }
    if (entry.type === "Checkbox") output[entry.id] = z.boolean().parse(value);
    else if (entry.type === "MultiSelect") {
      const options = z.array(z.string()).min(1).max(entry.options.length).parse(value);
      if (new Set(options).size !== options.length || options.some(choice => !entry.options.some(o => o.value === choice))) throw new Error(`راجع: ${entry.label}`);
      output[entry.id] = options;
    } else if (["Select", "Radio"].includes(entry.type)) {
      if (!entry.options.some(o => o.value === value)) throw new Error(`راجع: ${entry.label}`); output[entry.id] = z.string().parse(value);
    } else if (entry.type === "Number") {
      if (!/^-?\d+(\.\d+)?$/.test(String(value))) throw new Error(`راجع: ${entry.label}`);
      const number = z.coerce.number().finite().parse(value);
      if ((entry.min !== undefined && number < entry.min) || (entry.max !== undefined && number > entry.max)) throw new Error(`راجع: ${entry.label}`); output[entry.id] = number;
    } else if (entry.type === "File") output[entry.id] = z.uuid().regex(/^[0-9a-f-]+$/).parse(value);
    else if (entry.type === "Email") output[entry.id] = z.email().max(254).parse(value);
    else if (entry.type === "Date") {
      const date = z.iso.date().parse(value); output[entry.id] = date;
    } else output[entry.id] = z.string().trim().min(1).max(entry.maxLength).parse(value);
  }
  return output;
}

export const initialDefinition: FormDefinition = { layout: "SinglePage", sections: [{ id: "10000000-0000-4000-8000-000000000001", title: "عن مشاركتك", description: "البيانات الأساسية موجودة في ملفك؛ نحتاج التعرف على اهتمامك فقط.", fields: [{ id: "10000000-0000-4000-8000-000000000002", type: "LongText", label: "ليش ترغب بالانضمام؟", help: "", required: true, options: [], maxLength: 1000 }, { id: "10000000-0000-4000-8000-000000000003", type: "LongText", label: "خبرتك أو مهاراتك المرتبطة بالجهة", help: "", required: false, options: [], maxLength: 1500 }] }] };
