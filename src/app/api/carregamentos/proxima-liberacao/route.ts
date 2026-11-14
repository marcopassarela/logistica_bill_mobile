import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (user.role === "ADMIN" || user.role === "MANAGER" || !user.funcionarioId) {
    return NextResponse.json(
      { nextAt: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const proximo = await prisma.carregamento.findFirst({
    where: {
      motoristaId: user.funcionarioId,
      data: { gt: new Date() },
      status: { not: "CANCELADO" },
    },
    select: { data: true },
    orderBy: { data: "asc" },
  });

  return NextResponse.json(
    { nextAt: proximo?.data.toISOString() ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}