"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { AnnouncementDialog } from "@/app/(workspace)/manage/organizations/[id]/announcement-dialog";
import { useOrganizationSection } from "./organization-section-tabs";
import type { Locale } from "@/lib/preferences";

function subscribeLegacyEventDialog(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  window.addEventListener("legacy-event-dialog-change", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("legacy-event-dialog-change", onChange);
  };
}

function getLegacyEventDialogSnapshot() {
  return window.location.hash === "#new-event";
}

function subscribeLegacyAnnouncementDialog(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  window.addEventListener("legacy-announcement-dialog-change", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("legacy-announcement-dialog-change", onChange);
  };
}

function getLegacyAnnouncementDialogSnapshot() {
  return window.location.hash === "#new-announcement";
}

export function EventsAnnouncementsActions({ organizationId, locale, canCreateEvent, canCreateAnnouncement, children }: {
  organizationId: string;
  locale: Locale;
  canCreateEvent: boolean;
  canCreateAnnouncement: boolean;
  children?: ReactNode;
}) {
  const [eventOpen, setEventOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const legacyEventOpen = useSyncExternalStore(subscribeLegacyEventDialog, getLegacyEventDialogSnapshot, () => false);
  const legacyAnnouncementOpen = useSyncExternalStore(subscribeLegacyAnnouncementDialog, getLegacyAnnouncementDialogSnapshot, () => false);
  const section = useOrganizationSection();
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  if (!canCreateEvent && !canCreateAnnouncement) return null;
  const showEventAction = section === "events" && canCreateEvent;
  const showAnnouncementAction = section === "announcements" && canCreateAnnouncement;

  function handleEventDialogChange(open: boolean) {
    setEventOpen(open);
    if (open || window.location.hash !== "#new-event") return;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
    window.dispatchEvent(new Event("legacy-event-dialog-change"));
  }

  function handleAnnouncementDialogChange(open: boolean) {
    setAnnouncementOpen(open);
    if (open || window.location.hash !== "#new-announcement") return;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
    window.dispatchEvent(new Event("legacy-announcement-dialog-change"));
  }

  return <>
    {(showEventAction || showAnnouncementAction) && <Button type="button" size="sm" onClick={() => showEventAction ? setEventOpen(true) : setAnnouncementOpen(true)}>
      <Plus data-icon="inline-start" aria-hidden="true" />{showEventAction ? c("فعالية جديدة", "New event") : c("إعلان جديد", "New announcement")}
    </Button>}

    {canCreateEvent && <ManagementActionSheet label="" title={c("فعالية جديدة", "New event")} locale={locale} width="wide" open={eventOpen || legacyEventOpen} onOpenChange={handleEventDialogChange} hideTrigger>{children}</ManagementActionSheet>}

    {canCreateAnnouncement && (announcementOpen || legacyAnnouncementOpen) && <AnnouncementDialog organizationId={organizationId} locale={locale} open onOpenChange={handleAnnouncementDialogChange} showTrigger={false} />}
  </>;
}
