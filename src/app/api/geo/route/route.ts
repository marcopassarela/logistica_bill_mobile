import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const points = body.points as { lat: number; lng: number }[] | undefined;
  if (!points || points.length < 2) {
    return NextResponse.json({ error: "Mínimo 2 pontos" }, { status: 400 });
  }

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  let data: any;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Falha no serviço de rotas." }, { status: 502 });
    }

    data = await res.json();
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return NextResponse.json(
      { error: timedOut ? "O cálculo da rota demorou demais. Tente novamente." : "Serviço de rotas indisponível." },
      { status: timedOut ? 504 : 502 }
    );
  }
  if (data.code !== "Ok" || !data.routes?.[0]) {
    return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
  }

  const route = data.routes[0];
  const geometry = (route.geometry.coordinates as [number, number][]).map(
    ([lng, lat]) => [lat, lng] as [number, number]
  );

  return NextResponse.json({
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    geometry,
  });
}
