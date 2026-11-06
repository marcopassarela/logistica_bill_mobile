"use client";

import {
  Children,
  isValidElement,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";

export function ScreenAssembly({
  children,
  className,
  delay = 0,
  itemClassNames,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  itemClassNames?: string[];
}) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className={className}>
      {Children.map(children, (child, index) =>
        isValidElement(child) ? (
          <div
            className={[
              itemClassNames?.[index],
              reduceMotion ? "" : "screen-assembly-item",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              reduceMotion
                ? undefined
                : {
                    animationDelay: `${(delay + index * 0.32) * 1000}ms`,
                  }
            }
          >
            {child}
          </div>
        ) : (
          child
        )
      )}
    </div>
  );
}