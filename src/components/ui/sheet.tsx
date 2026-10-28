"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetContent({
  className,
  side = "left",
  showCloseButton = true,
  closeLabel = "Close",
  children,
  ...props
}: DialogPrimitive.Popup.Props & {
  side?: "right" | "left" | "top" | "bottom"
  showCloseButton?: boolean
  closeLabel?: string
}) {
  const popupRef = React.useRef<HTMLDivElement>(null);
  const sideClasses = {
    right: "inset-y-0 right-0 h-full w-[min(90vw,30rem)] border-s",
    left: "inset-y-0 left-0 h-full w-[min(90vw,30rem)] border-e",
    top: "inset-x-0 top-0 max-h-[85dvh] border-b",
    bottom: "inset-x-0 bottom-0 max-h-[85dvh] border-t",
  }[side]

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 isolate z-50 bg-black/30 backdrop-blur-[1px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        ref={popupRef}
        initialFocus={() => popupRef.current?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]):not([aria-hidden="true"]),textarea:not([disabled]),select:not([disabled]),[role="combobox"]:not([aria-disabled="true"])') ?? true}
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex min-w-0 flex-col gap-4 overflow-y-auto bg-card p-4 text-card-foreground shadow-xl ring-1 ring-foreground/10 outline-none duration-200 data-open:animate-in data-closed:animate-out data-[side=right]:data-open:slide-in-from-right data-[side=right]:data-closed:slide-out-to-right data-[side=left]:data-open:slide-in-from-left data-[side=left]:data-closed:slide-out-to-left data-[side=top]:data-open:slide-in-from-top data-[side=top]:data-closed:slide-out-to-top data-[side=bottom]:data-open:slide-in-from-bottom data-[side=bottom]:data-closed:slide-out-to-bottom",
          sideClasses,
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            render={<Button variant="ghost" size="icon-sm" className="absolute end-3 top-3" />}
          >
            <XIcon />
            <span className="sr-only">{closeLabel}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 pe-8", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end", className)} {...props} />
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="sheet-title" className={cn("text-base font-semibold", className)} {...props} />
}

function SheetDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger }
