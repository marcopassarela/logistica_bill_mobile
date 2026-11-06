"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

interface StartupTransitionContextValue {
  beginStartupTransition: () => void;
  finishStartupTransition: () => void;
}

const StartupTransitionContext =
  createContext<StartupTransitionContextValue | null>(null);

export function StartupTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [active, setActive] = useState(false);

  const beginStartupTransition = useCallback(() => {
    setActive(true);
  }, []);

  const finishStartupTransition = useCallback(() => {
    setActive(false);
  }, []);

  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(() => setActive(false), 15000);
    return () => window.clearTimeout(timeout);
  }, [active]);

  return (
    <StartupTransitionContext.Provider
      value={{ beginStartupTransition, finishStartupTransition }}
    >
      {children}

      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            key="startup-transition"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950 p-4"
            role="status"
            aria-label="Carregando sistema"
          >
            <div className="flex w-full max-w-lg flex-col items-center justify-center text-center text-white">
              <div className="mb-10 h-20 w-20 overflow-hidden rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
                <img
                  src="/logo.png"
                  alt="Logísticas Bill"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="relative mb-10 h-48 w-48">
                <div className="absolute inset-0 rounded-full border-[20px] border-white/5" />

                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0deg 240deg, rgba(163,163,163,0.15) 270deg, rgba(229,229,229,0.4) 300deg, rgba(255,255,255,0.75) 330deg, #ffffff 360deg)",
                    maskImage:
                      "radial-gradient(farthest-side, transparent calc(100% - 20px), black calc(100% - 20px))",
                    WebkitMaskImage:
                      "radial-gradient(farthest-side, transparent calc(100% - 20px), black calc(100% - 20px))",
                  }}
                />
              </div>

              <h2 className="text-lg font-medium tracking-[0.35em] text-white/90">
                LOADING...
              </h2>

              <div className="mt-10 w-full max-w-xs">
                <div className="h-[15px] overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-neutral-400 via-white to-neutral-300" />
                </div>
              </div>

              <p className="mt-8 text-[10px] tracking-[0.25em] text-white/25">
                SISTEMA INICIALIZADO.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </StartupTransitionContext.Provider>
  );
}

export function useStartupTransition() {
  const context = useContext(StartupTransitionContext);

  if (!context) {
    throw new Error(
      "useStartupTransition deve ser usado dentro de StartupTransitionProvider."
    );
  }

  return context;
}