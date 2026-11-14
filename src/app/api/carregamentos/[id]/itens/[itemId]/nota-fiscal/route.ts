import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/authorization";

const MAX_PDF_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const permission = await requirePermission("carregamentos.editar");
  if (permission.response) return permission.response;

  const { id, itemId } = await params;
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo PDF." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_PDF_SIZE) return NextResponse.json({ error: "O PDF deve ter até 10 MB." }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "O arquivo deve ser um PDF." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "O conteúdo do arquivo não é um PDF válido." }, { status: 400 });

  const item = await prisma.carregamentoItem.findFirst({ where: { id: itemId, carregamentoId: id }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Item não encontrado nesta carga." }, { status: 404 });

  const nome = file.name.replaceAll("/", "_").replaceAll(String.fromCharCode(92), "_").replaceAll(String.fromCharCode(13), "").replaceAll(String.fromCharCode(10), "").replaceAll("\"", "_").trim().slice(0, 180) || "nota-fiscal.pdf";
  await prisma.carregamentoItem.update({ where: { id: itemId }, data: { notaFiscalNome: nome, notaFiscalData: bytes } });
  return NextResponse.json({ ok: true, notaFiscalNome: nome });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id, itemId } = await params;
  const item = await prisma.carregamentoItem.findFirst({
    where: { id: itemId, carregamentoId: id },
    select: { notaFiscalNome: true, notaFiscalData: true, carregamento: { select: { motoristaId: true, data: true } } },
  });
  if (!item || !item.notaFiscalData) return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER" && (item.carregamento.motoristaId !== user.funcionarioId || item.carregamento.data > new Date())) {
    return NextResponse.json({ error: "Você não tem acesso a esta nota fiscal." }, { status: 403 });
  }

  const filename = (item.notaFiscalNome || "nota-fiscal.pdf").replaceAll(String.fromCharCode(13), "").replaceAll(String.fromCharCode(10), "").replaceAll("\"", "_");
  return new NextResponse(new Uint8Array(item.notaFiscalData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(item.notaFiscalData.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}

