"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Truck, Package, AlertTriangle, Weight, Activity, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

type DashboardData = {
  stats: {
    caminhoesAtivos: number;
    pesoHojeToneladas: number;
    carregamentosHoje: number;
    alertas: number;
    carregamentosOntem: number;
    pesoOntemToneladas: number;
  };
  statusCaminhoes: { name: string; value: number; color: string }[];
  pesoSemanal: { date: string; dia: string; peso: number }[];
  recentes: {
    id: string;
    placa: string;
    produtos: string[];
    pesoToneladas: number;
    status: string;
    data: string;
  }[];
  alertas: {
    id: string;
    titulo: string;
    mensagem: string;
    severidade: string;
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

  const stats = data ? [
    { title: "Caminhões ativos", value: String(data.stats.caminhoesAtivos), icon: Truck, color: "text-blue-600 dark:text-blue-400", iconBg: "bg-blue-500/10" },
    { title: "Peso carregado hoje", value: `${numberFormat.format(data.stats.pesoHojeToneladas)} t`, icon: Weight, color: "text-emerald-600 dark:text-emerald-400", iconBg: "bg-emerald-500/10" },
    { title: "Carregamentos hoje", value: String(data.stats.carregamentosHoje), icon: Package, color: "text-violet-600 dark:text-violet-400", iconBg: "bg-violet-500/10" },
    { title: "Alertas não lidos", value: String(data.stats.alertas), icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", iconBg: "bg-amber-500/10" },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
          {error}
          <button type="button" onClick={() => void loadDashboard()} className="ml-2 underline">
            Tentar novamente
          </button>
        </div>
      )}

      {loading && !data ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando dados reais...</CardContent></Card>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-foreground/80">{stat.title}</CardTitle>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg}`}><Icon className={`h-5 w-5 ${stat.color}`} /></span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Calculado a partir dos registros do banco
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Peso carregado (t)  esta semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.pesoSemanal}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dia" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} tickLine={{ stroke: "hsl(var(--border))" }} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <YAxis tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} tickLine={{ stroke: "hsl(var(--border))" }} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <Tooltip formatter={(value) => [`${numberFormat.format(Number(value))} t`, "Peso"]} />
                      <Bar dataKey="peso" name="Peso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Status dos caminhões</CardTitle></CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.statusCaminhoes} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {data.statusCaminhoes.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {data.statusCaminhoes.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      {item.name}: {item.value}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
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
                          <p className="text-foreground/80">
                            {item.produtos.length ? item.produtos.join(", ") : "Sem produto informado"}
                            {"  "}{numberFormat.format(item.pesoToneladas)} t
                          </p>
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
          </div>
        </>
      ) : !error ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum dado disponível.</CardContent></Card>
      ) : null}
    </div>
  );
}
