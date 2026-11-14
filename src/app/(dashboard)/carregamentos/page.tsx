"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { RecordListSkeleton } from "@/components/layout/PageSkeletons";
import {
  Plus,
  Pencil,
  Trash2,
  PackageCheck,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  MapPinned,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useUserAccess } from "@/components/layout/UserAccessContext";

type Caminhao = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  capacidadeKg: number | string | null;
  status: string;
};

type Funcionario = {
  id: string;
  nome: string;
  status: string;
};
type ItemForm = {
  key: string;
  id?: string;
  descricaoLivre: string;
  ordemServico: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteCidade: string;
  clienteBairro: string;
  mapaUrl: string;
  quantidade: string;
  peso: string;
  statusItem: "PENDENTE" | "CARREGADO" | "NAO_CARREGADO";
  observacao: string;
  notaFiscalNome: string;
  notaFiscalArquivo: File | null;
};

type Carregamento = {
  id: string;
  data: string;
  origem: string | null;
  destino: string | null;
  pesoTotal: number | string;
  status: string;
  observacoes: string | null;
  motoristaId?: string | null;
  ajudanteId?: string | null;
  motorista?: { id: string; nome: string } | null;
  ajudante?: { id: string; nome: string } | null;
  caminhao: { id: string; placa: string; marca?: string | null; modelo?: string | null; capacidadeKg?: number | string | null };
  itens: {
    id: string;
    quantidade: number | string;
    peso: number | string;
      statusItem: string;
      observacao: string | null;
      descricaoLivre?: string | null;
      ordemServico?: string | null;
      clienteNome?: string | null;
      clienteTelefone?: string | null;
      clienteCidade?: string | null;
      clienteBairro?: string | null;
      mapaUrl?: string | null;
      notaFiscalNome?: string | null;

  }[];
};

const statusLabel: Record<string, string> = {
  EM_ANDAMENTO: "Em andamento",
  FINALIZADO: "Liberado",
  EM_ROTA: "Em rota",
  CANCELADO: "Cancelado",
  NAO_CARREGADO: "Não carregado",
};

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  EM_ANDAMENTO: "default",
  FINALIZADO: "success",
  EM_ROTA: "warning",
  CANCELADO: "destructive",
  NAO_CARREGADO: "warning",
};

const itemStatusLabel: Record<string, string> = {
  PENDENTE: "Pendente",
  CARREGADO: "Carregado",
  NAO_CARREGADO: "Não carregou",
};

function todayISO() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function brazilDateInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function num(v: number | string | null | undefined) {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) || 0 : v;
}

