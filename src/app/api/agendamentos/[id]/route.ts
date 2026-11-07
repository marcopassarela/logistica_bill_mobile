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

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.agendamentoCarregamento.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });

    const data = parsed.data;
    const dataHora = new Date(data.dataHora);

    if (dataHora <= new Date()) {
      return NextResponse.json({ error: "A data e hora devem ser futuras." }, { status: 400 });
    }

    const caminhao = await prisma.caminhao.findUnique({
      where: { id: data.caminhaoId },
      select: { id: true },
    });

    if (!caminhao) return NextResponse.json({ error: "Caminhão não encontrado." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.alerta.deleteMany({
        where: {
          tipo: "AGENDAMENTO",
          referencia: id,
        },
      });

      return tx.agendamentoCarregamento.update({
        where: { id },
        data: {
          ...data,
          dataHora,
          alertaGeradoEm: null,
        },
        include: {
          caminhao: {
            select: { id: true, placa: true, marca: true, modelo: true },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao editar agendamento:", error);
    return NextResponse.json({ error: "Não foi possível editar o agendamento." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.agendamentoCarregamento.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.alerta.deleteMany({
        where: {
          tipo: "AGENDAMENTO",
          referencia: id,
        },
      });

      await tx.agendamentoCarregamento.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir agendamento:", error);
    return NextResponse.json({ error: "Não foi possível excluir o agendamento." }, { status: 500 });
  }
}