import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishDataChanged } from "@/lib/realtime";
import { getCurrentUser } from "@/lib/auth";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Contexto) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const result = await prisma.alerta.updateMany({
      where: { id },
      data: { lido: true },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Notificação não encontrada." },
        { status: 404 }
      );
    }

    await publishDataChanged("alertas");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar a notificação." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const result = await prisma.alerta.deleteMany({
      where: { id },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Notificação não encontrada." },
        { status: 404 }
      );
    }

    await publishDataChanged("alertas");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível excluir a notificação." },
      { status: 500 }
    );
  }
}