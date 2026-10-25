"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  PackageCheck,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";
import { formatDate, formatDateTime } from "@/lib/utils";

type Caminhao = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  capacidadeKg: number | string | null;
  status: string;
};

type Produto = {
  id: string;
  codigo: string;
  nome: string;
  unidade: string;
  pesoUnitario: number | string | null;
};

type ItemForm = {
  key: string;
  produtoId: string;
  quantidade: string;
  peso: string;
  statusItem: "PENDENTE" | "CARREGADO" | "NAO_CARREGADO";
  observacao: string;
};

type Carregamento = {
  id: string;
  data: string;
  origem: string | null;
  destino: string | null;
  pesoTotal: number | string;
  status: string;
  observacoes: string | null;
  caminhao: { id: string; placa: string; marca?: string | null; modelo?: string | null; capacidadeKg?: number | string | null };
  itens: {
    id: string;
    quantidade: number | string;
    peso: number | string;
    statusItem: string;
    observacao: string | null;
    produto: { id: string; codigo: string; nome: string; unidade: string };
  }[];
};

const statusLabel: Record<string, string> = {
  EM_ANDAMENTO: "Em andamento",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
  NAO_CARREGADO: "Não carregado",
};

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  EM_ANDAMENTO: "default",
  FINALIZADO: "success",
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
  return d.toISOString().slice(0, 10);
}

function num(v: number | string | null | undefined) {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) || 0 : v;
}

