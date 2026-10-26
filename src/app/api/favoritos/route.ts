import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const favoritoSchema = z.object({
  pasta: z.string().trim().min(1).max(80).optional().default("Favoritos"),
  nome: z.string().trim().min(1).max(120),
  query: z.string().trim().min(1).max(500),
  endereco: z.string().trim().min(1).max(500),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const favoritos = await prisma.enderecoFavorito.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(favoritos);
  } catch (error) {
    console.error("Erro ao consultar favoritos:", error);
    return NextResponse.json(
      { error: "Não foi possível consultar os favoritos." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = favoritoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados do favorito inválidos.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const favorito = await prisma.enderecoFavorito.create({
      data: parsed.data,
    });

    return NextResponse.json(favorito, { status: 201 });
  } catch (error) {
    console.error("Erro ao salvar favorito:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o favorito." },
      { status: 500 }
    );
  }
}
