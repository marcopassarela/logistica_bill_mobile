import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  origem: z.string().optional().nullable(),
  destino: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  status: z.enum(["EM_ANDAMENTO", "FINALIZADO", "CANCELADO", "NAO_CARREGADO"]).optional(),
  itens: z
    .array(
      z.object({
        id: z.string().optional(),
        produtoId: z.string(),
        quantidade: z.coerce.number().positive(),
        peso: z.coerce.number().min(0),
        statusItem: z.enum(["PENDENTE", "CARREGADO", "NAO_CARREGADO"]),
        observacao: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.carregamento.findUnique({
    where: { id },
    include: {
      caminhao: true,
      itens: { include: { produto: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const data = parsed.data;

    if (data.itens) {
      await prisma.carregamentoItem.deleteMany({ where: { carregamentoId: id } });
      const pesoTotal = data.itens.reduce((acc, i) => acc + Number(i.peso), 0);
      await prisma.carregamento.update({
        where: { id },
        data: {
          origem: data.origem,
          destino: data.destino,
          observacoes: data.observacoes,
          status: data.status,
          pesoTotal,
          itens: {
            create: data.itens.map((i) => ({
              produtoId: i.produtoId,
              quantidade: i.quantidade,
              peso: i.peso,
              statusItem: i.statusItem,
              observacao: i.observacao || null,
            })),
          },
        },
      });
    } else {
      await prisma.carregamento.update({
        where: { id },
        data: {
          origem: data.origem,
          destino: data.destino,
          observacoes: data.observacoes,
          status: data.status,
        },
      });
    }

    const carreg = await prisma.carregamento.findUnique({ where: { id } });
    if (carreg && data.status) {
      if (data.status === "FINALIZADO") {
        await prisma.caminhao.update({
          where: { id: carreg.caminhaoId },
          data: { status: "CARREGADO" },
        });
      } else if (data.status === "EM_ANDAMENTO") {
        await prisma.caminhao.update({
          where: { id: carreg.caminhaoId },
          data: { status: "CARREGANDO" },
        });
      } else if (data.status === "CANCELADO" || data.status === "NAO_CARREGADO") {
        await prisma.caminhao.update({
          where: { id: carreg.caminhaoId },
          data: { status: "LIBERADO" },
        });
      }
    }

    const updated = await prisma.carregamento.findUnique({
      where: { id },
      include: {
        caminhao: { select: { placa: true } },
        itens: { include: { produto: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
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
    if (!id) return NextResponse.json({ error: "ID do carregamento obrigatório" }, { status: 400 });

    const carregamento = await prisma.carregamento.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!carregamento) {
      return NextResponse.json({ error: "Carregamento não encontrado" }, { status: 404 });
    }

    await prisma.carregamento.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir carregamento:", error);
    return NextResponse.json({ error: "Não foi possível excluir o carregamento" }, { status: 500 });
  }
}
