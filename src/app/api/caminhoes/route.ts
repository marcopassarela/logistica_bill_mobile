import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { caminhaoSchema } from "@/lib/validations";

function normalize(body: Record<string, unknown>) {
  const result = { ...body };
  for (const key of [
    "modelo", "marca", "tipo", "renavam", "chassi", "observacoes",
    "ano", "capacidadeKg", "quilometragem",
  ]) {
    if (result[key] === "") result[key] = null;
  }
  if (typeof result.placa === "string") {
    result.placa = result.placa.trim().toUpperCase();
  }
  return result;
}

function prismaError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const list = await prisma.caminhao.findMany({
      orderBy: { placa: "asc" },
      select: {
        id: true, placa: true, marca: true, modelo: true, ano: true,
        capacidadeKg: true, tipo: true, status: true, quilometragem: true,
      },
    });
    return NextResponse.json(list);
  } catch (error) {
    console.error("Erro ao listar caminhões:", error);
    return NextResponse.json({ error: "Não foi possível listar os caminhões" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = normalize(await req.json());
    const parsed = caminhaoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
    }

    const truck = await prisma.caminhao.create({ data: parsed.data });
    return NextResponse.json(truck, { status: 201 });
  } catch (error) {
    if (prismaError(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um caminhão com essa placa." }, { status: 409 });
    }
    console.error("Erro ao cadastrar caminhão:", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o caminhão" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = normalize(await req.json());
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "ID do caminhão obrigatório" }, { status: 400 });

    const parsed = caminhaoSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
    }

    const { id: _ignored, ...data } = parsed.data as typeof parsed.data & { id?: string };
    const truck = await prisma.caminhao.update({ where: { id }, data });
    return NextResponse.json(truck);
  } catch (error) {
    if (prismaError(error) === "P2025") {
      return NextResponse.json({ error: "Caminhão não encontrado" }, { status: 404 });
    }
    if (prismaError(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um caminhão com essa placa." }, { status: 409 });
    }
    console.error("Erro ao editar caminhão:", error);
    return NextResponse.json({ error: "Não foi possível editar o caminhão" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.adminPassword !== "string" ||
        !(await verifyAdminPassword(body.adminPassword))) {
      return NextResponse.json({ error: "Senha do administrador inválida" }, { status: 403 });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "ID do caminhão obrigatório" }, { status: 400 });

    const truck = await prisma.caminhao.findUnique({ where: { id }, select: { id: true } });
    if (!truck) return NextResponse.json({ error: "Caminhão não encontrado" }, { status: 404 });

    const [diarias, rotas, carregamentos] = await Promise.all([
      prisma.diaria.count({ where: { caminhaoId: id } }),
      prisma.rota.count({ where: { caminhaoId: id } }),
      prisma.carregamento.count({ where: { caminhaoId: id } }),
    ]);

    if (diarias + rotas + carregamentos > 0) {
      return NextResponse.json({
        error: "Este caminhão possui registros vinculados e não pode ser excluído.",
        vinculados: { diarias, rotas, carregamentos },
      }, { status: 409 });
    }

    await prisma.caminhao.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir caminhão:", error);
    return NextResponse.json({ error: "Não foi possível excluir o caminhão" }, { status: 500 });
  }
}
