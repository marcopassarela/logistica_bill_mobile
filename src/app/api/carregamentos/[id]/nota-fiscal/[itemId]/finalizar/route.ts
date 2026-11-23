
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { del, get } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/permissions";
import { publishDataChanged } from "@/lib/realtime";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (
    !canAccess(user.role, user.permissions, "carregamentos.editar") &&
    !canAccess(user.role, user.permissions, "carregamentos.criar")
  ) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { id, itemId } = await params;

  const item = await prisma.carregamentoItem.findFirst({
    where: { id: itemId, carregamentoId: id },
    select: {
      id: true,
      notaFiscalPath: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  let novoPathname: string | null = null;
  let bancoAtualizado = false;

  try {
    const body = await req.json();
    const pathname = body.pathname;
    const nomeArquivo = body.nomeArquivo;

    const prefix = `notas-fiscais/${id}/${itemId}/`;

    const filename =
      typeof pathname === "string" && pathname.startsWith(prefix)
        ? pathname.slice(prefix.length)
        : "";

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(
        filename
      )
    ) {
      return NextResponse.json(
        { error: "Caminho inválido." },
        { status: 400 }
      );
    }

    if (typeof nomeArquivo !== "string" || !nomeArquivo.trim()) {
      return NextResponse.json(
        { error: "Nome do arquivo inválido." },
        { status: 400 }
      );
    }

    const blob = await get(pathname, { access: "private" });

    if (
      !blob ||
      blob.statusCode !== 200 ||
      blob.blob.contentType !== "application/pdf" ||
      blob.blob.size <= 0 ||
      blob.blob.size > 10 * 1024 * 1024
    ) {
      return NextResponse.json(
        { error: "PDF inválido ou acima de 10 MB." },
        { status: 400 }
      );
    }

    const reader = blob.stream.getReader();
    const inicio: number[] = [];

    try {
      while (inicio.length < 5) {
        const { done, value } = await reader.read();

        if (done) break;

        for (const byte of value) {
          inicio.push(byte);
          if (inicio.length === 5) break;
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    if (String.fromCharCode(...inicio) !== "%PDF-") {
      return NextResponse.json(
        { error: "O conteúdo enviado não é um PDF válido." },
        { status: 400 }
      );
    }

    // O novo arquivo só poderá ser removido se o banco não for atualizado.
    novoPathname = pathname;

    // Atualização otimista: evita sobrescrever uma substituição concorrente.
    const resultado = await prisma.carregamentoItem.updateMany({
      where: {
        id: itemId,
        notaFiscalPath: item.notaFiscalPath,
      },
      data: {
        notaFiscalPath: pathname,
        notaFiscalDisponivel: true,
        notaFiscalNome: nomeArquivo
          .replace(/[\\/\r\n"']/g, "_")
          .trim()
          .slice(0, 180),
        notaFiscalData: null,
      },
    });

    if (resultado.count !== 1) {
      throw new Error(
        "O item foi alterado durante o envio. Tente novamente."
      );
    }

    bancoAtualizado = true;

    // Só exclui o arquivo anterior depois da confirmação do banco.
    if (
      item.notaFiscalPath &&
      item.notaFiscalPath !== pathname &&
      item.notaFiscalPath.startsWith(prefix)
    ) {
      try {
        await del(item.notaFiscalPath);
      } catch (error) {
        // A nota nova já está salva. Falha na limpeza não invalida a operação.
        console.error("Não foi possível excluir a nota fiscal antiga:", error);
      }
    }

    after(() => publishDataChanged("carregamentos"));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao finalizar nota fiscal:", error);

    // Se o banco não foi atualizado, tenta limpar o novo arquivo enviado.
    if (novoPathname && !bancoAtualizado) {
      try {
        await del(novoPathname);
      } catch (cleanupError) {
        console.error("Não foi possível limpar o novo PDF:", cleanupError);
      }
    }

    return NextResponse.json(
      { error: "Não foi possível finalizar a nota fiscal." },
      { status: 500 }
    );
  }
}
