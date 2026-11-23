
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { gerarAlertasDeAgendamento } from "@/lib/gerar-alertas-agendamentos";
import { publishDataChanged } from "@/lib/realtime";

export const runtime = "nodejs";
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

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Nao autorizado." },
      { status: 401 }
    );
  }

  try {
    const criados = await gerarAlertasDeAgendamento();

    if (criados > 0) {
      await publishDataChanged("alertas");
    }

    return NextResponse.json({
      ok: true,
      criados,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao gerar alertas de agendamento:", error);

    return NextResponse.json(
      { ok: false, error: "Falha ao gerar alertas de agendamento." },
      { status: 500 }
    );
  }
}
