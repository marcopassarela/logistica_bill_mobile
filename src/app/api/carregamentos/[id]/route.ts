
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { publishDataChanged } from "@/lib/realtime";
import { canAccess } from "@/lib/permissions";
import { del } from "@vercel/blob";
import { z } from "zod";

const statusCargaSchema = z.enum([
  "EM_ANDAMENTO",
  "FINALIZADO",
  "EM_ROTA",
  "CANCELADO",
  "NAO_CARREGADO",
]);

const statusItemSchema = z.enum([
  "PENDENTE",
  "CARREGADO",
  "NAO_CARREGADO",
]);

const itemSchema = z.object({
  id: z.string().optional(),
  descricaoLivre: z.string().nullable().optional(),
  ordemServico: z.string().nullable().optional(),
  clienteNome: z.string().nullable().optional(),
  clienteTelefone: z.string().nullable().optional(),
  clienteCidade: z.string().nullable().optional(),
  clienteBairro: z.string().nullable().optional(),
  mapaUrl: z.string().url().max(500).nullable().optional(),
  mapaUrl2: z.string().url().max(500).nullable().optional(),
  quantidade: z.coerce.number().finite().positive(),
  peso: z.coerce.number().finite().min(0),
  statusItem: statusItemSchema,
  observacao: z.string().nullable().optional(),
});

const editSchema = z.object({
  origem: z.string().nullable().optional(),
  destino: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  motoristaId: z.string().nullable().optional(),
  ajudanteId: z.string().nullable().optional(),
  status: statusCargaSchema.optional(),
  itens: z.array(itemSchema).min(1),
});

async function atualizarStatusCaminhao(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  caminhaoId: string
) {
  const caminhao = await tx.caminhao.findUnique({
    where: { id: caminhaoId },
    select: { status: true },
  });

  if (!caminhao || caminhao.status === "MANUTENCAO") return;

  const [carregamentos, rotaAtiva] = await Promise.all([
    tx.carregamento.findMany({
      where: {
        caminhaoId,
        status: { in: ["EM_ANDAMENTO", "FINALIZADO", "EM_ROTA"] },
      },
      select: { status: true },
    }),
    tx.rota.findFirst({
      where: { caminhaoId, status: "EM_ANDAMENTO" },
      select: { id: true },
    }),
  ]);

  let novoStatus: "LIBERADO" | "CARREGANDO" | "EM_ROTA";

  if (
    rotaAtiva ||
    carregamentos.some((c) => c.status === "EM_ROTA")
  ) {
    novoStatus = "EM_ROTA";
  } else if (carregamentos.some((c) => c.status === "EM_ANDAMENTO")) {
    novoStatus = "CARREGANDO";
  } else {
    novoStatus = "LIBERADO";
  }

  await tx.caminhao.update({
    where: { id: caminhaoId },
    data: { status: novoStatus },
  });
}

