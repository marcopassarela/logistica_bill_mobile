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
  if (!user) return NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.carregamento.findUnique({
    where: { id },
    include: {
      caminhao: true,
      itens: { include: { produto: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "NÃ£o encontrado" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados invÃ¡lidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const resultado = await prisma.$transaction(async (tx) => {
      const atual = await tx.carregamento.findUnique({
        where: { id },
        include: {
          caminhao: {
            select: { id: true, placa: true, capacidadeKg: true, status: true },
          },
          itens: {
            select: {
              id: true,
              peso: true,
              statusItem: true,
            },
          },
        },
      });

      if (!atual) {
        return { erro: "NAO_ENCONTRADO" as const };
      }

      const idsAtuais = new Set(atual.itens.map((item) => item.id));

      if (data.itens?.some((item) => item.id && !idsAtuais.has(item.id))) {
        return { erro: "ITEM_INVALIDO" as const };
      }

      // Preserva itens nÃ£o enviados e aplica as alteraÃ§Ãµes apenas em memÃ³ria.
      const previstos = new Map(
        atual.itens.map((item) => [
          item.id,
          {
            peso: Number(item.peso),
            statusItem: item.statusItem,
          },
        ])
      );

      for (const [indice, item] of (data.itens ?? []).entries()) {
        previstos.set(item.id ?? `novo-${indice}`, {
          peso: item.peso,
          statusItem: item.statusItem,
        });
      }

      const pesoPrevisto = Array.from(previstos.values()).reduce(
        (total, item) =>
          total + (item.statusItem === "CARREGADO" ? item.peso : 0),
        0
      );

      const capacidadeKg = Number(atual.caminhao.capacidadeKg ?? 0);

      const validarPeso =
        data.status === "FINALIZADO" ||
        data.status === "EM_ANDAMENTO" ||
        (data.itens !== undefined &&
          data.status !== "CANCELADO" &&
          data.status !== "NAO_CARREGADO");

      if (!Number.isFinite(pesoPrevisto) || pesoPrevisto < 0) {
        return { erro: "PESO_INVALIDO" as const };
      }

      const excessoPeso =
        validarPeso &&
        capacidadeKg > 0 &&
        pesoPrevisto > capacidadeKg;

      if (excessoPeso) {
        // O excesso gera alerta, mas nao bloqueia a gravacao.
        // A validacao continua informativa para a operacao.
      }

      // Nenhuma gravaÃ§Ã£o ocorre antes das validaÃ§Ãµes acima.
      if (data.itens !== undefined) {
        for (const item of data.itens) {
          const itemData = {
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            peso: item.peso,
            statusItem: item.statusItem,
            observacao: item.observacao ?? null,
          };

          if (item.id) {
            await tx.carregamentoItem.update({
              where: { id: item.id },
              data: itemData,
            });
          } else {
            await tx.carregamentoItem.create({
              data: { ...itemData, carregamentoId: id },
            });
          }
        }
      }

      await tx.carregamento.update({
        where: { id },
        data: {
          origem: data.origem,
          destino: data.destino,
          observacoes: data.observacoes,
          ...(data.status !== undefined ? { status: data.status } : {}),
          pesoTotal: pesoPrevisto,
        },
      });

      // Preserva os estados operacionais especiais do caminhÃ£o.
      if (
        atual.caminhao.status !== "EM_ROTA" &&
        atual.caminhao.status !== "MANUTENCAO"
      ) {
        const carregamentosRestantes = await tx.carregamento.findMany({
          where: {
            caminhaoId: atual.caminhao.id,
            status: { in: ["EM_ANDAMENTO", "FINALIZADO"] },
          },
          select: { status: true },
        });

        let novoStatus: "LIBERADO" | "CARREGANDO" | "CARREGADO";

        if (carregamentosRestantes.some((c) => c.status === "EM_ANDAMENTO")) {
          novoStatus = "CARREGANDO";
        } else if (
          carregamentosRestantes.some((c) => c.status === "FINALIZADO")
        ) {
          novoStatus = "CARREGADO";
        } else {
          novoStatus = "LIBERADO";
        }

        await tx.caminhao.update({
          where: { id: atual.caminhao.id },
          data: { status: novoStatus },
        });
      }

      const atualizado = await tx.carregamento.findUnique({
        where: { id },
        include: {
          caminhao: { select: { placa: true } },
          itens: { include: { produto: true } },
        },
      });

      return {
        dados: atualizado,
        avisoExcessoPeso: excessoPeso
          ? {
              pesoCarregado: pesoPrevisto,
              capacidadeKg,
              placa: atual.caminhao.placa,
            }
          : null,
      };
    });

    if ("erro" in resultado) {
      if (resultado.erro === "NAO_ENCONTRADO") {
        return NextResponse.json(
          { error: "Carregamento nÃ£o encontrado" },
          { status: 404 }
        );
      }

      if (resultado.erro === "ITEM_INVALIDO") {
        return NextResponse.json(
          { error: "Um dos itens nÃ£o pertence a este carregamento." },
          { status: 400 }
        );
      }

      if (resultado.erro === "PESO_INVALIDO") {
        return NextResponse.json(
          { error: "Peso carregado invÃ¡lido." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "NÃ£o foi possÃ­vel validar o carregamento." },
        { status: 400 }
      );
    }

    let avisoExcessoPeso: string | null = null;

    if (resultado.avisoExcessoPeso) {
      const excesso = resultado.avisoExcessoPeso;
      const formatarKg = (valor: number) =>
        valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

      avisoExcessoPeso =
        `ATENCAO: o caminhao ${excesso.placa} esta com ` +
        `${formatarKg(excesso.pesoCarregado)} kg carregados, acima da ` +
        `capacidade cadastrada de ${formatarKg(excesso.capacidadeKg)} kg.`;

      try {
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
              mensagem: avisoExcessoPeso,
              severidade: "CRITICAL",
              referencia: id,
            },
          });
        }
      } catch (erroAlerta) {
        console.error("Carregamento salvo, mas nao foi possivel registrar o alerta de peso:", erroAlerta);
      }
    }

    return NextResponse.json({
      ...resultado.dados,
      ...(avisoExcessoPeso ? { avisoExcessoPeso } : {}),
    });
  } catch (e) {
    console.error("Erro ao atualizar carregamento:", e);
    return NextResponse.json(
      { error: "Erro ao atualizar" },
      { status: 500 }
    );
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    if (
      typeof body.adminPassword !== "string" ||
      !(await verifyAdminPassword(body.adminPassword))
    ) {
      return NextResponse.json(
        { error: "Senha do administrador invÃ¡lida" },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "ID do carregamento obrigatÃ³rio" },
        { status: 400 }
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const carregamento = await tx.carregamento.findUnique({
        where: { id },
        select: { id: true, caminhaoId: true },
      });

      if (!carregamento) {
        throw new Error("CARREGAMENTO_NAO_ENCONTRADO");
      }

      // Excluir somente alertas associados a este carregamento.
      await tx.alerta.deleteMany({
        where: { referencia: id, tipo: "PESO" },
      });

      await tx.carregamento.delete({
        where: { id },
      });

      const caminhao = await tx.caminhao.findUnique({
        where: { id: carregamento.caminhaoId },
        select: { id: true, status: true },
      });

      if (!caminhao) {
        return { ok: true };
      }

      // NÃ£o interferir em caminhÃµes em rota ou em manutenÃ§Ã£o.
      if (
        caminhao.status === "EM_ROTA" ||
        caminhao.status === "MANUTENCAO"
      ) {
        return { ok: true };
      }

      const restantes = await tx.carregamento.findMany({
        where: {
          caminhaoId: carregamento.caminhaoId,
          status: { in: ["EM_ANDAMENTO", "FINALIZADO"] },
        },
        select: { status: true },
      });

      let novoStatus: "LIBERADO" | "CARREGANDO" | "CARREGADO";

      if (restantes.some((c) => c.status === "EM_ANDAMENTO")) {
        novoStatus = "CARREGANDO";
      } else if (restantes.some((c) => c.status === "FINALIZADO")) {
        novoStatus = "CARREGADO";
      } else {
        novoStatus = "LIBERADO";
      }

      await tx.caminhao.update({
        where: { id: carregamento.caminhaoId },
        data: { status: novoStatus },
      });

      return { ok: true, statusCaminhao: novoStatus };
    });

    return NextResponse.json(resultado);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CARREGAMENTO_NAO_ENCONTRADO"
    ) {
      return NextResponse.json(
        { error: "Carregamento nÃ£o encontrado" },
        { status: 404 }
      );
    }

    console.error("Erro ao excluir carregamento:", error);
    return NextResponse.json(
      { error: "NÃ£o foi possÃ­vel excluir o carregamento" },
      { status: 500 }
    );
  }
}

