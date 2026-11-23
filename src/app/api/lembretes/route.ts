import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishDataChanged } from "@/lib/realtime";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  descricao: z.string().trim().min(2).max(500),
  dataHora: z.string().datetime({ offset: true }),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const list = await prisma.lembrete.findMany({
      where: { userId: user.id },
      orderBy: [{ dataHora: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Erro ao listar lembretes:", error);
    return NextResponse.json(
      { error: "Não foi possível listar os lembretes." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const dataHora = new Date(parsed.data.dataHora);

    if (dataHora <= new Date()) {
      return NextResponse.json(
        { error: "A data e hora devem ser futuras." },
        { status: 400 }
      );
    }

    const created = await prisma.lembrete.create({
      data: {
        userId: user.id,
        descricao: parsed.data.descricao,
        dataHora,
      },
    });

    await publishDataChanged("lembretes");
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar lembrete:", error);
    return NextResponse.json(
      { error: "Não foi possível criar o lembrete." },
      { status: 500 }
    );
  }
}