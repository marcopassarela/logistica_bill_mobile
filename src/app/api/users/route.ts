import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hashPassword, verifyPassword, verifyAdminPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess, normalizePermissions } from "@/lib/permissions";
import { publishDataChanged } from "@/lib/realtime";

const publicSelect = {
  id: true, username: true, name: true, role: true, cargoUsuario: true, funcionarioId: true, isActive: true,
  permissions: true, lastSeenAt: true, lastLoginAt: true, lastLogoutAt: true, createdAt: true,
} as const;

const createSchema = z.object({
  username: z.string().trim().min(3).max(50),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(4).max(128),
  cargoUsuario: z.string().trim().min(2).max(60).optional().nullable(),
  funcionarioId: z.string().optional().nullable(),
  role: z.enum(["USER", "MANAGER", "ADMIN"]).default("USER"),
  permissions: z.record(z.boolean()).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  username: z.string().trim().min(3).max(50).optional(),
  name: z.string().trim().min(2).max(100).optional(),
  password: z.string().min(4).max(128).optional(),
  currentPassword: z.string().min(1).optional(),
  cargoUsuario: z.string().trim().min(2).max(60).optional().nullable(),
  funcionarioId: z.string().optional().nullable(),
  role: z.enum(["USER", "MANAGER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  permissions: z.record(z.boolean()).optional(),
});

function isOnline(lastSeenAt: Date | null) {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < 90_000;
}

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (current.role !== "ADMIN") {
    return NextResponse.json({ admin: false, users: [{ ...current, permissions: normalizePermissions(current.permissions), online: isOnline(current.lastSeenAt) }] });
  }

  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], select: publicSelect });
  return NextResponse.json({ admin: true, users: users.map((user) => ({ ...user, permissions: normalizePermissions(user.permissions), online: isOnline(user.lastSeenAt) })) });
}

export async function POST(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current || current.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores podem cadastrar usuários." }, { status: 403 });

  try {
    const data = createSchema.parse(await req.json());
    const user = await prisma.user.create({
      data: {
        username: data.username,
        name: data.name,
        passwordHash: await hashPassword(data.password),
        role: data.role,
        cargoUsuario: data.cargoUsuario || null,
        funcionarioId: data.funcionarioId || null,
        permissions: normalizePermissions(data.permissions),
      },
      select: publicSelect,
    });
    void publishDataChanged("usuarios");
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
    }
    return NextResponse.json({ error: "Dados inválidos para cadastro." }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const data = updateSchema.parse(await req.json());
    const isSelf = data.id === current.id;
    if (current.role !== "ADMIN" && !isSelf) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    if (current.role !== "ADMIN" && (data.role !== undefined || data.isActive !== undefined || data.permissions !== undefined)) {
      return NextResponse.json({ error: "Somente o administrador pode alterar permissões e status." }, { status: 403 });
    }
    if (isSelf && data.isActive === false) return NextResponse.json({ error: "O usuário atual não pode se desativar." }, { status: 400 });
    if (isSelf && data.password !== undefined) {
      if (!data.currentPassword) return NextResponse.json({ error: "Informe a senha atual para definir uma nova senha." }, { status: 400 });
      const account = await prisma.user.findUnique({ where: { id: current.id }, select: { passwordHash: true } });
      if (!account || !(await verifyPassword(account.passwordHash, data.currentPassword))) return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    if (data.username !== undefined) update.username = data.username;
    if (data.name !== undefined) update.name = data.name;
    if (data.cargoUsuario !== undefined) update.cargoUsuario = data.cargoUsuario || null;
    if (data.funcionarioId !== undefined && current.role === "ADMIN") update.funcionarioId = data.funcionarioId || null;
    if (data.password !== undefined) update.passwordHash = await hashPassword(data.password);
    if (current.role === "ADMIN") {
      if (data.role !== undefined) update.role = data.role;
      if (data.isActive !== undefined) update.isActive = data.isActive;
      if (data.permissions !== undefined) update.permissions = normalizePermissions(data.permissions);
    }

    const before = await prisma.user.findUnique({ where: { id: data.id }, select: { username: true, name: true } });
    if (current.role === "ADMIN" && data.funcionarioId !== undefined) update.funcionarioId = data.funcionarioId || null;
    const user = await prisma.user.update({ where: { id: data.id }, data: update, select: publicSelect });
    if (before && (before.username !== user.username || before.name !== user.name)) {
      await prisma.auditLog.create({ data: { userId: current.id, action: "PERFIL_ATUALIZADO", entity: "User", entityId: user.id, details: { antes: before, depois: { username: user.username, name: user.name } } } });
    }
    if (current.role === "ADMIN" && (data.permissions !== undefined || data.isActive === false || data.password !== undefined || data.role !== undefined || data.username !== undefined || data.name !== undefined || data.funcionarioId !== undefined)) {
      await prisma.session.deleteMany({ where: { userId: data.id } });
    }
    void publishDataChanged("usuarios");
    return NextResponse.json({ user });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível atualizar o usuário." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (current.role !== "ADMIN" && !canAccess(current.role, current.permissions, "usuarios.excluir")) {
    return NextResponse.json({ error: "Você não tem permissão para excluir usuários." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!(await verifyAdminPassword(String(body.adminPassword || "")))) return NextResponse.json({ error: "Senha do administrador inválida." }, { status: 403 });
  const id = String(body.id || "");
  if (!id || id === current.id) return NextResponse.json({ error: "Não é possível excluir o usuário atual." }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: current.id, action: "USUARIO_EXCLUIDO", entity: "User", entityId: id } });
  void publishDataChanged("usuarios");
  return NextResponse.json({ ok: true });
}
