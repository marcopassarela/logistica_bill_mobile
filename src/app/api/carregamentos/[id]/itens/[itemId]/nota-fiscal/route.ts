import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { decodePdf } from "@/lib/pdf-storage";
import { publishDataChanged } from "@/lib/realtime";
import { get, put } from "@vercel/blob";

const MAX_PDF_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!canAccess(user.role, user.permissions, "carregamentos.criar") && !canAccess(user.role, user.permissions, "carregamentos.editar")) {
    return NextResponse.json({ error: "Você não tem permissão para executar esta ação." }, { status: 403 });
  }

  const { id, itemId } = await params;
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Não foi possível ler o arquivo enviado." }, { status: 400 });
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo PDF." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_PDF_SIZE) return NextResponse.json({ error: "O PDF deve ter até 10 MB." }, { status: 400 });
  if (file.type && file.type !== "application/pdf") return NextResponse.json({ error: "O arquivo deve ser um PDF." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "O conteúdo do arquivo não é um PDF válido." }, { status: 400 });

  const item = await prisma.carregamentoItem.findFirst({ where: { id: itemId, carregamentoId: id }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Item não encontrado nesta carga." }, { status: 404 });

  const nome = file.name.replaceAll("/", "_").replaceAll(String.fromCharCode(92), "_").replaceAll(String.fromCharCode(13), "").replaceAll(String.fromCharCode(10), "").replaceAll("\"", "_").trim().slice(0, 180) || "nota-fiscal.pdf";
  const pathname = `notas-fiscais/${id}/${itemId}/${crypto.randomUUID()}.pdf`;
  await put(pathname, Buffer.from(bytes), { access: "private", contentType: "application/pdf", addRandomSuffix: false });
  await prisma.carregamentoItem.update({ where: { id: itemId }, data: { notaFiscalNome: nome, notaFiscalPath: pathname, notaFiscalDisponivel: true, notaFiscalData: null } });
  after(() => publishDataChanged("carregamentos"));
  return NextResponse.json({ ok: true, notaFiscalNome: nome });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id, itemId } = await params;
  const item = await prisma.carregamentoItem.findFirst({
    where: { id: itemId, carregamentoId: id },
    select: { notaFiscalNome: true, notaFiscalDisponivel: true, notaFiscalData: true, notaFiscalPath: true, carregamento: { select: { motoristaId: true, data: true } } },
  });
  if (!item || (!item.notaFiscalDisponivel && !item.notaFiscalData && !item.notaFiscalPath)) return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER" && (item.carregamento.motoristaId !== user.funcionarioId || item.carregamento.data > new Date())) {
    return NextResponse.json({ error: "Você não tem acesso a esta nota fiscal." }, { status: 403 });
  }

  const filename = (item.notaFiscalNome || "nota-fiscal.pdf").replaceAll(String.fromCharCode(13), "").replaceAll(String.fromCharCode(10), "").replaceAll("\"", "_");
  if (item.notaFiscalPath) {
    const prefix = `notas-fiscais/${id}/${itemId}/`;
    if (!item.notaFiscalPath.startsWith(prefix)) return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
    const blob = await get(item.notaFiscalPath, { access: "private" });
    if (!blob || blob.statusCode !== 200 || blob.blob.contentType !== "application/pdf" || blob.blob.size > MAX_PDF_SIZE) return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
    return new NextResponse(blob.stream, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, "Content-Length": String(blob.blob.size), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  const pdf = decodePdf(item.notaFiscalData!);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    },
  });
}

