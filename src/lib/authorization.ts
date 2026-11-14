import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

export async function requirePermission(permission: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  if (!canAccess(user.role, user.permissions, permission)) {
    return { user: null, response: NextResponse.json({ error: "Você não tem permissão para executar esta ação." }, { status: 403 }) };
  }
  return { user, response: null };
}
