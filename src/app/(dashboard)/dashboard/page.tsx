"use client";

import { motion } from "framer-motion";
import {
  Truck,
  Package,
  AlertTriangle,
  Weight,
  Activity,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const stats = [
  { title: "Caminhões Ativos", value: "12", icon: Truck, change: "+2", color: "text-blue-500" },
  { title: "Peso Total (hoje)", value: "48.2 t", icon: Weight, change: "+12%", color: "text-emerald-500" },
  { title: "Carregamentos", value: "28", icon: Package, change: "+5", color: "text-violet-500" },
  { title: "Alertas", value: "3", icon: AlertTriangle, change: "-1", color: "text-amber-500" },
];

const statusCaminhoes = [
  { name: "Liberado", value: 5, color: "#22c55e" },
  { name: "Carregando", value: 3, color: "#3b82f6" },
  { name: "Carregado", value: 2, color: "#8b5cf6" },
  { name: "Em Rota", value: 2, color: "#f59e0b" },
];

const pesoSemanal = [
  { dia: "Seg", peso: 32 },
  { dia: "Ter", peso: 41 },
  { dia: "Qua", peso: 38 },
  { dia: "Qui", peso: 45 },
  { dia: "Sex", peso: 48 },
  { dia: "Sáb", peso: 22 },
  { dia: "Dom", peso: 8 },
];

const recentes = [
  { id: 1, placa: "ABC-1D23", produto: "Soja", peso: "18.4 t", status: "Finalizado", hora: "08:42" },
  { id: 2, placa: "XYZ-9K87", produto: "Milho", peso: "22.1 t", status: "Em andamento", hora: "09:15" },
  { id: 3, placa: "DEF-4M56", produto: "Fertilizante", peso: "12.8 t", status: "Finalizado", hora: "07:30" },
  { id: 4, placa: "GHI-2P11", produto: "Farelo", peso: "15.0 t", status: "Carregando", hora: "10:05" },
];

const alertas = [
  { id: 1, titulo: "Peso próximo do limite", msg: "Caminhão ABC-1D23 atingiu 98% da capacidade", severidade: "warning" },
  { id: 2, titulo: "Manutenção pendente", msg: "Caminhão XYZ-9K87 – 15.000 km sem revisão", severidade: "critical" },
  { id: 3, titulo: "Rota atrasada", msg: "Rota #1042 – atraso estimado de 45 min", severidade: "info" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema Logísticas Bill</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    {stat.change} vs ontem
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart peso */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Peso carregado (t) — esta semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pesoSemanal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dia" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="peso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status caminhões */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Caminhões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusCaminhoes}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {statusCaminhoes.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {statusCaminhoes.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}: {s.value}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Carregamentos recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Carregamentos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentes.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.placa}</p>
                    <p className="text-muted-foreground">{r.produto} • {r.peso}</p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        r.status === "Finalizado"
                          ? "success"
                          : r.status === "Em andamento"
                          ? "default"
                          : "warning"
                      }
                    >
                      {r.status}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{r.hora}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alertas de Peso e Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertas.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border p-3 text-sm ${
                    a.severidade === "critical"
                      ? "border-destructive/50 bg-destructive/5"
                      : a.severidade === "warning"
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-border"
                  }`}
                >
                  <p className="font-medium">{a.titulo}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{a.msg}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
