"use client";
import dynamic from "next/dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { DashboardSkeleton } from "@/components/layout/PageSkeletons";
import {
  Truck, Package, AlertTriangle, Weight, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


const DashboardCharts = dynamic(
  () => import("@/components/dashboard/DashboardCharts"),
  {
    loading: () => (
      <div
        role="status"
        aria-label="Carregando gráficos"
        aria-busy="true"
        className="grid items-stretch gap-6 lg:grid-cols-3"
      >
        <div className="min-h-[340px] animate-pulse rounded-xl bg-muted lg:col-span-2" />
        <div className="min-h-[340px] animate-pulse rounded-xl bg-muted" />
      </div>
    ),
  }
);
type DashboardData = {
  stats: {
    caminhoesAtivos: number;
    pesoHojeToneladas: number;
    carregamentosHoje: number;
    alertas: number;
    carregamentosOntem: number;
    pesoOntemToneladas: number;
  };
  statusCaminhoes: { name: string; status: string; value: number; color: string }[];
  pesoSemanal: { date: string; dia: string; peso: number }[];
  recentes: {
    id: string;
    placa: string;
    itens: { quantidade: number; nome: string; unidade: string; pesoKg: number }[];
    pesoToneladas: number;
    status: string;
    data: string;
  }[];
  alertas: {
    id: string;
    titulo: string;
    mensagem: string;
    severidade: string;
    tipo: string;
    referencia: string | null;
    createdAt: string;
  }[];
};

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    EM_ANDAMENTO: "Em andamento",
    FINALIZADO: "Finalizado",
    CANCELADO: "Cancelado",
    NAO_CARREGADO: "Não carregado",
  };
  return labels[status] ?? status;
}

function statusVariant(status: string): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (status === "FINALIZADO") return "success";
  if (status === "CANCELADO") return "destructive";
  if (status === "NAO_CARREGADO") return "warning";
  return "default";
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(response.status === 401
          ? "Sua sessão expirou. Entre novamente no sistema."
          : "Não foi possível consultar os dados do Dashboard.");
      }
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o Dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function handleOpenAlert(alert: DashboardData["alertas"][number]) {
    try {
      const response = await fetch(`/api/alertas/${encodeURIComponent(alert.id)}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Não foi possível marcar o alerta como lido.");
      }

      setData((current) => current ? {
        ...current,
        stats: {
          ...current.stats,
          alertas: Math.max(0, current.stats.alertas - 1),
        },
        alertas: current.alertas.filter((item) => item.id !== alert.id),
      } : current);

      if (alert.tipo === "PESO" && alert.referencia) {
        router.push(`/carregamentos?editar=${encodeURIComponent(alert.referencia)}`);
      } else if (alert.tipo === "CAMINHAO") {
        if (alert.referencia) {
          router.push(`/caminhoes?editar=${encodeURIComponent(alert.referencia)}`);
        } else {
          router.push("/caminhoes");
        }
      } else if (alert.tipo === "SISTEMA") {
        router.push("/configuracoes");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir alerta.");
    }
  }

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const totalCaminhoes = useMemo(() => data ? data.statusCaminhoes.reduce((total, item) => total + item.value, 0) : 0, [data?.statusCaminhoes]);

  const stats = data ? [
    { title: "Caminhões ativos", value: String(data.stats.caminhoesAtivos), icon: Truck, color: "text-blue-600 dark:text-blue-400", iconBg: "bg-blue-500/10" },
    { title: "Peso carregado hoje", value: `${numberFormat.format(data.stats.pesoHojeToneladas)} t`, icon: Weight, color: "text-emerald-600 dark:text-emerald-400", iconBg: "bg-emerald-500/10" },
    { title: "Carregamentos hoje", value: String(data.stats.carregamentosHoje), icon: Package, color: "text-violet-600 dark:text-violet-400", iconBg: "bg-violet-500/10" },
    { title: "Alertas não lidos", value: String(data.stats.alertas), icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", iconBg: "bg-amber-500/10" },
  ] : [];

  return (
    <div className="space-y-6">
      <ScreenAssembly delay={0}><div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-foreground/80">Visão geral do sistema Logísticas Bill.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div></ScreenAssembly>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
          {error}
          <button type="button" onClick={() => void loadDashboard()} className="ml-2 underline">
            Tentar novamente
          </button>
        </div>
      )}

      {loading && !data ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <ScreenAssembly className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" delay={0.18}>
            {stats.map((stat) => {
              const Icon = stat.icon;
              const card = (
                <Card className="h-full transition-all duration-200 hover:border-primary/40 hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-foreground/80">{stat.title}</CardTitle>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg}`}><Icon className={`h-5 w-5 ${stat.color}`} /></span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stat.title === "Carregamentos hoje" ? "Clique para acessar os carregamentos" : "Calculado a partir dos registros do banco"}
                    </p>
                  </CardContent>
                </Card>
              );

              return stat.title === "Carregamentos hoje" ? (
                <Link
                  key={stat.title}
                  href="/carregamentos"
                  aria-label="Abrir página de carregamentos"
                  className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {card}
                </Link>
              ) : (
                <div key={stat.title}>{card}</div>
              );
            })}
          </ScreenAssembly>

          <DashboardCharts
            pesoSemanal={data.pesoSemanal}
            statusCaminhoes={data.statusCaminhoes}
            totalCaminhoes={totalCaminhoes}
            todayKey={todayKey}
            onStatusClick={(status) =>
              router.push(`/caminhoes?status=${encodeURIComponent(status)}`)
            }
          />

          <ScreenAssembly className="grid gap-6 lg:grid-cols-2" delay={1.05}>
            <Card>
              <CardHeader><CardTitle>Carregamentos recentes</CardTitle></CardHeader>
              <CardContent>
                {data.recentes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhum carregamento registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {data.recentes.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm transition-colors hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="font-medium">{item.placa}</p>
                          <div className="mt-1 space-y-1 text-foreground/80">{item.itens.length ? item.itens.map((itemCarga, index) => (<p key={`${item.id}-${index}`}>{itemCarga.nome}<span className="text-muted-foreground"> • {numberFormat.format(itemCarga.pesoKg)} kg</span></p>)) : <p className="text-muted-foreground">Sem item informado</p>}</div><p className="mt-1 font-medium">Total: {numberFormat.format(item.pesoToneladas)} t</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {dateTimeFormat.format(new Date(item.data))}
                          </p>
                        </div>
                        <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Alertas registrados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.alertas.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhum alerta não lido registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {data.alertas.map((alert) => (
                      <div
                        key={alert.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void handleOpenAlert(alert)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void handleOpenAlert(alert);
                          }
                        }}
                        title="Abrir alerta e marcar como lido"
                        className={`rounded-lg border p-3 text-sm ${
                          alert.severidade === "CRITICAL"
                            ? "border-destructive/50 bg-destructive/5"
                            : alert.severidade === "WARNING"
                            ? "border-amber-500/50 bg-amber-500/5"
                            : "border-border"
                        }`}
                      >
                        <p className="font-medium">{alert.titulo}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{alert.mensagem}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateTimeFormat.format(new Date(alert.createdAt))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </ScreenAssembly>
        </>
      ) : !error ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum dado disponível.</CardContent></Card>
      ) : null}
    </div>
  );
}
