"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { CalendarClock, Plus, RefreshCw, Truck, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Caminhao = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
};

type Agendamento = {
  id: string;
  peso: number | string;
  dataHora: string;
  origem: string;
  destino: string;
  status: string;
  caminhao: Caminhao;
  caminhaoId?: string;
};

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const labelClass = "mb-1 block text-sm font-medium";

function formatarData(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function dataLocalInput(valor: string) {
  const data = new Date(valor);
  return new Date(data.getTime() - data.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function AgendamentosPage() {
  const [items, setItems] = useState<Agendamento[]>([]);
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Agendamento | null>(null);
  const [deleteItem, setDeleteItem] = useState<Agendamento | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [agendamentosRes, caminhoesRes] = await Promise.all([
        fetch("/api/agendamentos", { cache: "no-store" }),
        fetch("/api/caminhoes", { cache: "no-store" }),
      ]);

      const agendamentosData = await agendamentosRes.json();
      const caminhoesData = await caminhoesRes.json();

      if (!agendamentosRes.ok) {
        throw new Error(agendamentosData.error || "Não foi possível carregar os agendamentos.");
      }

      if (!caminhoesRes.ok) {
        throw new Error(caminhoesData.error || "Não foi possível carregar os caminhões.");
      }

      setItems(agendamentosData);
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

  function iniciarEdicao(item: Agendamento) {
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

  async function salvarAgendamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const form = new FormData(formElement);
      const dataHora = String(form.get("dataHora") || "");

      const payload = {
        caminhaoId: String(form.get("caminhaoId") || ""),
        peso: Number(form.get("peso")),
        dataHora: new Date(dataHora).toISOString(),
        origem: String(form.get("origem") || "").trim(),
        destino: String(form.get("destino") || "").trim(),
      };

      const response = await fetch(
        editingId ? `/api/agendamentos/${editingId}` : "/api/agendamentos",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar o agendamento.");
      }

      const estavaEditando = Boolean(editingId);
      formElement.reset();
      setEditingId(null);
      setEditingItem(null);
      setSuccess(estavaEditando
        ? "Agendamento atualizado com sucesso."
        : "Agendamento cadastrado com sucesso.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar agendamento.");
    } finally {
      setSaving(false);
    }
  }

  async function excluirAgendamento(item: Agendamento) {

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/agendamentos/${item.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível excluir o agendamento.");
      }

      if (editingId === item.id) cancelarEdicao();
      setSuccess("Agendamento excluído com sucesso.");
      setDeleteItem(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir agendamento.");
    }
  }

  return (
    <ScreenAssembly className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Planejamento de carregamentos futuros da frota.
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
            {editingId ? "Editar agendamento" : "Novo agendamento"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!editingId && (
          <form key="novo" onSubmit={salvarAgendamento} className="grid gap-4 md:grid-cols-2">
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
              <label className={labelClass}>Peso previsto (kg)</label>
              <input name="peso" type="number" min="0.001" step="0.001" className={fieldClass} required placeholder="Ex.: 12000" defaultValue={editingItem ? String(Number(editingItem.peso)) : ""} />
            </div>

            <div>
              <label className={labelClass}>Data e horário</label>
              <input name="dataHora" type="datetime-local" className={fieldClass} required defaultValue={editingItem ? dataLocalInput(editingItem.dataHora) : ""} />
            </div>

            <div>
              <label className={labelClass}>Origem</label>
              <input name="origem" minLength={2} className={fieldClass} required placeholder="Local de origem" defaultValue={editingItem?.origem || ""} />
            </div>

            <div>
              <label className={labelClass}>Destino</label>
              <input name="destino" minLength={2} className={fieldClass} required placeholder="Local de destino" defaultValue={editingItem?.destino || ""} />
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit" disabled={saving || caminhoes.length === 0} className="w-full md:w-auto">
                {editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar agendamento"}
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

          {caminhoes.length === 0 && !loading && (
            <p className="mt-3 text-sm text-muted-foreground">
              Cadastre um caminhão antes de criar um agendamento.
            </p>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {success && <p role="status" className="mt-4 text-sm text-green-600">{success}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Carregamentos programados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando agendamentos...</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum agendamento cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">{item.origem}  {item.destino}</p>
                    <p className="text-sm text-muted-foreground">
                      <Truck className="mr-1 inline h-4 w-4" />
                      {item.caminhao?.placa || "Caminhão não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatarData(item.dataHora)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <div className="text-sm sm:text-right">
                      <p className="font-semibold">{Number(item.peso).toLocaleString("pt-BR")} kg</p>
                      <span className="text-muted-foreground">{item.status}</span>
                    </div>
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
              Editar agendamento
            </DialogTitle>
            <DialogDescription>
              Atualize os dados do carregamento programado.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <form key={editingId} onSubmit={salvarAgendamento} className="grid gap-4 md:grid-cols-2">
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
                <label className={labelClass}>Peso previsto (kg)</label>
                <input name="peso" type="number" min="0.001" step="0.001" className={fieldClass} required defaultValue={String(Number(editingItem.peso))} />
              </div>
              <div>
                <label className={labelClass}>Data e horário</label>
                <input name="dataHora" type="datetime-local" className={fieldClass} required defaultValue={dataLocalInput(editingItem.dataHora)} />
              </div>
              <div>
                <label className={labelClass}>Origem</label>
                <input name="origem" minLength={2} className={fieldClass} required defaultValue={editingItem.origem} />
              </div>
              <div>
                <label className={labelClass}>Destino</label>
                <input name="destino" minLength={2} className={fieldClass} required defaultValue={editingItem.destino} />
              </div>
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
            <DialogTitle>Excluir agendamento?</DialogTitle>
            <DialogDescription>
              Deseja realmente excluir o agendamento de
              <strong> {deleteItem?.origem} para {deleteItem?.destino}</strong>?
              Essa ação não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteItem(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={!deleteItem} onClick={() => { if (deleteItem) void excluirAgendamento(deleteItem); }}>
              <Trash2 className="mr-2 h-4 w-4" />
              Confirmar exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ScreenAssembly>
  );
}