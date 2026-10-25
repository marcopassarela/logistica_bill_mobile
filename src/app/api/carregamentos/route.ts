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
    const start = new Date(`${data}T00:00:00-03:00`);
    const end = new Date(`${data}T23:59:59.999-03:00`);
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
    const pesoTotal = data.itens.reduce(
      (acc, i) => acc + (i.statusItem === "CARREGADO" ? Number(i.peso) : 0),
      0
    );

    // Validar caminhão e capacidade antes de gravar o carregamento.
    const caminhaoValidado = await prisma.caminhao.findUnique({
      where: { id: data.caminhaoId },
      select: { id: true, placa: true, capacidadeKg: true, status: true },
    });

    if (!caminhaoValidado) {
      return NextResponse.json(
        { error: "Caminhão não encontrado." },
        { status: 404 }
      );
    }

    if (
      caminhaoValidado.status === "EM_ROTA" ||
      caminhaoValidado.status === "MANUTENCAO"
    ) {
      return NextResponse.json(
        {
          error: `Não é possível criar um carregamento: o caminhão ${caminhaoValidado.placa} está com status ${caminhaoValidado.status}.`,
        },
        { status: 409 }
      );
    }

    const capacidadeKg = Number(caminhaoValidado.capacidadeKg ?? 0);

    if (!Number.isFinite(pesoTotal) || pesoTotal < 0) {
      return NextResponse.json(
        { error: "Peso carregado inválido.", pesoCarregado: pesoTotal },
        { status: 400 }
      );
    }

    if (capacidadeKg > 0 && pesoTotal > capacidadeKg) {
      return NextResponse.json(
        {
          error: `Carregamento não permitido: o peso carregado (${pesoTotal.toLocaleString("pt-BR")} kg) excede a capacidade do caminhão ${caminhaoValidado.placa} (${capacidadeKg.toLocaleString("pt-BR")} kg).`,
          pesoCarregado: pesoTotal,
          capacidadeKg,
        },
        { status: 400 }
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // Revalidar o caminhão dentro da mesma transação.
      const caminhao = await tx.caminhao.findUnique({
        where: { id: data.caminhaoId },
        select: { id: true, placa: true, capacidadeKg: true, status: true },
      });

      if (!caminhao) {
        return { error: "CAMINHAO_NAO_ENCONTRADO" as const };
      }

      if (
        caminhao.status === "EM_ROTA" ||
        caminhao.status === "MANUTENCAO"
      ) {
        return {
          error: "CAMINHAO_INDISPONIVEL" as const,
          placa: caminhao.placa,
          status: caminhao.status,
        };
      }

      const capacidadeAtual = Number(caminhao.capacidadeKg ?? 0);

      if (!Number.isFinite(pesoTotal) || pesoTotal < 0) {
        return { error: "PESO_INVALIDO" as const };
      }

      if (capacidadeAtual > 0 && pesoTotal > capacidadeAtual) {
        return {
          error: "EXCESSO_PESO" as const,
          placa: caminhao.placa,
          pesoCarregado: pesoTotal,
          capacidadeKg: capacidadeAtual,
        };
      }

      const created = await tx.carregamento.create({
        data: {
          caminhaoId: data.caminhaoId,
          data: new Date(`${data.data}T12:00:00.000-03:00`),
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

      // Recalcular o status considerando os carregamentos existentes.
      // Nunca substituir EM_ROTA ou MANUTENCAO.
      const carregamentos = await tx.carregamento.findMany({
        where: {
          caminhaoId: caminhao.id,
          status: { in: ["EM_ANDAMENTO", "FINALIZADO"] },
        },
        select: { status: true },
      });

      let novoStatus: "LIBERADO" | "CARREGANDO" | "CARREGADO";

      if (carregamentos.some((c) => c.status === "EM_ANDAMENTO")) {
        novoStatus = "CARREGANDO";
      } else if (carregamentos.some((c) => c.status === "FINALIZADO")) {
        novoStatus = "CARREGADO";
      } else {
        novoStatus = "LIBERADO";
      }

      await tx.caminhao.update({
        where: { id: caminhao.id },
        data: { status: novoStatus },
      });

      return { created };
    });

    if ("error" in resultado) {
      if (resultado.error === "PESO_INVALIDO") {
        return NextResponse.json(
          { error: "Peso carregado inválido." },
          { status: 400 }
        );
      }

      if (resultado.error === "CAMINHAO_NAO_ENCONTRADO") {
        return NextResponse.json(
          { error: "Caminhão não encontrado." },
          { status: 404 }
        );
      }

      if (resultado.error === "CAMINHAO_INDISPONIVEL") {
        return NextResponse.json(
          {
            error: `Não é possível criar o carregamento: o caminhão ${resultado.placa} está com status ${resultado.status}.`,
          },
          { status: 409 }
        );
      }

      if (
        resultado.error === "EXCESSO_PESO" &&
        typeof resultado.pesoCarregado === "number" &&
        typeof resultado.capacidadeKg === "number"
      ) {
        return NextResponse.json(
          {
            error: `Carregamento não permitido: o peso (${resultado.pesoCarregado.toLocaleString("pt-BR")} kg) excede a capacidade do caminhão ${resultado.placa} (${resultado.capacidadeKg.toLocaleString("pt-BR")} kg).`,
            pesoCarregado: resultado.pesoCarregado,
            capacidadeKg: resultado.capacidadeKg,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Não foi possível criar o carregamento." },
        { status: 400 }
      );
    }

    return NextResponse.json(resultado.created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro ao criar carregamento" }, { status: 500 });
  }
}
