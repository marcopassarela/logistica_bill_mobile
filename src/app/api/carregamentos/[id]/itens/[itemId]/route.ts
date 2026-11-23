
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { publishDataChanged } from "@/lib/realtime";
import { del } from "@vercel/blob";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!canAccess(user.role, user.permissions, "carregamentos.excluirItem")) {
      return NextResponse.json(
        { error: "Você não tem permissão para excluir itens." },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (
      typeof body.adminPassword !== "string" ||
      !(await verifyAdminPassword(body.adminPassword))
    ) {
      return NextResponse.json(
        { error: "Senha do administrador inválida." },
        { status: 403 }
      );
    }

    const { id, itemId } = await context.params;

    const resultado = await prisma.$transaction(async (tx) => {
      const item = await tx.carregamentoItem.findFirst({
        where: { id: itemId, carregamentoId: id },
        select: {
          id: true,
          peso: true,
          descricaoLivre: true,
          notaFiscalPath: true,
        },
      });

      if (!item) throw new Error("ITEM_NAO_ENCONTRADO");

      const quantidadeItens = await tx.carregamentoItem.count({
        where: { carregamentoId: id },
      });

      if (quantidadeItens <= 1) {
        throw new Error("A carga precisa ter pelo menos um item.");
      }

      await tx.carregamentoItem.delete({ where: { id: itemId } });

      await tx.carregamento.update({
        where: { id },
        data: { pesoTotal: { decrement: item.peso } },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "ITEM_CARREGAMENTO_EXCLUIDO",
          entity: "CarregamentoItem",
          entityId: itemId,
          details: {
            carregamentoId: id,
            descricao: item.descricaoLivre,
            peso: String(item.peso),
          },
        },
      });

      return { notaFiscalPath: item.notaFiscalPath };
    });

    if (
      resultado.notaFiscalPath &&
      resultado.notaFiscalPath.startsWith(`notas-fiscais/${id}/${itemId}/`)
    ) {
      try {
        await del(resultado.notaFiscalPath);
      } catch (error) {
        console.error("Erro ao excluir arquivo da nota fiscal:", error);
      }
    }

    after(() => publishDataChanged("carregamentos", "caminhoes", "alertas"));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_NAO_ENCONTRADO") {
      return NextResponse.json(
        { error: "Item não encontrado nesta carga." },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "A carga precisa ter pelo menos um item.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Erro ao excluir item do carregamento:", error);

    return NextResponse.json(
      { error: "Não foi possível excluir o item." },
      { status: 500 }
    );
  }
}
