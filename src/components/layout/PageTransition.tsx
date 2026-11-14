"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <div
      style={{
        perspective: 1400,
        transformStyle: "preserve-3d",
      }}
    >
      <AnimatePresence mode="wait" initial={true}>
        <motion.div
          key={pathname}
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  z: -140,
                  y: 18,
                  scale: 0.94,
                  rotateX: 2,
                }
          }
          animate={{
            opacity: 1,
            z: 0,
            y: 0,
            scale: 1,
            rotateX: 0,
          }}
          exit={
            reduceMotion
              ? undefined
              : {
                  opacity: 0,
                  z: -180,
                  y: -8,
                  scale: 0.90,
                  rotateX: -2,
                }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            transformStyle: "preserve-3d",
            transformOrigin: "center center",
            willChange: reduceMotion ? "auto" : "transform, opacity",
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
