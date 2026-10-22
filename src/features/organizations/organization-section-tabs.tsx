"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

type SectionTab = { id: string; label: string; icon?: ReactNode };
const activeSectionContext = createContext<string | null>(null);

export function OrganizationSectionTabs({ items, initialSection, label, dir, children, defaultSection, legacyHashSections = {}, sticky = true, centered = false, action, sectionActions = {}, actionHiddenSections = [] }: {
  items: SectionTab[];
  initialSection: string;
  label: string;
  dir: "ltr" | "rtl";
  children: ReactNode;
  defaultSection?: string;
  legacyHashSections?: Record<string, string>;
  sticky?: boolean;
  centered?: boolean;
  action?: ReactNode;
  sectionActions?: Record<string, ReactNode>;
  actionHiddenSections?: string[];
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const itemIds = items.map(item => item.id).join("|");
  const firstId = items[0]?.id ?? "";
  const legacyHashKey = Object.entries(legacyHashSections).map(([hash, id]) => `${hash}:${id}`).join("|");
  const defaultId = defaultSection && itemIds.split("|").includes(defaultSection) ? defaultSection : firstId;

  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    window.addEventListener("organization-section-change", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("organization-section-change", onChange);
    };
  }, []);
  const getSnapshot = useCallback(() => {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("section");
    const validIds = itemIds.split("|");
    if (requested && validIds.includes(requested)) return requested;
    const legacySection = legacyHashKey.split("|").map(entry => entry.split(":") as [string, string]).find(([hash]) => hash === url.hash)?.[1];
    if (legacySection && validIds.includes(legacySection)) return legacySection;
    const historySection = (window.history.state as { __organizationSection?: { pathname?: string; id?: string } } | null)?.__organizationSection;
    if (historySection?.pathname === url.pathname && historySection.id && validIds.includes(historySection.id)) return historySection.id;
    return validIds.includes(initialSection) ? initialSection : defaultId;
  }, [defaultId, initialSection, legacyHashKey, itemIds]);
  const activeSection = useSyncExternalStore(subscribe, getSnapshot, () => initialSection);

  useEffect(() => {
    const validIds = itemIds.split("|");
    const legacySection = new Map(legacyHashKey.split("|").filter(Boolean).map(entry => {
      const [hash, id] = entry.split(":");
      return [hash, id] as const;
    })).get(window.location.hash);
    if (!legacySection || !validIds.includes(legacySection)) return;
    const url = new URL(window.location.href);
    if (legacySection === defaultId) url.searchParams.delete("section");
    else url.searchParams.set("section", legacySection);
    if (url.toString() !== window.location.href) {
      window.history.replaceState(window.history.state, "", url.toString());
      window.dispatchEvent(new Event("organization-section-change"));
    }
    window.requestAnimationFrame?.(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView?.({ block: "start" }));
  }, [defaultId, itemIds, legacyHashKey]);

  function selectSection(id: string) {
    if (id === activeSection) return;
    const url = new URL(window.location.href);
    if (id === defaultId) url.searchParams.delete("section");
    else url.searchParams.set("section", id);
    const legacyTarget = legacyHashKey.split("|").map(entry => entry.split(":") as [string, string]).find(([hash]) => hash === url.hash)?.[1];
    if (legacyTarget && legacyTarget !== id) url.hash = "";
    const previousState = window.history.state && typeof window.history.state === "object" ? window.history.state as Record<string, unknown> : {};
    window.history.pushState({ ...previousState, __organizationSection: { pathname: url.pathname, id } }, "", url.toString());
    window.dispatchEvent(new Event("organization-section-change"));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = dir === "rtl" ? -1 : 1;
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : event.key === "ArrowRight" ? (index + direction + items.length) % items.length
          : event.key === "ArrowLeft" ? (index - direction + items.length) % items.length
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    selectSection(items[nextIndex].id);
  }

  const activeAction = sectionActions[activeSection] ?? action;
  const hasActionSlot = Boolean(action) || Object.values(sectionActions).some(Boolean);
  const showAction = Boolean(activeAction) && !actionHiddenSections.includes(activeSection);
  const sectionNavigation = items.length > 1 && <nav className={`workspace-segmented-control organization-section-nav${sticky ? "" : " organization-section-nav--static"}`} aria-label={label}>
    <ul className="organization-section-nav-list" role="tablist" aria-label={label} dir={dir}>
      {items.map((item, index) => <li key={item.id}>
        <button
          ref={node => { tabRefs.current[index] = node; }}
          id={`organization-section-tab-${item.id}`}
          type="button"
          role="tab"
          aria-selected={activeSection === item.id}
          aria-controls={`organization-section-panel-${item.id}`}
          tabIndex={activeSection === item.id ? 0 : -1}
          className="organization-section-nav-link"
          onClick={() => selectSection(item.id)}
          onKeyDown={event => handleKeyDown(event, index)}
        >
          {item.icon}<span>{item.label}</span>
        </button>
      </li>)}
    </ul>
  </nav>;

  return <activeSectionContext.Provider value={activeSection}>
    {items.length > 1
      ? hasActionSlot
        ? <div className={`organization-section-tabs-toolbar${showAction ? " organization-section-tabs-toolbar--has-action" : ""}`}>
          {sectionNavigation}
          <div className="organization-section-tabs-action" hidden={!showAction}>{activeAction}</div>
        </div>
        : <div className={centered ? "organization-section-nav-center" : undefined}>{sectionNavigation}</div>
      : showAction && <div className="organization-section-tabs-toolbar organization-section-tabs-toolbar--has-action">
        <div className="organization-section-tabs-action">{action}</div>
      </div>}
    {children}
  </activeSectionContext.Provider>;
}

export function useOrganizationSection() {
  return useContext(activeSectionContext) ?? "events";
}

export function OrganizationSectionTabPanel({ id, children, legacyId }: { id: string; children: ReactNode; legacyId?: string }) {
  const activeSection = useContext(activeSectionContext);
  if (activeSection === null) throw new Error("OrganizationSectionTabPanel must be inside OrganizationSectionTabs");
  return <div
    id={`organization-section-panel-${id}`}
    role="tabpanel"
    aria-labelledby={`organization-section-tab-${id}`}
    tabIndex={0}
    hidden={activeSection !== id}
  >{legacyId && <span id={legacyId} className="organization-section-tab-legacy-anchor" aria-hidden="true" />}{children}</div>;
}
