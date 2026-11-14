"use client";

import { useEffect } from "react";

export function useScheduledLoadRefresh(
  onRelease: () => void | Promise<void>
) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let requestId = 0;

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

          Promise.resolve(onRelease())
            .catch(() => {})
            .finally(() => {
              if (!disposed) void scheduleNext();
            });
        }, Math.min(Math.max(delay + 1000, 0), 2147000000));
      } catch {
        // Uma nova tentativa acontece quando houver uma atualizacao em tempo real.
      }
    };

    const handleDataChanged = () => {
      void scheduleNext();
    };

    void scheduleNext();

    window.addEventListener("logistica:data-changed", handleDataChanged);

    return () => {
      disposed = true;
      requestId++;

      if (timer) clearTimeout(timer);

      window.removeEventListener(
        "logistica:data-changed",
        handleDataChanged
      );
    };
  }, [onRelease]);
}