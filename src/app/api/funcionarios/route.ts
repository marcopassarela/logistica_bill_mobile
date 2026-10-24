import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { funcionarioSchema } from "@/lib/validations";

function normalize(body: Record<string, unknown>) {
  const result = { ...body };
  for (const key of ["cpf", "telefone", "email", "cargoId", "dataAdmissao", "salario", "observacoes"]) {
    if (result[key] === "") result[key] = null;
  }
  if (typeof result.nome === "string") result.nome = result.nome.trim();
  if (typeof result.cpf === "string") result.cpf = result.cpf.trim();
  if (typeof result.email === "string") result.email = result.email.trim() || null;
  return result;
}

function prismaError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

function employeeData(data: Record<string, unknown>) {
  const result = { ...data };
  if (typeof result.dataAdmissao === "string" && result.dataAdmissao) {
    const date = new Date(`${result.dataAdmissao}T12:00:00`);
    if (Number.isNaN(date.getTime())) throw new Error("Data de admissão inválida");
    result.dataAdmissao = date;
  }
  return result;
}

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const list = await prisma.funcionario.findMany({
      orderBy: { nome: "asc" },
      include: { cargo: { select: { id: true, nome: true } } },
    });
    return NextResponse.json(list);
  } catch (error) {
    console.error("Erro ao listar funcionários:", error);
    return NextResponse.json({ error: "Não foi possível listar os funcionários" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = normalize(await req.json());
    const parsed = funcionarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
    }

    const data = employeeData(parsed.data as Record<string, unknown>);
    const employee = await prisma.funcionario.create({
      data: data as Parameters<typeof prisma.funcionario.create>[0]["data"],
      include: { cargo: { select: { id: true, nome: true } } },
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    if (prismaError(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um funcionário com esse CPF." }, { status: 409 });
    }
    console.error("Erro ao cadastrar funcionário:", error);
    return NextResponse.json({ error: error instanceof Error && error.message === "Data de admissão inválida" ? error.message : "Não foi possível cadastrar o funcionário" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = normalize(await req.json());
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "ID do funcionário obrigatório" }, { status: 400 });

    // O formato antigo { id, adminPassword } continua servindo para desativar.
    if (typeof body.adminPassword === "string") {
      if (!(await verifyAdminPassword(body.adminPassword))) {
        return NextResponse.json({ error: "Senha do administrador inválida" }, { status: 403 });
      }
      const employee = await prisma.funcionario.findUnique({ where: { id }, select: { id: true } });
      if (!employee) return NextResponse.json({ error: "Funcionário não encontrado" }, { status: 404 });

      const updated = await prisma.funcionario.update({
        where: { id },
        data: { status: "INATIVO" },
        include: { cargo: { select: { id: true, nome: true } } },
      });
      return NextResponse.json({ ok: true, funcionario: updated });
    }

    const parsed = funcionarioSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
    }

    const { id: _ignored, ...fields } = parsed.data as typeof parsed.data & { id?: string };
    const data = employeeData(fields as Record<string, unknown>);
    const updated = await prisma.funcionario.update({
      where: { id },
      data: data as Parameters<typeof prisma.funcionario.update>[0]["data"],
      include: { cargo: { select: { id: true, nome: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (prismaError(error) === "P2025") {
      return NextResponse.json({ error: "Funcionário não encontrado" }, { status: 404 });
    }
    if (prismaError(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um funcionário com esse CPF." }, { status: 409 });
    }
    console.error("Erro ao salvar funcionário:", error);
    return NextResponse.json({ error: error instanceof Error && error.message === "Data de admissão inválida" ? error.message : "Não foi possível salvar o funcionário" }, { status: 500 });
  }
}
// Exclui permanentemente um funcionário somente após confirmar a senha administrativa.
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
        { error: "ID do funcionário obrigatório" },
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

    const employee = await prisma.funcionario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        _count: {
          select: {
            diarias: true,
            faltas: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 },
      );
    }

    const { diarias, faltas } = employee._count;

    if (diarias > 0 || faltas > 0) {
      const motivos: string[] = [];
      if (diarias > 0) {
        motivos.push(`${diarias} diária(s) vinculada(s)`);
      }
      if (faltas > 0) {
        motivos.push(`${faltas} falta(s) vinculada(s)`);
      }

      return NextResponse.json(
        {
          error:
            `Não é possível excluir ${employee.nome}: possui ${motivos.join(" e ")}. ` +
            "Resolva os registros vinculados antes de tentar novamente.",
        },
        { status: 409 },
      );
    }

    await prisma.funcionario.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = prismaError(error);

    if (code === "P2025") {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 },
      );
    }

    if (code === "P2003" || code === "P2014") {
      return NextResponse.json(
        {
          error:
            "Não foi possível excluir: existem registros vinculados a este funcionário.",
        },
        { status: 409 },
      );
    }

    console.error("Erro ao excluir funcionário:", error);
    return NextResponse.json(
      { error: "Não foi possível excluir o funcionário" },
      { status: 500 },
    );
  }
}