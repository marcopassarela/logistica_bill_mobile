import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  nome: z.string().min(2).optional(),
  status: z.enum(["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).optional(),
  observacoes: z.string().optional().nullable(),
  caminhaoId: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const updated = await prisma.rota.update({
    where: { id },
    data: parsed.data,
    include: {
      caminhao: { select: { placa: true } },
      pontos: { orderBy: { ordem: "asc" } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.adminPassword !== "string" ||
        !(await verifyAdminPassword(body.adminPassword))) {
      return NextResponse.json({ error: "Senha do administrador inválida" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID da rota obrigatório" }, { status: 400 });

    const rota = await prisma.rota.findUnique({ where: { id }, select: { id: true } });
    if (!rota) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });

    await prisma.rota.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir rota:", error);
    return NextResponse.json({ error: "Não foi possível excluir a rota" }, { status: 500 });
  }
}
