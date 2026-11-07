"use client";

import { useCallback, useEffect, useState } from "react";
import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { CardGridSkeleton } from "@/components/layout/PageSkeletons";
import { Plus, Pencil, Trash2, Truck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";

type Caminhao = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  capacidadeKg: number | string | null;
  status: string;
  tipo: string | null;
  quilometragem?: number | null;
};

const statusMap: Record<string, { label: string; variant: "success" | "default" | "warning" | "secondary" }> = {
  LIBERADO: { label: "Liberado", variant: "success" },
  CARREGANDO: { label: "Carregando", variant: "default" },
  CARREGADO: { label: "Carregado", variant: "secondary" },
  EM_ROTA: { label: "Em rota", variant: "warning" },
  MANUTENCAO: { label: "Manutencao", variant: "warning" },
};

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

export default function CaminhoesPage() {
  const [items, setItems] = useState<Caminhao[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Caminhao | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await fetch("/api/caminhoes", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nao foi possivel carregar os caminhoes.");
      setItems(data);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao carregar caminhoes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status") ?? "";
    if (Object.prototype.hasOwnProperty.call(statusMap, status)) {
      setStatusFilter(status);
    }
  }, []);

  useEffect(() => {
    if (loading || pageError) return;

    const params = new URLSearchParams(window.location.search);
    const editId = params.get("editar");
    if (!editId) return;

    const caminhao = items.find((item) => item.id === editId);
    params.delete("editar");
    const query = params.toString();

    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );

    if (caminhao) {
      setEditing(caminhao);
      setPageError("");
      setFormOpen(true);
    } else {
      setPageError("O caminhão solicitado não foi encontrado.");
    }
  }, [items, loading, pageError]);
  const filtered = items.filter((c) => {
    const correspondeBusca = `${c.placa} ${c.marca ?? ""} ${c.modelo ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const correspondeStatus = !statusFilter || c.status === statusFilter;
    return correspondeBusca && correspondeStatus;
  });

  function openNew() {
    setEditing(null);
    setPageError("");
    setFormOpen(true);
  }

  function openEdit(item: Caminhao) {
    setEditing(item);
    setPageError("");
    setFormOpen(true);
  }

  async function saveTruck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setPageError("");

    try {
      const form = new FormData(event.currentTarget);
      const numberOrNull = (key: string) => {
        const value = String(form.get(key) ?? "").trim();
        return value === "" ? null : Number(value);
      };

      const payload = {
        placa: String(form.get("placa") ?? "").trim().toUpperCase(),
        marca: String(form.get("marca") ?? "").trim() || null,
        modelo: String(form.get("modelo") ?? "").trim() || null,
        ano: numberOrNull("ano"),
        capacidadeKg: numberOrNull("capacidadeKg"),
        tipo: String(form.get("tipo") ?? "").trim() || null,
        status: String(form.get("status") ?? "LIBERADO"),
        quilometragem: numberOrNull("quilometragem"),
      };

      const res = await fetch("/api/caminhoes", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Nao foi possivel salvar o caminhao.");

      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao salvar caminhao.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(adminPassword: string) {
    if (!selectedId) throw new Error("Selecione um caminhao.");
    const res = await fetch("/api/caminhoes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId, adminPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const linked = data.vinculados;
      if (res.status === 409 && linked) {
        throw new Error(`${data.error} Diarias: ${linked.diarias}; rotas: ${linked.rotas}; carregamentos: ${linked.carregamentos}.`);
      }
      throw new Error(data.error || "Nao foi possivel excluir o caminhao.");
    }
    setItems((current) => current.filter((c) => c.id !== selectedId));
    setSelectedId(null);
    return true;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caminhoes</h1>
          <p className="text-muted-foreground">Cadastre caminhões e mantenha os dados organizados.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Novo Caminhao
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500 dark:text-blue-400" />
        <Input placeholder="Buscar por placa, marca, modelo..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {statusFilter && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Status: <strong>{statusMap[statusFilter]?.label ?? statusFilter}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              const url = new URL(window.location.href);
              url.searchParams.delete("status");
              window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
            }}
            className="text-primary underline underline-offset-2"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {pageError && <p role="alert" className="text-sm text-destructive">{pageError}</p>}

      {loading ? <CardGridSkeleton count={6} /> :
        filtered.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum caminhao encontrado.</p> :
        <ScreenAssembly className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const st = statusMap[c.status] || statusMap.LIBERADO;
            return (
              <Card key={c.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="font-mono text-base">{c.placa}</CardTitle>
                        <p className="text-sm text-muted-foreground">{[c.marca, c.modelo].filter(Boolean).join(" ")}</p>
                      </div>
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Ano</span><p className="font-medium">{c.ano ?? "-"}</p></div>
                      <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{c.tipo || "-"}</p></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Capacidade</span>
                        <p className="font-medium">{(Number(c.capacidadeKg || 0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} t</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(c)}>
                        <Pencil className="mr-1 h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
                        aria-label={`Excluir caminhao ${c.placa}`}
                        onClick={() => { setSelectedId(c.id); setDeleteOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
            );
          })}
        </ScreenAssembly>
      }

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar caminhao" : "Novo caminhao"}</DialogTitle>
            <DialogDescription>Preencha os dados da frota e salve para atualizar o cadastro.</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveTruck} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Placa *</label>
                <input name="placa" required minLength={7} maxLength={8} className={fieldClass}
                  defaultValue={editing?.placa ?? ""} placeholder="ABC1D23" />
              </div>
              <div>
                <label className={labelClass}>Marca</label>
                <input name="marca" className={fieldClass} defaultValue={editing?.marca ?? ""} placeholder="Ex.: Volvo" />
              </div>
              <div>
                <label className={labelClass}>Modelo</label>
                <input name="modelo" className={fieldClass} defaultValue={editing?.modelo ?? ""} placeholder="Ex.: FH 540" />
              </div>
              <div>
                <label className={labelClass}>Ano</label>
                <input name="ano" type="number" min="1980" max="2030" className={fieldClass} defaultValue={editing?.ano ?? ""} />
              </div>
              <div>
                <label className={labelClass}>Capacidade (kg)</label>
                <input name="capacidadeKg" type="number" min="0" step="0.01" className={fieldClass} defaultValue={editing?.capacidadeKg ?? ""} />
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <input name="tipo" className={fieldClass} defaultValue={editing?.tipo ?? ""} placeholder="Truck, carreta, munck..." />
              </div>
              <div>
                <label className={labelClass}>Quilometragem</label>
                <input name="quilometragem" type="number" min="0" step="1" className={fieldClass} defaultValue={editing?.quilometragem ?? ""} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select name="status" className={fieldClass} defaultValue={editing?.status ?? "LIBERADO"}>
                  <option value="LIBERADO">Liberado</option>
                  <option value="CARREGANDO">Carregando</option>
                  <option value="CARREGADO">Carregado</option>
                  <option value="EM_ROTA">Em rota</option>
                  <option value="MANUTENCAO">Manutencao</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar caminhao"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AdminPasswordModal open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={confirmDelete}
        title="Excluir caminhao"
        description="A exclusao so sera permitida se nao houver diarias, rotas ou carregamentos vinculados." />
    </div>
  );
}
