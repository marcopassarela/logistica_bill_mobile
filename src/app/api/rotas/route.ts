import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { publishDataChanged } from "@/lib/realtime";
import { z } from "zod";

const pontoSchema = z.object({
  ordem: z.number().int().min(0),
  nome: z.string().optional().nullable(),
  lat: z.number(),
  lng: z.number(),
  endereco: z.string().optional().nullable(),
});

const createSchema = z.object({
  nome: z.string().min(2),
  origem: z.string().min(1),
  destino: z.string().min(1),
  origemLat: z.number().optional().nullable(),
  origemLng: z.number().optional().nullable(),
  destinoLat: z.number().optional().nullable(),
  destinoLng: z.number().optional().nullable(),
  distanciaKm: z.number().optional().nullable(),
  caminhaoId: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  status: z.enum(["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).default("PLANEJADA"),
  dataProgramada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  pontos: z.array(pontoSchema).min(2),
});

function dateKeyBrazil(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const caminhaoId = searchParams.get("caminhaoId");
  const status = searchParams.get("status");
  const data = searchParams.get("data");

  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  const where: Record<string, unknown> = {};

  if (status) where.status = status;

  if (data) {
    const inicioDia = new Date(`${data}T03:00:00.000Z`);
    const fimDia = new Date(inicioDia);
    fimDia.setUTCDate(fimDia.getUTCDate() + 1);

    where.AND = [{
      OR: [
        { dataProgramada: data },
        {
          dataProgramada: null,
          createdAt: { gte: inicioDia, lt: fimDia },
        },
      ],
    }];
  }

  const isDriver = user.role !== "ADMIN" && user.role !== "MANAGER";

  if (isDriver) {
    if (!user.funcionarioId) {
      return NextResponse.json([]);
    }

    const cargas = await prisma.carregamento.findMany({
      where: {
        motoristaId: user.funcionarioId,
        data: { lte: new Date() },
        status: { not: "CANCELADO" },
      },
      select: {
        caminhaoId: true,
        data: true,
      },
    });

    if (cargas.length === 0) {
      return NextResponse.json([]);
    }

    const combinacoes = cargas.map((carga) => ({
      caminhaoId: carga.caminhaoId,
      dataProgramada: dateKeyBrazil(carga.data),
    }));

    const condicoes = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { OR: combinacoes },
    ];

    where.AND = condicoes;

    if (caminhaoId) {
      where.caminhaoId = caminhaoId;
    } else {
      where.caminhaoId = {
        in: [...new Set(cargas.map((carga) => carga.caminhaoId))],
      };
    }
  } else if (caminhaoId) {
    where.caminhaoId = caminhaoId;
  }

  const list = await prisma.rota.findMany({
    where,
    include: {
      caminhao: {
        select: { id: true, placa: true, marca: true, modelo: true },
      },
      pontos: { orderBy: { ordem: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(list);
}
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const created = await prisma.rota.create({
      data: {
        nome: d.nome,
        origem: d.origem,
        destino: d.destino,
        origemLat: d.origemLat ?? null,
        origemLng: d.origemLng ?? null,
        destinoLat: d.destinoLat ?? null,
        destinoLng: d.destinoLng ?? null,
        distanciaKm: d.distanciaKm ?? null,
        caminhaoId: d.caminhaoId || null,
        observacoes: d.observacoes || null,
        status: d.status,
        dataProgramada: d.dataProgramada ?? null,
        pontos: {
          create: d.pontos.map((p) => ({
            ordem: p.ordem,
            nome: p.nome || null,
            lat: p.lat,
            lng: p.lng,
            endereco: p.endereco || null,
          })),
        },
      },
      include: {
        caminhao: { select: { placa: true } },
        pontos: { orderBy: { ordem: "asc" } },
      },
    });

    if (d.caminhaoId && d.status === "EM_ANDAMENTO") {
      await prisma.caminhao.update({
        where: { id: d.caminhaoId },
        data: { status: "EM_ROTA" },
      });
    }

    await publishDataChanged("rotas", "caminhoes");
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro ao criar rota" }, { status: 500 });
  }
}
