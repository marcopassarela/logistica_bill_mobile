import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyAdminPassword } from "@/lib/auth";
import { z } from "zod";

const updatePontoSchema = z.object({
  ordem: z.number().int().min(0),
  nome: z.string().optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  endereco: z.string().optional().nullable(),
});

const updateSchema = z.object({
  nome: z.string().min(2).optional(),
  origem: z.string().min(1).optional(),
  destino: z.string().min(1).optional(),
  origemLat: z.number().min(-90).max(90).optional().nullable(),
  origemLng: z.number().min(-180).max(180).optional().nullable(),
  destinoLat: z.number().min(-90).max(90).optional().nullable(),
  destinoLng: z.number().min(-180).max(180).optional().nullable(),
  distanciaKm: z.number().min(0).optional().nullable(),
  status: z.enum(["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).optional(),
  observacoes: z.string().optional().nullable(),
  caminhaoId: z.string().optional().nullable(),
  pontos: z.array(updatePontoSchema).min(2).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { pontos, caminhaoId, ...rotaData } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.rota.update({
        where: { id },
        data: {
          ...rotaData,
          ...(caminhaoId !== undefined
            ? {
                caminhao: caminhaoId
                  ? { connect: { id: caminhaoId } }
                  : { disconnect: true },
              }
            : {}),
          ...(pontos
            ? {
                origem: pontos[0].endereco || pontos[0].nome || "Origem",
                destino:
                  pontos[pontos.length - 1].endereco ||
                  pontos[pontos.length - 1].nome ||
                  "Destino",
                origemLat: pontos[0].lat,
                origemLng: pontos[0].lng,
                destinoLat: pontos[pontos.length - 1].lat,
                destinoLng: pontos[pontos.length - 1].lng,
              }
            : {}),
        },
      });

      if (pontos) {
        const existentes = await tx.rotaPonto.findMany({
          where: { rotaId: id },
          orderBy: { ordem: "asc" },
          select: { id: true },
        });

        const manterIds: string[] = [];

        for (let i = 0; i < pontos.length; i++) {
          const p = pontos[i];
          const dataPonto = {
            ordem: p.ordem,
            nome: p.nome || null,
            lat: p.lat,
            lng: p.lng,
            endereco: p.endereco || null,
          };

          if (existentes[i]) {
            await tx.rotaPonto.update({
              where: { id: existentes[i].id },
              data: dataPonto,
            });
            manterIds.push(existentes[i].id);
          } else {
            const criado = await tx.rotaPonto.create({
              data: { ...dataPonto, rotaId: id },
              select: { id: true },
            });
            manterIds.push(criado.id);
          }
        }

        const excedentes = existentes
          .slice(pontos.length)
          .map((p) => p.id);

        if (excedentes.length > 0) {
          await tx.rotaPonto.deleteMany({
            where: {
              rotaId: id,
              id: { in: excedentes },
            },
          });
        }
      }

      return tx.rota.findUniqueOrThrow({
        where: { id },
        include: {
          caminhao: {
            select: { id: true, placa: true, marca: true, modelo: true },
          },
          pontos: { orderBy: { ordem: "asc" } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar rota:", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar a rota." },
      { status: 500 }
    );
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.adminPassword !== "string" ||
        !(await verifyAdminPassword(body.adminPassword))) {
      return NextResponse.json({ error: "Senha do administrador inválida" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID da rota obrigatório" }, { status: 400 });

    const rota = await prisma.rota.findUnique({ where: { id }, select: { id: true } });
    if (!rota) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });

    await prisma.rota.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir rota:", error);
    return NextResponse.json({ error: "Não foi possível excluir a rota" }, { status: 500 });
  }
}
