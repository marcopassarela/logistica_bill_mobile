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

/** Busca endereço / lugar via Nominatim (proxy interno) */
export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
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
