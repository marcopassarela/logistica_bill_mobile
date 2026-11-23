import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { cargoSchema } from "@/lib/validations";
import { publishDataChanged } from "@/lib/realtime";

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const cargos = await prisma.cargo.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { funcionarios: true } } },
    });
    return NextResponse.json(cargos);
  } catch (error) {
    console.error("Erro ao listar cargos:", error);
    return NextResponse.json({ error: "Não foi possível listar os cargos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = cargoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const cargo = await prisma.cargo.create({
      data: {
        nome: parsed.data.nome.trim(),
        descricao: parsed.data.descricao?.trim() || null,
      },
      include: { _count: { select: { funcionarios: true } } },
    });

    await publishDataChanged("cargos", "funcionarios");
    return NextResponse.json(cargo, { status: 201 });
  } catch (error) {
    if (errorCode(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um cargo com esse nome." }, { status: 409 });
    }
    console.error("Erro ao cadastrar cargo:", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o cargo" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json({ error: "ID do cargo obrigatório" }, { status: 400 });
    }

    const parsed = cargoSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const data: { nome?: string; descricao?: string | null } = {};
    if (typeof parsed.data.nome === "string") data.nome = parsed.data.nome.trim();
    if (parsed.data.descricao !== undefined) data.descricao = parsed.data.descricao?.trim() || null;

    const cargo = await prisma.cargo.update({
      where: { id },
      data,
      include: { _count: { select: { funcionarios: true } } },
    });

    await publishDataChanged("cargos", "funcionarios");
    return NextResponse.json(cargo);
  } catch (error) {
    if (errorCode(error) === "P2025") {
      return NextResponse.json({ error: "Cargo não encontrado" }, { status: 404 });
    }
    if (errorCode(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um cargo com esse nome." }, { status: 409 });
    }
    console.error("Erro ao editar cargo:", error);
    return NextResponse.json({ error: "Não foi possível editar o cargo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    const password = typeof body.adminPassword === "string" ? body.adminPassword : "";

    if (!id) {
      return NextResponse.json({ error: "ID do cargo obrigatório" }, { status: 400 });
    }
    if (!password || !(await verifyAdminPassword(password))) {
      return NextResponse.json({ error: "Senha do administrador inválida" }, { status: 403 });
    }

    const cargo = await prisma.cargo.findUnique({
      where: { id },
      include: { _count: { select: { funcionarios: true } } },
    });

    if (!cargo) {
      return NextResponse.json({ error: "Cargo não encontrado" }, { status: 404 });
    }
    if (cargo._count.funcionarios > 0) {
      return NextResponse.json(
        { error: "Este cargo está associado a funcionários. Reatribua esses funcionários antes de excluir." },
        { status: 409 }
      );
    }

    await prisma.cargo.delete({ where: { id } });
    await publishDataChanged("cargos", "funcionarios");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir cargo:", error);
    return NextResponse.json({ error: "Não foi possível excluir o cargo" }, { status: 500 });
  }
}
