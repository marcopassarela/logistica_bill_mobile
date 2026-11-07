"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Info,
  ShieldAlert,
  Truck,
  Package,
} from "lucide-react";

type Alerta = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  severidade: "INFO" | "WARNING" | "CRITICAL";
  lido: boolean;
  referencia: string | null;
  createdAt: string;
};

function formatarData(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));
}

export function NotificationBell() {
  const [aberto, setAberto] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [naoLidos, setNaoLidos] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function fecharAoClicarFora(event: PointerEvent) {
      if (
        painelRef.current &&
        !painelRef.current.contains(event.target as Node)
      ) {
        setAberto(false);
      }
    }

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAberto(false);
    }

    document.addEventListener("pointerdown", fecharAoClicarFora);
    document.addEventListener("keydown", fecharComEscape);

    return () => {
      document.removeEventListener("pointerdown", fecharAoClicarFora);
      document.removeEventListener("keydown", fecharComEscape);
    };
  }, [aberto]);

  const carregar = useCallback(async () => {
    try {
      const response = await fetch("/api/alertas", { cache: "no-store" });

      if (!response.ok) {
        setErro(true);
        return;
      }

      const data = await response.json();
      setAlertas(data.alertas ?? []);
      setNaoLidos(data.naoLidos ?? 0);
      setErro(false);
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    carregar();

    const intervalo = window.setInterval(carregar, 60000);
    return () => window.clearInterval(intervalo);
  }, [carregar]);

  async function abrirAlerta(alerta: Alerta) {
    setCarregando(true);

    try {
      if (!alerta.lido) {
        await fetch(`/api/alertas/${encodeURIComponent(alerta.id)}`, {
          method: "PATCH",
        });
      }

      setAlertas((atuais) =>
        atuais.map((item) =>
          item.id === alerta.id ? { ...item, lido: true } : item
        )
      );

      if (!alerta.lido) {
        setNaoLidos((atual) => Math.max(0, atual - 1));
      }

      if (alerta.referencia && alerta.tipo === "PESO") {
        window.location.href =
          `/carregamentos?editar=${encodeURIComponent(alerta.referencia)}`;
        return;
      }

      if (alerta.referencia && alerta.tipo === "CAMINHAO") {
        window.location.href =
          `/caminhoes?editar=${encodeURIComponent(alerta.referencia)}`;
        return;
      }

      await carregar();
    } finally {
      setCarregando(false);
    }
  }

  function icone(severidade: Alerta["severidade"]) {
    if (severidade === "CRITICAL") {
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    }

    if (severidade === "WARNING") {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }

    return <Info className="h-4 w-4 text-blue-500" />;
  }

  return (
    <div ref={painelRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setAberto((atual) => !atual);
          if (!aberto) carregar();
        }}
        aria-label={`Notificações: ${naoLidos} não lidas`}
        aria-expanded={aberto}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-4 w-4" />

        {naoLidos > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {naoLidos > 99 ? "99+" : naoLidos}
          </span>
        )}
      </button>

      {aberto && (
        <>

          <div className="absolute right-0 top-11 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">Notificações</h3>
                <p className="text-xs text-muted-foreground">
                  {naoLidos} não lida(s)
                </p>
              </div>

              <button
                type="button"
                onClick={carregar}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent"
                aria-label="Atualizar notificações"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(65vh,480px)] overflow-y-auto">
              {erro ? (
                <p className="px-4 py-8 text-center text-sm text-red-500">
                  Não foi possível carregar as notificações.
                </p>
              ) : alertas.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">Tudo em dia</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhuma notificação registrada.
                  </p>
                </div>
              ) : (
                alertas.map((alerta) => (
                  <button
                    key={alerta.id}
                    type="button"
                    disabled={carregando}
                    onClick={() => abrirAlerta(alerta)}
                    className={`flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent disabled:opacity-60 ${
                      alerta.lido ? "opacity-65" : "bg-accent/30"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {icone(alerta.severidade)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{alerta.titulo}</p>
                        {!alerta.lido && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {alerta.mensagem}
                      </p>

                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {formatarData(alerta.createdAt)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-border px-4 py-2">
              <p className="text-center text-[11px] text-muted-foreground">
                Exibindo as últimas 50 notificações
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}