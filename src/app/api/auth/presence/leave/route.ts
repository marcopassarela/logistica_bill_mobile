import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOnlineUserIds } from "@/lib/realtime";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const onlineUserIds = await getOnlineUserIds();
  if (!onlineUserIds) {
    return NextResponse.json({ error: "Não foi possível verificar a presença" }, { status: 503 });
  }

  if (onlineUserIds.has(user.id)) {
    return NextResponse.json({ ok: true, online: true });
  }

  const lastSeenAt = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt },
  });

  return NextResponse.json({ ok: true, online: false, lastSeenAt: lastSeenAt.toISOString() });
}