
import { prisma } from "@/lib/prisma";

export async function gerarAlertasDeAgendamento(): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      // Impede duas execuções simultâneas de criarem alertas duplicados.
      await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(827364921::bigint) IS NULL AS locked
    `;

      const agora = new Date();

      const agendamentos = await tx.agendamentoCarregamento.findMany({
        where: {
          status: "AGENDADO",
          dataHora: { lte: agora },
        },
        orderBy: { dataHora: "desc" },
        take: 200,
        select: {
          id: true,
          origem: true,
          destino: true,
          caminhao: {
            select: { placa: true },
          },
        },
      });

      if (agendamentos.length === 0) return 0;

      const ids = agendamentos.map((item) => item.id);

      const existentes = await tx.alerta.findMany({
        where: {
          tipo: "AGENDAMENTO",
          referencia: { in: ids },
        },
        select: { referencia: true },
      });

      const exclusoes = await tx.auditLog.findMany({
        where: {
          action: "ALERTA_EXCLUIDO",
          entity: "Alerta",
          entityId: {
            in: ids.map((id) => `AGENDAMENTO:${id}`),
          },
        },
        select: { entityId: true },
      });

      const jaTemAlerta = new Set(
        existentes.map((item) => item.referencia)
      );

      const jaExcluidos = new Set(
        exclusoes.map((item) => item.entityId)
      );

      const novos = agendamentos.filter(
        (item) =>
          !jaTemAlerta.has(item.id) &&
          !jaExcluidos.has(`AGENDAMENTO:${item.id}`)
      );

      if (novos.length === 0) return 0;

      const resultado = await tx.alerta.createMany({
        data: novos.map((item) => ({
          tipo: "AGENDAMENTO",
          titulo: "Agendamento chegou ao horário",
          mensagem: `O agendamento do caminhão ${item.caminhao.placa} chegou ao horário programado: ${item.origem} - ${item.destino}.`,
          severidade: "WARNING" as const,
          referencia: item.id,
        })),
      });

      return resultado.count;
    },
    {
      maxWait: 5000,
      timeout: 15000,
    }
  );
}
