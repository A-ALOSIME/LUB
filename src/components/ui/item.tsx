import * as React from "react"
import { cn } from "cn"

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-group" className={cn("flex min-w-0 flex-col divide-y divide-border/70", className)} {...props} />
}

function Item({ className, size = "default", variant = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm"; variant?: "default" | "outline" }) {
  return <div data-slot="item" data-size={size} data-variant={variant} className={cn("flex min-w-0 items-center gap-3 py-3 text-start data-[size=sm]:gap-2 data-[size=sm]:py-2.5 data-[variant=outline]:rounded-lg data-[variant=outline]:border data-[variant=outline]:px-3", className)} {...props} />
}

function ItemMedia({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "icon" }) {
  return <div data-slot="item-media" data-variant={variant} className={cn("flex shrink-0 items-center justify-center text-muted-foreground data-[variant=icon]:size-9 data-[variant=icon]:rounded-lg data-[variant=icon]:bg-muted [&_svg]:size-4", className)} {...props} />
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-content" className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)} {...props} />
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-title" className={cn("min-w-0 break-words text-sm font-medium leading-5", className)} {...props} />
}

function ItemDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-description" className={cn("min-w-0 break-words text-xs leading-5 text-muted-foreground", className)} {...props} />
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-actions" className={cn("ms-auto flex shrink-0 items-center gap-2", className)} {...props} />
}

export { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle }
