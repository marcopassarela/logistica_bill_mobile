
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@ably/pubsub-device";

let realtimeClient: ReturnType<typeof createClient> | undefined;

export function RealtimeSync() {
  const router = useRouter();

  useEffect(() => {
    const realtime = (realtimeClient ??= createClient({
      authUrl: "/api/realtime/auth",
    }));

    const channel = realtime.channels.get("logistica-global");
    const presence = channel.presence;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const pendingModules = new Set<string>();
    const pendingMutationIds = new Set<string>();
    let hasUntrackedDataChanges = false;
    const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let isPresent = false;
    let presenceQueue = Promise.resolve();

    const emitPresence = (
      userId: string,
      online: boolean,
      lastSeenAt?: string
    ) => {
      window.dispatchEvent(
        new CustomEvent("logistica:presence-changed", {
          detail: {
            userId,
            online,
            ...(lastSeenAt ? { lastSeenAt } : {}),
          },
        })
      );
    };

    const onPresenceChanged = (message: {
      action: string;
      clientId?: string;
    }) => {
      const userId = message.clientId;
      if (!userId) return;

      const pending = leaveTimers.get(userId);
      if (pending) {
        clearTimeout(pending);
        leaveTimers.delete(userId);
      }

      if (message.action === "enter") {
        emitPresence(userId, true);
        return;
      }

      if (message.action !== "leave") return;

      const timeout = setTimeout(async () => {
        leaveTimers.delete(userId);

        try {
          const members = await presence.get();
          const stillOnline = members.some(
            (member) => member.clientId === userId
          );

          if (!stillOnline) {
            emitPresence(userId, false, new Date().toISOString());
          }
        } catch (error) {
          console.error("Falha ao confirmar saída do usuário:", error);
        }
      }, 400);

      leaveTimers.set(userId, timeout);
    };

    const enterPresence = () => {
      presenceQueue = presenceQueue
        .then(async () => {
          if (document.visibilityState !== "visible" || isPresent) return;

          await presence.enter();
          isPresent = true;
        })
        .catch((error) => {
          console.error("Falha ao entrar na presença:", error);
        });
    };

    const leavePresence = () => {
      presenceQueue = presenceQueue
        .then(async () => {
          if (!isPresent) return;

          await presence.leave();
          isPresent = false;

          try {
            await fetch("/api/auth/presence/leave", {
              method: "POST",
              cache: "no-store",
              keepalive: true,
            });
          } catch (error) {
            console.error("Falha ao registrar última atividade:", error);
          }
        })
        .catch((error) => {
          console.error("Falha ao sair da presença:", error);
        });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        enterPresence();
      } else {
        leavePresence();
      }
    };

    const flushChanges = async () => {
      timer = undefined;

      if (pendingModules.size === 0) return;

      const modules = Array.from(pendingModules);
      const mutationIds = Array.from(pendingMutationIds);
      const hasUntrackedChanges = hasUntrackedDataChanges;

      pendingModules.clear();
      pendingMutationIds.clear();
      hasUntrackedDataChanges = false;

      const refreshAccess = modules.includes("usuarios");

      if (refreshAccess) {
        try {
          const response = await fetch("/api/auth/heartbeat", {
            method: "POST",
            cache: "no-store",
          });

          if (!response.ok) {
            window.location.replace("/login");
            return;
          }

          router.refresh();
        } catch {
          return;
        }
      }

      window.dispatchEvent(
        new CustomEvent("logistica:data-changed", {
          detail: { modules, mutationIds, hasUntrackedChanges },
        })
      );
    };

    channel.subscribe((message) => {
      if (message.name === "auth:invalidate") {
        window.location.replace("/login");
        return;
      }

      if (message.name === "auth:device-revoked") {
        void fetch("/api/auth/heartbeat", {
          method: "POST",
          cache: "no-store",
        }).then((response) => {
          if (response.status === 401) window.location.replace("/login");
        }).catch(() => {});
        return;
      }

      if (message.name !== "data:changed") return;

      const data = message.data as {
        modules?: string[];
        mutationId?: string;
      };

      const modules = data?.modules ?? [];
      modules.forEach((module) => pendingModules.add(module));

      if (typeof data?.mutationId === "string") {
        pendingMutationIds.add(data.mutationId);
      } else {
        hasUntrackedDataChanges = true;
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(flushChanges, 200);
    });

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", leavePresence);

    void presence
      .subscribe(["enter", "leave"], onPresenceChanged)
      .then(async () => {
        try {
          const members = await presence.get();

          members.forEach((member) => {
            if (member.clientId) {
              emitPresence(member.clientId, true);
            }
          });

          enterPresence();
        } catch (error) {
          console.error("Falha ao inicializar presença:", error);
        }
      })
      .catch((error) => {
        console.error("Falha ao assinar presença:", error);
      });

    return () => {
      if (timer) clearTimeout(timer);

      leaveTimers.forEach((timeout) => clearTimeout(timeout));
      leaveTimers.clear();

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );

      window.removeEventListener("pagehide", leavePresence);

      presence.unsubscribe(onPresenceChanged);
      channel.unsubscribe();
    };
  }, [router]);

  return null;
}
