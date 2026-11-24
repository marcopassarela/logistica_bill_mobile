"use client";

import { useEffect, useState } from "react";

/**
 * Banner superior estilo WhatsApp Web.
 * Quando NEXT_PUBLIC_APP_VERSION muda após um deploy, o aviso aparece
 * até o usuário clicar em "Atualizar" (reload) ou recarregar a aba.
 */
const STORAGE_KEY = "lb_app_version_seen";

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const current = process.env.NEXT_PUBLIC_APP_VERSION || "1.0";

  useEffect(() => {
    if (!current || typeof window === "undefined") return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen && seen !== current) {
        setVisible(true);
      } else if (!seen) {
        localStorage.setItem(STORAGE_KEY, current);
      }
    } catch {
      // localStorage indisponível
    }
  }, [current]);

  function handleUpdate() {
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-emerald-600 px-4 py-2.5 text-sm text-white shadow-md"
    >
      <span className="font-medium">
        Há uma nova versão do sistema disponível.
      </span>
      <button
        type="button"
        onClick={handleUpdate}
        className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-white/30"
      >
        Atualizar
      </button>
    </div>
  );
}
