import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { faltaSchema } from "@/lib/validations";

function prismaError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

function normalize(body: Record<string, unknown>) {
  const result = { ...body };

  for (const key of ["justificativa"]) {
    if (result[key] === "") result[key] = null;
  }

  if (typeof result.funcionarioId === "string") {
    result.funcionarioId = result.funcionarioId.trim();
  }

  if (typeof result.justificativa === "string") {
    result.justificativa = result.justificativa.trim() || null;
  }

  return result;
}

function faltaData(data: Record<string, unknown>) {
  const result = { ...data };

  if (typeof result.data === "string") {
    const date = new Date(`${result.data}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Data da falta inválida");
    }

    result.data = date;
  }

  return result;
}

const includeRelations = {
  funcionario: { select: { id: true, nome: true } },
};

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const list = await prisma.falta.findMany({
      include: includeRelations,
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Erro ao listar faltas:", error);
    return NextResponse.json(
      { error: "Não foi possível listar as faltas" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = normalize(await req.json());
    const parsed = faltaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 },
      );
    }

    const data = faltaData(parsed.data as Record<string, unknown>);

    const created = await prisma.falta.create({
      data: {
        funcionarioId: String(data.funcionarioId),
        data: data.data as Date,
        tipo: data.tipo as
          | "FALTA"
          | "ATESTADO"
          | "FOLGA"
          | "LICENCA"
          | "OUTRO",
        justificativa:
          typeof data.justificativa === "string"
            ? data.justificativa
            : null,
        createdById: user.id,
      },
      include: includeRelations,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const code = prismaError(error);

    if (code === "P2003" || code === "P2025") {
      return NextResponse.json(
        { error: "Funcionário inválido. Atualize a tela e tente novamente." },
        { status: 400 },
      );
    }

    console.error("Erro ao cadastrar falta:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error &&
          error.message === "Data da falta inválida"
            ? error.message
            : "Não foi possível cadastrar a falta",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = normalize(await req.json());
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json(
        { error: "ID da falta obrigatório" },
        { status: 400 },
      );
    }

    const fields = { ...body };
    delete fields.id;
    delete fields.adminPassword;

    const parsed = faltaSchema.partial().safeParse(fields);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 },
      );
    }

    const data = faltaData(parsed.data as Record<string, unknown>);

    const updated = await prisma.falta.update({
      where: { id },
      data: data as Parameters<typeof prisma.falta.update>[0]["data"],
      include: includeRelations,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const code = prismaError(error);

    if (code === "P2025") {
      return NextResponse.json(
        { error: "Falta não encontrada" },
        { status: 404 },
      );
    }

    if (code === "P2003") {
      return NextResponse.json(
        { error: "Funcionário inválido" },
        { status: 400 },
      );
    }

    console.error("Erro ao editar falta:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error &&
          error.message === "Data da falta inválida"
            ? error.message
            : "Não foi possível salvar a falta",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const adminPassword =
      typeof body.adminPassword === "string" ? body.adminPassword : "";

    if (!id) {
      return NextResponse.json(
        { error: "ID da falta obrigatório" },
        { status: 400 },
      );
    }

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Informe a senha do administrador" },
        { status: 400 },
      );
    }

    if (!(await verifyAdminPassword(adminPassword))) {
      return NextResponse.json(
        { error: "Senha do administrador inválida" },
        { status: 403 },
      );
    }

    await prisma.falta.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = prismaError(error);

    if (code === "P2025") {
      return NextResponse.json(
        { error: "Falta não encontrada" },
        { status: 404 },
      );
    }

    if (code === "P2003" || code === "P2014") {
      return NextResponse.json(
        { error: "Não é possível excluir esta falta porque existem registros vinculados." },
        { status: 409 },
      );
    }

    console.error("Erro ao excluir falta:", error);

    return NextResponse.json(
      { error: "Não foi possível excluir a falta" },
      { status: 500 },
    );
  }
}