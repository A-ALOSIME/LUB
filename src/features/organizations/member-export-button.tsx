"use client";

import { useState } from "react";
import { ExportButton } from "@/components/export-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/preferences";
import type { MemberFilters } from "./member-types";

export function MemberExportButton({ organization, filters, locale }: {
  organization: string; filters: MemberFilters; locale: Locale; leader: boolean;
}) {
  const c = createTranslator(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportRows() {
    setPending(true);
    setError(null);
    try {
      const file = await fetch(`/api/organizations/${organization}/members/export`, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ ...filters, locale }),
      });
      if (!file.ok) {
        setError(file.status === 422 ? c("ضيّق الفلاتر لتصدير عدد أقل من الأعضاء.", "Narrow the filters to export fewer members.")
          : c("تعذّر التصدير. حاول مجددًا.", "Export failed. Try again."));
        return;
      }
      const blobUrl = URL.createObjectURL(await file.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.headers.get("Content-Disposition")?.match(/filename="([a-zA-Z0-9-]+\.xlsx)"/)?.[1] ?? "members.xlsx";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      toast.add({ title: c("بدأ تحميل الملف", "Download started"), type: "success", timeout: 3000 });
    } catch {
      setError(c("تعذّر التصدير. حاول مجددًا.", "Export failed. Try again."));
    } finally {
      setPending(false);
    }
  }

  return <><ExportButton disabled={pending} onClick={() => void exportRows()}
    hint={c("تصدير الأعضاء حسب الفلاتر الحالية", "Export members using the current filters")} />
    {error && <Alert className="basis-full"><AlertDescription>{error}</AlertDescription></Alert>}</>;
}
