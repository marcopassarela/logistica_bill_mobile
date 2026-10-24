"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function makeNumberedIcon(n: number, color = "#2563eb") {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export type MapPoint = {
  lat: number;
  lng: number;
  label?: string;
  ordem?: number;
};

function FitBounds({ points, geometry }: { points: MapPoint[]; geometry: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] =
      geometry.length > 0
        ? geometry
        : points.map((p) => [p.lat, p.lng] as [number, number]);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 14);
      return;
    }
    const bounds = L.latLngBounds(coords.map((c) => L.latLng(c[0], c[1])));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points, geometry]);
  return null;
}

type Props = {
  points?: MapPoint[];
  /** Coordenadas da rota já calculada pelo OSRM (segue as estradas) [lat, lng][] */
  routeGeometry?: [number, number][];
  height?: string;
};

export default function MapView({
  points = [],
  routeGeometry = [],
  height = "100%",
}: Props) {
  const center: [number, number] = useMemo(() => {
    if (points.length > 0) return [points[0].lat, points[0].lng];
    return [-15.78, -47.93];
  }, [points]);

  return (
    <MapContainer
      center={center}
      zoom={5}
      scrollWheelZoom
      style={{ height, width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Tiles © OSM France'
        url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
      />

      {routeGeometry.length > 1 && (
        <Polyline
          positions={routeGeometry}
          pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }}
        />
      )}

      {points.map((p, i) => (
        <Marker
          key={`${p.lat}-${p.lng}-${i}`}
          position={[p.lat, p.lng]}
          icon={makeNumberedIcon(p.ordem ?? i + 1, i === 0 ? "#16a34a" : i === points.length - 1 ? "#dc2626" : "#2563eb")}
        >
          <Popup>
            <strong>
              {i === 0 ? "Origem" : i === points.length - 1 ? "Destino" : `Parada ${i}`}
            </strong>
            {p.label ? <div>{p.label}</div> : null}
            <div className="text-xs opacity-70">
              {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
            </div>
          </Popup>
        </Marker>
      ))}

      <FitBounds points={points} geometry={routeGeometry} />
    </MapContainer>
  );
}
