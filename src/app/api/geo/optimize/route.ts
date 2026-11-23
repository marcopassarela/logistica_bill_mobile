import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

type Point = { lat: number; lng: number };

function routeCoordinates(points: Point[]) {
  return points.map((p) => `${p.lng},${p.lat}`).join(";");
}

function routeUrl(points: Point[]) {
  return `https://router.project-osrm.org/route/v1/driving/${routeCoordinates(points)}?overview=false&steps=false`;
}

function tourDuration(order: number[], durations: (number | null)[][]) {
  let total = 0;

  for (let i = 0; i < order.length - 1; i++) {
    const value = durations[order[i]]?.[order[i + 1]];
    if (value == null || !Number.isFinite(value)) return Infinity;
    total += value;
  }

  return total;
}

// Melhora a ordem sem mover a origem nem o destino.
// A matriz pode ser assimétrica: cada candidato é avaliado integralmente.
function improveOrder(
  initialOrder: number[],
  durations: (number | null)[][]
) {
  let best = [...initialOrder];
  let bestCost = tourDuration(best, durations);

  if (!Number.isFinite(bestCost)) return best;

  const maxPasses = 30;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    for (let start = 1; start < best.length - 2; start++) {
      for (let end = start + 1; end < best.length - 1; end++) {
        const candidate = [
          ...best.slice(0, start),
          ...best.slice(start, end + 1).reverse(),
          ...best.slice(end + 1),
        ];

        const candidateCost = tourDuration(candidate, durations);

        if (candidateCost + 1 < bestCost) {
          best = candidate;
          bestCost = candidateCost;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return best;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const points = body.points as Point[] | undefined;

    if (
      !Array.isArray(points) ||
      points.length < 3 ||
      points.length > 50 ||
      points.some(
        (p) =>
          !Number.isFinite(p?.lat) ||
          !Number.isFinite(p?.lng) ||
          p.lat < -90 ||
          p.lat > 90 ||
          p.lng < -180 ||
          p.lng > 180
      )
    ) {
      return NextResponse.json(
        { error: "Informe entre 3 e 50 pontos com coordenadas válidas." },
        { status: 400 }
      );
    }

    const baseUrl = "https://router.project-osrm.org";
    const coords = routeCoordinates(points);

    const routeResponse = await fetch(
      `${baseUrl}/route/v1/driving/${coords}?overview=false&steps=false`,
      { signal: AbortSignal.timeout(20000), cache: "no-store" }
    );

    const tripResponse = await fetch(
      `${baseUrl}/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false&overview=false`,
      { signal: AbortSignal.timeout(20000), cache: "no-store" }
    );

    if (!routeResponse.ok || !tripResponse.ok) {
      return NextResponse.json(
        { error: "O serviço rodoviário está indisponível. Tente novamente." },
        { status: 502 }
      );
    }

    const [routeData, tripData] = await Promise.all([
      routeResponse.json(),
      tripResponse.json(),
    ]);

    const currentMeters = routeData.routes?.[0]?.distance;

    if (
      routeData.code !== "Ok" ||
      !Number.isFinite(currentMeters) ||
      currentMeters < 0
    ) {
      return NextResponse.json(
        { error: "Não foi possível calcular a distância da sequência atual." },
        { status: 422 }
      );
    }

    if (
      tripData.code !== "Ok" ||
      !Array.isArray(tripData.waypoints) ||
      tripData.waypoints.length !== points.length
    ) {
      return NextResponse.json(
        { error: "Não foi possível encontrar uma sequência rodoviária para os pontos informados." },
        { status: 422 }
      );
    }

    const tripOrder = tripData.waypoints
      .map((waypoint: { waypoint_index: number }, originalIndex: number) => ({
        originalIndex,
        routeIndex: waypoint.waypoint_index,
      }))
      .sort((a: { routeIndex: number }, b: { routeIndex: number }) =>
        a.routeIndex - b.routeIndex
      )
      .map((item: { originalIndex: number }) => item.originalIndex);

    if (
      tripOrder.length !== points.length ||
      new Set(tripOrder).size !== points.length ||
      tripOrder.some(
        (index: number) =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= points.length
      ) ||
      tripOrder[0] !== 0 ||
      tripOrder[tripOrder.length - 1] !== points.length - 1
    ) {
      return NextResponse.json(
        { error: "O serviço não retornou uma ordem válida." },
        { status: 502 }
      );
    }

    // Compara alternativas pela distância real calculada nas estradas.
    // A matriz pública é usada somente em rotas com até 20 pontos.
    const candidateOrders: number[][] = [[...tripOrder]];

    if (points.length <= 20) {
      try {
        const tableResponse = await fetch(
          `${baseUrl}/table/v1/driving/${coords}?annotations=duration`,
          { signal: AbortSignal.timeout(15000), cache: "no-store" }
        );

        if (tableResponse.ok) {
          const tableData = await tableResponse.json();
          const durations = tableData.durations as
            | (number | null)[][]
            | undefined;

          const matrixValid =
            tableData.code === "Ok" &&
            Array.isArray(durations) &&
            durations.length === points.length &&
            durations.every(
              (row) =>
                Array.isArray(row) &&
                row.length === points.length
            );

          if (matrixValid) {
            const improved = improveOrder(tripOrder, durations!);

            if (
              improved.length === points.length &&
              improved[0] === 0 &&
              improved[improved.length - 1] === points.length - 1 &&
              new Set(improved).size === points.length &&
              improved.some((value, index) => value !== tripOrder[index])
            ) {
              candidateOrders.push(improved);
            }
          }
        }
      } catch {
        // A matriz é opcional; a alternativa Trip continua disponível.
      }
    }

    let bestOrder = points.map((_, index) => index);
    let bestMeters = currentMeters;

    // Mede cada alternativa candidata pelas estradas e mantém a melhor
    // somente quando ela é realmente mais curta que a sequência atual.
    for (const candidateOrder of candidateOrders) {
      const orderedPoints = candidateOrder.map(
        (index: number) => points[index]
      );

      try {
        const candidateResponse = await fetch(routeUrl(orderedPoints), {
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });

        if (!candidateResponse.ok) continue;

        const candidateData = await candidateResponse.json();
        const candidateMeters = candidateData.routes?.[0]?.distance;

        if (
          candidateData.code === "Ok" &&
          Number.isFinite(candidateMeters) &&
          candidateMeters >= 0 &&
          candidateMeters < bestMeters
        ) {
          bestMeters = candidateMeters;
          bestOrder = [...candidateOrder];
        }
      } catch {
        // Se uma alternativa falhar, tenta a próxima.
      }
    }

    const acceptedOrder = bestOrder;
    const acceptedMeters = bestMeters;
    return NextResponse.json({
      order: acceptedOrder,
      currentDistanceKm: currentMeters / 1000,
      optimizedDistanceKm: acceptedMeters / 1000,
      savingsKm: (currentMeters - acceptedMeters) / 1000,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao consultar o serviço de otimização rodoviária." },
      { status: 502 }
    );
  }
}
