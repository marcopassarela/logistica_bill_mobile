import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const list = await prisma.caminhao.findMany({
    orderBy: { placa: "asc" },
    select: {
      id: true,
      placa: true,
      marca: true,
      modelo: true,
      capacidadeKg: true,
      status: true,
    },
  });
  return NextResponse.json(list);
}
