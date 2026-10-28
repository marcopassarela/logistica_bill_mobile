export type LatLng = { lat: number; lng: number };

export type RouteResult = {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][];
};

export type GeocodeResult = {
  displayName: string;
  lat: number;
  lng: number;
};

/** Calcula rota pelas estradas via API interna → OSRM */
export async function fetchDrivingRoute(points: LatLng[]): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const res = await fetch("/api/geo/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });
  if (!res.ok) return null;
  return res.json();
}

/** Normaliza abreviações comuns de endereços brasileiros. */
function normalizeAddressQuery(query: string): string {
  return query
    .trim()
    .replace(/\bR\.\s*/gi, "Rua ")
    .replace(/\bAv\.\s*/gi, "Avenida ")
    .replace(/\bRod\.\s*/gi, "Rodovia ")
    .replace(/\bEst\.\s*/gi, "Estrada ")
    .replace(/\bTrav\.\s*/gi, "Travessa ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s{2,}/g, " ");
}

/** Busca endereço / lugar via API interna, com uma alternativa se necessário. */
export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  const normalized = normalizeAddressQuery(query);
  if (normalized.length < 3) return [];

  const search = async (q: string): Promise<GeocodeResult[]> => {
    const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    return res.json();
  };

  const first = await search(normalized);
  if (first.length > 0) return first;

  const simplified = normalized
    .replace(/,\s*\d+[A-Za-z]?(?=,|$)/, "")
    .replace(/,\s*\d{5}-?\d{3}(?=,|$)/, "")
    .trim();

  if (!simplified || simplified === normalized) return [];
  return search(simplified);
}

export function parseCoordinates(input: string): LatLng | null {
  const m = input.trim().match(/^(-?\d+[.,]\d+)\s*[,;\s]\s*(-?\d+[.,]\d+)$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(",", "."));
  const lng = parseFloat(m[2].replace(",", "."));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
