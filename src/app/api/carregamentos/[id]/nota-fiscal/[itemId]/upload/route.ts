
import { NextRequest, NextResponse } from "next/server";
import { handleUploadPresigned } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/permissions";

const MAX_PDF_SIZE = 10 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

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

  const webhookPublicKey = process.env.BLOB_WEBHOOK_PUBLIC_KEY;
  if (!webhookPublicKey) {
    return NextResponse.json({ error: "Configuração do armazenamento incompleta." }, { status: 500 });
  }

  try {
    const body = await req.json();
    const result = await handleUploadPresigned({
      body,
      request: req,
      webhookPublicKey,
      getSignedToken: async (pathname) => {
        const prefix = `notas-fiscais/${id}/${itemId}/`;
        const filename = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";

        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(filename)) {
          throw new Error("Caminho de upload inválido.");
        }

        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil: Date.now() + 5 * 60 * 1000,
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_SIZE,
        });

        return { token };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao autorizar upload da nota fiscal:", error);
    return NextResponse.json({ error: "Não foi possível autorizar o envio da nota fiscal." }, { status: 400 });
  }
}
