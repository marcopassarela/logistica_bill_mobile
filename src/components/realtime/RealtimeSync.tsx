"use client";

import { useEffect } from "react";
import { createClient } from "@ably/pubsub-device";

export function RealtimeSync() {
  useEffect(() => {
    const realtime = createClient({
      authUrl: "/api/realtime/auth",
    });

    const channel = realtime.channels.get("logistica-global");

    channel.subscribe((message) => {
      if (message.name === "auth:invalidate") {
        window.location.replace("/login");
        return;
      }

      if (message.name === "data:changed") {
        window.dispatchEvent(
          new CustomEvent("logistica:data-changed", {
            detail: message.data,
          })
        );
      }
    });

    return () => {
      channel.unsubscribe();
      realtime.close();
    };
  }, []);

  return null;
}
