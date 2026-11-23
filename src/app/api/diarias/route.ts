import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { diariaSchema } from "@/lib/validations";
import { z } from "zod";
import { publishDataChanged } from "@/lib/realtime";

function prismaError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

function normalize(body: Record<string, unknown>) {
  const result = { ...body };
  if (result.caminhaoId === "") result.caminhaoId = null;
  if (result.observacao === "") result.observacao = null;
  return result;
}

function diariaData(data: Record<string, unknown>) {
  const result = { ...data };

  if (typeof result.data === "string") {
    const date = new Date(`${result.data}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Data da diária inválida");
    }
    result.data = date;
  }

  if (typeof result.caminhaoId === "string" && !result.caminhaoId.trim()) {
    result.caminhaoId = null;
  }
  if (typeof result.observacao === "string" && !result.observacao.trim()) {
    result.observacao = null;
  }

  return result;
}

const includeRelations = {
  funcionario: { select: { id: true, nome: true } },
  caminhao: { select: { id: true, placa: true } },
};

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const list = await prisma.diaria.findMany({
      include: includeRelations,
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(list);
  } catch (error) {
    console.error("Erro ao listar diárias:", error);
    return NextResponse.json(
      { error: "Não foi possível listar as diárias" },
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
    const parsed = diariaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 },
      );
    }

    const data = diariaData(parsed.data as Record<string, unknown>);
    const created = await prisma.diaria.create({
      data: {
        funcionarioId: String(data.funcionarioId),
        caminhaoId: typeof data.caminhaoId === "string" ? data.caminhaoId : null,
        data: data.data as Date,
        valor: Number(data.valor),
        observacao: typeof data.observacao === "string" ? data.observacao : null,
        createdById: user.id,
      },
      include: includeRelations,
    });

    await publishDataChanged("diarias", "funcionarios", "caminhoes");
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const code = prismaError(error);
    if (code === "P2003" || code === "P2025") {
      return NextResponse.json(
        { error: "Funcionário ou caminhão inválido. Atualize a tela e tente novamente." },
        { status: 400 },
      );
    }

    console.error("Erro ao cadastrar diária:", error);
    return NextResponse.json(
      { error: error instanceof Error && error.message === "Data da diária inválida"
        ? error.message
        : "Não foi possível cadastrar a diária" },
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
      return NextResponse.json({ error: "ID da diária obrigatório" }, { status: 400 });
    }

    const fields = { ...body };
    delete fields.id;
    delete fields.adminPassword;

    const parsed = diariaSchema.partial().safeParse(fields);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 },
      );
    }

    const data = diariaData(parsed.data as Record<string, unknown>);
    const updated = await prisma.diaria.update({
      where: { id },
      data: data as Parameters<typeof prisma.diaria.update>[0]["data"],
      include: includeRelations,
    });

    await publishDataChanged("diarias", "funcionarios", "caminhoes");
    return NextResponse.json(updated);
  } catch (error) {
    const code = prismaError(error);
    if (code === "P2025") {
      return NextResponse.json({ error: "Diária não encontrada" }, { status: 404 });
    }
    if (code === "P2003") {
      return NextResponse.json({ error: "Funcionário ou caminhão inválido" }, { status: 400 });
    }

    console.error("Erro ao editar diária:", error);
    return NextResponse.json(
      { error: error instanceof Error && error.message === "Data da diária inválida"
        ? error.message
        : "Não foi possível salvar a diária" },
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
    const adminPassword = typeof body.adminPassword === "string" ? body.adminPassword : "";

    if (!id && body.deleteAll !== true) {
      return NextResponse.json({ error: "ID da diária obrigatório" }, { status: 400 });
    }
    if (!adminPassword) {
      return NextResponse.json({ error: "Informe a senha do administrador" }, { status: 400 });
    }
    if (!(await verifyAdminPassword(adminPassword))) {
      return NextResponse.json({ error: "Senha do administrador inválida" }, { status: 403 });
    }

    if (body.deleteAll === true) {
      const result = await prisma.diaria.deleteMany();
      if (result.count > 0) await publishDataChanged("diarias", "funcionarios", "caminhoes");
      return NextResponse.json({ ok: true, count: result.count });
    }

    await prisma.diaria.delete({ where: { id } });
    await publishDataChanged("diarias", "funcionarios", "caminhoes");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = prismaError(error);
    if (code === "P2025") {
      return NextResponse.json({ error: "Diária não encontrada" }, { status: 404 });
    }
    if (code === "P2003" || code === "P2014") {
      return NextResponse.json(
        { error: "Não é possível excluir esta diária porque existem registros vinculados." },
        { status: 409 },
      );
    }

    console.error("Erro ao excluir diária:", error);
    return NextResponse.json({ error: "Não foi possível excluir a diária" }, { status: 500 });
  }
}