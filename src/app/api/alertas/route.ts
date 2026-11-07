import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const agora = new Date();

    const [agendamentos, manutencoes] = await Promise.all([
      prisma.agendamentoCarregamento.findMany({
        where: {
          status: "AGENDADO",
          dataHora: { lte: agora },
          alertaGeradoEm: null,
        },
        select: {
          id: true,
          origem: true,
          destino: true,
          caminhao: { select: { placa: true } },
        },
      }),

      prisma.manutencaoProgramada.findMany({
        where: {
          status: "ATIVA",
          dataHora: { lte: agora },
          alertaGeradoEm: null,
        },
        select: {
          id: true,
          descricao: true,
          caminhao: { select: { placa: true } },
        },
      }),
    ]);

    for (const item of agendamentos) {
      await prisma.$transaction(async (tx) => {
        const atualizado = await tx.agendamentoCarregamento.updateMany({
          where: {
            id: item.id,
            status: "AGENDADO",
            dataHora: { lte: agora },
            alertaGeradoEm: null,
          },
          data: {
            alertaGeradoEm: agora,
          },
        });

        if (atualizado.count === 1) {
          const existente = await tx.alerta.findFirst({
            where: {
              tipo: "AGENDAMENTO",
              referencia: item.id,
            },
            select: { id: true },
          });

          if (!existente) {
            await tx.alerta.create({
              data: {
                tipo: "AGENDAMENTO",
                titulo: "Agendamento chegou ao horário",
                mensagem: `O agendamento do caminhão ${item.caminhao.placa} chegou ao horário programado: ${item.origem} - ${item.destino}.`,
                severidade: "WARNING",
                referencia: item.id,
              },
            });
          }
        }
      });
    }

    for (const item of manutencoes) {
      await prisma.$transaction(async (tx) => {
        const atualizado = await tx.manutencaoProgramada.updateMany({
          where: {
            id: item.id,
            status: "ATIVA",
            dataHora: { lte: agora },
            alertaGeradoEm: null,
          },
          data: {
            alertaGeradoEm: agora,
          },
        });

        if (atualizado.count === 1) {
          const existente = await tx.alerta.findFirst({
            where: {
              tipo: "MANUTENCAO",
              referencia: item.id,
            },
            select: { id: true },
          });

          if (!existente) {
            await tx.alerta.create({
              data: {
                tipo: "MANUTENCAO",
                titulo: "Manutenção programada chegou ao horário",
                mensagem: `A manutenção "${item.descricao}" do caminhão ${item.caminhao.placa} chegou à data e hora programadas.`,
                severidade: "WARNING",
                referencia: item.id,
              },
            });
          }
        }
      });
    }

    const [alertas, naoLidos] = await Promise.all([
      prisma.alerta.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.alerta.count({
        where: { lido: false },
      }),
    ]);

    return NextResponse.json({ alertas, naoLidos });
  } catch (error) {
    console.error("Erro ao carregar notificações:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar as notificações." },
      { status: 500 }
    );
  }
}