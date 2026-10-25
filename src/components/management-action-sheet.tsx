"use client";

import {Spinner} from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Locale } from "@/lib/preferences";
import { RowAction } from "@/components/row-action";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Presentation = "dialog" | "sheet";
const ManagementActionContext = createContext<{ close: () => void; locale: Locale } | null>(null);

export function ManagementActionProvider({ locale, close, children }: { locale: Locale; close: () => void; children: ReactNode }) {
  return <ManagementActionContext.Provider value={{ close, locale }}>{children}</ManagementActionContext.Provider>;
}

export function ManagementActionFooter({ label, pending = false, disabled = false, secondaryAction, buttonClassName, showCancel = true, sticky = true, cancelVariant = "ghost" }: {
  label: string;
  pending?: boolean;
  disabled?: boolean;
  secondaryAction?: ReactNode;
  buttonClassName?: string;
  showCancel?: boolean;
  sticky?: boolean;
  cancelVariant?: "ghost" | "outline";
}) {
  const action = useContext(ManagementActionContext);
  const en = action?.locale === "en";
  return <div className={`management-action-footer${action && sticky ? " is-modal-footer" : ""}`}>
    <Button type="submit" className={buttonClassName} disabled={pending || disabled}>{pending&&<Spinner/>}{label}</Button>
    {secondaryAction}
    {action && showCancel && <Button type="button" variant={cancelVariant} onClick={action.close}>{en ? "Cancel" : "إلغاء"}</Button>}
  </div>;
}

export function ManagementActionSheet({ label, title, children, locale = "ar", initiallyOpen = false, icon, variant = "outline", presentation = "dialog", open: controlledOpen, onOpenChange, hideTrigger = false, width = "default", mobileBottomSheet = false, triggerSize = "sm", triggerAriaLabel, rowAction = false }: {
  label: string;
  title: string;
  children: ReactNode;
  locale?: Locale;
  initiallyOpen?: boolean;
  icon?: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  presentation?: Presentation;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  width?: "default" | "wide";
  mobileBottomSheet?: boolean;
  triggerSize?: "sm" | "default" | "lg" | "icon-sm";
  triggerAriaLabel?: string;
  rowAction?: boolean;
}) {
  const mobile = useIsMobile();
  const [localOpen, setLocalOpen] = useState(initiallyOpen);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const en = locale === "en";
  const cancelLabel = en ? "Close" : "إغلاق";
  const dir = en ? "ltr" : "rtl";
  const body = <ManagementActionProvider locale={locale} close={() => setOpen(false)}>
    <div className="management-action-scroll" data-management-action-scroll>{children}</div>
  </ManagementActionProvider>;
  const trigger = <Button type="button" variant={variant === "destructive" ? "danger-outline" : variant} size={triggerSize} aria-label={triggerAriaLabel} title={triggerAriaLabel}>{icon ?? <Plus aria-hidden="true" />}{label}</Button>;
  const directTrigger = !hideTrigger && rowAction ? <RowAction label={label || triggerAriaLabel || title} danger={variant === "destructive"} onClick={() => setOpen(true)}>{icon ?? <Plus aria-hidden="true" />}</RowAction> : null;

  if (presentation === "sheet" || mobile) return <Sheet open={open} onOpenChange={setOpen}>
    {directTrigger ?? (!hideTrigger && <SheetTrigger render={trigger} />)}
    <SheetContent dir={dir} side={mobile ? "bottom" : "left"} showCloseButton={false} className={`management-action-sheet${mobile ? " management-action-bottom-sheet" : ""} gap-0 overflow-hidden p-0${width === "wide" ? " management-action-sheet-wide" : ""}`}>
      <SheetHeader className="management-action-header">
        <SheetTitle className="min-w-0 w-full break-words text-start">{title}</SheetTitle>
        <SheetClose render={<Button type="button" variant="ghost" size="icon-sm" className="absolute end-3 top-3" aria-label={cancelLabel} title={cancelLabel}><X aria-hidden="true" /></Button>} />
      </SheetHeader>
      {body}
    </SheetContent>
  </Sheet>;

  return <Dialog open={open} onOpenChange={setOpen}>
    {directTrigger ?? (!hideTrigger && (triggerAriaLabel ? <Tooltip><TooltipTrigger render={<span className="inline-flex"/>}><DialogTrigger render={trigger}/></TooltipTrigger><TooltipContent>{triggerAriaLabel}</TooltipContent></Tooltip> : <DialogTrigger render={trigger} />))}
    <DialogContent dir={dir} width={width === "wide" ? "wide" : "default"} showCloseButton={false} className={`management-action-dialog${width === "wide" ? " management-action-dialog-wide" : ""}${mobileBottomSheet ? " management-action-dialog--mobile-bottom" : ""} flex max-h-[90dvh] ${width === "wide" ? "w-[min(42rem,calc(100vw-2rem))] max-w-2xl" : "w-[min(38rem,calc(100vw-2rem))] max-w-none"} flex-col gap-0 overflow-hidden p-0`}>
      <DialogHeader className="management-action-header">
        <DialogTitle className="w-full text-start">{title}</DialogTitle>
        <DialogClose render={<Button type="button" variant="ghost" size="icon-sm" className="absolute end-3 top-3" aria-label={cancelLabel} title={cancelLabel}><X aria-hidden="true" /></Button>} />
      </DialogHeader>
      {body}
    </DialogContent>
  </Dialog>;
}
