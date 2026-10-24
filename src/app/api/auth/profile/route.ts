import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword, verifyPassword, hashPassword } from "@/lib/auth";

export async function GET() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  return NextResponse.json({
    id: sessionUser.id,
    username: sessionUser.username,
    name: sessionUser.name,
    role: sessionUser.role,
    theme: sessionUser.theme,
  });
}

const profileSchema = z.object({
  action: z.literal("profile"),
  username: z.string().trim().min(3).max(50),
  name: z.string().trim().min(2).max(100),
  adminPassword: z.string().min(1),
});

const passwordSchema = z.object({
  action: z.literal("password"),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  adminPassword: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();

    if (body?.action === "profile") {
      const parsed = profileSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Informe um usuário válido e um nome com pelo menos 2 caracteres." }, { status: 400 });
      }
      const data = parsed.data;

      if (!(await verifyAdminPassword(data.adminPassword))) {
        return NextResponse.json({ error: "Senha do administrador inválida" }, { status: 403 });
      }

      const username = data.username.trim();
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: sessionUser.id } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
      }

      const updated = await prisma.user.update({
        where: { id: sessionUser.id },
        data: { username, name: data.name.trim() },
        select: { id: true, username: true, name: true, role: true, theme: true },
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    if (body?.action === "password") {
      const parsed = passwordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "A nova senha deve ter entre 8 e 128 caracteres." }, { status: 400 });
      }
      const data = parsed.data;

      if (!(await verifyAdminPassword(data.adminPassword))) {
        return NextResponse.json({ error: "Senha do administrador inválida" }, { status: 403 });
      }

      const account = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { passwordHash: true },
      });
      if (!account || !(await verifyPassword(account.passwordHash, data.currentPassword))) {
        return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 403 });
      }

      await prisma.user.update({
        where: { id: sessionUser.id },
        data: { passwordHash: await hashPassword(data.newPassword) },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Operação inválida" }, { status: 400 });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível salvar as alterações" }, { status: 500 });
  }
}
