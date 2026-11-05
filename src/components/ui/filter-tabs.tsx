"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "cn";

export type FilterTabOption = {
  value: string;
  label: string;
  count?: number;
};

export function FilterTabs({
  value,
  options,
  ariaLabel,
  dir = "rtl",
  size = "sm",
  activeTone = "primary",
  className,
  onValueChange,
  onItemClick,onItemPrefetch,
}: {
  value: string;
  options: FilterTabOption[];
  ariaLabel: string;
  dir?: "ltr" | "rtl";
  size?: "sm" | "default" | "lg";
  activeTone?: "secondary" | "primary";
  className?: string;
  onValueChange: (value: string) => void;
  onItemClick?: (value: string) => void;onItemPrefetch?:(value:string)=>void;
}) {
  void size;
  void activeTone;

  return <Tabs
    value={value}
    dir={dir}
    onValueChange={next => { if (next) onValueChange(next); }}
    className="min-w-0 gap-0"
  >
    <div dir={dir} className="workspace-filter-scroll">
      <TabsList aria-label={ariaLabel} className={cn("workspace-segmented-control workspace-filter-control", className)}>
        {options.map(option => {
          const active = value === option.value;
          const activeColors = "data-active:bg-primary data-active:text-primary-foreground";

          return <TabsTrigger
            key={option.value}
            value={option.value}
            onClick={() => onItemClick?.(option.value)}
            onPointerEnter={()=>onItemPrefetch?.(option.value)} onFocus={()=>onItemPrefetch?.(option.value)} onTouchStart={()=>onItemPrefetch?.(option.value)}
            className={cn(
              "w-fit flex-none rounded-md border-transparent shadow-none",
              "h-7 px-2.5 text-xs",
              activeColors,
              active && "border-transparent shadow-none"
            )}
          >
            <span>{option.label}</span>

          </TabsTrigger>;
        })}
      </TabsList>
    </div>
  </Tabs>;
}