export default function CarregamentosPage() {
  const { can } = useUserAccess();
  const podeCriar = can("carregamentos.criar");
  const podeEditar = can("carregamentos.editar");
  const podeExcluir = can("carregamentos.excluir");
  const podeAlterarStatus = can("carregamentos.alterarStatus");
  const podeVerCliente = can("carregamentos.detalhesCliente");
  const podeRotaCompleta = can("carregamentos.rotaCompleta");
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [lista, setLista] = useState<Carregamento[]>([]);
  const [carregamentosPendentes, setCarregamentosPendentes] = useState<Set<string>>(new Set());
  const carregamentosEmAtualizacao = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroData, setFiltroData] = useState(todayISO());
  const [busca, setBusca] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [rotaAbertaId, setRotaAbertaId] = useState<string | null>(null);
  const [avisoPeso, setAvisoPeso] = useState<{
    pesoCarregado: number;
    capacidadeKg: number;
    placa: string;
  } | null>(null);

  useEffect(() => {
    if (!avisoPeso) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAvisoPeso(null);
    }

    window.addEventListener("keydown", fecharComEscape);
    return () => {
      window.removeEventListener("keydown", fecharComEscape);
      document.body.style.overflow = overflowAnterior;
    };
  }, [avisoPeso]);

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [caminhaoId, setCaminhaoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [ajudanteId, setAjudanteId] = useState("");
  const [data, setData] = useState(todayISO());
  const [horaProgramada, setHoraProgramada] = useState("08:00");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [status, setStatus] = useState<"EM_ANDAMENTO" | "FINALIZADO" | "EM_ROTA" | "CANCELADO" | "NAO_CARREGADO">("EM_ANDAMENTO");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([
    { key: crypto.randomUUID(), descricaoLivre: "", ordemServico: "", clienteNome: "", clienteTelefone: "", clienteCidade: "", clienteBairro: "", mapaUrl: "", quantidade: "", peso: "", statusItem: "PENDENTE", observacao: "", notaFiscalNome: "", notaFiscalArquivo: null },
  ]);

  const caminhaoSel = useMemo(
    () => caminhoes.find((c) => c.id === caminhaoId),
    [caminhoes, caminhaoId]
  );

  const pesoTotal = useMemo(
    () => itens.reduce((acc, i) => acc + (parseFloat(i.peso) || 0), 0),
    [itens]
  );

  const capacidade = num(caminhaoSel?.capacidadeKg);
  const percentual = capacidade > 0 ? (pesoTotal / capacidade) * 100 : 0;

  const loadBase = useCallback(async () => {
    try {
      const [cRes, fRes] = await Promise.all([
        fetch("/api/caminhoes"),
        fetch("/api/funcionarios"),
      ]);
      if (cRes.ok) setCaminhoes(await cRes.json());
      if (fRes.ok) {
        const dadosFuncionarios: Funcionario[] = await fRes.json();
        setFuncionarios(dadosFuncionarios.filter((f) => f.status === "ATIVO"));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadLista = useCallback(async () => {
    setLoading(true);
    try {
      const q = filtroData ? `?data=${filtroData}` : "";
      const res = await fetch(`/api/carregamentos${q}`);
      if (res.ok) setLista(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [filtroData]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    loadLista();
  }, [loadLista]);
  useEffect(() => {
    const onDataChanged = (event: Event) => {
      const modules = (event as CustomEvent<{ modules?: string[] }>).detail?.modules ?? [];
      if (modules.includes("carregamentos")) void loadLista();
      if (modules.some((module) => ["caminhoes", "funcionarios"].includes(module))) void loadBase();
    };

    window.addEventListener("logistica:data-changed", onDataChanged);
    return () => window.removeEventListener("logistica:data-changed", onDataChanged);
  }, [loadBase, loadLista]);

  function addItem() {
    setItens((prev) => [
      {
        key: crypto.randomUUID(),
        descricaoLivre: "",
        ordemServico: "",
        clienteNome: "",
        clienteTelefone: "",
        clienteCidade: "",
        clienteBairro: "",
        mapaUrl: "",
        notaFiscalNome: "",
        notaFiscalArquivo: null,
        quantidade: "",
        peso: "",
        statusItem: "PENDENTE",
        observacao: "",
      },
      ...prev,
    ]);
  }
  function removeItem(key: string) {
    setItens((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.key !== key)));
  }

  function updateItem(key: string, patch: Partial<ItemForm>) {
    setItens((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const next = { ...i, ...patch };
        return next;
      })
    );
  }

  function handleNotaFiscal(key: string, file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setMsg({ type: "err", text: "A nota fiscal deve estar no formato PDF." });
      return;
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setMsg({ type: "err", text: "O PDF deve ter entre 1 byte e 10 MB." });
      return;
    }
    updateItem(key, { notaFiscalNome: file.name, notaFiscalArquivo: file });
  }

  function startEdit(carreg: Carregamento) {
    if (!podeEditar) {
      setMsg({ type: "err", text: "Você não tem permissão para editar carregamentos." });
      return;
    }
    setEditingId(carreg.id);
    setCaminhaoId(carreg.caminhao.id);
    setMotoristaId(carreg.motoristaId ?? carreg.motorista?.id ?? "");
    setAjudanteId(carreg.ajudanteId ?? carreg.ajudante?.id ?? "");
    setData(brazilDateInput(carreg.data));
    setHoraProgramada(new Date(carreg.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    setOrigem(carreg.origem ?? "");
    setDestino(carreg.destino ?? "");
    setStatus(
      carreg.status as "EM_ANDAMENTO" | "FINALIZADO" | "EM_ROTA" | "CANCELADO" | "NAO_CARREGADO"
    );
    setObservacoes(carreg.observacoes ?? "");
    setItens(
      carreg.itens.map((item) => ({
        key: item.id,
        id: item.id,
        descricaoLivre: item.descricaoLivre || "",
        ordemServico: item.ordemServico || "",
        clienteNome: item.clienteNome || "",
        clienteTelefone: item.clienteTelefone || "",
        clienteCidade: item.clienteCidade || "",
        clienteBairro: item.clienteBairro || "",
        mapaUrl: item.mapaUrl || "",
        notaFiscalNome: item.notaFiscalNome || "",
        notaFiscalArquivo: null,
        quantidade: String(num(item.quantidade)),
        peso: String(num(item.peso)),
        statusItem: item.statusItem as ItemForm["statusItem"],
        observacao: item.observacao ?? "",
      }))
    );
    setMsg(null);
    document.getElementById("form-carregamento")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("editar");
    if (!id) return;
    const carregamentoId = id;

    let cancelado = false;

    async function abrirCarregamento() {
      try {
        const res = await fetch(
          `/api/carregamentos/${encodeURIComponent(carregamentoId)}`
        );

        if (!res.ok) {
          if (!cancelado) {
            setMsg({
              type: "err",
              text: "Não foi possível localizar o carregamento deste alerta.",
            });
          }
          return;
        }

        const carregamento = await res.json() as Carregamento;

        if (cancelado) return;

        startEdit(carregamento);

        const url = new URL(window.location.href);
        url.searchParams.delete("editar");
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${url.search}${url.hash}`
        );
      } catch {
        if (!cancelado) {
          setMsg({
            type: "err",
            text: "Erro ao abrir o carregamento. Tente novamente.",
          });
        }
      }
    }

    abrirCarregamento();

    return () => {
      cancelado = true;
    };
  }, [loadBase]);
  function cancelEdit() {
    setEditingId(null);
    setCaminhaoId("");
    setMotoristaId("");
    setAjudanteId("");
    setData(todayISO());
    setHoraProgramada("08:00");
    setOrigem("");
    setDestino("");
    setStatus("EM_ANDAMENTO");
    setObservacoes("");
    setItens([
      { key: crypto.randomUUID(), descricaoLivre: "", ordemServico: "", clienteNome: "", clienteTelefone: "", clienteCidade: "", clienteBairro: "", mapaUrl: "", quantidade: "", peso: "", statusItem: "PENDENTE", observacao: "", notaFiscalNome: "", notaFiscalArquivo: null },
    ]);
    setMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!caminhaoId) {
      setMsg({ type: "err", text: "Selecione o caminhão (placa)." });
      return;
    }

    const validItens = itens.filter(
      (item) => item.descricaoLivre.trim() && parseFloat(item.quantidade) > 0
    );

    if (validItens.length === 0) {
      setMsg({ type: "err", text: "Adicione pelo menos um item com descrição e quantidade." });
      return;
    }

    for (const item of validItens) {
      if (!Number.isFinite(Number(item.peso)) || Number(item.peso) < 0) {
        setMsg({ type: "err", text: "Confira o peso de todos os itens." });
        return;
      }
    }

    setSaving(true);
    try {
      const editando = Boolean(editingId);
      const payloadItens = validItens.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        descricaoLivre: item.descricaoLivre || null,
        ordemServico: item.ordemServico || null,
        clienteNome: item.clienteNome || null,
        clienteTelefone: item.clienteTelefone || null,
        clienteCidade: item.clienteCidade || null,
        clienteBairro: item.clienteBairro || null,
        mapaUrl: item.mapaUrl || null,
        quantidade: parseFloat(item.quantidade),
        peso: parseFloat(item.peso) || 0,
        statusItem: item.statusItem,
        observacao: item.observacao || null,
      }));

      const res = await fetch(
        editando ? `/api/carregamentos/${editingId}` : "/api/carregamentos",
        {
          method: editando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
              editando
              ? {
                  origem: origem || null,
                  destino: destino || null,
                  ...(podeAlterarStatus ? { status } : {}),
                  observacoes: observacoes || null,
                  motoristaId: motoristaId || null,
                  ajudanteId: ajudanteId || null,
                  itens: payloadItens,
                }
              : {
                  caminhaoId,
                  data,
                  horaProgramada,
                  origem: origem || null,
                  destino: destino || null,
                  status,
                  observacoes: observacoes || null,
                  motoristaId: motoristaId || null,
                  ajudanteId: ajudanteId || null,
                  itens: payloadItens,
                }
          ),
        }
      );

      const dataRes = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: dataRes.error || "Erro ao salvar carregamento." });
        return;
      }

      const cargaId = editando ? editingId : dataRes.id;
      const itensSalvos = dataRes.itens;
      if (!cargaId || !Array.isArray(itensSalvos) || itensSalvos.length !== validItens.length) { if (cargaId) setEditingId(cargaId); setMsg({ type: "err", text: "Carga salva, mas não foi possível identificar os itens para anexar os PDFs." }); return; }
      for (let n = 0; n < validItens.length; n++) {
        const arquivo = validItens[n].notaFiscalArquivo;
        if (!arquivo) continue;
        const fd = new FormData(); fd.append("file", arquivo);
        const up = await fetch(`/api/carregamentos/${cargaId}/itens/${itensSalvos[n].id}/nota-fiscal`, { method: "POST", body: fd });
        if (!up.ok) { const erro = await up.json().catch(() => ({})); setEditingId(cargaId); setMsg({ type: "err", text: erro.error || "Carga salva, mas falhou o envio do PDF." }); return; }
      }
      if (dataRes.avisoExcessoPeso && dataRes.excessoPeso) {
        setAvisoPeso(dataRes.excessoPeso);
      }

      setMsg({
        type: "ok",
        text: editando
          ? "Carregamento atualizado com sucesso!"
          : "Carregamento salvo no banco com sucesso!",
      });

      setEditingId(null);
      setCaminhaoId("");
    setMotoristaId("");
    setAjudanteId("");
      setData(todayISO());
      setHoraProgramada("08:00");
      setOrigem("");
      setDestino("");
      setStatus("EM_ANDAMENTO");
      setObservacoes("");
      setItens([
        { key: crypto.randomUUID(), descricaoLivre: "", ordemServico: "", clienteNome: "", clienteTelefone: "", clienteCidade: "", clienteBairro: "", mapaUrl: "", quantidade: "", peso: "", statusItem: "PENDENTE", observacao: "", notaFiscalNome: "", notaFiscalArquivo: null },
      ]);

      await loadLista();
    } catch {
      setMsg({ type: "err", text: "Erro de conexão ao salvar carregamento." });
    } finally {
      setSaving(false);
    }
  }
  async function toggleItemStatus(carregId: string, itemId: string, novo: "CARREGADO" | "NAO_CARREGADO" | "PENDENTE") {
    const carreg = lista.find((c) => c.id === carregId);
    if (!carreg) {
      alert("Carregamento não encontrado na lista. Atualize a página.");
      return;
    }

    if (carregamentosEmAtualizacao.current.has(carregId)) return;

    carregamentosEmAtualizacao.current.add(carregId);
    setCarregamentosPendentes((prev) => new Set(prev).add(carregId));


    setLista((prev) =>
      prev.map((c) =>
        c.id !== carregId
          ? c
          : {
              ...c,

              itens: c.itens.map((item) =>
                item.id === itemId ? { ...item, statusItem: novo } : item
              ),
            }
      )
    );

    try {
      const res = await fetch(`/api/carregamentos/${carregId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemStatus: { itemId, statusItem: novo },
        }),
      });

      const resultado = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLista((prev) =>
          prev.map((c) => c.id === carregId ? carreg : c)
        );
        alert(resultado.error || `Não foi possível atualizar o item (HTTP ${res.status}).`);
        return;
      }

      if (novo === "CARREGADO" && resultado.avisoExcessoPeso) {
        setAvisoPeso(resultado.detalhesExcessoPeso ?? null);
      }
    } catch (erro) {
      console.error("Erro ao alterar status do item:", erro);

      setLista((prev) =>
        prev.map((c) => c.id === carregId ? carreg : c)
      );

      alert("Erro de conexao ao atualizar o item. A alteracao visual foi revertida.");
    } finally {
      carregamentosEmAtualizacao.current.delete(carregId);
      setCarregamentosPendentes((prev) => {
        const next = new Set(prev);
        next.delete(carregId);
        return next;
      });
    }
  }

  async function setCarregStatus(carregId: string, novoStatus: string) {
    const carreg = lista.find((c) => c.id === carregId);
    if (!carreg || carregamentosEmAtualizacao.current.has(carregId)) return;

    carregamentosEmAtualizacao.current.add(carregId);
    setCarregamentosPendentes((prev) => new Set(prev).add(carregId));

    setLista((prev) =>
      prev.map((c) => c.id === carregId ? { ...c, status: novoStatus } : c)
    );

    try {
      const res = await fetch(`/api/carregamentos/${carregId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });

      const resultado = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLista((prev) =>
          prev.map((c) => c.id === carregId ? carreg : c)
        );
        alert(resultado.error || `Não foi possível alterar o status (${res.status}).`);
        return;
      }
    } catch (erro) {
      console.error("Erro ao atualizar status do carregamento:", erro);

      setLista((prev) =>
        prev.map((c) => c.id === carregId ? carreg : c)
      );

      alert("Erro de conexao ao atualizar o carregamento. A alteracao visual foi revertida.");
    } finally {
      carregamentosEmAtualizacao.current.delete(carregId);
      setCarregamentosPendentes((prev) => {
        const next = new Set(prev);
        next.delete(carregId);
        return next;
      });
    }
  }
  async function confirmDelete(password: string) {
    if (!deleteId) return false;
    const res = await fetch(`/api/carregamentos/${deleteId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword: password }),
    });
    if (res.ok) {
      await loadLista();
      return true;
    }
    return false;
  }

  function textoParada(item: Carregamento["itens"][number]) {
    return [item.clienteNome, item.clienteBairro, item.clienteCidade].filter(Boolean).join(", ") || item.mapaUrl || "Destino do cliente";
  }

  function abrirRotaCompleta(carregamento: Carregamento, modo: "todas" | "uma") {
    const paradas = carregamento.itens.map(textoParada).filter(Boolean);
    if (!paradas.length) {
      setMsg({ type: "err", text: "Adicione cidade, bairro ou link do mapa para montar a rota." });
      return;
    }
    if (modo === "uma") {
      paradas.forEach((parada, index) => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parada)}`, `rota-${carregamento.id}-${index}`));
    } else {
      const origin = paradas[0];
      const destination = paradas[paradas.length - 1];
      const waypoints = paradas.slice(1, -1).join("|");
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}`;
      window.open(url, "rota-completa");
    }
    setRotaAbertaId(null);
  }

  const listaFiltrada = useMemo(() => lista.filter((c) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      c.caminhao.placa.toLowerCase().includes(q) ||
      (c.origem || "").toLowerCase().includes(q) ||
      (c.destino || "").toLowerCase().includes(q) ||
      c.itens.some((i) => (i.descricaoLivre || "").toLowerCase().includes(q))
    );
  }), [lista, busca]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carregamentos</h1>
          <p className="text-muted-foreground">
            Monte o que cada caminhão vai carregar — descrição, peso, clientes, origem, destino e status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadLista(); loadBase(); }}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <ScreenAssembly className="grid items-start gap-6 lg:grid-cols-5" itemClassNames={["lg:col-span-2", "lg:col-span-3"]}>
        {/* FORMULÁRIO */}
        {(podeCriar || (editingId !== null && podeEditar)) && <Card id="form-carregamento" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              {editingId ? "Editar carregamento" : "Novo carregamento do dia"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Caminhão (placa) *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100 px-3 py-1 text-sm"
                  value={caminhaoId}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setCaminhaoId(e.target.value)}
                  required
                >
                  <option value="" className="bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100">Selecione a placa...</option>
                  {caminhoes.map((c) => (
                    <option key={c.id} value={c.id} className="bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100">
                      {c.placa} {c.marca ? `— ${c.marca} ${c.modelo || ""}` : ""} ({c.status})
                    </option>
                  ))}
                </select>
                {caminhaoSel && capacidade > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Capacidade: {(capacidade / 1000).toFixed(1)} t
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Motorista</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100 px-3 py-1 text-sm" value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)}>
                    <option value="">Sem motorista</option>
                    {funcionarios.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Ajudante</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100 px-3 py-1 text-sm" value={ajudanteId} onChange={(e) => setAjudanteId(e.target.value)}>
                    <option value="">Sem ajudante</option>
                    {funcionarios.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required disabled={Boolean(editingId)} />
                </div>
                <div className="space-y-2">
                  <Label>Horário programado *</Label>
                  <Input type="time" value={horaProgramada} onChange={(e) => setHoraProgramada(e.target.value)} required disabled={Boolean(editingId)} />
                </div>
                <div className="space-y-2">
                  <Label>Status geral</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                    disabled={!podeAlterarStatus}
                  >
                    <option value="EM_ANDAMENTO">Em andamento</option>
                    <option value="FINALIZADO">Liberado</option>
                    <option value="EM_ROTA">Em rota</option>
                    <option value="NAO_CARREGADO">Não carregou</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex: Tubarão SC" />
                </div>
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex: Cliente RJ" />
                </div>
              </div>

              {/* Totais */}
              <div className="rounded-lg border bg-primary/5 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Peso total</span>
                  <span className="font-bold">
                    {pesoTotal.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg
                    {pesoTotal >= 1000 ? ` (${(pesoTotal / 1000).toFixed(2)} t)` : ""}
                  </span>
                </div>
                {capacidade > 0 && (
                  <>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          percentual > 100 ? "bg-red-600" : percentual > 90 ? "bg-amber-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(percentual, 100)}%` }}
                      />
                    </div>
                    <p className={`text-xs ${percentual > 100 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {percentual.toFixed(1)}% da capacidade
                      {percentual > 100 && " — ACIMA DO LIMITE!"}
                    </p>
                  </>
                )}
              </div>

              {/* ITENS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Itens da carga *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={editingId ? !podeEditar : !podeCriar}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Item
                  </Button>
                </div>

                {[...itens].map((item, idx) => (
                  <div key={item.key} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                      {itens.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.key)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <Input value={item.descricaoLivre} onChange={(e) => updateItem(item.key, { descricaoLivre: e.target.value })} placeholder="Descrição da carga (ex.: 1 Mono 1cx 7m ae)" required />
                    {podeVerCliente && <div className="grid grid-cols-2 gap-2">
                      <Input value={item.ordemServico} onChange={(e) => updateItem(item.key, { ordemServico: e.target.value })} placeholder="Nº da ordem de serviço *" required />
                      <Input value={item.clienteNome} onChange={(e) => updateItem(item.key, { clienteNome: e.target.value })} placeholder="Nome do cliente *" required />
                      <Input value={item.clienteTelefone} onChange={(e) => updateItem(item.key, { clienteTelefone: e.target.value })} placeholder="Telefone / WhatsApp *" required />
                      <Input value={item.clienteCidade} onChange={(e) => updateItem(item.key, { clienteCidade: e.target.value })} placeholder="Cidade *" required />
                      <Input value={item.clienteBairro} onChange={(e) => updateItem(item.key, { clienteBairro: e.target.value })} placeholder="Bairro" />
                      <Input type="url" value={item.mapaUrl} onChange={(e) => updateItem(item.key, { mapaUrl: e.target.value })} placeholder="Link do Google Maps" />
                    </div>}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.quantidade}
                          onChange={(e) => updateItem(item.key, { quantidade: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Peso (kg)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={item.peso === "" ? "" : Number(item.peso).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                          onChange={(e) => {
                            const valor = e.target.value.replace(/\./g, "").replace(",", ".");
                            if (valor === "" || /^\d*\.?\d{0,3}$/.test(valor)) {
                              updateItem(item.key, { peso: valor });
                            }
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Status</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                          value={item.statusItem}
                          disabled={!podeAlterarStatus}
                          onChange={(e) =>
                            updateItem(item.key, {
                              statusItem: e.target.value as ItemForm["statusItem"],
                            })
                          }
                        >
                          <option value="PENDENTE">Pendente</option>
                          <option value="CARREGADO">Carregou</option>
                          <option value="NAO_CARREGADO">Não carregou</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nota fiscal em PDF (opcional)</Label>
                      <Input type="file" accept="application/pdf,.pdf" onChange={(e) => handleNotaFiscal(item.key, e.target.files?.[0])} className="text-xs" />
                      {item.notaFiscalNome && <p className="truncate text-xs text-muted-foreground">Anexo: {item.notaFiscalNome}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Observação do item</Label>
                      <Input
                        value={item.observacao}
                        onChange={(e) => updateItem(item.key, { observacao: e.target.value })}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
              </div>

              {msg && (
                <p className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-destructive"}`}>
                  {msg.text}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PackageCheck className="mr-2 h-4 w-4" />
                {editingId ? "Salvar alterações" : "Salvar no banco"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" className="w-full" onClick={cancelEdit} disabled={saving}>
                  Cancelar edição
                </Button>
              )}
            </form>
          </CardContent>
        </Card>}

        {/* LISTA / PRÉ-VISUALIZAÇÃO */}
        <Card className="lg:col-span-3">
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Carregamentos do dia</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="sm:w-40"
              />
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar placa, origem, destino ou item..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && lista.length === 0 ? (
              <RecordListSkeleton rows={3} />
            ) : listaFiltrada.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Nenhum carregamento nesta data. Monte uma a esquerda e salve.
              </div>
            ) : (
              <div className="space-y-4">
                {listaFiltrada.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-xl border p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-lg">{c.caminhao.placa}{c.motorista?.nome && <span className="ml-2 font-sans text-sm font-medium text-muted-foreground">• {c.motorista.nome}</span>}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(c.data)}
                          {c.origem || c.destino
                            ? ` • ${c.origem || "?"} → ${c.destino || "?"}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant[c.status] || "secondary"}>
                          {statusLabel[c.status] || c.status}
                        </Badge>
                        <span className="text-sm font-semibold">
                          {num(c.pesoTotal).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {c.itens.map((it) => (
                        <div
                          key={it.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">{it.descricaoLivre || "Carga"}</p>
                            {podeVerCliente && <>
                            {it.clienteNome && <p className="text-xs text-muted-foreground">Cliente: {it.clienteNome}</p>}
                            {it.clienteCidade && <p className="text-xs text-muted-foreground">Cidade: {it.clienteCidade}</p>}
                            {it.clienteBairro && <p className="text-xs text-muted-foreground">Bairro: {it.clienteBairro}</p>}
                            {it.ordemServico && <p className="text-xs text-muted-foreground">OS: {it.ordemServico}</p>}
                            {it.observacao?.trim() && <p className="text-xs text-muted-foreground">Observação: {it.observacao}</p>}
                            <p className="text-xs text-muted-foreground">Peso: {num(it.peso).toLocaleString("pt-BR")} kg</p>
                            {it.notaFiscalNome && <a className="block max-w-[280px] truncate text-xs text-violet-600 underline" href={`/api/carregamentos/${c.id}/itens/${it.id}/nota-fiscal`} download={it.notaFiscalNome} target="_blank" rel="noreferrer">Nota fiscal: {it.notaFiscalNome}</a>}
                            <div className="mt-1 flex flex-wrap gap-2 text-xs">{it.clienteTelefone && <a className="text-green-600 underline" href={`https://wa.me/55${it.clienteTelefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}{(it.mapaUrl || textoParada(it)) && <><a className="text-blue-600 underline" href={it.mapaUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(textoParada(it))}`} target="_blank" rel="noreferrer">Google Maps</a><a className="text-indigo-600 underline" href={`https://www.waze.com/ul?q=${encodeURIComponent(textoParada(it))}&navigate=yes`} target="_blank" rel="noreferrer">Waze</a></>}</div></>}
                          </div>
                          {podeAlterarStatus && <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={it.statusItem === "CARREGADO" ? "h-7 text-xs border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white" : "h-7 text-xs border-green-600/50 text-green-700 hover:bg-green-50 dark:border-green-500/50 dark:text-green-400 dark:hover:bg-green-950"}
                              disabled={carregamentosPendentes.has(c.id)}
                              onClick={() => toggleItemStatus(c.id, it.id, "CARREGADO")}
                              title="Marcar como carregado"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Carregou
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={it.statusItem === "NAO_CARREGADO" ? "h-7 text-xs border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white" : "h-7 text-xs border-red-600/50 text-red-700 hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-950"}
                              disabled={carregamentosPendentes.has(c.id)}
                              onClick={() => toggleItemStatus(c.id, it.id, "NAO_CARREGADO")}
                              title="Marcar como não carregou"
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Não
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={it.statusItem === "PENDENTE" ? "h-7 text-xs border-amber-600 bg-amber-500 text-white hover:bg-amber-600 hover:text-white" : "h-7 text-xs border-amber-600/50 text-amber-700 hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-400 dark:hover:bg-amber-950"}
                              disabled={carregamentosPendentes.has(c.id)}
                              onClick={() => toggleItemStatus(c.id, it.id, "PENDENTE")}
                            >
                              <Clock className="mr-1 h-3 w-3" />
                              Pendente
                            </Button>
                          </div>}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {podeRotaCompleta && <div className="relative">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setRotaAbertaId(rotaAbertaId === c.id ? null : c.id)}>
                          <MapPinned className="mr-1 h-3.5 w-3.5" /> Rota completa
                        </Button>
                        {rotaAbertaId === c.id && <div className="absolute left-0 top-9 z-20 w-56 rounded-md border bg-background p-2 shadow-lg"><Button type="button" variant="ghost" className="h-8 w-full justify-start text-xs" onClick={() => abrirRotaCompleta(c, "todas")}>Abrir todas as paradas</Button><Button type="button" variant="ghost" className="h-8 w-full justify-start text-xs" onClick={() => abrirRotaCompleta(c, "uma")}>Abrir uma por uma</Button></div>}
                      </div>}
                      {podeEditar && <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                                                 disabled={carregamentosPendentes.has(c.id)}
                         onClick={() => startEdit(c)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>}
                      {podeAlterarStatus && <>
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={carregamentosPendentes.has(c.id)} onClick={() => setCarregStatus(c.id, "EM_ANDAMENTO")}>
                        Em andamento
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={carregamentosPendentes.has(c.id)} onClick={() => setCarregStatus(c.id, "FINALIZADO")}>
                        Liberado
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={carregamentosPendentes.has(c.id)} onClick={() => setCarregStatus(c.id, "EM_ROTA")}>
                        Em rota
                      </Button>
                      </>}
                      {podeExcluir && <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-destructive ml-auto"
                        onClick={() => {
                          setDeleteId(c.id);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ScreenAssembly>

      {avisoPeso && typeof document !== "undefined" && createPortal((
        <div
          className="fixed inset-0 z-[9999] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setAvisoPeso(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-aviso-peso"
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="titulo-aviso-peso" className="text-lg font-bold">
                    Atenção: excesso de peso
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O item foi carregado com sucesso, mas o limite de peso foi ultrapassado.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Fechar aviso"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  onClick={() => setAvisoPeso(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Caminhão</p>
                <p className="font-semibold">{avisoPeso.placa}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
                  <p className="text-xs text-muted-foreground">Peso carregado</p>
                  <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">
                    {avisoPeso.pesoCarregado.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
                  </p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Capacidade máxima</p>
                  <p className="mt-1 text-lg font-bold">
                    {avisoPeso.capacidadeKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-amber-500/40 p-3">
                <p className="text-sm text-muted-foreground">Excesso de peso</p>
                <p className="text-xl font-bold text-amber-600">
                  {(avisoPeso.pesoCarregado - avisoPeso.capacidadeKg).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
                </p>
              </div>

              <div className="mt-4 text-sm text-muted-foreground">
                Verifique a carga e a capacidade do caminhão antes de continuar a operação.
              </div>

              <Button
                type="button"
                className="mt-6 w-full bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => setAvisoPeso(null)}
              >
                Entendi, fechar
              </Button>
            </div>
          </div>
        </div>
      ), document.body)}

      <AdminPasswordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        title="Excluir carregamento"
        description="Atenção: esta ação excluirá o carregamento e todos os itens relacionados. Digite a senha do administrador para confirmar."
      />
    </div>
  );
}





