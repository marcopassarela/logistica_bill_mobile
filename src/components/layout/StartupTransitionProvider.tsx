"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";

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
  const beginStartupTransition = useCallback(() => {}, []);
  const finishStartupTransition = useCallback(() => {}, []);

  return (
    <StartupTransitionContext.Provider
      value={{ beginStartupTransition, finishStartupTransition }}
    >
      {children}
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