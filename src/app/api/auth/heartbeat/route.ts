import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishDataChanged } from "@/lib/realtime";

// Mesmo limite usado em /api/users para considerar alguém online.
const LIMITE_ONLINE_MS = 90_000;
// Não grava de novo se o último registro for mais recente que isto
// (evita escrita repetida quando há várias abas abertas do mesmo usuário).
const INTERVALO_MINIMO_GRAVACAO_MS = 30_000;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const agora = Date.now();
  const idade = user.lastSeenAt ? agora - user.lastSeenAt.getTime() : Infinity;
  const estavaOnline = idade < LIMITE_ONLINE_MS;

  if (idade >= INTERVALO_MINIMO_GRAVACAO_MS) {
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date(agora) } });
  }

  if (!estavaOnline) void publishDataChanged("usuarios");
  return NextResponse.json({ ok: true, at: new Date(agora).toISOString() });
}
