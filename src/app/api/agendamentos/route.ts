import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { publishDataChanged } from "@/lib/realtime";
import { z } from "zod";

const schema = z.object({
  caminhaoId: z.string().min(1),
  dataHora: z.string().datetime({ offset: true }),
  origem: z.string().trim().min(2),
  destino: z.string().trim().min(2),
});

function getBrazilDayRange(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = `${values.year}-${values.month}-${values.day}`;

  return {
    start: new Date(`${day}T00:00:00.000-03:00`),
    end: new Date(`${day}T23:59:59.999-03:00`),
  };
}

async function getPesoCarregamento(caminhaoId: string, dataHora: Date) {
  const range = getBrazilDayRange(dataHora);

  const carregamento = await prisma.carregamento.findFirst({
    where: {
      caminhaoId,
      data: { gte: range.start, lte: range.end },
      status: { notIn: ["CANCELADO", "NAO_CARREGADO"] },
    },
    orderBy: { createdAt: "desc" },
    select: { pesoTotal: true },
  });

  return carregamento ? Number(carregamento.pesoTotal) : 0;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "N\u00E3o autorizado" }, { status: 401 });

  try {
    const list = await prisma.agendamentoCarregamento.findMany({
      where: { userId: user.id },
      include: {
        caminhao: {
          select: { id: true, placa: true, marca: true, modelo: true },
        },
      },
      orderBy: { dataHora: "asc" },
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    return NextResponse.json({ error: "N?o foi poss?vel listar os agendamentos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "N\u00E3o autorizado" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inv?lidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const dataHora = new Date(data.dataHora);

    if (dataHora <= new Date()) {
      return NextResponse.json({ error: "A data e hora devem ser futuras." }, { status: 400 });
    }

    const caminhao = await prisma.caminhao.findUnique({
      where: { id: data.caminhaoId },
      select: { id: true },
    });

    if (!caminhao) {
      return NextResponse.json({ error: "Caminh?o n?o encontrado." }, { status: 404 });
    }

    const peso = await getPesoCarregamento(data.caminhaoId, dataHora);

    const created = await prisma.agendamentoCarregamento.create({
      data: {
        userId: user.id,
        caminhaoId: data.caminhaoId,
        peso,
        dataHora,
        origem: data.origem,
        destino: data.destino,
      },
      include: {
        caminhao: { select: { id: true, placa: true, marca: true, modelo: true } },
      },
    });

    await publishDataChanged("agendamentos");
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json({ error: "N?o foi poss?vel criar o agendamento." }, { status: 500 });
  }
}
