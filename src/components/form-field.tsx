"use client";

import { Children, cloneElement, isValidElement, useId, useState, type ReactNode, type ReactElement } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import type { Locale } from "@/lib/preferences";

// One field contract for management forms, including legacy native controls.
export function FormField({ id: suppliedId, label, required, hint, error: suppliedError, children, locale = "ar", className }: {
  id?: string; label: ReactNode; required?: boolean; hint?: ReactNode; error?: ReactNode;
  children: ReactNode; locale?: Locale; className?: string;
}) {
  const findControl = (nodes: ReactNode): ReactElement<Record<string, unknown>> | undefined => {
    for (const node of (Array.isArray(nodes) ? nodes.flat(Infinity) : [nodes])) {
      if (!isValidElement(node)) continue;
      const element = node as ReactElement<Record<string, unknown>>, props = element.props;
      if ((typeof element.type === "string" && ["input", "select", "textarea"].includes(element.type) && props.type !== "hidden") || (typeof element.type !== "string" && (props.name || "value" in props || "defaultValue" in props))) return element;
      const nested = findControl(props.children as ReactNode);
      if (nested) return nested;
    }
  };
  const first = findControl(children);
  const generatedId = useId(), id = suppliedId ?? (first?.props.id as string | undefined) ?? generatedId;
  const [validationError, setValidationError] = useState("");
  const error = suppliedError || validationError;
  const inferredRequired = required ?? Boolean(first?.props.required);
  const connect = (nodes: ReactNode): ReactNode => Children.map(nodes, node => {
    if (!isValidElement(node)) return node;
    const element = node as ReactElement<{ id?: string; children?: ReactNode; required?: boolean; type?: string; "aria-describedby"?: string }>;
    const props = element.props;
    const control = node === first;
    if (control) {
      return cloneElement(element, { id, "aria-describedby": [props["aria-describedby"], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined, ...(error ? { "aria-invalid": true } : {}) });
    }
    return props.children ? cloneElement(element, {}, connect(props.children)) : node;
  });
  const content = connect(children);
  return <Field className={className} data-form-field data-invalid={!!error || undefined}
    onInvalidCapture={event => {
      event.preventDefault();
      const control = event.target as HTMLInputElement;
      setValidationError(locale === "en" ? control.validationMessage : control.validity.valueMissing ? "هذا الحقل مطلوب." : "راجع القيمة المدخلة.");
      if (Array.from(control.form?.elements ?? []).find(element => "willValidate" in element && (element as HTMLInputElement).willValidate && !(element as HTMLInputElement).validity.valid) === control) control.focus();
    }} onInputCapture={() => setValidationError("")} onChangeCapture={() => setValidationError("")}>
    <FieldLabel htmlFor={id}>{label}{inferredRequired && <span className="text-destructive" aria-hidden="true">*</span>}</FieldLabel>
    {content}
    {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
    {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
  </Field>;
}
