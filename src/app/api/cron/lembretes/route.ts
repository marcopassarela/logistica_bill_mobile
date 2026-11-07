import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import * as webpush from "web-push";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const received = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    return typeof code === "number" ? code : undefined;
  }

  return undefined;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado." },
      { status: 500 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 }
    );
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json(
      { error: "Configuração VAPID incompleta." },
      { status: 500 }
    );
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const now = new Date();
    const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);

    const candidates = await prisma.lembrete.findMany({
      where: {
        OR: [
          { status: "PENDENTE", dataHora: { lte: now } },
          {
            status: "PROCESSANDO",
            processandoEm: { lt: staleBefore },
          },
        ],
      },
      orderBy: { dataHora: "asc" },
      take: 20,
    });

    let sent = 0;
    let retry = 0;
    let withoutDevices = 0;
    let partial = 0;

    for (const reminder of candidates) {
      const claimedAt = new Date();

      const claim = await prisma.lembrete.updateMany({
        where: {
          id: reminder.id,
          OR: [
            { status: "PENDENTE", dataHora: { lte: now } },
            {
              status: "PROCESSANDO",
              processandoEm: { lt: staleBefore },
            },
          ],
        },
        data: {
          status: "PROCESSANDO",
          processandoEm: claimedAt,
        },
      });

      if (claim.count !== 1) continue;

      try {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: reminder.userId },
        });

        if (subscriptions.length === 0) {
          await prisma.lembrete.updateMany({
            where: {
              id: reminder.id,
              status: "PROCESSANDO",
              processandoEm: claimedAt,
            },
            data: {
              status: "PENDENTE",
              processandoEm: null,
            },
          });

          withoutDevices++;
          continue;
        }

        const date = reminder.dataHora.toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        });

        const time = reminder.dataHora.toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
        });

        const payload = JSON.stringify({
          id: reminder.id,
          title: "Logísticas Bill",
          body: `Descrição: ${reminder.descricao}\nData: ${date}\nHorário: ${time}`,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `lembrete-${reminder.id}`,
          url: "/programacoes",
        });

        const results = await Promise.all(
          subscriptions.map(async (subscription) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                  },
                },
                payload,
                { TTL: 60 * 60 }
              );

              return { accepted: true, expired: false };
            } catch (error) {
              const statusCode = getStatusCode(error);

              if (statusCode === 404 || statusCode === 410) {
                await prisma.pushSubscription.deleteMany({
                  where: {
                    id: subscription.id,
                    userId: reminder.userId,
                  },
                });

                return { accepted: false, expired: true };
              }

              console.error(
                "Falha no envio Push para inscrição:",
                statusCode ?? "erro de envio"
              );

              return { accepted: false, expired: false };
            }
          })
        );

        const accepted = results.filter((result) => result.accepted).length;
        const failed = results.length - accepted;

        if (accepted > 0) {
          await prisma.lembrete.updateMany({
            where: {
              id: reminder.id,
              status: "PROCESSANDO",
              processandoEm: claimedAt,
            },
            data: {
              status: "ENVIADO",
              enviadoEm: new Date(),
              processandoEm: null,
            },
          });

          sent++;
          if (failed > 0) partial++;
        } else {
          await prisma.lembrete.updateMany({
            where: {
              id: reminder.id,
              status: "PROCESSANDO",
              processandoEm: claimedAt,
            },
            data: {
              status: "PENDENTE",
              processandoEm: null,
            },
          });

          retry++;
        }
      } catch (error) {
        console.error("Erro ao processar lembrete:", reminder.id, error);

        await prisma.lembrete.updateMany({
          where: {
            id: reminder.id,
            status: "PROCESSANDO",
            processandoEm: claimedAt,
          },
          data: {
            status: "PENDENTE",
            processandoEm: null,
          },
        });

        retry++;
      }
    }

    const agendamentos = await prisma.agendamentoCarregamento.findMany({
      where: {
        status: "AGENDADO",
        dataHora: { lte: now },
        alertaGeradoEm: null,
      },
      include: {
        caminhao: { select: { placa: true } },
      },
      orderBy: { dataHora: "asc" },
      take: 20,
    });

    let agendamentosEnviados = 0;
    let agendamentosAguardandoCarregamento = 0;
    let agendamentosSemDispositivos = 0;
    let agendamentosRetry = 0;

    for (const agendamento of agendamentos) {
      const claimedAt = new Date();

      const claim = await prisma.agendamentoCarregamento.updateMany({
        where: {
          id: agendamento.id,
          status: "AGENDADO",
          dataHora: { lte: now },
          alertaGeradoEm: null,
        },
        data: { alertaGeradoEm: claimedAt },
      });

      if (claim.count !== 1) continue;

      try {
        const pesoTotal = Number(agendamento.peso);

        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: agendamento.userId },
        });

        if (subscriptions.length === 0) {
          await prisma.agendamentoCarregamento.updateMany({
            where: {
              id: agendamento.id,
              alertaGeradoEm: claimedAt,
            },
            data: { alertaGeradoEm: null },
          });

          agendamentosSemDispositivos++;
          continue;
        }

        const date = agendamento.dataHora.toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        });

        const pesoFormatado =
          Number.isFinite(pesoTotal) && pesoTotal > 0
            ? pesoTotal.toLocaleString("pt-BR", {
                maximumFractionDigits: 3,
              }) + " kg"
            : "n\u00E3o informado";

        const payload = JSON.stringify({
          id: agendamento.id,
          title: "Log\u00EDsticas Bill \u2014 Agendamento",
          body:
            `Caminh\u00E3o ${agendamento.caminhao.placa} \u2014 Carga programada para hoje.\n` +
            `Data: ${date}\n` +
            `Peso previsto: ${pesoFormatado}\n` +
            `Origem: ${agendamento.origem}\n` +
            `Destino: ${agendamento.destino}`,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `agendamento-${agendamento.id}`,
          url: "/programacoes",
        });

        const results = await Promise.all(
          subscriptions.map(async (subscription) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                  },
                },
                payload,
                { TTL: 60 * 60 }
              );

              return { accepted: true };
            } catch (error) {
              const statusCode = getStatusCode(error);

              if (statusCode === 404 || statusCode === 410) {
                await prisma.pushSubscription.deleteMany({
                  where: {
                    id: subscription.id,
                    userId: agendamento.userId,
                  },
                });
              } else {
                console.error(
                  "Falha no Push do agendamento:",
                  statusCode ?? "erro de envio"
                );
              }

              return { accepted: false };
            }
          })
        );

        const accepted = results.some((result) => result.accepted);

        if (accepted) {
          agendamentosEnviados++;
        } else {
          await prisma.agendamentoCarregamento.updateMany({
            where: {
              id: agendamento.id,
              alertaGeradoEm: claimedAt,
            },
            data: { alertaGeradoEm: null },
          });

          agendamentosRetry++;
        }
      } catch (error) {
        console.error("Erro ao processar agendamento:", agendamento.id, error);

        await prisma.agendamentoCarregamento.updateMany({
          where: {
            id: agendamento.id,
            alertaGeradoEm: claimedAt,
          },
          data: { alertaGeradoEm: null },
        });

        agendamentosRetry++;
      }
    }

    return NextResponse.json({
      success: true,
      encontrados: candidates.length,
      enviados: sent,
      parciais: partial,
      aguardandoNovaTentativa: retry,
      semDispositivos: withoutDevices,
      agendamentosEncontrados: agendamentos.length,
      agendamentosEnviados,
      agendamentosAguardandoCarregamento,
      agendamentosSemDispositivos,
      agendamentosRetry,
    });
  } catch (error) {
    console.error("Erro no processamento automático de lembretes:", error);

    return NextResponse.json(
      { error: "Falha ao processar os lembretes." },
      { status: 500 }
    );
  }
}