export default function CarregamentosPage() {
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [lista, setLista] = useState<Carregamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroData, setFiltroData] = useState(todayISO());
  const [busca, setBusca] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // form
  const [caminhaoId, setCaminhaoId] = useState("");
  const [data, setData] = useState(todayISO());
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [status, setStatus] = useState<"EM_ANDAMENTO" | "FINALIZADO" | "CANCELADO" | "NAO_CARREGADO">("EM_ANDAMENTO");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([
    { key: crypto.randomUUID(), produtoId: "", quantidade: "", peso: "", statusItem: "PENDENTE", observacao: "" },
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
      const [cRes, pRes] = await Promise.all([
        fetch("/api/caminhoes"),
        fetch("/api/produtos"),
      ]);
      if (cRes.ok) setCaminhoes(await cRes.json());
      if (pRes.ok) setProdutos(await pRes.json());
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

  function addItem() {
    setItens((prev) => [
      {
        key: crypto.randomUUID(),
        produtoId: "",
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
        // auto-calcula peso se mudou produto ou quantidade
        if (patch.produtoId !== undefined || patch.quantidade !== undefined) {
          const prod = produtos.find((p) => p.id === (patch.produtoId ?? i.produtoId));
          const qtd = parseFloat(patch.quantidade ?? i.quantidade) || 0;
          const pu = num(prod?.pesoUnitario);
          if (pu > 0 && qtd > 0) {
            next.peso = (pu * qtd).toFixed(3);
          }
        }
        return next;
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!caminhaoId) {
      setMsg({ type: "err", text: "Selecione o caminhão (placa)." });
      return;
    }
    const validItens = itens.filter((i) => i.produtoId && parseFloat(i.quantidade) > 0);
    if (validItens.length === 0) {
      setMsg({ type: "err", text: "Adicione pelo menos um produto com quantidade." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/carregamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caminhaoId,
          data,
          origem: origem || null,
          destino: destino || null,
          status,
          observacoes: observacoes || null,
          itens: validItens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: parseFloat(i.quantidade),
            peso: parseFloat(i.peso) || 0,
            statusItem: i.statusItem,
            observacao: i.observacao || null,
          })),
        }),
      });
      const dataRes = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: dataRes.error || "Erro ao salvar" });
        return;
      }
      setMsg({ type: "ok", text: "Carregamento salvo no banco com sucesso!" });
      // reset parcial
      setItens([
        { key: crypto.randomUUID(), produtoId: "", quantidade: "", peso: "", statusItem: "PENDENTE", observacao: "" },
      ]);
      setObservacoes("");
      await loadLista();
      await loadBase();
    } catch {
      setMsg({ type: "err", text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleItemStatus(carregId: string, itemId: string, novo: "CARREGADO" | "NAO_CARREGADO" | "PENDENTE") {
    const carreg = lista.find((c) => c.id === carregId);
    if (!carreg) return;

    const novosItens = carreg.itens.map((it) =>
      it.id === itemId
        ? {
            id: it.id,
            produtoId: it.produto.id,
            quantidade: num(it.quantidade),
            peso: num(it.peso),
            statusItem: novo,
            observacao: it.observacao,
          }
        : {
            id: it.id,
            produtoId: it.produto.id,
            quantidade: num(it.quantidade),
            peso: num(it.peso),
            statusItem: it.statusItem as "PENDENTE" | "CARREGADO" | "NAO_CARREGADO",
            observacao: it.observacao,
          }
    );

    const res = await fetch(`/api/carregamentos/${carregId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: novosItens }),
    });
    if (res.ok) await loadLista();
  }

  async function setCarregStatus(carregId: string, novoStatus: string) {
    try {
      const res = await fetch(`/api/carregamentos/${carregId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });

      const resultado = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(resultado.error || `Não foi possível alterar o status (${res.status}).`);
        await loadLista();
        await loadBase();
        return;
      }

      await loadLista();
      await loadBase();
    } catch {
      alert("Erro de conexão ao atualizar o carregamento.");
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

  const listaFiltrada = lista.filter((c) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      c.caminhao.placa.toLowerCase().includes(q) ||
      (c.origem || "").toLowerCase().includes(q) ||
      (c.destino || "").toLowerCase().includes(q) ||
      c.itens.some((i) => i.produto.nome.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carregamentos</h1>
          <p className="text-muted-foreground">
            Monte o que cada caminhão (placa) vai carregar — peso por produto e total, origem, destino e status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadLista(); loadBase(); }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* FORMULÁRIO */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Novo carregamento do dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Caminhão (placa) *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={caminhaoId}
                  onChange={(e) => setCaminhaoId(e.target.value)}
                  required
                >
                  <option value="">Selecione a placa...</option>
                  {caminhoes.map((c) => (
                    <option key={c.id} value={c.id}>
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
                  <Label>Data *</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Status geral</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                  >
                    <option value="EM_ANDAMENTO">Em andamento</option>
                    <option value="FINALIZADO">Finalizado / Carregou</option>
                    <option value="NAO_CARREGADO">Não carregou</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex: Armazém SP" />
                </div>
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex: Cliente RJ" />
                </div>
              </div>

              {/* ITENS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Produtos / cargas *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
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
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={item.produtoId}
                      onChange={(e) => updateItem(item.key, { produtoId: e.target.value })}
                    >
                      <option value="">Produto...</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo} — {p.nome} ({p.unidade})
                        </option>
                      ))}
                    </select>
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
                  </div>
                ))}
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
                          percentual > 100 ? "bg-destructive" : percentual > 90 ? "bg-amber-500" : "bg-primary"
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
                Salvar no banco
              </Button>
            </form>
          </CardContent>
        </Card>

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
                  placeholder="Buscar placa, origem, destino, produto..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
              </div>
            ) : listaFiltrada.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Nenhum carregamento nesta data. Monte um à esquerda e salve.
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
                        <p className="font-mono font-bold text-lg">{c.caminhao.placa}</p>
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
                            <span className="font-medium">{it.produto.nome}</span>
                            <span className="text-muted-foreground text-xs ml-2">
                              {num(it.quantidade)} {it.produto.unidade} • {num(it.peso).toLocaleString("pt-BR")} kg
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={it.statusItem === "CARREGADO" ? "default" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => toggleItemStatus(c.id, it.id, "CARREGADO")}
                              title="Marcar como carregou"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Carregou
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={it.statusItem === "NAO_CARREGADO" ? "destructive" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => toggleItemStatus(c.id, it.id, "NAO_CARREGADO")}
                              title="Marcar como não carregou"
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Não
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={it.statusItem === "PENDENTE" ? "secondary" : "ghost"}
                              className="h-7 text-xs"
                              onClick={() => toggleItemStatus(c.id, it.id, "PENDENTE")}
                            >
                              <Clock className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setCarregStatus(c.id, "FINALIZADO")}>
                        Finalizar
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setCarregStatus(c.id, "EM_ANDAMENTO")}>
                        Em andamento
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setCarregStatus(c.id, "NAO_CARREGADO")}>
                        Não carregou (geral)
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-destructive ml-auto"
                        onClick={() => {
                          setDeleteId(c.id);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
