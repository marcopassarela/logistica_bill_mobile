"use client";

import {
  Children,
  isValidElement,
  type ReactNode,
} from "react";

export function ScreenAssembly({
  children,
  className,
  itemClassNames,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  itemClassNames?: string[];
}) {
  return (
    <div className={className}>
      {Children.map(children, (child, index) =>
        isValidElement(child) ? (
          <div className={itemClassNames?.[index]}>
            {child}
          </div>
        ) : (
          child
        )
      )}
    </div>
  );
}