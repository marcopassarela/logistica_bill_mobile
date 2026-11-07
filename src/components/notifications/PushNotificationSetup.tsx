"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, Loader2, X } from "lucide-react";

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

export function PushNotificationSetup() {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [forceShowModal, setForceShowModal] = useState(false);
  const [message, setMessage] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => { setPortalReady(true); }, []);

  async function saveSubscription(subscription: PushSubscription) {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível registrar este dispositivo."
      );
    }
  }

  useEffect(() => {
    let active = true;

    async function checkSubscription() {
      try {
        if (
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          return;
        }

        if (Notification.permission === "denied") return;

        if (Notification.permission === "default") {
          if (sessionStorage.getItem("push-prompt-dismissed") !== "1" && active) {
            setShowModal(true);
          }
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await saveSubscription(subscription);

          if (active) {
            setEnabled(true);
            setShowModal(false);
          }
        } else if (active) {
          setShowModal(true);
        }
      } catch (error) {
        console.error("Erro ao verificar notificações Push:", error);
      }
    }

    checkSubscription();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handlePushTestModal() {
      setMessage("");
      setForceShowModal(true);
      setShowModal(true);
    }

    window.addEventListener("push-test-modal", handlePushTestModal);

    return () => {
      window.removeEventListener("push-test-modal", handlePushTestModal);
    };
  }, []);
  async function activateNotifications() {
    setLoading(true);
    setMessage("");

    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        throw new Error("Este navegador não oferece suporte a notificações Push.");
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error("A chave pública de notificações não está configurada.");
      }

      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;

      if (permission !== "granted") {
        throw new Error(
          "Permissão não concedida. Verifique as configurações de notificações do navegador."
        );
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      await saveSubscription(subscription);

      setEnabled(true);
      setShowModal(false);
      sessionStorage.removeItem("push-prompt-dismissed");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar as notificações."
      );
    } finally {
      setLoading(false);
    }
  }

  function dismissModal() {
    sessionStorage.setItem("push-prompt-dismissed", "1");
    setShowModal(false);
    setMessage("");
  }

  if (!portalReady || ((!showModal || enabled) && !forceShowModal)) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-modal-title"
        className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border bg-background p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={dismissModal}
          disabled={loading}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <BellRing className="h-8 w-8" />
          </div>

          <h2 id="push-modal-title" className="text-xl font-semibold tracking-tight">
            Ative suas notificações
          </h2>

          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Receba avisos de agendamentos, manutenções e lembretes importantes,
            mesmo quando não estiver com o Logísticas Bill aberto.
          </p>

          {message && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={activateNotifications}
            disabled={loading}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4" />
            )}
            {loading ? "Ativando..." : "Ativar notificações"}
          </button>

          <button
            type="button"
            onClick={dismissModal}
            disabled={loading}
            className="mt-3 h-9 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}



