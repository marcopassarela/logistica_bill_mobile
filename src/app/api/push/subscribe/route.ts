import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048).refine(
      (value) => new URL(value).protocol === "https:",
      { message: "O endereço Push precisa utilizar HTTPS." }
    ),
    keys: z.object({
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
    }),
  }),
  userAgent: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 }
    );
  }

  try {
    const parsed = schema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados da inscrição inválidos." },
        { status: 400 }
      );
    }

    const { subscription, userAgent } = parsed.data;

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId: user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
      create: {
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao registrar dispositivo Push:", error);

    return NextResponse.json(
      { error: "Não foi possível registrar o dispositivo." },
      { status: 500 }
    );
  }
}