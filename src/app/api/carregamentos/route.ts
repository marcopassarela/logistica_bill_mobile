import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const itemSchema = z.object({
  produtoId: z.string().min(1),
  quantidade: z.coerce.number().positive(),
  peso: z.coerce.number().min(0),
  statusItem: z.enum(["PENDENTE", "CARREGADO", "NAO_CARREGADO"]).default("PENDENTE"),
  observacao: z.string().optional().nullable(),
});

const createSchema = z.object({
  caminhaoId: z.string().min(1),
  data: z.string().min(1),
  origem: z.string().optional().nullable(),
  destino: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  status: z
    .enum(["EM_ANDAMENTO", "FINALIZADO", "CANCELADO", "NAO_CARREGADO"])
    .default("EM_ANDAMENTO"),
  itens: z.array(itemSchema).min(1, "Adicione pelo menos um produto"),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data"); // YYYY-MM-DD
  const caminhaoId = searchParams.get("caminhaoId");

  const where: Record<string, unknown> = {};
  if (data) {
    const start = new Date(data + "T00:00:00");
    const end = new Date(data + "T23:59:59.999");
    where.data = { gte: start, lte: end };
  }
  if (caminhaoId) where.caminhaoId = caminhaoId;

  const list = await prisma.carregamento.findMany({
    where,
    include: {
      caminhao: { select: { id: true, placa: true, marca: true, modelo: true, capacidadeKg: true } },
      itens: {
        include: {
          produto: { select: { id: true, codigo: true, nome: true, unidade: true, pesoUnitario: true } },
        },
      },
    },
    orderBy: { data: "desc" },
    take: 100,
  });

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const pesoTotal = data.itens.reduce((acc, i) => acc + Number(i.peso), 0);

    const created = await prisma.carregamento.create({
      data: {
        caminhaoId: data.caminhaoId,
        data: new Date(data.data),
        origem: data.origem || null,
        destino: data.destino || null,
        observacoes: data.observacoes || null,
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
      include: {
        caminhao: { select: { placa: true } },
        itens: { include: { produto: true } },
      },
    });

    // Atualiza status do caminhão se estiver carregando
    if (data.status === "EM_ANDAMENTO") {
      await prisma.caminhao.update({
        where: { id: data.caminhaoId },
        data: { status: "CARREGANDO" },
      });
    } else if (data.status === "FINALIZADO") {
      await prisma.caminhao.update({
        where: { id: data.caminhaoId },
        data: { status: "CARREGADO" },
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro ao criar carregamento" }, { status: 500 });
  }
}
