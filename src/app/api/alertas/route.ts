
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { publishDataChanged } from "@/lib/realtime";

export async function PATCH() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Nao autorizado" },
      { status: 401 }
    );
  }

  try {
    const resultado = await prisma.alerta.updateMany({
      where: { lido: false },
      data: { lido: true },
    });

    await publishDataChanged("alertas");

    return NextResponse.json({
      success: true,
      updated: resultado.count,
    });
  } catch (error) {
    console.error("Erro ao marcar notificacoes como lidas:", error);

    return NextResponse.json(
      { error: "Nao foi possivel atualizar as notificacoes." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Nao autorizado" },
      { status: 401 }
    );
  }

  try {
    const [alertas, naoLidos] = await Promise.all([
      prisma.alerta.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.alerta.count({
        where: { lido: false },
      }),
    ]);

    const alertasExibicao = alertas.map((alerta) => ({
      ...alerta,
      titulo: alerta.titulo.replaceAll("hor?rio", "horário"),
      mensagem: alerta.mensagem
        .replaceAll("caminh?o", "caminhão")
        .replaceAll("hor?rio", "horário"),
    }));

    return NextResponse.json({ alertas: alertasExibicao, naoLidos });
  } catch (error) {
    console.error("Erro ao carregar notificacoes:", error);

    return NextResponse.json(
      { error: "Nao foi possivel carregar as notificacoes." },
      { status: 500 }
    );
  }
}
