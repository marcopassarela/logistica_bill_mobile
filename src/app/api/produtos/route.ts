import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { produtoSchema } from "@/lib/validations";

function normalize(body: Record<string, unknown>) {
  const result = { ...body };
  for (const key of ["descricao", "categoria", "pesoUnitario", "preco"]) {
    if (result[key] === "") result[key] = null;
  }
  if (typeof result.codigo === "string") result.codigo = result.codigo.trim();
  if (typeof result.nome === "string") result.nome = result.nome.trim();
  return result;
}

function prismaError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const list = await prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true, codigo: true, nome: true, unidade: true,
        pesoUnitario: true, preco: true, categoria: true, ativo: true,
      },
    });
    return NextResponse.json(list);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    return NextResponse.json({ error: "Não foi possível listar os produtos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = normalize(await req.json());
    const parsed = produtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
    }

    const data = parsed.data;
    const codigo = data.codigo?.trim() || `PRD-${randomUUID().slice(0, 8).toUpperCase()}`;

    const product = await prisma.produto.create({
      data: { ...data, codigo },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (prismaError(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um produto com esse código." }, { status: 409 });
    }
    console.error("Erro ao cadastrar produto:", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o produto" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = normalize(await req.json());
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "ID do produto obrigatório" }, { status: 400 });

    const parsed = produtoSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
    }

    const { id: _ignored, ...data } = parsed.data as typeof parsed.data & { id?: string };
    const product = await prisma.produto.update({ where: { id }, data });
    return NextResponse.json(product);
  } catch (error) {
    if (prismaError(error) === "P2025") {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }
    if (prismaError(error) === "P2002") {
      return NextResponse.json({ error: "Já existe um produto com esse código." }, { status: 409 });
    }
    console.error("Erro ao editar produto:", error);
    return NextResponse.json({ error: "Não foi possível editar o produto" }, { status: 500 });
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
    if (!id) return NextResponse.json({ error: "ID do produto obrigatório" }, { status: 400 });

    const product = await prisma.produto.findUnique({ where: { id }, select: { id: true, ativo: true } });
    if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    if (!product.ativo) return NextResponse.json({ ok: true });

    await prisma.produto.update({ where: { id }, data: { ativo: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao desativar produto:", error);
    return NextResponse.json({ error: "Não foi possível desativar o produto" }, { status: 500 });
  }
}
