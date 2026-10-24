import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDay(key: string, amount: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function startOfBrazilianDay(key: string) {
  return new Date(`${key}T00:00:00-03:00`);
}

function isExcluded(status: string) {
  return status === "CANCELADO" || status === "NAO_CARREGADO";
}

function numberOf(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const today = dateKey(new Date());
    const yesterday = shiftDay(today, -1);
    const tomorrow = shiftDay(today, 1);
    const weekday = new Date(startOfBrazilianDay(today).getTime() + 12 * 60 * 60 * 1000).getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const monday = shiftDay(today, mondayOffset);

    const weekStart = startOfBrazilianDay(monday);
    const tomorrowStart = startOfBrazilianDay(tomorrow);
    const yesterdayStart = startOfBrazilianDay(yesterday);
    const todayStart = startOfBrazilianDay(today);

    const [
      truckTotal,
      trucksByStatus,
      weeklyLoads,
      recentLoads,
      alerts,
    ] = await Promise.all([
      prisma.caminhao.count(),
      prisma.caminhao.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.carregamento.findMany({
        where: {
          data: { gte: weekStart, lt: tomorrowStart },
        },
        select: {
          data: true,
          pesoTotal: true,
          status: true,
        },
      }),
      prisma.carregamento.findMany({
        orderBy: [{ data: "desc" }, { createdAt: "desc" }],
        take: 5,
        include: {
          caminhao: { select: { placa: true } },
          itens: {
            include: {
              produto: { select: { nome: true } },
            },
          },
        },
      }),
      prisma.alerta.findMany({
        where: { lido: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const statusMap = Object.fromEntries(
      trucksByStatus.map((item) => [item.status, item._count._all])
    ) as Record<string, number>;

    const validLoads = weeklyLoads.filter((load) => !isExcluded(load.status));
    const todayLoads = validLoads.filter(
      (load) => load.data >= todayStart && load.data < tomorrowStart
    );
    const yesterdayLoads = validLoads.filter(
      (load) => load.data >= yesterdayStart && load.data < todayStart
    );

    const weeklyWeight = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      weeklyWeight.set(shiftDay(monday, i), 0);
    }

    for (const load of validLoads) {
      const key = dateKey(load.data);
      if (weeklyWeight.has(key)) {
        weeklyWeight.set(key, (weeklyWeight.get(key) ?? 0) + numberOf(load.pesoTotal));
      }
    }

    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const chart = Array.from(weeklyWeight.entries()).map(([date, weight]) => {
      const [year, month, day] = date.split("-").map(Number);
      const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

      return {
        date,
        dia: days[weekdayIndex],
        peso: Number((weight / 1000).toFixed(3)),
      };
    });

    const activeTrucks = truckTotal - (statusMap.MANUTENCAO ?? 0);
    const todayWeightKg = todayLoads.reduce(
      (sum, load) => sum + numberOf(load.pesoTotal),
      0
    );
    const yesterdayWeightKg = yesterdayLoads.reduce(
      (sum, load) => sum + numberOf(load.pesoTotal),
      0
    );

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      stats: {
        caminhoesAtivos: activeTrucks,
        pesoHojeToneladas: Number((todayWeightKg / 1000).toFixed(3)),
        carregamentosHoje: todayLoads.length,
        alertas: alerts.length,
        carregamentosOntem: yesterdayLoads.length,
        pesoOntemToneladas: Number((yesterdayWeightKg / 1000).toFixed(3)),
      },
      statusCaminhoes: [
        { name: "Liberado", value: statusMap.LIBERADO ?? 0, color: "#22c55e" },
        { name: "Carregando", value: statusMap.CARREGANDO ?? 0, color: "#3b82f6" },
        { name: "Carregado", value: statusMap.CARREGADO ?? 0, color: "#8b5cf6" },
        { name: "Em rota", value: statusMap.EM_ROTA ?? 0, color: "#f59e0b" },
        { name: "Manutenção", value: statusMap.MANUTENCAO ?? 0, color: "#ef4444" },
      ],
      pesoSemanal: chart,
      recentes: recentLoads.map((load) => ({
        id: load.id,
        placa: load.caminhao.placa,
        produtos: load.itens.map((item) => item.produto.nome).filter(Boolean),
        pesoToneladas: Number((numberOf(load.pesoTotal) / 1000).toFixed(3)),
        status: load.status,
        data: load.data,
      })),
      alertas: alerts.map((alert) => ({
        id: alert.id,
        titulo: alert.titulo,
        mensagem: alert.mensagem,
        severidade: alert.severidade,
        createdAt: alert.createdAt,
      })),
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Erro ao carregar Dashboard:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os dados reais do Dashboard." },
      { status: 500 }
    );
  }
}
