import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishDataChanged } from "@/lib/realtime";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const estavaOnline = Boolean(user.lastSeenAt && Date.now() - user.lastSeenAt.getTime() < 90_000);
  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  if (!estavaOnline) void publishDataChanged("usuarios");
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
