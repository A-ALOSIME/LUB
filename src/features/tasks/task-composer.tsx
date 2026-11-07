"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/preferences";
import { TaskForm } from "./task-form";
import { TaskFields } from "./task-fields";
import type { Task, TaskWorkspace } from "./repository";

export function TaskComposer({ org, workspace, locale }: { org: string; workspace: TaskWorkspace; locale: Locale }) {
  const t = createTranslator(locale);
  return <ManagementActionSheet label={t("مهمة جديدة", "New task")} title={t("إنشاء مهمة", "Create task")} locale={locale} width="wide">
    <TaskEditorForm org={org} workspace={workspace} locale={locale}/>
  </ManagementActionSheet>;
}

export function TaskEditorForm({ org, workspace, task, locale = "ar", onSaved }: { org: string; workspace: TaskWorkspace; task?: Task; locale?: Locale; onSaved?: () => void }) {
  const router = useRouter();
  const t = createTranslator(locale);
  const [committee, setCommittee] = useState(task ? task.committee_id ?? "" : workspace.scopes[0]?.id ?? "");
  return <TaskForm operation="save-task" fields={{ org, ...(task ? { task: task.id, revision: String(task.revision), committee: task.committee_id ?? "" } : {}) }}
    label={t("حفظ التعديل", "Save changes")} locale={locale} creationActions={!task}
    confirmDescription={task ? t("ستُحدّث تفاصيل المهمة وتبقى التسليمات السابقة محفوظة.", "Update the task while preserving existing submissions.") : undefined}
    onSuccess={() => { onSaved?.(); router.refresh(); }}>
    <TaskFields value={task} locale={locale} organization={org} committee={committee || null}
      scopeField={!task && <FormField label={t("نطاق العمل", "Work scope")}>
        <NativeSelect name="committee" value={committee} onChange={event => setCommittee(event.target.value)}>
          {workspace.scopes.map(scope => <option key={scope.id ?? "org"} value={scope.id ?? ""}>{scope.name}</option>)}
        </NativeSelect>
      </FormField>}/>
  </TaskForm>;
}
