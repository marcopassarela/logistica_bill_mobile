import { NextResponse } from "next/server";
import { getCurrentUser, refreshSessionPermissions } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const permissaoAtualizada = await refreshSessionPermissions({
    id: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  if (!permissaoAtualizada) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}