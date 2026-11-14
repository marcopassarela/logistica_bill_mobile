import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/permissions";
import { compressPdfDataUrl, decodePdf } from "@/lib/pdf-storage";
import { after } from "next/server";
import { publishDataChanged } from "@/lib/realtime";

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
      carregamento: { select: { data: true, motoristaId: true } },
    },
  });
  if (!item?.notaFiscalData) return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });

  const podeVerTudo = user.role === "ADMIN" || user.role === "MANAGER";
  if (!podeVerTudo && (item.carregamento.motoristaId !== user.funcionarioId || item.carregamento.data > new Date())) {
    return NextResponse.json({ error: "Esta nota fiscal ainda não está disponível." }, { status: 403 });
  }

  try {
    const pdf = decodePdf(item.notaFiscalData);
    const filename = (item.notaFiscalNome || "nota-fiscal.pdf").replace(/[\\/\r\n"']/g, "_");
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível abrir a nota fiscal." }, { status: 500 });
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
    const dataUrl = `data:application/pdf;base64,${bytes.toString("base64")}`;
    const compactado = compressPdfDataUrl(dataUrl);
    await prisma.carregamentoItem.update({
      where: { id: itemId },
      data: { notaFiscalNome: file.name.replace(/[\\/\r\n"']/g, "_"), notaFiscalData: compactado },
    });
    after(() => publishDataChanged("carregamentos"));
    return NextResponse.json({ ok: true, nome: file.name });
  } catch (error) {
    console.error("Erro ao armazenar nota fiscal:", error);
    return NextResponse.json({ error: "Não foi possível armazenar a nota fiscal." }, { status: 500 });
  }
}
