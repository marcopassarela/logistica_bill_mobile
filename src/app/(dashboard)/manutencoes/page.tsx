"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { Wrench, Plus, RefreshCw, Truck, CalendarClock, Gauge, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Caminhao = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  quilometragem?: number | null;
};

type Manutencao = {
  id: string;
  descricao: string;
  dataHora: string | null;
  quilometragemAlvo: number | null;
  status: string;
  caminhao: Caminhao;
  caminhaoId?: string;
};

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

function formatarData(valor: string | null) {
  if (!valor) return "Sem data definida";
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function dataLocalInput(valor: string | null) {
  if (!valor) return "";
  const data = new Date(valor);
  return new Date(data.getTime() - data.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function ManutencoesPage() {
  const [items, setItems] = useState<Manutencao[]>([]);
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Manutencao | null>(null);
  const [deleteItem, setDeleteItem] = useState<Manutencao | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [manutencoesRes, caminhoesRes] = await Promise.all([
        fetch("/api/manutencoes", { cache: "no-store" }),
        fetch("/api/caminhoes", { cache: "no-store" }),
      ]);

      const manutencoesData = await manutencoesRes.json();
      const caminhoesData = await caminhoesRes.json();

      if (!manutencoesRes.ok) {
        throw new Error(manutencoesData.error || "Não foi possível carregar as manutenções.");
      }

      if (!caminhoesRes.ok) {
        throw new Error(caminhoesData.error || "Não foi possível carregar os caminhões.");
      }

      setItems(manutencoesData);
      setCaminhoes(caminhoesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar informações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function iniciarEdicao(item: Manutencao) {
    setEditingId(item.id);
    setEditingItem(item);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicao() {
    setEditingId(null);
    setEditingItem(null);
    setError("");
    setSuccess("");
  }

  async function salvarManutencao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const form = new FormData(formElement);
      const dataHora = String(form.get("dataHora") || "");
      const km = String(form.get("quilometragemAlvo") || "");

      if (!dataHora && !km) {
        throw new Error("Informe uma data ou uma quilometragem-alvo.");
      }

      const payload = {
        caminhaoId: String(form.get("caminhaoId") || ""),
        descricao: String(form.get("descricao") || "").trim(),
        dataHora: dataHora ? new Date(dataHora).toISOString() : null,
        quilometragemAlvo: km ? Number(km) : null,
      };

      const response = await fetch(
        editingId ? `/api/manutencoes/${editingId}` : "/api/manutencoes",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar a manutenção.");
      }

      const estavaEditando = Boolean(editingId);
      formElement.reset();
      setEditingId(null);
      setEditingItem(null);
      setSuccess(estavaEditando
        ? "Manutenção atualizada com sucesso."
        : "Manutenção programada com sucesso.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar manutenção.");
    } finally {
      setSaving(false);
    }
  }

  async function excluirManutencao(item: Manutencao) {

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/manutencoes/${item.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível excluir a manutenção.");
      }

      if (editingId === item.id) cancelarEdicao();
      setSuccess("Manutenção excluída com sucesso.");
      setDeleteItem(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir manutenção.");
    }
  }

  return (
    <ScreenAssembly className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manutenções</h1>
          <p className="text-sm text-muted-foreground">
            Controle preventivo da manutenção dos caminhões.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {editingId ? "Editar manutenção" : "Programar manutenção"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!editingId && (
          <form key="novo" onSubmit={salvarManutencao} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Caminhão</label>
              <select name="caminhaoId" className={fieldClass} required defaultValue={editingItem?.caminhaoId || editingItem?.caminhao?.id || ""}>
                <option value="" disabled>Selecione um caminhão</option>
                {caminhoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.placa} {c.marca ? `- ${c.marca}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Descrição do serviço</label>
              <input name="descricao" minLength={2} className={fieldClass} required placeholder="Ex.: Troca de óleo" defaultValue={editingItem?.descricao || ""} />
            </div>

            <div>
              <label className={labelClass}>Data e horário (opcional)</label>
              <input name="dataHora" type="datetime-local" className={fieldClass} defaultValue={dataLocalInput(editingItem?.dataHora || null)} />
            </div>

            <div>
              <label className={labelClass}>Quilometragem-alvo (opcional)</label>
              <input name="quilometragemAlvo" type="number" min="1" step="1" className={fieldClass} placeholder="Ex.: 150000" defaultValue={editingItem?.quilometragemAlvo ?? ""} />
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit" disabled={saving || caminhoes.length === 0} className="w-full md:w-auto">
                {editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Programar manutenção"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelarEdicao} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>
          </form>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Informe pelo menos uma referência: data ou quilometragem.
          </p>

          {caminhoes.length === 0 && !loading && (
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre um caminhão antes de programar uma manutenção.
            </p>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {success && <p role="status" className="mt-4 text-sm text-green-600">{success}</p>}
        </CardContent>
      </Card>

      <Card className="w-full min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Manutenções programadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando manutenções...</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma manutenção cadastrada.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex w-full min-w-0 flex-col gap-3 rounded-lg border p-4">
                  <div className="w-full min-w-0 space-y-1">
                    <p className="font-semibold">{item.descricao}</p>
                    <p className="text-sm text-muted-foreground">
                      <Truck className="mr-1 inline h-4 w-4" />
                      {item.caminhao?.placa || "Caminhão não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <CalendarClock className="mr-1 inline h-4 w-4" />
                      {formatarData(item.dataHora)}
                    </p>
                    {item.quilometragemAlvo != null && (
                      <p className="flex min-w-0 items-start gap-1 whitespace-normal text-sm leading-6 text-muted-foreground">
                        <Gauge className="mt-1 h-4 w-4 shrink-0" />
                        <span className="min-w-0">Meta: {Number(item.quilometragemAlvo).toLocaleString("pt-BR")} km</span>
                      </p>
                    )}
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="rounded-full border px-3 py-1">{item.status}</span>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => iniciarEdicao(item)}>
                        <Pencil className="mr-1 h-4 w-4" />
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteItem(item)}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(editingId)}
        onOpenChange={(open) => {
          if (!open && !saving) cancelarEdicao();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar manutenção
            </DialogTitle>
            <DialogDescription>
              Atualize os dados da manutenção programada.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <form key={editingId} onSubmit={salvarManutencao} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Caminhão</label>
                <select name="caminhaoId" className={fieldClass} required defaultValue={editingItem.caminhaoId || editingItem.caminhao?.id || ""}>
                  <option value="" disabled>Selecione um caminhão</option>
                  {caminhoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.placa} {c.marca ? `- ${c.marca}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Descrição do serviço</label>
                <input name="descricao" minLength={2} className={fieldClass} required defaultValue={editingItem.descricao} />
              </div>
              <div>
                <label className={labelClass}>Data e horário (opcional)</label>
                <input name="dataHora" type="datetime-local" className={fieldClass} defaultValue={dataLocalInput(editingItem.dataHora)} />
              </div>
              <div>
                <label className={labelClass}>Quilometragem-alvo (opcional)</label>
                <input name="quilometragemAlvo" type="number" min="1" step="1" className={fieldClass} defaultValue={editingItem.quilometragemAlvo ?? ""} />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">
                Informe pelo menos uma referência: data ou quilometragem.
              </p>
              {error && <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p>}
              <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
                <Button type="button" variant="outline" onClick={cancelarEdicao} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleteItem)} onOpenChange={(open) => { if (!open) setDeleteItem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir manutenção?</DialogTitle>
            <DialogDescription>
              Deseja realmente excluir a manutenção
              <strong> {deleteItem?.descricao}</strong>?
              Essa ação não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteItem(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={!deleteItem} onClick={() => { if (deleteItem) void excluirManutencao(deleteItem); }}>
              <Trash2 className="mr-2 h-4 w-4" />
              Confirmar exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ScreenAssembly>
  );
}