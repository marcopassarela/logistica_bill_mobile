import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  caminhaoId: z.string().min(1),
  peso: z.coerce.number().positive(),
  dataHora: z.string().datetime({ offset: true }),
  origem: z.string().trim().min(2),
  destino: z.string().trim().min(2),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

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
    return NextResponse.json({ error: "Não foi possível listar os agendamentos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
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
      return NextResponse.json({ error: "Caminhão não encontrado." }, { status: 404 });
    }

    const created = await prisma.agendamentoCarregamento.create({
      data: {
        userId: user.id,
        caminhaoId: data.caminhaoId,
        peso: data.peso,
        dataHora,
        origem: data.origem,
        destino: data.destino,
      },
      include: {
        caminhao: { select: { id: true, placa: true, marca: true, modelo: true } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json({ error: "Não foi possível criar o agendamento." }, { status: 500 });
  }
}