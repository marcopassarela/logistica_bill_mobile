import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { publishDataChanged } from "@/lib/realtime";
import { z } from "zod";
import { requirePermission } from "@/lib/authorization";
import { canAccess } from "@/lib/permissions";

const updateSchema = z.object({
  origem: z.string().optional().nullable(),
  destino: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  motoristaId: z.string().optional().nullable(),
  ajudanteId: z.string().optional().nullable(),
  status: z.enum(["EM_ANDAMENTO", "FINALIZADO", "EM_ROTA", "CANCELADO", "NAO_CARREGADO"]).optional(),
  itemStatus: z.object({
    itemId: z.string(),
    statusItem: z.enum(["PENDENTE", "CARREGADO", "NAO_CARREGADO"]),
  }).optional(),
  itens: z
    .array(
      z.object({
        id: z.string().optional(),
        quantidade: z.coerce.number().positive(),
        peso: z.coerce.number().min(0),
        statusItem: z.enum(["PENDENTE", "CARREGADO", "NAO_CARREGADO"]),
        observacao: z.string().optional().nullable(),
        descricaoLivre: z.string().trim().min(1, "Informe o item/produto.").max(1000),
        ordemServico: z.string().trim().min(1, "Informe o número da ordem.").max(100),
        clienteNome: z.string().trim().min(1, "Informe o nome do cliente.").max(160),
        clienteTelefone: z.string().trim().min(1, "Informe o telefone do cliente.").max(40),
        clienteCidade: z.string().trim().min(1, "Informe a cidade do cliente.").max(100),
        clienteBairro: z.string().max(100).optional().nullable(),
        mapaUrl: z.string().url().max(500).optional().nullable(),
      })
    )
    .min(1, "Informe pelo menos um item")
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
      motorista: { select: { id: true, nome: true } },
      ajudante: { select: { id: true, nome: true } },
      itens: { orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true, carregamentoId: true, quantidade: true, peso: true, statusItem: true, observacao: true, ordem: true, descricaoLivre: true, ordemServico: true, clienteNome: true, clienteTelefone: true, clienteCidade: true, clienteBairro: true, mapaUrl: true, notaFiscalNome: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER" && (item.motoristaId !== user.funcionarioId || item.data > new Date())) {
    return NextResponse.json({ error: "Esta carga ainda não está disponível para o motorista." }, { status: 403 });
  }
  return NextResponse.json(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const somenteStatus = data.status !== undefined && data.itemStatus === undefined && data.itens === undefined && data.origem === undefined && data.destino === undefined && data.observacoes === undefined && data.motoristaId === undefined && data.ajudanteId === undefined;
    const permission = await requirePermission(data.itemStatus || somenteStatus ? "carregamentos.alterarStatus" : "carregamentos.editar");
    if (permission.response) return permission.response;
    const podeAlterarStatus = canAccess(permission.user!.role, permission.user!.permissions, "carregamentos.alterarStatus");
    if ((data.itemStatus !== undefined || data.status !== undefined) && !podeAlterarStatus) {
      return NextResponse.json({ error: "Você não tem permissão para alterar o status da carga." }, { status: 403 });
    }

    if (data.itemStatus) {
      const alvo = await prisma.carregamento.findUnique({
        where: { id },
        select: { id: true, data: true, motoristaId: true },
      });
      if (!alvo) return NextResponse.json({ error: "Carregamento não encontrado" }, { status: 404 });
      if (permission.user!.role !== "ADMIN" && permission.user!.role !== "MANAGER" && (alvo.motoristaId !== permission.user!.funcionarioId || alvo.data > new Date())) {
        return NextResponse.json({ error: "Esta carga ainda não está disponível para alteração." }, { status: 403 });
      }
      const alterado = await prisma.carregamentoItem.updateMany({
        where: { id: data.itemStatus.itemId, carregamentoId: id },
        data: { statusItem: data.itemStatus.statusItem },
      });
      if (!alterado.count) return NextResponse.json({ error: "Item não encontrado neste carregamento." }, { status: 400 });
      after(() => publishDataChanged("carregamentos"));
      return NextResponse.json({ ok: true });
    }

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

      const funcionariosSelecionados = [data.motoristaId, data.ajudanteId].filter((id): id is string => id !== undefined && id !== null);
      if (funcionariosSelecionados.length > 0) {
        const funcionariosAtivos = await tx.funcionario.findMany({ where: { id: { in: [...new Set(funcionariosSelecionados)] }, status: "ATIVO" }, select: { id: true } });
        if (funcionariosAtivos.length !== new Set(funcionariosSelecionados).size) return { erro: "FUNCIONARIO_INVALIDO" as const };
      }
      const idsAtuais = new Set(atual.itens.map((item) => item.id));

      if (data.itemStatus && !idsAtuais.has(data.itemStatus.itemId)) {
        return { erro: "ITEM_INVALIDO" as const };
      }

      if (data.itens?.some((item) => item.id && !idsAtuais.has(item.id))) {
        return { erro: "ITEM_INVALIDO" as const };
      }

      // Preserva itens não enviados e aplica as alterações apenas em memória.
      const previstos = new Map<
        string,
        { peso: number; statusItem: string }
      >();

      if (data.itemStatus !== undefined) {
        for (const item of atual.itens) {
          previstos.set(item.id, {
            peso: Number(item.peso),
                statusItem: item.id === data.itemStatus.itemId
              ? data.itemStatus.statusItem
              : item.statusItem,
          });
        }
      } else if (data.itens !== undefined) {
        for (const [indice, item] of data.itens.entries()) {
          previstos.set(item.id ?? `novo-${indice}`, {
            peso: item.peso,
            statusItem: item.statusItem,
          });
        }
      } else {
        for (const item of atual.itens) {
          previstos.set(item.id, {
            peso: Number(item.peso),
            statusItem: item.statusItem,
          });
        }
      }
      const pesoPrevisto = Array.from(previstos.values()).reduce(
        (total, item) => total + Number(item.peso),
        0
      );

      const pesoCarregadoPrevisto = Array.from(previstos.values()).reduce(
        (total, item) => total + (item.statusItem === "CARREGADO" ? Number(item.peso) : 0),
        0
      );

      const capacidadeKg = Number(atual.caminhao.capacidadeKg ?? 0);

      const validarPeso =
        data.status === "FINALIZADO" ||
        data.status === "EM_ANDAMENTO" ||
        ((data.itens !== undefined || data.itemStatus !== undefined) &&
          data.status !== "CANCELADO" &&
          data.status !== "NAO_CARREGADO");

      if (!Number.isFinite(pesoPrevisto) || pesoPrevisto < 0) {
        return { erro: "PESO_INVALIDO" as const };
      }

      const excessoPeso =
        validarPeso &&
        capacidadeKg > 0 &&
        pesoCarregadoPrevisto > capacidadeKg;

      if (excessoPeso) {
        // O excesso gera alerta, mas não bloqueia a gravação.
        // A validação continua informativa para a operação.
      }

      // Nenhuma gravação ocorre antes das validações acima.
      if (data.itemStatus !== undefined) {
        await tx.carregamentoItem.update({
          where: { id: data.itemStatus.itemId },
          data: { statusItem: data.itemStatus.statusItem },
        });
      } else if (data.itens !== undefined) {
        const idsEnviados = data.itens
          .map((item) => item.id)
          .filter((itemId): itemId is string => Boolean(itemId));

        await tx.carregamentoItem.deleteMany({
          where: {
            carregamentoId: id,
            ...(idsEnviados.length > 0
              ? { id: { notIn: idsEnviados } }
              : {}),
          },
        });

        const statusAtuais = new Map(atual.itens.map((item) => [item.id, item.statusItem]));

        for (const [indice, item] of data.itens.entries()) {
          const itemData = {
            quantidade: item.quantidade,
            peso: item.peso,
            ordem: indice,
            statusItem: podeAlterarStatus ? item.statusItem : (item.id ? statusAtuais.get(item.id) || "PENDENTE" : "PENDENTE"),
            observacao: item.observacao ?? null,
            descricaoLivre: item.descricaoLivre ?? null,
            ordemServico: item.ordemServico ?? null,
            clienteNome: item.clienteNome ?? null,
            clienteTelefone: item.clienteTelefone ?? null,
            clienteCidade: item.clienteCidade ?? null,
            clienteBairro: item.clienteBairro ?? null,
            mapaUrl: item.mapaUrl ?? null,
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
          ...(data.motoristaId !== undefined ? { motoristaId: data.motoristaId } : {}),
          ...(data.ajudanteId !== undefined ? { ajudanteId: data.ajudanteId } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          pesoTotal: pesoPrevisto,
        },
      });

      // Preserva os estados operacionais especiais do caminhão.
      // Manutenção tem prioridade e nunca deve ser sobrescrita.
      if (atual.caminhao.status !== "MANUTENCAO") {
        const [carregamentosRestantes, rotaAtiva] = await Promise.all([
          tx.carregamento.findMany({
            where: {
              caminhaoId: atual.caminhao.id,
              status: { in: ["EM_ANDAMENTO", "FINALIZADO", "EM_ROTA"] },
            },
            select: { status: true },
          }),
          tx.rota.findFirst({
            where: {
              caminhaoId: atual.caminhao.id,
              status: "EM_ANDAMENTO",
            },
            select: { id: true },
          }),
        ]);

        let novoStatus: "LIBERADO" | "CARREGANDO" | "EM_ROTA";

        if (
          rotaAtiva ||
          carregamentosRestantes.some((c) => c.status === "EM_ROTA")
        ) {
          novoStatus = "EM_ROTA";
        } else if (
          carregamentosRestantes.some((c) => c.status === "EM_ANDAMENTO")
        ) {
          novoStatus = "CARREGANDO";
        } else {
          novoStatus = "LIBERADO";
        }

        await tx.caminhao.update({
          where: { id: atual.caminhao.id },
          data: { status: novoStatus },
        });
      }

      return {
        avisoExcessoPeso: excessoPeso
          ? {
              pesoCarregado: pesoCarregadoPrevisto,
              capacidadeKg,
              placa: atual.caminhao.placa,
            }
          : null,
      };
    });

    if ("erro" in resultado) {
      if (resultado.erro === "NAO_ENCONTRADO") {
        return NextResponse.json(
          { error: "Carregamento não encontrado" },
          { status: 404 }
        );
      }

      if (resultado.erro === "FUNCIONARIO_INVALIDO") {
        return NextResponse.json({ error: "Motorista ou ajudante inválido ou inativo." }, { status: 400 });
      }
      if (resultado.erro === "ITEM_INVALIDO") {
        return NextResponse.json(
          { error: "Um dos itens não pertence a este carregamento." },
          { status: 400 }
        );
      }

      if (resultado.erro === "PESO_INVALIDO") {
        return NextResponse.json(
          { error: "Peso carregado inválido." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Não foi possível validar o carregamento." },
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
        const [alertaExistente, exclusao] = await Promise.all([
          prisma.alerta.findFirst({
            where: { tipo: "PESO", referencia: id },
            select: { id: true },
          }),
          prisma.auditLog.findFirst({
            where: { action: "ALERTA_EXCLUIDO", entity: "Alerta", entityId: "PESO:" + id },
            select: { id: true },
          }),
        ]);

        if (!alertaExistente && !exclusao) {
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
    } else {
      try {
        await prisma.auditLog.deleteMany({ where: { action: "ALERTA_EXCLUIDO", entity: "Alerta", entityId: "PESO:" + id } });
      } catch (erroAuditoria) {
        console.error("Não foi possível liberar a exclusão anterior do alerta de peso:", erroAuditoria);
      }
    }

    await publishDataChanged("carregamentos", "caminhoes", "alertas");
    const itensSalvos = await prisma.carregamentoItem.findMany({ where: { carregamentoId: id }, orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true, ordem: true, notaFiscalNome: true } });
    return NextResponse.json({ itens: itensSalvos,
      ...(avisoExcessoPeso ? { avisoExcessoPeso } : {}),
      ...(resultado.avisoExcessoPeso
        ? { detalhesExcessoPeso: resultado.avisoExcessoPeso }
        : {}),
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
  const permission = await requirePermission("carregamentos.excluir");
  if (permission.response) return permission.response;

  try {
    const body = await req.json().catch(() => ({}));

    if (
      typeof body.adminPassword !== "string" ||
      !(await verifyAdminPassword(body.adminPassword))
    ) {
      return NextResponse.json(
        { error: "Senha do administrador inválida" },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "ID do carregamento obrigatório" },
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

      // Não interferir em caminhões em rota ou em manutenção.
      // Nunca alterar o status de um caminhão em manutenção.
      if (caminhao.status === "MANUTENCAO") {
        return { ok: true };
      }

      const [restantes, rotaAtiva] = await Promise.all([
        tx.carregamento.findMany({
          where: {
            caminhaoId: carregamento.caminhaoId,
            status: { in: ["EM_ANDAMENTO", "FINALIZADO", "EM_ROTA"] },
          },
          select: { status: true },
        }),
        tx.rota.findFirst({
          where: {
            caminhaoId: carregamento.caminhaoId,
            status: "EM_ANDAMENTO",
          },
          select: { id: true },
        }),
      ]);

      let novoStatus: "LIBERADO" | "CARREGANDO" | "EM_ROTA";

      if (
        rotaAtiva ||
        restantes.some((c) => c.status === "EM_ROTA")
      ) {
        novoStatus = "EM_ROTA";
      } else if (restantes.some((c) => c.status === "EM_ANDAMENTO")) {
        novoStatus = "CARREGANDO";
      } else {
        novoStatus = "LIBERADO";
      }

      await tx.caminhao.update({
        where: { id: carregamento.caminhaoId },
        data: { status: novoStatus },
      });

      return { ok: true, statusCaminhao: novoStatus };
    });

    await publishDataChanged("carregamentos", "caminhoes", "alertas");
    return NextResponse.json(resultado);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CARREGAMENTO_NAO_ENCONTRADO"
    ) {
      return NextResponse.json(
        { error: "Carregamento não encontrado" },
        { status: 404 }
      );
    }

    console.error("Erro ao excluir carregamento:", error);
    return NextResponse.json(
      { error: "Não foi possível excluir o carregamento" },
      { status: 500 }
    );
  }
}

