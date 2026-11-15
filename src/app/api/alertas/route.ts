import { after, NextResponse } from "next/server";
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

/**
 * Gera os alertas internos de agendamentos que já chegaram ao horário.
 *
 * Antes: uma transação (com 2 consultas) por agendamento vencido, a cada
 * consulta de cada aba aberta, sem limite. Agora: no máximo 3 consultas em
 * lote, independentemente da quantidade de agendamentos.
 *
 * Mantém o comportamento original: não altera alertaGeradoEm (reservado ao
 * Push do Cron) e respeita alertas que o usuário já excluiu (AuditLog).
 */
async function gerarAlertasDeAgendamento(agora: Date): Promise<number> {
  const agendamentos = await prisma.agendamentoCarregamento.findMany({
    where: { status: "AGENDADO", dataHora: { lte: agora } },
    orderBy: { dataHora: "desc" },
    take: 200,
    select: {
      id: true,
      origem: true,
      destino: true,
      caminhao: { select: { placa: true } },
    },
  });

  if (agendamentos.length === 0) return 0;

  const ids = agendamentos.map((item) => item.id);

  const [existentes, exclusoes] = await Promise.all([
    prisma.alerta.findMany({
      where: { tipo: "AGENDAMENTO", referencia: { in: ids } },
      select: { referencia: true },
    }),
    prisma.auditLog.findMany({
      where: {
        action: "ALERTA_EXCLUIDO",
        entity: "Alerta",
        entityId: { in: ids.map((id) => `AGENDAMENTO:${id}`) },
      },
      select: { entityId: true },
    }),
  ]);

  const jaTemAlerta = new Set(existentes.map((item) => item.referencia));
  const jaExcluidos = new Set(exclusoes.map((item) => item.entityId));

  const novos = agendamentos.filter(
    (item) => !jaTemAlerta.has(item.id) && !jaExcluidos.has(`AGENDAMENTO:${item.id}`)
  );

  if (novos.length === 0) return 0;

  await prisma.alerta.createMany({
    data: novos.map((item) => ({
      tipo: "AGENDAMENTO",
      titulo: "Agendamento chegou ao horário",
      mensagem: `O agendamento do caminhão ${item.caminhao.placa} chegou ao horário programado: ${item.origem} - ${item.destino}.`,
      severidade: "WARNING" as const,
      referencia: item.id,
    })),
  });

  return novos.length;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const criados = await gerarAlertasDeAgendamento(new Date());

    // Avisa os outros usuários conectados na hora, sem esperar a próxima consulta.
    if (criados > 0) {
      after(() => publishDataChanged("alertas"));
    }

    // Manutenções não são mais processadas nesta central.
    // Os registros e as APIs de manutenção permanecem intactos.
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
    console.error("Erro ao carregar notificações:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar as notificações." },
      { status: 500 }
    );
  }
}
