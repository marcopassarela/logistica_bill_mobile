import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  concluido: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pontoId: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id, pontoId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe um estado de conclusão válido." },
      { status: 400 }
    );
  }

  const ponto = await prisma.rotaPonto.findFirst({
    where: { id: pontoId, rotaId: id },
    select: { id: true },
  });

  if (!ponto) {
    return NextResponse.json(
      { error: "Ponto não encontrado nesta rota." },
      { status: 404 }
    );
  }

  const atualizado = await prisma.rotaPonto.update({
    where: { id: pontoId },
    data: { concluido: parsed.data.concluido },
    select: { id: true, concluido: true },
  });

  return NextResponse.json(atualizado);
}