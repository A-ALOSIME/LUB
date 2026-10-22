"use client";

import { useState, type ReactNode } from "react";
import { CalendarPlus, Plus, RefreshCw } from "lucide-react";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Locale } from "@/lib/preferences";

export function RenewalCreationActions({ locale, mode, canCreateRound, canCreateCampaign, roundForm, campaignForm }: {
  locale: Locale;
  mode: "cards" | "menu";
  canCreateRound: boolean;
  canCreateCampaign: boolean;
  roundForm: ReactNode;
  campaignForm: ReactNode;
}) {
  const [roundOpen, setRoundOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;

  const cards = <div className={`grid w-full gap-4 ${canCreateRound && canCreateCampaign ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
    {canCreateRound && <Button type="button" variant="outline" size="lg" className="renewal-create-card h-auto min-h-44 w-full flex-col items-start justify-start gap-4 whitespace-normal p-5 text-start" onClick={() => setRoundOpen(true)}>
      <span className="grid size-10 place-items-center rounded-lg border border-border/70 bg-background text-primary"><CalendarPlus aria-hidden="true" className="size-5" /></span>
      <span className="grid gap-1 text-start"><span className="font-semibold">{c("جولة تسجيل", "Registration round")}</span><span className="line-clamp-2 max-w-md text-sm font-normal leading-relaxed text-muted-foreground">{c("استقبال طلبات انضمام جديدة عبر نموذج منشور.", "Accept new membership applications using a published form.")}</span></span>
    </Button>}
    {canCreateCampaign && <Button type="button" variant="outline" size="lg" className="renewal-create-card h-auto min-h-44 w-full flex-col items-start justify-start gap-4 whitespace-normal p-5 text-start" onClick={() => setCampaignOpen(true)}>
      <span className="grid size-10 place-items-center rounded-lg border border-border/70 bg-background text-primary"><RefreshCw aria-hidden="true" className="size-5" /></span>
      <span className="grid gap-1 text-start"><span className="font-semibold">{c("حملة تجديد", "Renewal campaign")}</span><span className="line-clamp-2 max-w-md text-sm font-normal leading-relaxed text-muted-foreground">{c("تجديد عضويات الأعضاء الحاليين خلال فترة محددة.", "Renew current members' memberships during a set period.")}</span></span>
    </Button>}
  </div>;

  return <>
    {mode === "cards" ? cards : <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" size="sm"><Plus data-icon="inline-start" aria-hidden="true" />{c("جديد", "New")}</Button>} />
      <DropdownMenuContent align={en ? "end" : "start"} className="w-56">
        {canCreateRound && <DropdownMenuItem onClick={() => setRoundOpen(true)}>{c("جولة تسجيل", "Registration round")}</DropdownMenuItem>}
        {canCreateCampaign && <DropdownMenuItem onClick={() => setCampaignOpen(true)}>{c("حملة تجديد", "Renewal campaign")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>}

    {canCreateRound && <ManagementActionSheet label="" title={c("إنشاء جولة تسجيل", "Create a registration round")} locale={locale} open={roundOpen} onOpenChange={setRoundOpen} hideTrigger mobileBottomSheet>{roundForm}</ManagementActionSheet>}
    {canCreateCampaign && <ManagementActionSheet label="" title={c("إنشاء حملة تجديد", "Create a renewal campaign")} locale={locale} open={campaignOpen} onOpenChange={setCampaignOpen} hideTrigger>{campaignForm}</ManagementActionSheet>}
  </>;
}
