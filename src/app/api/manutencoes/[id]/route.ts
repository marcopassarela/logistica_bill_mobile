import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  caminhaoId: z.string().min(1),
  descricao: z.string().trim().min(2),
  dataHora: z.string().datetime({ offset: true }).optional().nullable(),
  quilometragemAlvo: z.coerce.number().int().positive().optional().nullable(),
}).refine(
  (data) => Boolean(data.dataHora) || Boolean(data.quilometragemAlvo),
  { message: "Informe uma data/hora ou uma quilometragem-alvo." }
);

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

    const existing = await prisma.manutencaoProgramada.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) return NextResponse.json({ error: "Manutenção não encontrada." }, { status: 404 });

    const data = parsed.data;

    if (data.dataHora && new Date(data.dataHora) <= new Date()) {
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
          tipo: "MANUTENCAO",
          referencia: id,
        },
      });

      return tx.manutencaoProgramada.update({
        where: { id },
        data: {
          caminhaoId: data.caminhaoId,
          descricao: data.descricao,
          dataHora: data.dataHora ? new Date(data.dataHora) : null,
          quilometragemAlvo: data.quilometragemAlvo ?? null,
          alertaGeradoEm: null,
        },
        include: {
          caminhao: {
            select: {
              id: true,
              placa: true,
              marca: true,
              modelo: true,
              quilometragem: true,
            },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao editar manutenção:", error);
    return NextResponse.json({ error: "Não foi possível editar a manutenção." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.manutencaoProgramada.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) return NextResponse.json({ error: "Manutenção não encontrada." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.alerta.deleteMany({
        where: {
          tipo: "MANUTENCAO",
          referencia: id,
        },
      });

      await tx.manutencaoProgramada.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir manutenção:", error);
    return NextResponse.json({ error: "Não foi possível excluir a manutenção." }, { status: 500 });
  }
}