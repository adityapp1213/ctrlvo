"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ShimmerProps = React.HTMLAttributes<HTMLDivElement>;

function ShimmerComponent({ className, ...props }: ShimmerProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/60",
        className
      )}
      {...props}
    />
  );
}

export const Shimmer = React.memo(ShimmerComponent);
