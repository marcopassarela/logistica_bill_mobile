"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  MapPin,
  Trash2,
  Route,
  Loader2,
  Navigation,
  Truck,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";
import {
  fetchDrivingRoute,
  geocodeSearch,
  parseCoordinates,
  type GeocodeResult,
  type LatLng,
} from "@/lib/routing";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-xl bg-muted text-muted-foreground text-sm">
      Carregando mapa...
    </div>
  ),
});

type Waypoint = {
  key: string;
  query: string;
  nome: string;
  lat: number | null;
  lng: number | null;
  endereco: string;
};

type Caminhao = { id: string; placa: string; marca: string | null; modelo: string | null; status: string };

type RotaSalva = {
  id: string;
  nome: string;
  origem: string;
  destino: string;
  distanciaKm: number | null;
  status: string;
  caminhao: { id: string; placa: string } | null;
  pontos: { ordem: number; nome: string | null; lat: number; lng: number; endereco: string | null }[];
};

const statusLabel: Record<string, string> = {
  PLANEJADA: "Planejada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

function emptyWp(): Waypoint {
  return { key: crypto.randomUUID(), query: "", nome: "", lat: null, lng: null, endereco: "" };
}

export default function RotasPage() {
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [rotas, setRotas] = useState<RotaSalva[]>([]);
  const [nomeRota, setNomeRota] = useState("");
  const [caminhaoId, setCaminhaoId] = useState("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([emptyWp(), emptyWp()]);
  const [searchIdx, setSearchIdx] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [routing, setRouting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selectedRotaId, setSelectedRotaId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cRes, rRes] = await Promise.all([fetch("/api/caminhoes"), fetch("/api/rotas")]);
    if (cRes.ok) setCaminhoes(await cRes.json());
    if (rRes.ok) setRotas(await rRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mapPoints = waypoints
    .filter((w) => w.lat != null && w.lng != null)
    .map((w, i) => ({
      lat: w.lat!,
      lng: w.lng!,
      label: w.nome || w.endereco || w.query,
      ordem: i + 1,
    }));

  async function doSearch(idx: number) {
    const q = waypoints[idx].query.trim();
    if (!q) return;

    const coords = parseCoordinates(q);
    if (coords) {
      setWaypoints((prev) =>
        prev.map((w, i) =>
          i === idx
            ? {
                ...w,
                lat: coords.lat,
                lng: coords.lng,
                endereco: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
                nome: w.nome || `Ponto ${idx + 1}`,
              }
            : w
        )
      );
      setSearchResults([]);
      setSearchIdx(null);
      return;
    }

    setSearching(true);
    setSearchIdx(idx);
    try {
      const results = await geocodeSearch(q);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  function pickResult(idx: number, r: GeocodeResult) {
    setWaypoints((prev) =>
      prev.map((w, i) =>
        i === idx
          ? {
              ...w,
              lat: r.lat,
              lng: r.lng,
              endereco: r.displayName,
              nome: w.nome || r.displayName.split(",")[0],
              query: r.displayName.split(",").slice(0, 2).join(","),
            }
          : w
      )
    );
    setSearchResults([]);
    setSearchIdx(null);
  }

  function addWaypoint() {
    setWaypoints((prev) => [...prev, emptyWp()]);
  }

  function removeWaypoint(key: string) {
    setWaypoints((prev) => (prev.length <= 2 ? prev : prev.filter((w) => w.key !== key)));
  }

  async function calcularRotaNasEstradas() {
    setMsg(null);
    const pts: LatLng[] = waypoints
      .filter((w) => w.lat != null && w.lng != null)
      .map((w) => ({ lat: w.lat!, lng: w.lng! }));

    if (pts.length < 2) {
      setMsg({ type: "err", text: "Defina pelo menos origem e destino (2 pontos no mapa)." });
      return;
    }

    setRouting(true);
    try {
      const result = await fetchDrivingRoute(pts);
      if (!result) {
        setMsg({
          type: "err",
          text: "Não foi possível calcular a rota pelas estradas. Tente outros pontos.",
        });
        setRouteGeometry([]);
        setDistanceKm(null);
        setDurationMin(null);
        return;
      }
      setRouteGeometry(result.geometry);
      setDistanceKm(result.distanceKm);
      setDurationMin(result.durationMin);
      setMsg({
        type: "ok",
        text: `Rota pelas estradas: ${result.distanceKm.toFixed(1)} km • ~${Math.round(result.durationMin)} min`,
      });
    } catch {
      setMsg({ type: "err", text: "Erro ao consultar o serviço de rotas (OSRM)." });
    } finally {
      setRouting(false);
    }
  }

  async function salvarRota() {
    setMsg(null);
    const valid = waypoints.filter((w) => w.lat != null && w.lng != null);
    if (valid.length < 2) {
      setMsg({ type: "err", text: "Precisa de pelo menos 2 pontos com coordenadas." });
      return;
    }
    if (!nomeRota.trim()) {
      setMsg({ type: "err", text: "Informe um nome para a rota." });
      return;
    }

    // garante geometria
    let dist = distanceKm;
    if (routeGeometry.length < 2) {
      const result = await fetchDrivingRoute(valid.map((w) => ({ lat: w.lat!, lng: w.lng! })));
      if (result) {
        setRouteGeometry(result.geometry);
        dist = result.distanceKm;
        setDistanceKm(result.distanceKm);
        setDurationMin(result.durationMin);
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/rotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeRota.trim(),
          origem: valid[0].endereco || valid[0].nome || valid[0].query,
          destino: valid[valid.length - 1].endereco || valid[valid.length - 1].nome || valid[valid.length - 1].query,
          origemLat: valid[0].lat,
          origemLng: valid[0].lng,
          destinoLat: valid[valid.length - 1].lat,
          destinoLng: valid[valid.length - 1].lng,
          distanciaKm: dist,
          caminhaoId: caminhaoId || null,
          status: "PLANEJADA",
          pontos: valid.map((w, i) => ({
            ordem: i,
            nome: w.nome || `Ponto ${i + 1}`,
            lat: w.lat,
            lng: w.lng,
            endereco: w.endereco || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Erro ao salvar" });
        return;
      }
      setMsg({ type: "ok", text: "Rota salva no banco! Você pode criar outra para outro caminhão." });
      setNomeRota("");
      setCaminhaoId("");
      setWaypoints([emptyWp(), emptyWp()]);
      setRouteGeometry([]);
      setDistanceKm(null);
      setDurationMin(null);
      await load();
    } catch {
      setMsg({ type: "err", text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  }

  async function verRotaSalva(r: RotaSalva) {
    setSelectedRotaId(r.id);
    const pts = r.pontos
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((p) => ({ lat: p.lat, lng: p.lng }));
    setWaypoints(
      r.pontos
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
        .map((p) => ({
          key: crypto.randomUUID(),
          query: p.endereco || p.nome || "",
          nome: p.nome || "",
          lat: p.lat,
          lng: p.lng,
          endereco: p.endereco || "",
        }))
    );
    setNomeRota(r.nome);
    setCaminhaoId(r.caminhao?.id || "");
    setDistanceKm(r.distanciaKm);
    setRouting(true);
    try {
      const result = await fetchDrivingRoute(pts);
      if (result) {
        setRouteGeometry(result.geometry);
        setDistanceKm(result.distanceKm);
        setDurationMin(result.durationMin);
      }
    } finally {
      setRouting(false);
    }
  }

  async function confirmDelete(password: string) {
    if (!deleteId) return false;
    const res = await fetch(`/api/rotas/${deleteId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: password }),
    });
    if (res.ok) {
      if (selectedRotaId === deleteId) setSelectedRotaId(null);
      await load();
      return true;
    }
    return false;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rotas</h1>
          <p className="text-muted-foreground">
            Organize os pontos de entrega e defina a melhor sequência de paradas para cada caminhão.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* FORM */}
        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Nova rota
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da rota</Label>
              <Input
                value={nomeRota}
                onChange={(e) => setNomeRota(e.target.value)}
                placeholder="Ex: Entregas Zona Sul — 24/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" /> Caminhão (placa)
              </Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={caminhaoId}
                onChange={(e) => setCaminhaoId(e.target.value)}
              >
                <option value="">Sem caminhão / definir depois</option>
                {caminhoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.placa} {c.marca ? `— ${c.marca}` : ""} ({c.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Pontos (origem → paradas → destino)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addWaypoint}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Ponto
                </Button>
              </div>

              {waypoints.map((wp, idx) => (
                <div key={wp.key} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {idx === 0
                        ? "1. Origem"
                        : idx === waypoints.length - 1
                        ? `${idx + 1}. Destino`
                        : `${idx + 1}. Entrega / parada`}
                    </span>
                    {waypoints.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeWaypoint(wp.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={wp.query}
                      onChange={(e) =>
                        setWaypoints((prev) =>
                          prev.map((w, i) => (i === idx ? { ...w, query: e.target.value } : w))
                        )
                      }
                      placeholder="Bairro, rua, comércio ou -23.55,-46.63"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          doSearch(idx);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => doSearch(idx)}
                      disabled={searching && searchIdx === idx}
                    >
                      {searching && searchIdx === idx ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {wp.lat != null && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                      ✓ {wp.endereco || `${wp.lat.toFixed(4)}, ${wp.lng!.toFixed(4)}`}
                    </p>
                  )}
                  {searchIdx === idx && searchResults.length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-md border bg-background text-sm">
                      {searchResults.map((r, ri) => (
                        <button
                          key={ri}
                          type="button"
                          className="block w-full px-3 py-2 text-left hover:bg-muted border-b last:border-0"
                          onClick={() => pickResult(idx, r)}
                        >
                          {r.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(distanceKm != null || durationMin != null) && (
              <div className="rounded-lg border bg-primary/5 p-3 text-sm flex flex-wrap gap-4">
                {distanceKm != null && (
                  <div>
                    <span className="text-muted-foreground">Distância </span>
                    <strong>{distanceKm.toFixed(1)} km</strong>
                  </div>
                )}
                {durationMin != null && (
                  <div>
                    <span className="text-muted-foreground">Tempo est. </span>
                    <strong>~{Math.round(durationMin)} min</strong>
                  </div>
                )}
              </div>
            )}

            {msg && (
              <p className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-destructive"}`}>
                {msg.text}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Button type="button" variant="secondary" onClick={calcularRotaNasEstradas} disabled={routing}>
                {routing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                Calcular rota nas estradas
              </Button>
              <Button type="button" onClick={salvarRota} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Salvar rota no banco
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MAPA + LISTA */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0 h-[380px] lg:h-[420px]">
              <MapView points={mapPoints} routeGeometry={routeGeometry} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="h-4 w-4" />
                Rotas salvas ({rotas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {rotas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma rota ainda. Crie uma à esquerda — cada caminhão pode ter a sua.
                </p>
              ) : (
                rotas.map((r) => (
                  <div
                    key={r.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm cursor-pointer transition-colors ${
                      selectedRotaId === r.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                    onClick={() => verRotaSalva(r)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.caminhao ? `Placa ${r.caminhao.placa} • ` : ""}
                        {r.pontos.length} pontos
                        {r.distanciaKm != null ? ` • ${Number(r.distanciaKm).toFixed(1)} km` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{statusLabel[r.status] || r.status}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(r.id);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AdminPasswordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        title="Excluir rota"
        description="Atenção: esta ação excluirá a rota e todos os pontos relacionados. Digite a senha do administrador para confirmar."
      />
    </div>
  );
}
