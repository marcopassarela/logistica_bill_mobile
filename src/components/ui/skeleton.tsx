import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  );
}