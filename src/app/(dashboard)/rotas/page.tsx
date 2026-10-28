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
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  Star,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  id?: string;
  key: string;
  query: string;
  nome: string;
  lat: number | null;
  lng: number | null;
  endereco: string;
  concluido?: boolean;
};

type FavoritoEndereco = {
  id: string;
  nome: string;
  query: string;
  endereco: string;
  lat: number;
  lng: number;
  pasta: string;
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
  pontos: {
    id: string;
    ordem: number;
    nome: string | null;
    lat: number;
    lng: number;
    endereco: string | null;
    concluido: boolean;
  }[];
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
  const [refreshing, setRefreshing] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selectedRotaId, setSelectedRotaId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pontoAtualizando, setPontoAtualizando] = useState<string | null>(null);
  const [favoritos, setFavoritos] = useState<FavoritoEndereco[]>([]);
  const [favoritosCarregados, setFavoritosCarregados] = useState(false);
  const [favoritoModalOpen, setFavoritoModalOpen] = useState(false);
  const [favoritoRascunho, setFavoritoRascunho] = useState<Waypoint | null>(null);
  const [favoritoNome, setFavoritoNome] = useState("");
  const [favoritoPasta, setFavoritoPasta] = useState("Favoritos");
  const [novaPasta, setNovaPasta] = useState("");
  const [favoritoSalvando, setFavoritoSalvando] = useState(false);
  const [pastasAbertas, setPastasAbertas] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [cRes, rRes] = await Promise.all([
        fetch("/api/caminhoes", { cache: "no-store" }),
        fetch("/api/rotas", { cache: "no-store" }),
      ]);

      if (!cRes.ok || !rRes.ok) {
        throw new Error("Uma das consultas não foi concluída.");
      }

      const [caminhoesData, rotasData] = await Promise.all([
        cRes.json(),
        rRes.json(),
      ]);

      setCaminhoes(caminhoesData);
      setRotas(rotasData);
    } catch (error) {
      console.error("Erro ao atualizar Rotas:", error);
      setMsg({
        type: "err",
        text: "Não foi possível atualizar as rotas. Verifique sua conexão e tente novamente.",
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelado = false;

    async function carregarFavoritos() {
      const chaveLocal = "logisticas-bill-favoritos-enderecos";
      let locais: FavoritoEndereco[] = [];

      try {
        const salvo = window.localStorage.getItem(chaveLocal);
        if (salvo) {
          const dados: unknown = JSON.parse(salvo);

          if (Array.isArray(dados)) {
            locais = dados.filter(
              (item): item is FavoritoEndereco =>
                item !== null &&
                typeof item === "object" &&
                typeof item.id === "string" &&
                typeof item.nome === "string" &&
                typeof item.query === "string" &&
                typeof item.endereco === "string" &&
                typeof item.lat === "number" &&
                typeof item.lng === "number" &&
                Number.isFinite(item.lat) &&
                Number.isFinite(item.lng)
            );
          }
        }
      } catch (error) {
        console.error("Erro ao ler favoritos locais:", error);
      }

      try {
        const resposta = await fetch("/api/favoritos", {
          cache: "no-store",
        });

        if (!resposta.ok) {
          throw new Error("Não foi possível consultar favoritos no servidor.");
        }

        const dadosServidor: unknown = await resposta.json();
        let remotos: FavoritoEndereco[] = Array.isArray(dadosServidor)
          ? dadosServidor
          : [];

        if (remotos.length === 0 && locais.length > 0) {
          const migrados: FavoritoEndereco[] = [];

          for (const local of locais) {
            const respostaPost = await fetch("/api/favoritos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nome: local.nome,
                pasta: local.pasta || "Favoritos",
                query: local.query || local.endereco,
                endereco: local.endereco || local.query,
                lat: local.lat,
                lng: local.lng,
              }),
            });

            if (respostaPost.ok) {
              const criado: FavoritoEndereco = await respostaPost.json();
              migrados.push(criado);
            } else {
              console.error(
                "Não foi possível migrar um favorito local:",
                await respostaPost.text()
              );
            }
          }

          remotos = migrados;
        }

        if (cancelado) return;

        if (remotos.length > 0 || locais.length === 0) {
          setFavoritos(remotos);
        } else {
          // Preserva os favoritos locais caso a migração não tenha
          // conseguido salvar nenhum deles no servidor.
          setFavoritos(locais);
        }
      } catch (error) {
        console.error("Erro ao carregar favoritos do servidor:", error);

        if (!cancelado) {
          // Não descarta os favoritos locais se a API estiver indisponível.
          setFavoritos(locais);
        }
      } finally {
        if (!cancelado) {
          setFavoritosCarregados(true);
        }
      }
    }

    carregarFavoritos();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!favoritosCarregados) return;

    try {
      window.localStorage.setItem(
        "logisticas-bill-favoritos-enderecos",
        JSON.stringify(favoritos)
      );
    } catch (error) {
      console.error("Erro ao atualizar cópia local dos favoritos:", error);
    }
  }, [favoritos, favoritosCarregados]);
  useEffect(() => {
    if (searchIdx === null) return;

    const wp = waypoints[searchIdx];
    if (!wp || wp.query.trim().length < 3 || parseCoordinates(wp.query)) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const query = wp.query.trim();

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocodeSearch(query);
        if (!cancelled) setSearchResults(results);
      } catch (error) {
        console.error("Erro na pesquisa de endereÃ§o:", error);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [waypoints, searchIdx]);
  // Recalcula o trajeto automaticamente após alterações nos pontos.
  // Aguarda 800 ms para evitar várias chamadas enquanto o usuário edita.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const todosValidos =
      waypoints.length >= 2 &&
      waypoints.every(
        (w) =>
          w.lat != null &&
          w.lng != null &&
          Number.isFinite(w.lat) &&
          Number.isFinite(w.lng)
      );

    setRouting(false);

    if (!todosValidos) {
      setRouteGeometry([]);
      setDistanceKm(null);
      setDurationMin(null);
      return () => {
        cancelled = true;
      };
    }

    timer = setTimeout(async () => {
      setRouting(true);

      try {
        const points: LatLng[] = waypoints.map((w) => ({
          lat: w.lat!,
          lng: w.lng!,
        }));

        const result = await fetchDrivingRoute(points);

        if (cancelled) return;

        if (!result) {
          setRouteGeometry([]);
          setDistanceKm(null);
          setDurationMin(null);
          setMsg({
            type: "err",
            text: "Não foi possível calcular o trajeto pelas estradas. Verifique os pontos.",
          });
          return;
        }

        setRouteGeometry(result.geometry);
        setDistanceKm(result.distanceKm);
        setDurationMin(result.durationMin);
        setMsg({
          type: "ok",
          text: `Trajeto atualizado automaticamente: ${result.distanceKm.toFixed(1)} km · ~${Math.round(result.durationMin)} min`,
        });
      } catch {
        if (!cancelled) {
          setRouteGeometry([]);
          setDistanceKm(null);
          setDurationMin(null);
          setMsg({
            type: "err",
            text: "Falha ao atualizar o trajeto automaticamente. Tente novamente.",
          });
        }
      } finally {
        if (!cancelled) setRouting(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [waypoints]);
  const mapPoints = waypoints
    .filter((w) => w.lat != null && w.lng != null)
    .map((w, i) => ({
      key: w.key,
      lat: w.lat!,
      lng: w.lng!,
      label: w.nome || w.endereco || w.query,
      ordem: i + 1,
      concluido: w.concluido ?? false,
    }));

  function handlePointDrag(key: string, lat: number, lng: number) {
    setWaypoints((prev) =>
      prev.map((w) =>
        w.key === key
          ? {
              ...w,
              lat,
              lng,
              endereco: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            }
          : w
      )
    );

    setRouteGeometry([]);
    setDistanceKm(null);
    setDurationMin(null);
    setMsg({
      type: "ok",
      text: "Localização ajustada. Clique em Calcular rota e depois em Salvar rota para persistir a alteração.",
    });
  }

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


  function salvarFavorito(wp: Waypoint) {
    if (
      wp.lat == null ||
      wp.lng == null ||
      !Number.isFinite(wp.lat) ||
      !Number.isFinite(wp.lng)
    ) {
      setMsg({ type: "err", text: "Selecione um endereço no mapa antes de favoritar." });
      return;
    }

    const existente = favoritos.find(
      (f) => Math.abs(f.lat - wp.lat!) < 0.00001 &&
             Math.abs(f.lng - wp.lng!) < 0.00001
    );

    if (existente) {
      setMsg({ type: "err", text: `Este endereço já está salvo como "${existente.nome}".` });
      return;
    }

    setFavoritoRascunho(wp);
    setFavoritoNome(wp.nome || wp.endereco || wp.query);
    setFavoritoPasta("Favoritos");
    setNovaPasta("");
    setFavoritoModalOpen(true);
  }

  async function confirmarSalvarFavorito() {
    if (!favoritoRascunho) return;

    const nomeFinal = favoritoNome.trim();
    const pastaFinal = (novaPasta.trim() || favoritoPasta.trim() || "Favoritos").trim();

    if (!nomeFinal) {
      setMsg({ type: "err", text: "Informe um nome para o favorito." });
      return;
    }
    if (nomeFinal.length > 120 || pastaFinal.length > 80) {
      setMsg({ type: "err", text: "O nome do endereço ou da pasta é muito longo." });
      return;
    }

    const wp = favoritoRascunho;
    setFavoritoSalvando(true);

    try {
      const resposta = await fetch("/api/favoritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeFinal,
          pasta: pastaFinal,
          query: wp.query || wp.endereco,
          endereco: wp.endereco || wp.query,
          lat: wp.lat,
          lng: wp.lng,
        }),
      });

      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        throw new Error(dados?.error || "Não foi possível salvar o favorito.");
      }

      const favorito: FavoritoEndereco = dados;
      setFavoritos((prev) => [favorito, ...prev.filter((f) => f.id !== favorito.id)]);
      setPastasAbertas((prev) => ({ ...prev, [pastaFinal]: true }));
      setFavoritoModalOpen(false);
      setFavoritoRascunho(null);
      setMsg({ type: "ok", text: `Endereço "${nomeFinal}" salvo na pasta "${pastaFinal}".` });
    } catch (error) {
      console.error("Erro ao salvar favorito:", error);
      setMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Erro ao salvar favorito. Verifique a conexão.",
      });
    } finally {
      setFavoritoSalvando(false);
    }
  }
  async function removerFavorito(id: string) {
    try {
      const resposta = await fetch(
        `/api/favoritos/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        throw new Error(
          dados?.error || "Não foi possível remover o favorito."
        );
      }

      setFavoritos((prev) => prev.filter((f) => f.id !== id));
      setMsg({ type: "ok", text: "Favorito removido." });
    } catch (error) {
      console.error("Erro ao remover favorito:", error);
      setMsg({
        type: "err",
        text:
          error instanceof Error
            ? error.message
            : "Erro ao remover favorito.",
      });
    }
  }

  function handleMapClick(lat: number, lng: number) {
    const indiceVazio = waypoints.findIndex(
      (wp) => wp.lat == null || wp.lng == null
    );

    if (indiceVazio < 0) {
      setMsg({
        type: "err",
        text: 'Não há linha vazia. Clique em "Ponto" para criar uma parada antes de escolher outro local no mapa.',
      });
      return;
    }

    const coordenadas = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    setWaypoints((prev) =>
      prev.map((wp, i) =>
        i === indiceVazio
          ? {
              ...wp,
              query: coordenadas,
              nome: "Ponto selecionado no mapa",
              endereco: coordenadas,
              lat,
              lng,
            }
          : wp
      )
    );

    setRouteGeometry([]);
    setDistanceKm(null);
    setDurationMin(null);
    setMsg({
      type: "ok",
      text: "A linha vazia foi preenchida com o ponto selecionado.",
    });
  }
  function adicionarFavoritoNaRota(favorito: FavoritoEndereco) {
    const novoPonto: Waypoint = {
      ...emptyWp(),
      query: favorito.query || favorito.endereco,
      nome: favorito.nome,
      endereco: favorito.endereco,
      lat: favorito.lat,
      lng: favorito.lng,
    };

    // Reutiliza a primeira linha sem coordenadas, se houver.
    const indiceVazio = waypoints.findIndex(
      (wp) => wp.lat == null || wp.lng == null
    );

    if (indiceVazio >= 0) {
      setWaypoints((prev) =>
        prev.map((wp, i) =>
          i === indiceVazio
            ? { ...wp, ...novoPonto, key: wp.key }
            : wp
        )
      );
    } else {
      // Só cria uma linha quando todas as existentes já estão preenchidas.
      setWaypoints((prev) => [...prev, novoPonto]);
    }

    setRouteGeometry([]);
    setDistanceKm(null);
    setDurationMin(null);
    setMsg({
      type: "ok",
      text: `Endereço "${favorito.nome}" colocado na rota.`,
    });
  }
  function addWaypoint() {
    setWaypoints((prev) => [...prev, emptyWp()]);
  }

  function removeWaypoint(key: string) {
    setWaypoints((prev) => (prev.length <= 2 ? prev : prev.filter((w) => w.key !== key)));
  }

  function moveWaypoint(index: number, direction: -1 | 1) {
    setWaypoints((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

    setRouteGeometry([]);
    setDistanceKm(null);
    setDurationMin(null);
    setMsg({
      type: "ok",
      text: "Ordem alterada. Recalcule a rota para atualizar o percurso.",
    });
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

  async function otimizarMelhorRota() {
    const validos =
      waypoints.length >= 3 &&
      waypoints.every(
        (w) =>
          w.lat != null &&
          w.lng != null &&
          Number.isFinite(w.lat) &&
          Number.isFinite(w.lng)
      );

    if (!validos) {
      setMsg({
        type: "err",
        text: "Informe origem, destino final e pelo menos uma parada intermediária com coordenadas válidas.",
      });
      return;
    }

    setRouting(true);
    setMsg({
      type: "ok",
      text: "Comparando a distância atual com uma sequência alternativa pelas estradas...",
    });

    try {
      const response = await fetch("/api/geo/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: waypoints.map((w) => ({
            lat: w.lat,
            lng: w.lng,
          })),
        }),
      });

      const data = await response.json();

      if (
        !response.ok ||
        !Array.isArray(data.order) ||
        !Number.isFinite(data.currentDistanceKm) ||
        !Number.isFinite(data.optimizedDistanceKm) ||
        !Number.isFinite(data.savingsKm)
      ) {
        throw new Error(
          data.error || "Não foi possível comparar as distâncias rodoviárias."
        );
      }

      if (
        data.order.length !== waypoints.length ||
        new Set(data.order).size !== waypoints.length ||
        data.order.some(
          (index: number) =>
            !Number.isInteger(index) ||
            index < 0 ||
            index >= waypoints.length
        ) ||
        data.order[0] !== 0 ||
        data.order[data.order.length - 1] !== waypoints.length - 1
      ) {
        throw new Error("O serviço retornou uma sequência inválida.");
      }

      const distanciaAtual = data.currentDistanceKm as number;
      const distanciaProposta = data.optimizedDistanceKm as number;
      const economia = distanciaAtual - distanciaProposta;

      const km = (valor: number) =>
        valor.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      // Exige mais de 50 metros de economia para evitar trocas irrelevantes.
      if (economia <= 0.05) {
        setMsg({
          type: "ok",
          text:
            `Nenhuma economia relevante encontrada. ` +
            `Trajeto atual: ${km(distanciaAtual)} km; ` +
            `alternativa: ${km(distanciaProposta)} km. ` +
            "A ordem original foi mantida.",
        });
        return;
      }

      const sequencia = data.order.map(
        (index: number) => waypoints[index]
      );

      setWaypoints(sequencia);
      setRouteGeometry([]);
      setDistanceKm(null);
      setDurationMin(null);

      setMsg({
        type: "ok",
        text:
          `Sequência reorganizada! Economia rodoviária estimada: ` +
          `${km(economia)} km ` +
          `(${km(distanciaAtual)} km → ${km(distanciaProposta)} km). ` +
          "Recalculando o traçado e o tempo estimado.",
      });
    } catch (error) {
      setMsg({
        type: "err",
        text:
          error instanceof Error
            ? error.message
            : "Erro ao otimizar a rota.",
      });
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
      const res = await fetch(
        selectedRotaId ? `/api/rotas/${selectedRotaId}` : "/api/rotas",
        {
        method: selectedRotaId ? "PATCH" : "POST",
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
            ...(w.id ? { id: w.id } : {}),
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
      if (selectedRotaId) {
        setMsg({
          type: "ok",
          text: "Rota atualizada no banco com sucesso.",
        });
        await load();
      } else {
        setMsg({
          type: "ok",
          text: "Rota salva no banco! Você pode criar outra para outro caminhão.",
        });
        setNomeRota("");
        setCaminhaoId("");
        setSelectedRotaId(null);
        setWaypoints([emptyWp(), emptyWp()]);
        setRouteGeometry([]);
        setDistanceKm(null);
        setDurationMin(null);
        await load();
      }
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
          id: p.id,
          concluido: p.concluido,
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

  async function togglePontoConcluido(
    rota: RotaSalva,
    ponto: RotaSalva["pontos"][number]
  ) {
    if (pontoAtualizando) return;

    setPontoAtualizando(ponto.id);
    setMsg(null);

    try {
      const res = await fetch(
        `/api/rotas/${rota.id}/pontos/${ponto.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ concluido: !ponto.concluido }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg({
          type: "err",
          text: data.error || "Não foi possível atualizar a entrega.",
        });
        return;
      }

      const concluido = typeof data.concluido === "boolean" ? data.concluido : !ponto.concluido;
      setWaypoints((prev) =>
        prev.map((w) => w.id === ponto.id ? { ...w, concluido } : w)
      );
      await load();
    } catch {
      setMsg({
        type: "err",
        text: "Falha de conexão ao atualizar a entrega.",
      });
    } finally {
      setPontoAtualizando(null);
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
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-clip">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rotas</h1>
          <p className="text-muted-foreground">
            Organize os pontos de entrega e defina a melhor sequência de paradas para cada caminhão.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-5">
        {/* FORM */}
        <Card className="min-w-0 w-full lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Nova rota
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
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
  <div key={wp.key} className="relative flex gap-3 pb-3 last:pb-0">
    <div className="flex w-7 shrink-0 flex-col items-center">
      <div className={`z-10 flex h-7 w-7 items-center justify-center rounded-full border ${
        idx === 0
          ? "border-blue-500 bg-blue-500 text-white"
          : idx === waypoints.length - 1
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-muted-foreground/30 bg-background text-muted-foreground"
      }`}>
        {idx === 0 ? (
          <Navigation className="h-3.5 w-3.5" />
        ) : idx === waypoints.length - 1 ? (
          <MapPin className="h-3.5 w-3.5" />
        ) : (
          <Circle className="h-3 w-3" />
        )}
      </div>
      {idx < waypoints.length - 1 && (
        <div className="mt-1 min-h-8 flex-1 border-l-2 border-dotted border-muted-foreground/30" />
      )}
    </div>

    <div className="min-w-0 flex-1 space-y-2 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {idx === 0
            ? "Origem"
            : idx === waypoints.length - 1
            ? "Destino"
            : `Parada ${idx + 1}`}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
            title="Salvar endereço nos favoritos" aria-label="Salvar endereço nos favoritos"
            onClick={() => salvarFavorito(wp)}>
            <Star className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
            title="Mover ponto para cima" aria-label="Mover ponto para cima"
            disabled={idx === 0} onClick={() => moveWaypoint(idx, -1)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
            title="Mover ponto para baixo" aria-label="Mover ponto para baixo"
            disabled={idx === waypoints.length - 1} onClick={() => moveWaypoint(idx, 1)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          {waypoints.length > 2 && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              title="Remover ponto" aria-label="Remover ponto"
              onClick={() => removeWaypoint(wp.key)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-w-0 gap-2">
        <Input
          value={wp.query}
          onChange={(e) => {
            const query = e.target.value;
            setWaypoints((prev) =>
              prev.map((w, i) =>
                i === idx
                  ? { ...w, query, lat: null, lng: null, endereco: "" }
                  : w
              )
            );
            setSearchIdx(idx);
            setSearchResults([]);
          }}
          placeholder="Bairro, rua, comércio ou coordenadas"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              doSearch(idx);
            }
          }}
        />
        <Button type="button" variant="outline" size="icon"
          aria-label="Pesquisar endereço" title="Pesquisar endereço"
          onClick={() => doSearch(idx)}
          disabled={searching && searchIdx === idx}>
          {searching && searchIdx === idx
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {wp.lat != null && (
        <p className="truncate text-xs text-emerald-600 dark:text-emerald-400">
          ✓ {wp.endereco || `${wp.lat.toFixed(4)}, ${wp.lng!.toFixed(4)}`}
        </p>
      )}

      {searchIdx === idx && searchResults.length > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-md border bg-background text-sm">
          {searchResults.map((r, ri) => (
            <button key={ri} type="button"
              className="block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-muted"
              onClick={() => pickResult(idx, r)}>
              {r.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
))}
            </div>

                        {favoritos.length > 0 && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  <Label>Endereços favoritos</Label>
                  <Badge variant="secondary">{favoritos.length}</Badge>
                </div>

                <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                  {Object.entries(
                    favoritos.reduce<Record<string, FavoritoEndereco[]>>((grupos, favorito) => {
                      const pasta = favorito.pasta?.trim() || "Favoritos";
                      (grupos[pasta] ??= []).push(favorito);
                      return grupos;
                    }, {})
                  ).sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([pasta, itens]) => {
                    const aberta = pastasAbertas[pasta] ?? false;

                    return (
                      <section key={pasta} className="overflow-hidden rounded-md border">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left hover:bg-muted"
                          onClick={() => setPastasAbertas((prev) => ({ ...prev, [pasta]: !aberta }))}
                          aria-expanded={aberta}
                        >
                          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${aberta ? "" : "-rotate-90"}`} />
                          <span aria-hidden="true">📁</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{pasta}</span>
                          <Badge variant="secondary">{itens.length}</Badge>
                        </button>

                        {aberta && (
                          <div className="space-y-1 p-2">
                            {itens.map((favorito) => (
                              <div
                                key={favorito.id}
                                className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/50"
                              >
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left"
                                  title="Adicionar este endereço à rota"
                                  onClick={() => adicionarFavoritoNaRota(favorito)}
                                >
                                  <span className="block truncate text-sm font-medium">{favorito.nome}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {favorito.endereco || favorito.query}
                                  </span>
                                  <span className="text-xs text-primary">Adicionar à rota</span>
                                </button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-destructive"
                                  title="Remover dos favoritos"
                                  aria-label={`Remover ${favorito.nome} dos favoritos`}
                                  onClick={() => removerFavorito(favorito.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            )}
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
              <Button
                type="button"
                variant="secondary"
                onClick={otimizarMelhorRota}
                disabled={routing || saving}
              >
                {routing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Route className="mr-2 h-4 w-4" />
                )}
                Otimizar melhor rota
              </Button>
              <Button type="button" onClick={salvarRota} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Salvar rota no banco
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MAPA + LISTA */}
        <div className="min-w-0 w-full lg:col-span-3 space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="relative h-[300px] w-full min-w-0 p-0 sm:h-[380px] lg:h-[420px]">
              <MapView
                points={mapPoints}
                favoritePoints={favoritos.map((f) => ({ key: f.id, lat: f.lat, lng: f.lng, label: f.nome }))}
                routeGeometry={routeGeometry}
                editable={true}
                onPointDrag={handlePointDrag}
                onMapClick={handleMapClick}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="h-4 w-4" />
                Rotas salvas ({rotas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto overscroll-contain pr-2">
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

                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium">
                          Entregas concluídas: {
                            r.pontos.slice(1).filter((p) => p.concluido).length
                          } / {Math.max(0, r.pontos.length - 1)}
                        </p>

                        {r.pontos.slice(1).map((p, i) => (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 transition-colors ${p.concluido ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-transparent bg-muted/40"}`}
                          >
                            <span className={`min-w-0 truncate text-xs ${
                              p.concluido ? "text-muted-foreground line-through" : ""
                            }`}>
                              {i === r.pontos.length - 2
                                ? "Destino: "
                                : `Entrega ${i + 1}: `}
                              {p.endereco || p.nome || `Ponto ${p.ordem + 1}`}
                            </span>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-2"
                              disabled={pontoAtualizando !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                void togglePontoConcluido(r, p);
                              }}
                            >
                              {p.concluido ? (
                                <>
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                                  Reabrir
                                </>
                              ) : (
                                <>
                                  <Circle className="mr-1 h-3.5 w-3.5" />
                                  Concluir
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
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

      <Dialog open={favoritoModalOpen} onOpenChange={setFavoritoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar endereço favorito</DialogTitle>
            <DialogDescription>
              Escolha um nome e organize o endereço em uma pasta. As pastas ficam disponíveis nos seus favoritos.
            </DialogDescription>
          </DialogHeader>

          <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-clip">
            <div className="space-y-2">
              <Label htmlFor="favorito-nome">Nome do endereço</Label>
              <Input
                id="favorito-nome"
                value={favoritoNome}
                onChange={(e) => setFavoritoNome(e.target.value)}
                placeholder="Ex.: Cliente, depósito ou obra"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="favorito-pasta">Pasta de destino</Label>
              <select
                id="favorito-pasta"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={favoritoPasta}
                onChange={(e) => {
                  setFavoritoPasta(e.target.value);
                  setNovaPasta("");
                }}
              >
                {Array.from(new Set(["Favoritos", ...favoritos.map((f) => f.pasta?.trim() || "Favoritos")]))
                  .sort((a, b) => a.localeCompare(b, "pt-BR"))
                  .map((pasta) => <option key={pasta} value={pasta}>{pasta}</option>)}
                <option value="__nova__">+ Criar nova pasta...</option>
              </select>
            </div>

            {favoritoPasta === "__nova__" && (
              <div className="space-y-2">
                <Label htmlFor="favorito-nova-pasta">Nome da nova pasta</Label>
                <Input
                  id="favorito-nova-pasta"
                  value={novaPasta}
                  onChange={(e) => setNovaPasta(e.target.value)}
                  placeholder="Ex.: Clientes, Obras ou Depósitos"
                  maxLength={80}
                  autoFocus
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFavoritoModalOpen(false)}
                disabled={favoritoSalvando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmarSalvarFavorito}
                disabled={favoritoSalvando || !favoritoNome.trim() || (favoritoPasta === "__nova__" && !novaPasta.trim())}
              >
                {favoritoSalvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                Salvar favorito
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
