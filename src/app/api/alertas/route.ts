import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { publishDataChanged } from "@/lib/realtime";

export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const resultado = await prisma.alerta.updateMany({ where: { lido: false }, data: { lido: true } });
    await publishDataChanged("alertas");
    return NextResponse.json({ success: true, updated: resultado.count });
  } catch (error) {
    console.error("Erro ao marcar notificações como lidas:", error);
    return NextResponse.json({ error: "Não foi possível atualizar as notificações." }, { status: 500 });
  }
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "N\u00E3o autorizado" }, { status: 401 });
  }

  try {
    const agora = new Date();

    // Mant\u00E9m os alertas internos de Agendamento sem alterar
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
        const existente = await tx.alerta.findFirst({ where: { tipo: "AGENDAMENTO", referencia: item.id }, select: { id: true } });
        const exclusao = await tx.auditLog.findFirst({ where: { action: "ALERTA_EXCLUIDO", entity: "Alerta", entityId: `AGENDAMENTO:${item.id}` }, select: { id: true } });

        if (!existente && !exclusao) {
          await tx.alerta.create({
            data: {
              tipo: "AGENDAMENTO",
              titulo: "Agendamento chegou ao hor\u00E1rio",
              mensagem: `O agendamento do caminh\u00E3o ${item.caminhao.placa} chegou ao hor\u00E1rio programado: ${item.origem} - ${item.destino}.`,
              severidade: "WARNING",
              referencia: item.id,
            },
          });
        }
      });
    }

    // Manuten\u00E7\u00F5es n\u00E3o s\u00E3o mais processadas nesta central.
    // Os registros e as APIs de manuten\u00E7\u00E3o permanecem intactos.
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
      titulo: alerta.titulo.replaceAll("hor?rio", "hor\u00E1rio"),
      mensagem: alerta.mensagem
        .replaceAll("caminh?o", "caminh\u00E3o")
        .replaceAll("hor?rio", "hor\u00E1rio"),
    }));

    return NextResponse.json({ alertas: alertasExibicao, naoLidos });
  } catch (error) {
    console.error("Erro ao carregar notifica\u00E7\u00F5es:", error);

    return NextResponse.json(
      { error: "N\u00E3o foi poss\u00EDvel carregar as notifica\u00E7\u00F5es." },
      { status: 500 }
    );
  }
}
