import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/permissions";
import { decodePdf } from "@/lib/pdf-storage";
import { after } from "next/server";
import { publishDataChanged } from "@/lib/realtime";
import { del, get, put } from "@vercel/blob";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!canAccess(user.role, user.permissions, "carregamentos.detalhesCliente")) {
    return NextResponse.json({ error: "Você não tem permissão para ver a nota fiscal." }, { status: 403 });
  }

  const { id, itemId } = await params;
  const item = await prisma.carregamentoItem.findFirst({
    where: { id: itemId, carregamentoId: id },
    select: {
      notaFiscalNome: true,
      notaFiscalData: true,
      notaFiscalPath: true,
      carregamento: { select: { data: true, motoristaId: true } },
    },
  });
  if (!item || (!item.notaFiscalData && !item.notaFiscalPath)) return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });

  const podeVerTudo = user.role === "ADMIN" || user.role === "MANAGER";
  if (!podeVerTudo && (item.carregamento.motoristaId !== user.funcionarioId || item.carregamento.data > new Date())) {
    return NextResponse.json({ error: "Esta nota fiscal ainda não está disponível." }, { status: 403 });
  }

  try {
    const filename = (item.notaFiscalNome || "nota-fiscal.pdf").replace(/[\\/\r\n"']/g, "_");
    if (item.notaFiscalPath) {
      const prefix = `notas-fiscais/${id}/${itemId}/`;
      if (!item.notaFiscalPath.startsWith(prefix)) return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
      const blob = await get(item.notaFiscalPath, { access: "private" });
      if (!blob || blob.statusCode !== 200 || blob.blob.contentType !== "application/pdf" || blob.blob.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
      }
      return new NextResponse(blob.stream, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(blob.blob.size),
          "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const pdf = decodePdf(item.notaFiscalData!);
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
    } catch (error) {
    console.error("Erro ao abrir nota fiscal:", error);
    return NextResponse.json(
      { error: "Não foi possível abrir a nota fiscal." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const podeEditar = canAccess(user.role, user.permissions, "carregamentos.editar");
  const podeCriar = canAccess(user.role, user.permissions, "carregamentos.criar");
  if (!podeEditar && !podeCriar) {
    return NextResponse.json({ error: "Você não tem permissão para anexar notas fiscais." }, { status: 403 });
  }

  const { id, itemId } = await params;
  const item = await prisma.carregamentoItem.findFirst({
    where: { id: itemId, carregamentoId: id },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Envie um arquivo PDF válido." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "O PDF deve ter no máximo 10 MB." }, { status: 413 });
    }

    // O upload é separado da criação/edição da carga. Assim, a compactação
    // nunca mantém uma transação Prisma aberta.
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length === 0 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json({ error: "O conteúdo enviado não é um PDF válido." }, { status: 400 });
    }
    const pathname = `notas-fiscais/${id}/${itemId}/${crypto.randomUUID()}.pdf`;
    await put(pathname, bytes, { access: "private", contentType: "application/pdf", addRandomSuffix: false });
    await prisma.carregamentoItem.update({
      where: { id: itemId },
      data: { notaFiscalNome: file.name.replace(/[\\/\r\n"']/g, "_").slice(0, 180), notaFiscalPath: pathname, notaFiscalData: null },
    });
    after(() => publishDataChanged("carregamentos"));
    return NextResponse.json({ ok: true, nome: file.name });
  } catch (error) {
    console.error("Erro ao armazenar nota fiscal:", error);
    return NextResponse.json({ error: "Não foi possível armazenar a nota fiscal." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!canAccess(user.role, user.permissions, "carregamentos.editar")) {
    return NextResponse.json(
      { error: "Você não tem permissão para remover notas fiscais." },
      { status: 403 }
    );
  }

  try {
    const { id, itemId } = await params;
    const item = await prisma.carregamentoItem.findFirst({
      where: { id: itemId, carregamentoId: id },
      select: { id: true, notaFiscalPath: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }

    if (item.notaFiscalPath) {
      const prefix = `notas-fiscais/${id}/${itemId}/`;

      if (!item.notaFiscalPath.startsWith(prefix)) {
        return NextResponse.json({ error: "Nota fiscal inválida." }, { status: 400 });
      }

      await del(item.notaFiscalPath);
    }

    await prisma.carregamentoItem.update({
      where: { id: itemId },
      data: {
        notaFiscalNome: null,
        notaFiscalPath: null,
        notaFiscalData: null,
      },
    });

    after(() => publishDataChanged("carregamentos"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao remover nota fiscal:", error);
    return NextResponse.json(
      { error: "Não foi possível remover a nota fiscal." },
      { status: 500 }
    );
  }
}