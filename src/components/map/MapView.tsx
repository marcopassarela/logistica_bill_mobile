"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
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
  key?: string;
  lat: number;
  lng: number;
  label?: string;
  ordem?: number;
  concluido?: boolean;
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

function MapClickHandler({
  enabled,
  onMapClick,
}: {
  enabled: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (enabled && onMapClick) {
        onMapClick(event.latlng.lat, event.latlng.lng);
      }
    },
  });
  return null;
}
type Props = {
  points?: MapPoint[];
  favoritePoints?: MapPoint[];
  /** Coordenadas da rota calculada pelo OSRM [lat, lng][] */
  routeGeometry?: [number, number][];
  height?: string;
  editable?: boolean;
  onPointDrag?: (key: string, lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
};

export default function MapView({
  points = [],
  favoritePoints = [],
  routeGeometry = [],
  height = "100%",
  editable = false,
  onPointDrag,
  onMapClick,}: Props) {
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
      <MapClickHandler enabled={editable} onMapClick={onMapClick} />
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
          key={p.key ?? `${p.lat}-${p.lng}-${i}`}
          position={[p.lat, p.lng]}
          draggable={editable && Boolean(p.key)}
          eventHandlers={{
            dragend: (event) => {
              if (!p.key || !onPointDrag) return;
              const position = event.target.getLatLng();
              onPointDrag(p.key, position.lat, position.lng);
            },
          }}
          icon={makeNumberedIcon(p.ordem ?? i + 1, p.concluido ? "#16a34a" : i === 0 ? "#16a34a" : i === points.length - 1 ? "#dc2626" : "#eab308")}
        >
          <Popup>
            <strong>
              {i === 0 ? "Origem" : i === points.length - 1 ? "Destino" : `Parada ${i}`}
            </strong>
            {p.label ? <div>{p.label}</div> : null}
            <div className="text-xs opacity-70">
              {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
            </div>
            {editable ? <div>Arraste para ajustar a localização</div> : null}
          </Popup>
        </Marker>
      ))}

      {favoritePoints.map((favorito, i) => (
        <Marker
          key={`favorito-${favorito.key ?? `${favorito.lat}-${favorito.lng}-${i}`}`}
          position={[favorito.lat, favorito.lng]}
          icon={L.divIcon({
            className: "",
            html: '<div style="color:#f5b301;font-size:30px;line-height:30px;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 2px 5px rgba(0,0,0,.5);text-align:center">★</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })}
        >
          <Popup>
            <strong>★ {favorito.label || "Endereço favorito"}</strong>
            <div className="text-xs opacity-70">
              {favorito.lat.toFixed(5)}, {favorito.lng.toFixed(5)}
            </div>
          </Popup>
        </Marker>
      ))}

      <FitBounds points={points} geometry={routeGeometry} />
    </MapContainer>
  );
}
