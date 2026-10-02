import { expect, it } from "vitest";
import { definitionSchema, validateAnswers } from "./definition";
const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const section = "00000000-0000-4000-8000-000000000003";
const definition = { layout: "SinglePage", sections: [{ id: section, title: "اهتماماتك", description: "", fields: [
  { id: first, type: "Select", label: "هل عندك خبرة؟", help: "", required: true, options: [{ value: "yes", label: "نعم" }, { value: "no", label: "لا" }], maxLength: 500 },
  { id: second, type: "LongText", label: "خبرتك", help: "", required: true, options: [], maxLength: 500, condition: { fieldId: first, operator: "Equals", value: "yes" } },
] }] };
it("validates stable definitions and prevents duplicate IDs, forward conditions and unknown choices", () => {
  expect(definitionSchema.safeParse(definition).success).toBe(true);
  const duplicate = structuredClone(definition); duplicate.sections[0].fields[1].id = first;
  expect(definitionSchema.safeParse(duplicate).success).toBe(false);
  const forward = structuredClone(definition); forward.sections[0].fields[1].condition = { fieldId: second, operator: "Equals", value: "yes" };
  expect(definitionSchema.safeParse(forward).success).toBe(false);
  const invalid = structuredClone(definition); invalid.sections[0].fields[1].condition = { fieldId: first, operator: "Equals", value: "forged" };
  expect(definitionSchema.safeParse(invalid).success).toBe(false);
});
it("enforces only visible requirements and drops hidden answers instead of retaining private stale input", () => {
  const schema = definitionSchema.parse(definition);
  expect(validateAnswers(schema, { [first]: "no", [second]: "hidden answer" })).toEqual({ [first]: "no" });
  expect(() => validateAnswers(schema, { [first]: "yes" })).toThrow();
  expect(validateAnswers(schema, { [first]: "yes", [second]: "خبرة سابقة" })).toEqual({ [first]: "yes", [second]: "خبرة سابقة" });
});
it("rejects unknown fields/options, oversized answers and invalid file IDs", () => {
  const schema = definitionSchema.parse(definition);
  expect(() => validateAnswers(schema, { [first]: "forged" })).toThrow();
  expect(() => validateAnswers(schema, { [first]: "no", injected: "secret" })).toThrow();
  expect(() => validateAnswers(schema, { [first]: "yes", [second]: "x".repeat(501) })).toThrow();
  const file = definitionSchema.parse({ layout: "SinglePage", sections: [{ id: section, title: "مرفق", description: "", fields: [{ id: first, type: "File", label: "ملف", help: "", required: true, options: [], maxLength: 500 }] }] });
  expect(() => validateAnswers(file, { [first]: "other-user/path" })).toThrow();
});