async function obterCarregamento(id: string) {
  return prisma.carregamento.findUnique({
    where: { id },
    include: {
      caminhao: {
        select: {
          id: true,
          placa: true,
          marca: true,
          modelo: true,
          capacidadeKg: true,
        },
      },
      motorista: { select: { id: true, nome: true } },
      ajudante: { select: { id: true, nome: true } },
      itens: {
        orderBy: [{ ordem: "asc" }, { id: "asc" }],
        select: {
          id: true,
          quantidade: true,
          peso: true,
          statusItem: true,
          observacao: true,
          descricaoLivre: true,
          ordemServico: true,
          clienteNome: true,
          clienteTelefone: true,
          clienteCidade: true,
          clienteBairro: true,
          mapaUrl: true,
          mapaUrl2: true,
          notaFiscalNome: true,
        },
      },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!canAccess(user.role, user.permissions, "carregamentos.visualizar")) {
    return NextResponse.json(
      { error: "Você não tem permissão para visualizar carregamentos." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const carregamento = await obterCarregamento(id);

    if (!carregamento) {
      return NextResponse.json(
        { error: "Carregamento não encontrado." },
        { status: 404 }
      );
    }

    const isGestor = user.role === "ADMIN" || user.role === "MANAGER";

    if (!isGestor) {
      if (
        !user.funcionarioId ||
        carregamento.motoristaId !== user.funcionarioId ||
        carregamento.data > new Date()
      ) {
        return NextResponse.json(
          { error: "Carregamento não encontrado." },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(carregamento);
  } catch (error) {
    console.error("Erro ao buscar carregamento:", error);
    return NextResponse.json(
      { error: "Não foi possível buscar o carregamento." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body: unknown = await req.json();

    const atual = await prisma.carregamento.findUnique({
      where: { id },
      select: {
        id: true,
        caminhaoId: true,
        motoristaId: true,
        data: true,
      },
    });

    if (!atual) {
      return NextResponse.json(
        { error: "Carregamento não encontrado." },
        { status: 404 }
      );
    }

    const isGestor = user.role === "ADMIN" || user.role === "MANAGER";

    if (
      !isGestor &&
      (!user.funcionarioId ||
        atual.motoristaId !== user.funcionarioId ||
        atual.data > new Date())
    ) {
      return NextResponse.json(
        { error: "Carregamento não encontrado." },
        { status: 404 }
      );
    }

    // Atualização individual do status de um item.
    if (
      typeof body === "object" &&
      body !== null &&
      "itemStatus" in body
    ) {
      if (!canAccess(user.role, user.permissions, "carregamentos.alterarStatus")) {
        return NextResponse.json(
          { error: "Você não tem permissão para alterar status." },
          { status: 403 }
        );
      }

      const itemStatusBody = z.object({
        itemStatus: z.object({
          itemId: z.string().min(1),
          statusItem: statusItemSchema,
        }),
      }).safeParse(body);

      if (!itemStatusBody.success) {
        return NextResponse.json(
          { error: "Dados do item inválidos." },
          { status: 400 }
        );
      }

      const { itemId, statusItem } = itemStatusBody.data.itemStatus;

      const item = await prisma.carregamentoItem.findFirst({
        where: { id: itemId, carregamentoId: id },
        select: { id: true },
      });

      if (!item) {
        return NextResponse.json(
          { error: "Item não encontrado neste carregamento." },
          { status: 404 }
        );
      }

      const resultado = await prisma.$transaction(async (tx) => {
        await tx.carregamentoItem.update({
          where: { id: itemId },
          data: { statusItem },
        });

        const itens = await tx.carregamentoItem.findMany({
          where: {
            carregamentoId: id,
            statusItem: "CARREGADO",
          },
          select: { peso: true },
        });

        const pesoCarregado = itens.reduce(
          (total, itemAtual) => total + Number(itemAtual.peso),
          0
        );

        const caminhao = await tx.caminhao.findUnique({
          where: { id: atual.caminhaoId },
          select: { placa: true, capacidadeKg: true },
        });

        const capacidadeKg = Number(caminhao?.capacidadeKg ?? 0);
        const excesso =
          capacidadeKg > 0 && pesoCarregado > capacidadeKg;

        return {
          avisoExcessoPeso: excesso
            ? `Atenção: o caminhão ${caminhao?.placa ?? ""} está com ${pesoCarregado.toLocaleString("pt-BR")} kg carregados, acima da capacidade de ${capacidadeKg.toLocaleString("pt-BR")} kg.`
            : null,
          detalhesExcessoPeso: excesso
            ? {
                placa: caminhao?.placa ?? "",
                pesoCarregado,
                capacidadeKg,
              }
            : null,
        };
      });

      after(() => publishDataChanged("carregamentos", "caminhoes", "alertas"));

      return NextResponse.json(resultado);
    }

    // Atualização somente do status geral.
    if (
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      !("itens" in body)
    ) {
      if (!canAccess(user.role, user.permissions, "carregamentos.alterarStatus")) {
        return NextResponse.json(
          { error: "Você não tem permissão para alterar status." },
          { status: 403 }
        );
      }

      const parsedStatus = z.object({ status: statusCargaSchema }).safeParse(body);

      if (!parsedStatus.success) {
        return NextResponse.json(
          { error: "Status inválido." },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.carregamento.update({
          where: { id },
          data: { status: parsedStatus.data.status },
        });

        await atualizarStatusCaminhao(tx, atual.caminhaoId);
      });

      after(() => publishDataChanged("carregamentos", "caminhoes", "alertas"));

      return NextResponse.json({ ok: true });
    }

    // Edição dos dados da carga e dos itens.
    if (!canAccess(user.role, user.permissions, "carregamentos.editar")) {
      return NextResponse.json(
        { error: "Você não tem permissão para editar carregamentos." },
        { status: 403 }
      );
    }

    const parsed = editSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Os dados informados são inválidos.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (
      data.status !== undefined &&
      !canAccess(user.role, user.permissions, "carregamentos.alterarStatus")
    ) {
      return NextResponse.json(
        { error: "Você não tem permissão para alterar o status." },
        { status: 403 }
      );
    }

    const idsRecebidos = data.itens
      .map((item) => item.id)
      .filter((itemId): itemId is string => Boolean(itemId));

    if (new Set(idsRecebidos).size !== idsRecebidos.length) {
      return NextResponse.json(
        { error: "Um item foi enviado mais de uma vez." },
        { status: 400 }
      );
    }

    const itensExistentes = await prisma.carregamentoItem.findMany({
      where: { carregamentoId: id },
      select: { id: true },
    });

    const idsExistentes = new Set(itensExistentes.map((item) => item.id));

    if (idsRecebidos.some((itemId) => !idsExistentes.has(itemId))) {
      return NextResponse.json(
        { error: "Um ou mais itens não pertencem a este carregamento." },
        { status: 400 }
      );
    }

    const funcionariosSelecionados = [
      data.motoristaId,
      data.ajudanteId,
    ].filter((funcionarioId): funcionarioId is string => Boolean(funcionarioId));

    if (funcionariosSelecionados.length > 0) {
      const idsUnicos = [...new Set(funcionariosSelecionados)];

      const funcionariosAtivos = await prisma.funcionario.findMany({
        where: {
          id: { in: idsUnicos },
          status: "ATIVO",
        },
        select: { id: true },
      });

      if (funcionariosAtivos.length !== idsUnicos.length) {
        return NextResponse.json(
          { error: "Motorista ou ajudante inválido ou inativo." },
          { status: 400 }
        );
      }
    }

    const pesoTotal = data.itens.reduce(
      (total, item) => total + item.peso,
      0
    );

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.carregamento.update({
        where: { id },
        data: {
          ...(data.origem !== undefined ? { origem: data.origem } : {}),
          ...(data.destino !== undefined ? { destino: data.destino } : {}),
          ...(data.observacoes !== undefined
            ? { observacoes: data.observacoes }
            : {}),
          ...(data.motoristaId !== undefined
            ? { motoristaId: data.motoristaId }
            : {}),
          ...(data.ajudanteId !== undefined
            ? { ajudanteId: data.ajudanteId }
            : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          pesoTotal,
        },
      });

      for (const [indice, item] of data.itens.entries()) {
        const itemData = {
          quantidade: item.quantidade,
          peso: item.peso,
          statusItem: item.statusItem,
          observacao: item.observacao || null,
          ordem: indice,
          descricaoLivre: item.descricaoLivre || null,
          ordemServico: item.ordemServico || null,
          clienteNome: item.clienteNome || null,
          clienteTelefone: item.clienteTelefone || null,
          clienteCidade: item.clienteCidade || null,
          clienteBairro: item.clienteBairro || null,
          mapaUrl: item.mapaUrl || null,
          mapaUrl2: item.mapaUrl2 || null,
        };

        if (item.id) {
          // Não altera notaFiscalNome nem notaFiscalData.
          await tx.carregamentoItem.update({
            where: { id: item.id },
            data: itemData,
          });
        } else {
          await tx.carregamentoItem.create({
            data: {
              carregamentoId: id,
              ...itemData,
            },
          });
        }
      }

      // Remove somente itens retirados explicitamente do formulário.
      await tx.carregamentoItem.deleteMany({
        where: {
          carregamentoId: id,
          ...(idsRecebidos.length > 0
            ? { id: { notIn: idsRecebidos } }
            : {}),
        },
      });

      await atualizarStatusCaminhao(tx, atual.caminhaoId);

      return tx.carregamento.findUniqueOrThrow({
        where: { id },
        include: {
          caminhao: {
            select: {
              id: true,
              placa: true,
              marca: true,
              modelo: true,
              capacidadeKg: true,
            },
          },
          motorista: { select: { id: true, nome: true } },
          ajudante: { select: { id: true, nome: true } },
          itens: {
            orderBy: [{ ordem: "asc" }, { id: "asc" }],
            select: {
              id: true,
              quantidade: true,
              peso: true,
              statusItem: true,
              observacao: true,
              descricaoLivre: true,
              ordemServico: true,
              clienteNome: true,
              clienteTelefone: true,
              clienteCidade: true,
              clienteBairro: true,
              mapaUrl: true,
          mapaUrl2: true,
              notaFiscalNome: true,
            },
          },
        },
      });
    }, { maxWait: 10000, timeout: 30000 });

    after(() => publishDataChanged("carregamentos", "caminhoes", "alertas"));

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao atualizar carregamento:", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar o carregamento." },
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
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!canAccess(user.role, user.permissions, "carregamentos.excluir")) {
    return NextResponse.json(
      { error: "Você não tem permissão para excluir carregamentos." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (
      typeof body.adminPassword !== "string" ||
      !(await verifyAdminPassword(body.adminPassword))
    ) {
      return NextResponse.json(
        { error: "Senha do administrador inválida." },
        { status: 403 }
      );
    }

    const carregamento = await prisma.carregamento.findUnique({
      where: { id },
      select: {
        id: true,
        caminhaoId: true,
        caminhao: { select: { placa: true } },
        itens: { select: { notaFiscalPath: true } },
      },
    });

    if (!carregamento) {
      return NextResponse.json(
        { error: "Carregamento não encontrado." },
        { status: 404 }
      );
    }

    const caminhosNotas = carregamento.itens
      .flatMap((item) => item.notaFiscalPath ? [item.notaFiscalPath] : [])
      .filter((path) => path.startsWith(`notas-fiscais/${id}/`));

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CARREGAMENTO_EXCLUIDO",
          entity: "Carregamento",
          entityId: id,
          details: {
            placa: carregamento.caminhao.placa,
          },
        },
      });

      await tx.carregamento.delete({ where: { id } });

      await atualizarStatusCaminhao(tx, carregamento.caminhaoId);
    });

    after(() => publishDataChanged("carregamentos", "caminhoes", "alertas"));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir carregamento:", error);
    return NextResponse.json(
      { error: "Não foi possível excluir o carregamento." },
      { status: 500 }
    );
  }
}
