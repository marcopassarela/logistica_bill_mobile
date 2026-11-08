import { NextResponse } from "next/server";
import { Rest } from "ably";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey) {
      console.error("ABLY_API_KEY não configurada.");
      return NextResponse.json(
        { error: "Serviço de comunicação indisponível" },
        { status: 503 }
      );
    }

    const ably = new Rest(apiKey);

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: user.id,
      capability: JSON.stringify({
        "logistica-global": ["subscribe"]
      }),
    });

    return NextResponse.json(tokenRequest, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar token Ably:", error);

    return NextResponse.json(
      { error: "Não foi possível autenticar no serviço de comunicação" },
      { status: 500 }
    );
  }
}
