import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishDataChanged } from "@/lib/realtime";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  descricao: z.string().trim().min(2).max(500).optional(),
  dataHora: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["PENDENTE", "CANCELADO"]).optional(),
}).refine(
  (data) =>
    data.descricao !== undefined ||
    data.dataHora !== undefined ||
    data.status !== undefined,
  { message: "Informe pelo menos um campo para atualizar." }
);

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.lembrete.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Lembrete não encontrado." },
        { status: 404 }
      );
    }

    if (existing.status !== "PENDENTE") {
      return NextResponse.json(
        { error: "Somente lembretes pendentes podem ser alterados." },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.dataHora) {
      const novaData = new Date(data.dataHora);

      if (novaData <= new Date()) {
        return NextResponse.json(
          { error: "A data e hora devem ser futuras." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.lembrete.update({
      where: { id },
      data: {
        ...(data.descricao !== undefined && {
          descricao: data.descricao,
        }),
        ...(data.dataHora !== undefined && {
          dataHora: new Date(data.dataHora),
        }),
        ...(data.status !== undefined && {
          status: data.status,
        }),
      },
    });

    await publishDataChanged("lembretes");
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar lembrete:", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar o lembrete." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.lembrete.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Lembrete não encontrado." },
        { status: 404 }
      );
    }

    await prisma.lembrete.delete({ where: { id } });
    await publishDataChanged("lembretes");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir lembrete:", error);
    return NextResponse.json(
      { error: "Não foi possível excluir o lembrete." },
      { status: 500 }
    );
  }
}