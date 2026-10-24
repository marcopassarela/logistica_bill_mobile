"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, Users, Briefcase, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";

type Cargo = {
  id: string;
  nome: string;
  descricao: string | null;
  _count?: { funcionarios: number };
};

type Funcionario = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cargoId?: string | null;
  cargo: { id: string; nome: string } | null;
  dataAdmissao?: string | null;
  salario?: number | string | null;
  status: "ATIVO" | "INATIVO" | "AFASTADO";
  observacoes?: string | null;
};

type FuncionarioForm = {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cargoId: string;
  dataAdmissao: string;
  salario: string;
  status: "ATIVO" | "INATIVO" | "AFASTADO";
  observacoes: string;
};

const emptyEmployee: FuncionarioForm = {
  nome: "",
  cpf: "",
  telefone: "",
  email: "",
  cargoId: "",
  dataAdmissao: "",
  salario: "",
  status: "ATIVO",
  observacoes: "",
};

export default function FuncionariosPage() {
  const [items, setItems] = useState<Funcionario[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [form, setForm] = useState<FuncionarioForm>(emptyEmployee);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [cargoOpen, setCargoOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [cargoNome, setCargoNome] = useState("");
  const [cargoDescricao, setCargoDescricao] = useState("");
  const [cargoSaving, setCargoSaving] = useState(false);
  const [cargoError, setCargoError] = useState("");
  const [cargoDeleteOpen, setCargoDeleteOpen] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const [employeeResponse, cargoResponse] = await Promise.all([
        fetch("/api/funcionarios", { cache: "no-store" }),
        fetch("/api/cargos", { cache: "no-store" }),
      ]);

      const employeeData = await employeeResponse.json();
      const cargoData = await cargoResponse.json();

      if (!employeeResponse.ok) {
        throw new Error(employeeData.error || "Não foi possível carregar os funcionários.");
      }
      if (!cargoResponse.ok) {
        throw new Error(cargoData.error || "Não foi possível carregar os cargos.");
      }

      setItems(Array.isArray(employeeData) ? employeeData : []);
      setCargos(Array.isArray(cargoData) ? cargoData : []);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao carregar funcionários e cargos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = items.filter((f) =>
    `${f.nome} ${f.cargo?.nome || ""} ${f.telefone || ""} ${f.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function openNewEmployee() {
    setEditing(null);
    setForm({ ...emptyEmployee });
    setFormError("");
    setFormOpen(true);
  }

  function openEditEmployee(employee: Funcionario) {
    setEditing(employee);
    setForm({
      nome: employee.nome || "",
      cpf: employee.cpf || "",
      telefone: employee.telefone || "",
      email: employee.email || "",
      cargoId: employee.cargo?.id || employee.cargoId || "",
      dataAdmissao: employee.dataAdmissao ? employee.dataAdmissao.slice(0, 10) : "",
      salario: employee.salario == null ? "" : String(employee.salario),
      status: employee.status,
      observacoes: employee.observacoes || "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function saveEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        nome: form.nome.trim(),
        cpf: form.cpf.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        cargoId: form.cargoId || null,
        dataAdmissao: form.dataAdmissao || null,
        salario: form.salario.trim() === "" ? null : Number(form.salario.replace(",", ".")),
        status: form.status,
        observacoes: form.observacoes.trim() || null,
      };

      if (payload.salario !== null && !Number.isFinite(payload.salario)) {
        throw new Error("Informe um salário válido.");
      }

      const response = await fetch("/api/funcionarios", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar o funcionário.");
      }

      setFormOpen(false);
      setEditing(null);
      setForm({ ...emptyEmployee });
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar funcionário.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(adminPassword: string) {
    if (!selectedId) throw new Error("Selecione um funcionário.");

    const response = await fetch("/api/funcionarios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId, adminPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível excluir o funcionário.");
    }

    setItems((current) => current.filter((f) => f.id !== selectedId));
    setSelectedId(null);
    return true;
  }

  function openNewCargo() {
    setEditingCargo(null);
    setCargoNome("");
    setCargoDescricao("");
    setCargoError("");
  }

  function openEditCargo(cargo: Cargo) {
    setEditingCargo(cargo);
    setCargoNome(cargo.nome);
    setCargoDescricao(cargo.descricao || "");
    setCargoError("");
  }

  async function saveCargo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCargoSaving(true);
    setCargoError("");

    try {
      const response = await fetch("/api/cargos", {
        method: editingCargo ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingCargo ? { id: editingCargo.id } : {}),
          nome: cargoNome.trim(),
          descricao: cargoDescricao.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o cargo.");

      setEditingCargo(null);
      setCargoNome("");
      setCargoDescricao("");
      await load();
    } catch (e) {
      setCargoError(e instanceof Error ? e.message : "Erro ao salvar cargo.");
    } finally {
      setCargoSaving(false);
    }
  }

  async function confirmDeleteCargo(adminPassword: string) {
    if (!selectedCargoId) throw new Error("Selecione um cargo.");

    const response = await fetch("/api/cargos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedCargoId, adminPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível excluir o cargo.");

    setSelectedCargoId(null);
    await load();
    return true;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-muted-foreground">Cadastro de funcionários e gerenciamento de cargos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { openNewCargo(); setCargoOpen(true); }}>
            <Briefcase className="mr-2 h-4 w-4" /> Gerenciar Cargos
          </Button>
          <Button onClick={openNewEmployee}>
            <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionário, cargo ou contato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {pageError && <p role="alert" className="text-sm text-destructive">{pageError}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando funcionários...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum funcionário encontrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <Card key={f.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{f.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">{f.cargo?.nome || "Sem cargo"}</p>
                  </div>
                </div>
                <Badge variant={f.status === "ATIVO" ? "success" : f.status === "INATIVO" ? "secondary" : "warning"}>
                  {f.status === "ATIVO" ? "Ativo" : f.status === "INATIVO" ? "Inativo" : "Afastado"}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  {f.telefone || f.email || "Sem contato cadastrado"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditEmployee(f)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={f.status === "INATIVO"}
                    aria-label={`Desativar funcionário ${f.nome}`}
                    onClick={() => { setSelectedId(f.id); setDeleteOpen(true); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setFormOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="employee-title"
            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="employee-title" className="text-xl font-semibold">
                  {editing ? "Editar funcionário" : "Novo funcionário"}
                </h2>
                <p className="text-sm text-muted-foreground">Preencha os dados do funcionário.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" disabled={saving} onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={saveEmployee} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>Nome completo *</span>
                  <Input required minLength={2} value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Cargo</span>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3"
                    value={form.cargoId} onChange={(e) => setForm({ ...form, cargoId: e.target.value })}>
                    <option value="">Sem cargo</option>
                    {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span>CPF</span>
                  <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Telefone</span>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>E-mail</span>
                  <Input type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Data de admissão</span>
                  <Input type="date" value={form.dataAdmissao}
                    onChange={(e) => setForm({ ...form, dataAdmissao: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Salário (R$)</span>
                  <Input type="number" min="0" step="0.01" value={form.salario}
                    onChange={(e) => setForm({ ...form, salario: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Status</span>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as FuncionarioForm["status"] })}>
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                    <option value="AFASTADO">Afastado</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span>Observações</span>
                  <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2"
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </label>
              </div>

              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" disabled={saving} onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar funcionário"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cargoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !cargoSaving) setCargoOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="cargo-title"
            className="my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border bg-background p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="cargo-title" className="text-xl font-semibold">Gerenciar cargos</h2>
                <p className="text-sm text-muted-foreground">Cadastre, edite ou exclua cargos sem funcionários vinculados.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setCargoOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={saveCargo} className="mb-6 space-y-3 rounded-lg border p-4">
              <h3 className="font-medium">{editingCargo ? "Editar cargo" : "Novo cargo"}</h3>
              <label className="block space-y-1 text-sm">
                <span>Nome do cargo *</span>
                <Input required minLength={2} value={cargoNome} onChange={(e) => setCargoNome(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Descrição</span>
                <textarea className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2"
                  value={cargoDescricao} onChange={(e) => setCargoDescricao(e.target.value)} />
              </label>
              {cargoError && <p role="alert" className="text-sm text-destructive">{cargoError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={cargoSaving}>{cargoSaving ? "Salvando..." : editingCargo ? "Salvar cargo" : "Adicionar cargo"}</Button>
                {editingCargo && <Button type="button" variant="outline" onClick={openNewCargo}>Cancelar edição</Button>}
              </div>
            </form>

            <div className="space-y-2">
              <h3 className="font-medium">Cargos cadastrados ({cargos.length})</h3>
              {cargos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>}
              {cargos.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c._count?.funcionarios ?? 0} funcionário(s) vinculado(s)
                      {c.descricao ? `  ${c.descricao}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Editar cargo ${c.nome}`}
                      onClick={() => openEditCargo(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive"
                      aria-label={`Excluir cargo ${c.nome}`}
                      onClick={() => { setSelectedCargoId(c.id); setCargoDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setCargoOpen(false)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}

      <AdminPasswordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        title="Excluir funcionário"
        description="A exclusão será permanente. Funcionários com diárias ou faltas vinculadas não poderão ser excluídos."
      />

      <AdminPasswordModal
        open={cargoDeleteOpen}
        onOpenChange={setCargoDeleteOpen}
        onConfirm={confirmDeleteCargo}
        title="Excluir cargo"
        description="A exclusão exige a senha de administrador. Cargos associados a funcionários não podem ser excluídos."
      />
    </div>
  );
}
