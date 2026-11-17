"use client";

import { useEffect, useRef } from "react";

export function useScheduledLoadRefresh(
  onRelease: () => void | Promise<void>,
  relevantModules: readonly string[],
  enabled = true
) {
  const onReleaseRef = useRef(onRelease);

  useEffect(() => {
    onReleaseRef.current = onRelease;
  }, [onRelease]);

  const modulesKey = relevantModules.join("|");

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let requestId = 0;

    const modules = new Set(modulesKey.split("|"));

    const scheduleNext = async () => {
      const currentRequest = ++requestId;

      if (timer) clearTimeout(timer);

      try {
        const response = await fetch(
          "/api/carregamentos/proxima-liberacao",
          { cache: "no-store" }
        );

        if (!response.ok || disposed || currentRequest !== requestId) return;

        const result = await response.json();
        const nextAt = result.nextAt
          ? new Date(result.nextAt).getTime()
          : null;

        if (!nextAt || !Number.isFinite(nextAt)) return;

        const delay = nextAt - Date.now();

        timer = setTimeout(() => {
          if (disposed) return;

          if (Date.now() < nextAt) {
            void scheduleNext();
            return;
          }

          Promise.resolve(onReleaseRef.current())
            .catch(() => {})
            .finally(() => {
              if (!disposed) void scheduleNext();
            });
        }, Math.min(Math.max(delay + 1000, 0), 2147000000));
      } catch {
        // Nova tentativa após alteração relevante.
      }
    };

    const handleDataChanged = (event: Event) => {
      const changedModules =
        (event as CustomEvent<{ modules?: string[] }>).detail?.modules ?? [];

      if (changedModules.some((module) => modules.has(module))) {
        void scheduleNext();
      }
    };

    void scheduleNext();

    window.addEventListener("logistica:data-changed", handleDataChanged);

    return () => {
      disposed = true;
      requestId++;

      if (timer) clearTimeout(timer);

      window.removeEventListener("logistica:data-changed", handleDataChanged);
    };
  }, [modulesKey, enabled]);
}