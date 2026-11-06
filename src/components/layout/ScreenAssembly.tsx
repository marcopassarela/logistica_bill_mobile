"use client";

import {
  Children,
  isValidElement,
  type ReactNode,
} from "react";
import {
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";

const containerVariants = (
  delay: number,
  reduceMotion: boolean
): Variants => ({
  hidden: {},
  visible: {
    transition: {
      delayChildren: reduceMotion ? 0 : delay,
      staggerChildren: reduceMotion ? 0 : 0.16,
    },
  },
});

const itemVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    y: 24,
    scale: 0.97,
    rotateX: -4,
    z: -45,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    z: 0,
    transition: {
      duration: reduceMotion ? 0 : 0.62,
      ease: [0.22, 1, 0.36, 1],
    },
  },
});

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
  const items = itemVariants(reduceMotion);

  return (
    <motion.div
      className={className}
      variants={containerVariants(delay, reduceMotion)}
      initial="hidden"
      animate="visible"
      style={{
        perspective: 1000,
        transformStyle: "preserve-3d",
      }}
    >
      {Children.map(children, (child, index) =>
        isValidElement(child) ? (
          <motion.div
            className={itemClassNames?.[index]}
            variants={items}
            style={{ transformOrigin: "center bottom" }}
          >
            {child}
          </motion.div>
        ) : (
          child
        )
      )}
    </motion.div>
  );
}