"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type ModelSelectorProps = React.ComponentProps<typeof DropdownMenu>;

export function ModelSelector(props: ModelSelectorProps) {
  return <DropdownMenu {...props} />;
}

export type ModelSelectorTriggerProps = React.ComponentProps<typeof DropdownMenuTrigger>;

export function ModelSelectorTrigger(props: ModelSelectorTriggerProps) {
  return <DropdownMenuTrigger {...props} />;
}

export type ModelSelectorContentProps = React.ComponentProps<typeof DropdownMenuContent>;

export function ModelSelectorContent({ className, children, ...props }: ModelSelectorContentProps) {
  return (
    <DropdownMenuContent
      className={cn("w-[320px] p-0 overflow-hidden", className)}
      side="top"
      align="center"
      sideOffset={6}
      {...props}
    >
      <Command className="w-full">
        {children}
      </Command>
    </DropdownMenuContent>
  );
}

export type ModelSelectorInputProps = React.ComponentProps<typeof CommandInput>;

export function ModelSelectorInput(props: ModelSelectorInputProps) {
  return <CommandInput {...props} />;
}

export type ModelSelectorListProps = React.ComponentProps<typeof CommandList>;

export function ModelSelectorList(props: ModelSelectorListProps) {
  return <CommandList {...props} />;
}

export type ModelSelectorEmptyProps = React.ComponentProps<typeof CommandEmpty>;

export function ModelSelectorEmpty(props: ModelSelectorEmptyProps) {
  return <CommandEmpty {...props} />;
}

export type ModelSelectorGroupProps = React.ComponentProps<typeof CommandGroup> & { heading?: string };

export function ModelSelectorGroup(props: ModelSelectorGroupProps) {
  return <CommandGroup {...props} />;
}

export type ModelSelectorItemProps = React.ComponentProps<typeof CommandItem> & {
  value: string;
  onSelect?: () => void;
};

export function ModelSelectorItem({ onSelect, ...props }: ModelSelectorItemProps) {
  return (
    <CommandItem
      {...props}
      onSelect={() => {
        onSelect?.();
      }}
    />
  );
}

export type ModelSelectorNameProps = React.ComponentProps<"span">;

export function ModelSelectorName({ className, ...props }: ModelSelectorNameProps) {
  return <span className={cn("truncate", className)} {...props} />;
}

export type ModelSelectorLogoProps = React.ComponentProps<"span"> & {
  provider: "google" | "groq" | "openai" | string;
};

export function ModelSelectorLogo({ provider, className, ...props }: ModelSelectorLogoProps) {
  const p = (provider || "").toLowerCase();
  const label =
    p === "google" ? "G" : p === "openai" ? "O" : p === "groq" ? "Q" : p.slice(0, 1).toUpperCase();
  const color =
    p === "google"
      ? "bg-blue-600"
      : p === "openai"
        ? "bg-black"
        : p === "groq"
          ? "bg-emerald-600"
          : "bg-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center size-5 rounded-full text-[10px] font-semibold text-white shrink-0",
        color,
        className
      )}
      {...props}
    >
      {label}
    </span>
  );
}

export type ModelSelectorLogoGroupProps = React.ComponentProps<"div">;

export function ModelSelectorLogoGroup({ className, ...props }: ModelSelectorLogoGroupProps) {
  return <div className={cn("flex items-center gap-1 ml-auto", className)} {...props} />;
}
