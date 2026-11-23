import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(
  _req: Request,
  context: RouteContext
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    if (!id || id.length > 100) {
      return NextResponse.json(
        { error: "Identificador inválido." },
        { status: 400 }
      );
    }

    await prisma.enderecoFavorito.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Favorito não encontrado." },
        { status: 404 }
      );
    }

    console.error("Erro ao remover favorito:", error);
    return NextResponse.json(
      { error: "Não foi possível remover o favorito." },
      { status: 500 }
    );
  }
}
