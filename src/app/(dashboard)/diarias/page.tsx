"use client";

import { ScreenAssembly } from "@/components/layout/ScreenAssembly";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";
import { formatCurrency, formatDate } from "@/lib/utils";

type Funcionario = { id: string; nome: string; status?: string };
type Caminhao = { id: string; placa: string; marca?: string | null; modelo?: string | null };
type Diaria = {
  id: string;
  funcionarioId: string;
  caminhaoId: string | null;
  data: string;
  valor: number | string;
  observacao: string | null;
  funcionario: { id: string; nome: string };
  caminhao: { id: string; placa: string } | null;
};

const emptyForm = {
  funcionarioId: "",
  caminhaoId: "",
  data: new Date().toLocaleDateString("en-CA"),
  valor: "",
  observacao: "",
};

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : fallback;
}

export default function DiariasPage() {
  const [diarias, setDiarias] = useState<Diaria[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filterFuncionarioId, setFilterFuncionarioId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, fRes, cRes] = await Promise.all([
        fetch("/api/diarias", { cache: "no-store" }),
        fetch("/api/funcionarios", { cache: "no-store" }),
        fetch("/api/caminhoes", { cache: "no-store" }),
      ]);

      if (!dRes.ok) throw new Error(await readError(dRes, "Não foi possível carregar as diárias."));
      if (!fRes.ok) throw new Error(await readError(fRes, "Não foi possível carregar os funcionários."));
      if (!cRes.ok) throw new Error(await readError(cRes, "Não foi possível carregar os caminhões."));

      const [d, f, c] = await Promise.all([dRes.json(), fRes.json(), cRes.json()]);
      setDiarias(d);
      setFuncionarios(f);
      setCaminhoes(c);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function changeField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...emptyForm, data: new Date().toLocaleDateString("en-CA") });
    setError("");
    setNotice("");
  }

  function startEdit(d: Diaria) {
    setEditingId(d.id);
    setForm({
      funcionarioId: d.funcionarioId,
      caminhaoId: d.caminhaoId || "",
      data: new Date(d.data).toISOString().slice(0, 10),
      valor: String(d.valor),
      observacao: d.observacao || "",
    });
    setError("");
    setNotice("");
  }

  async function saveDiaria(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/diarias", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          funcionarioId: form.funcionarioId,
          caminhaoId: form.caminhaoId || null,
          data: form.data,
          valor: Number(form.valor),
          observacao: form.observacao.trim() || null,
        }),
      });

      if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar a diária."));

      setNotice(editingId ? "Diária atualizada com sucesso." : "Diária registrada com sucesso.");
      setEditingId(null);
      setForm({ ...emptyForm, data: new Date().toLocaleDateString("en-CA") });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar a diária.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(adminPassword: string) {
    if (!deleteId) return false;

    const response = await fetch("/api/diarias", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteId, adminPassword }),
    });

    if (!response.ok) {
      throw new Error(await readError(response, "Não foi possível excluir a diária."));
    }

    setDeleteId(null);
    setNotice("Diária excluída com sucesso.");
    setError("");
    await loadData();
    return true;
  }

  async function confirmDeleteAll(adminPassword: string) {
    const response = await fetch("/api/diarias", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteAll: true, adminPassword }),
    });

    if (!response.ok) {
      throw new Error(await readError(response, "Não foi possível excluir todas as diárias."));
    }

    const result = await response.json();
    setDeleteAllOpen(false);
    setNotice(`${result.count} diária(s) excluída(s) com sucesso.`);
    setError("");
    await loadData();
    return true;
  }

  const filteredDiarias = filterFuncionarioId
    ? diarias.filter((d) => d.funcionarioId === filterFuncionarioId)
    : diarias;
  const total = filteredDiarias.reduce((sum, d) => sum + Number(d.valor), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Diárias</h1>
        <p className="text-muted-foreground">Controle de diárias por funcionário e caminhão</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-lg border p-3 text-sm">{notice}</div>}

      <ScreenAssembly className="grid items-start gap-6 lg:grid-cols-5" itemClassNames={["lg:col-span-2", "lg:col-span-3"]}>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Editar Diária" : "Registrar Diária"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveDiaria} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="diaria-funcionario">Funcionário</Label>
                <select
                  id="diaria-funcionario"
                  required
                  value={form.funcionarioId}
                  onChange={(e) => changeField("funcionarioId", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione um funcionário</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}{f.status === "INATIVO" ? " (inativo)" : ""}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diaria-caminhao">Caminhão (opcional)</Label>
                <select
                  id="diaria-caminhao"
                  value={form.caminhaoId}
                  onChange={(e) => changeField("caminhaoId", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sem caminhão</option>
                  {caminhoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.placa}{c.modelo ? `  ${c.modelo}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diaria-data">Data</Label>
                <Input id="diaria-data" type="date" required value={form.data}
                  onChange={(e) => changeField("data", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diaria-valor">Valor (R$)</Label>
                <Input id="diaria-valor" type="number" min="0" step="0.01" required
                  value={form.valor} onChange={(e) => changeField("valor", e.target.value)}
                  placeholder="0,00" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diaria-observacao">Observação</Label>
                <Input id="diaria-observacao" value={form.observacao}
                  onChange={(e) => changeField("observacao", e.target.value)}
                  placeholder="Opcional" />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={saving || loading}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                    editingId ? <Pencil className="mr-2 h-4 w-4" /> : <CalendarDays className="mr-2 h-4 w-4" />}
                  {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar Diária"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving} aria-label="Cancelar edição">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 lg:flex lg:max-h-[calc(100vh-12rem)] lg:flex-col">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Diárias registradas</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Total: {formatCurrency(total)}</span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setDeleteAllOpen(true)}
                disabled={loading || diarias.length === 0}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Apagar todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="mb-4 space-y-2">
              <Label htmlFor="filtro-diarias">Filtrar por funcionário</Label>
              <select
                id="filtro-diarias"
                value={filterFuncionarioId}
                onChange={(e) => setFilterFuncionarioId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os funcionários</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando diárias...
              </div>
            ) : diarias.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma diária cadastrada no banco de dados.</p>
            ) : filteredDiarias.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma diária encontrada para este funcionário.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredDiarias.map((d) => (
                  <div key={d.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{d.funcionario?.nome || "Funcionário não encontrado"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(d.data)}  {d.caminhao?.placa || "Sem caminhão"}
                        {d.observacao ? `  ${d.observacao}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="font-semibold text-foreground">{formatCurrency(Number(d.valor))}</span>
                      <Button type="button" size="icon" variant="outline" onClick={() => startEdit(d)} aria-label={`Editar diária de ${d.funcionario?.nome || "funcionário"}`} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="destructive" onClick={() => setDeleteId(d.id)} aria-label="Excluir diária" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ScreenAssembly>

      <AdminPasswordModal
        open={Boolean(deleteId)}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={confirmDelete}
        title="Confirmar exclusão da diária"
        description="Esta ação excluirá permanentemente a diária selecionada. Digite a senha do administrador para continuar."
      />

      <AdminPasswordModal
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        onConfirm={confirmDeleteAll}
        title="Apagar todas as diárias?"
        description="Esta ação excluirá permanentemente todas as diárias cadastradas, de todos os meses. Funcionários, caminhões e faltas serão preservados. Digite a senha do administrador para continuar."
      />
    </div>
  );
}