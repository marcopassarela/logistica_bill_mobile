"use client";

import { useEffect } from "react";
import { createClient } from "@ably/pubsub-device";

let realtimeClient: ReturnType<typeof createClient> | undefined;

export function RealtimeSync() {
  useEffect(() => {
    const realtime = (realtimeClient ??= createClient({
      authUrl: "/api/realtime/auth",
    }));

    const channel = realtime.channels.get("logistica-global");

    let timer: ReturnType<typeof setTimeout> | undefined;
    const pendingModules = new Set<string>();

    const flushChanges = () => {
      timer = undefined;

      if (pendingModules.size === 0) return;

      const modules = Array.from(pendingModules);
      pendingModules.clear();

      window.dispatchEvent(
        new CustomEvent("logistica:data-changed", {
          detail: { modules },
        })
      );
    };

    channel.subscribe((message) => {
      if (message.name === "auth:invalidate") {
        window.location.replace("/login");
        return;
      }

      if (message.name !== "data:changed") return;

      const modules = (
        message.data as { modules?: string[] }
      )?.modules ?? [];

      modules.forEach((module) => pendingModules.add(module));

      if (timer) clearTimeout(timer);
      timer = setTimeout(flushChanges, 200);
    });

    return () => {
      if (timer) clearTimeout(timer);
      channel.unsubscribe();
    };
  }, []);

  return null;
}