"use client"

import type { ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { Locale } from "@/lib/preferences"

export function ActivityDocumentsSheet({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  const en = locale === "en"
  const router = useRouter()
  const searchParams = useSearchParams()
  const open = searchParams.get("documents") === "1"

  function setSheetOpen(next: boolean) {
    const params = new URLSearchParams(window.location.search)
    params.set("tab", "hours")
    if (next) params.set("documents", "1")
    else {
      params.delete("documents")
      params.delete("docPage")
    }
    router.replace(`/activity?${params.toString()}`, { scroll: false })
  }

  return <Sheet open={open} onOpenChange={setSheetOpen}>
    <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
      <FileText aria-hidden="true" data-icon="inline-start" />{en ? "My documents" : "مستنداتي"}
    </SheetTrigger>
    <SheetContent dir={en ? "ltr" : "rtl"} side="right" className="gap-0 p-0">
      <SheetHeader className="border-b border-border/70 p-4 pe-12">
        <SheetTitle>{en ? "My documents" : "مستنداتي"}</SheetTitle>
        <SheetDescription>{en ? "Saved certificates and reports." : "الشهادات والتقارير المحفوظة."}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>
    </SheetContent>
  </Sheet>
}
