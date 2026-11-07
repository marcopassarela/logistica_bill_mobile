import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "N?o autorizado" }, { status: 401 });
  }

  try {
    const agora = new Date();

    // Mant?m os alertas internos de Agendamento sem alterar
    // alertaGeradoEm, que fica reservado ao processamento do Push pelo Cron.
    const agendamentos = await prisma.agendamentoCarregamento.findMany({
      where: {
        status: "AGENDADO",
        dataHora: { lte: agora },
      },
      select: {
        id: true,
        origem: true,
        destino: true,
        caminhao: { select: { placa: true } },
      },
    });

    for (const item of agendamentos) {
      await prisma.$transaction(async (tx) => {
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
              titulo: "Agendamento chegou ao hor?rio",
              mensagem: `O agendamento do caminh?o ${item.caminhao.placa} chegou ao hor?rio programado: ${item.origem} - ${item.destino}.`,
              severidade: "WARNING",
              referencia: item.id,
            },
          });
        }
      });
    }

    // Manuten??es n?o s?o mais processadas nesta central.
    // Os registros e as APIs de manuten??o permanecem intactos.
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
    console.error("Erro ao carregar notifica??es:", error);

    return NextResponse.json(
      { error: "N?o foi poss?vel carregar as notifica??es." },
      { status: 500 }
    );
  }
}
