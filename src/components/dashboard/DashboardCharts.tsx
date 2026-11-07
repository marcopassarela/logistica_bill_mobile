"use client";

import { Activity } from "lucide-react";
import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type DashboardChartsProps = {
  pesoSemanal: { date: string; dia: string; peso: number }[];
  statusCaminhoes: {
    name: string;
    status: string;
    value: number;
    color: string;
  }[];
  totalCaminhoes: number;
  todayKey: string;
  onStatusClick: (status: string) => void;
};

export default function DashboardCharts({
  pesoSemanal,
  statusCaminhoes,
  totalCaminhoes,
  todayKey,
  onStatusClick,
}: DashboardChartsProps) {
  const numberFormat = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  });

  return (
    <ScreenAssembly
      className="grid items-stretch gap-6 lg:grid-cols-3"
      delay={0.65}
      itemClassNames={["h-full lg:col-span-2", "h-full"]}
    >
      <Card className="flex h-full flex-col lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
          Peso carregado (t) esta semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pesoSemanal} barCategoryGap="0%">
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  formatter={(value) => [
                    `${numberFormat.format(Number(value))} t`,
                    "Peso carregado",
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  labelStyle={{
                    color: "hsl(var(--foreground))",
                    fontWeight: 600,
                  }}
                  itemStyle={{ color: "#60A5FA" }}
                  cursor={{ fill: "rgba(59, 130, 246, 0.10)" }}
                />
                <Bar
                  dataKey="peso"
                  name="Peso carregado"
                  maxBarSize={48}
                  radius={[6, 6, 0, 0]}
                  activeBar={{
                    fill: "#60A5FA",
                    stroke: "#1D4ED8",
                    strokeWidth: 2,
                  }}
                >
                  {pesoSemanal.map((item) => (
                    <Cell
                      key={item.date}
                      fill={item.date === todayKey ? "#2563EB" : "#60A5FA"}
                      fillOpacity={item.date === todayKey ? 1 : 0.72}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle>Status dos caminhões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusCaminhoes}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={0}
                  stroke="none"
                  strokeWidth={0}
                >
                  {statusCaminhoes.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      cursor="pointer"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onStatusClick(entry.status)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [Number(value), "Caminhões"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "10px",
                    color: "hsl(var(--foreground))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums">
                {totalCaminhoes}
              </span>
              <span className="text-xs text-muted-foreground">caminhões</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            {statusCaminhoes.map((item) => (
              <button
                type="button"
                key={item.name}
                onClick={() => onStatusClick(item.status)}
                aria-label={`Filtrar caminhões: ${item.name}`}
                className="flex min-w-0 items-center justify-between gap-2 rounded-md text-left text-xs transition-colors hover:bg-muted/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="truncate text-muted-foreground">
                    {item.name}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{item.value}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </ScreenAssembly>
  );
}