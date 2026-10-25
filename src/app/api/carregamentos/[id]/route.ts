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

    // Validar o peso previsto antes de efetivar a finalização.
    if (data.status === "FINALIZADO") {
      const atual = await prisma.carregamento.findUnique({
        where: { id },
        include: {
          caminhao: { select: { placa: true, capacidadeKg: true } },
          itens: { select: { id: true, peso: true, statusItem: true } },
        },
      });

      if (!atual) {
        return NextResponse.json(
          { error: "Carregamento não encontrado" },
          { status: 404 }
        );
      }

      const idsAtuais = new Set(atual.itens.map((item) => item.id));

      if (
        data.itens?.some((item) => item.id && !idsAtuais.has(item.id))
      ) {
        return NextResponse.json(
          { error: "Um dos itens não pertence a este carregamento." },
          { status: 400 }
        );
      }

      const itensPrevistos = new Map(
        atual.itens.map((item) => [
          item.id,
          {
            peso: Number(item.peso),
            statusItem: item.statusItem,
          },
        ])
      );

      for (const item of data.itens ?? []) {
        if (item.id) {
          itensPrevistos.set(item.id, {
            peso: item.peso,
            statusItem: item.statusItem,
          });
        } else {
          itensPrevistos.set(`novo-${itensPrevistos.size}`, {
            peso: item.peso,
            statusItem: item.statusItem,
          });
        }
      }

      const pesoPrevisto = Array.from(itensPrevistos.values()).reduce(
        (total, item) =>
          total + (item.statusItem === "CARREGADO" ? item.peso : 0),
        0
      );

      const capacidade = Number(atual.caminhao.capacidadeKg ?? 0);

      if (capacidade > 0 && pesoPrevisto > capacidade) {
        const alertaPendente = await prisma.alerta.findFirst({
          where: {
            tipo: "PESO",
            referencia: id,
            lido: false,
          },
          select: { id: true },
        });

        if (!alertaPendente) {
          await prisma.alerta.create({
            data: {
              tipo: "PESO",
              titulo: "Excesso de peso no carregamento",
              mensagem: `O caminhão ${atual.caminhao.placa} está com ${pesoPrevisto.toLocaleString("pt-BR")} kg previstos, acima da capacidade de ${capacidade.toLocaleString("pt-BR")} kg.`,
              severidade: "CRITICAL",
              referencia: id,
            },
          });
        }

        return NextResponse.json(
          {
            error: `Não é possível finalizar: peso carregado (${pesoPrevisto.toLocaleString("pt-BR")} kg) acima da capacidade do caminhão (${capacidade.toLocaleString("pt-BR")} kg).`,
            pesoCarregado: pesoPrevisto,
            capacidadeKg: capacidade,
          },
          { status: 400 }
        );
      }
    }

    if (data.itens) {
      const existentes = await prisma.carregamentoItem.findMany({
        where: { carregamentoId: id },
        select: { id: true },
      });
      const idsExistentes = new Set(existentes.map((item) => item.id));

      if (data.itens.some((item) => item.id && !idsExistentes.has(item.id))) {
        return NextResponse.json(
          { error: "Um dos itens não pertence a este carregamento." },
          { status: 400 }
        );
      }

      for (const item of data.itens) {
        const itemData = {
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          peso: item.peso,
          statusItem: item.statusItem,
          observacao: item.observacao || null,
        };

        if (item.id) {
          await prisma.carregamentoItem.update({
            where: { id: item.id },
            data: itemData,
          });
        } else {
          await prisma.carregamentoItem.create({
            data: { ...itemData, carregamentoId: id },
          });
        }
      }
    }

    await prisma.carregamento.update({
      where: { id },
      data: {
        origem: data.origem,
        destino: data.destino,
        observacoes: data.observacoes,
      },
    });

    const carregamentoPeso = await prisma.carregamento.findUnique({
      where: { id },
      include: {
        caminhao: { select: { placa: true, capacidadeKg: true } },
        itens: { select: { peso: true, statusItem: true } },
      },
    });

    if (!carregamentoPeso) {
      return NextResponse.json({ error: "Carregamento não encontrado" }, { status: 404 });
    }

    const pesoCarregado = carregamentoPeso.itens.reduce(
      (total, item) =>
        total + (item.statusItem === "CARREGADO" ? Number(item.peso) : 0),
      0
    );

    await prisma.carregamento.update({
      where: { id },
      data: { pesoTotal: pesoCarregado },
    });

    const capacidadeKg = Number(carregamentoPeso.caminhao.capacidadeKg ?? 0);

    if (capacidadeKg > 0 && pesoCarregado > capacidadeKg) {
      const alertaPendente = await prisma.alerta.findFirst({
        where: {
          tipo: "PESO",
          referencia: id,
          lido: false,
        },
        select: { id: true },
      });

      if (!alertaPendente) {
        await prisma.alerta.create({
          data: {
            tipo: "PESO",
            titulo: "Excesso de peso no carregamento",
            mensagem: `O caminhão ${carregamentoPeso.caminhao.placa} está com ${pesoCarregado.toLocaleString("pt-BR")} kg carregados, acima da capacidade de ${capacidadeKg.toLocaleString("pt-BR")} kg.`,
            severidade: "CRITICAL",
            referencia: id,
          },
        });
      }
    }

    if (
      data.status === "FINALIZADO" &&
      capacidadeKg > 0 &&
      pesoCarregado > capacidadeKg
    ) {
      return NextResponse.json(
        {
          error: `Não é possível finalizar: peso carregado (${pesoCarregado.toLocaleString("pt-BR")} kg) acima da capacidade do caminhão (${capacidadeKg.toLocaleString("pt-BR")} kg).`,
          pesoCarregado,
          capacidadeKg,
        },
        { status: 400 }
      );
    }

    const carreg = await prisma.carregamento.findUnique({ where: { id } });

    if (carreg && data.status) {
      await prisma.carregamento.update({
        where: { id },
        data: { status: data.status },
      });

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
      } else if (
        data.status === "CANCELADO" ||
        data.status === "NAO_CARREGADO"
      ) {
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
