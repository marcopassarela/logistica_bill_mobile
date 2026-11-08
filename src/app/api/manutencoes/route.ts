import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { publishDataChanged } from "@/lib/realtime";
import { z } from "zod";

const schema = z.object({
  caminhaoId: z.string().min(1),
  descricao: z.string().trim().min(2),
  dataHora: z.string().datetime({ offset: true }).optional().nullable(),
  quilometragemAlvo: z.coerce.number().int().positive().optional().nullable(),
}).refine(
  (data) => Boolean(data.dataHora) || Boolean(data.quilometragemAlvo),
  { message: "Informe uma data/hora ou uma quilometragem-alvo." }
);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const list = await prisma.manutencaoProgramada.findMany({
      where: { userId: user.id },
      include: {
        caminhao: {
          select: { id: true, placa: true, marca: true, modelo: true, quilometragem: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Erro ao listar manutenções:", error);
    return NextResponse.json({ error: "Não foi possível listar as manutenções." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.dataHora && new Date(data.dataHora) <= new Date()) {
      return NextResponse.json({ error: "A data e hora devem ser futuras." }, { status: 400 });
    }

    const caminhao = await prisma.caminhao.findUnique({
      where: { id: data.caminhaoId },
      select: { id: true },
    });

    if (!caminhao) {
      return NextResponse.json({ error: "Caminhão não encontrado." }, { status: 404 });
    }

    const created = await prisma.manutencaoProgramada.create({
      data: {
        userId: user.id,
        caminhaoId: data.caminhaoId,
        descricao: data.descricao,
        dataHora: data.dataHora ? new Date(data.dataHora) : null,
        quilometragemAlvo: data.quilometragemAlvo ?? null,
      },
      include: {
        caminhao: { select: { id: true, placa: true, quilometragem: true } },
      },
    });

    await publishDataChanged("manutencoes", "caminhoes");
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar manutenção:", error);
    return NextResponse.json({ error: "Não foi possível criar a manutenção." }, { status: 500 });
  }
}