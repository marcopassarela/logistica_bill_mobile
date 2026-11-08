"use client";

import { useEffect } from "react";
import { Realtime } from "ably";

export function RealtimeSync() {
  useEffect(() => {
    const realtime = new Realtime({
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