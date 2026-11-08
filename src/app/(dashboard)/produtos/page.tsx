"use client";

import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { TableSkeleton } from "@/components/layout/PageSkeletons";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";
import { formatCurrency } from "@/lib/utils";

type Produto = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  unidade: string;
  pesoUnitario: number | string | null;
  preco: number | string | null;
  ativo: boolean;
  categoria: string | null;
};

type ProdutoForm = {
  codigo: string;
  nome: string;
  descricao: string;
  unidade: string;
  pesoUnitario: string;
  preco: string;
  categoria: string;
  ativo: boolean;
};

const emptyForm: ProdutoForm = {
  codigo: "",
  nome: "",
  descricao: "",
  unidade: "KG",
  pesoUnitario: "",
  preco: "",
  categoria: "",
  ativo: true,
};

export default function ProdutosPage() {
  const [items, setItems] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState<ProdutoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await fetch("/api/produtos", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível carregar os produtos.");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onDataChanged = (event: Event) => {
      const modules = (event as CustomEvent<{ modules?: string[] }>).detail?.modules ?? [];
      if (modules.includes("produtos")) void load();
    };

    window.addEventListener("logistica:data-changed", onDataChanged);
    return () => window.removeEventListener("logistica:data-changed", onDataChanged);
  }, [load]);

  const filtered = items.filter((p) =>
    `${p.nome} ${p.codigo} ${p.categoria || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(p: Produto) {
    setEditing(p);
    setForm({
      codigo: p.codigo || "",
      nome: p.nome || "",
      descricao: p.descricao || "",
      unidade: p.unidade || "KG",
      pesoUnitario: p.pesoUnitario == null ? "" : String(p.pesoUnitario),
      preco: p.preco == null ? "" : String(p.preco),
      categoria: p.categoria || "",
      ativo: p.ativo,
    });
    setFormError("");
    setFormOpen(true);
  }

  function updateForm<K extends keyof ProdutoForm>(key: K, value: ProdutoForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProduto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        codigo: form.codigo.trim() || undefined,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        unidade: form.unidade.trim() || "KG",
        pesoUnitario: form.pesoUnitario.trim() === "" ? null : Number(form.pesoUnitario.replace(",", ".")),
        preco: form.preco.trim() === "" ? null : Number(form.preco.replace(",", ".")),
        categoria: form.categoria.trim() || null,
        ativo: form.ativo,
      };

      if (!payload.nome || payload.nome.length < 2) {
        throw new Error("Informe um nome com pelo menos 2 caracteres.");
      }

      if (
        (payload.pesoUnitario !== null && !Number.isFinite(payload.pesoUnitario)) ||
        (payload.preco !== null && !Number.isFinite(payload.preco))
      ) {
        throw new Error("Confira os valores de peso e preço.");
      }

      const res = await fetch("/api/produtos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível salvar o produto.");
      }

      setFormOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(adminPassword: string) {
    if (!selectedId) throw new Error("Selecione um produto.");

    const res = await fetch("/api/produtos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId, adminPassword }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Não foi possível desativar o produto.");

    setItems((current) => current.filter((p) => p.id !== selectedId));
    setSelectedId(null);
    return true;
  }

  return (
    <div className="space-y-6">
      <ScreenAssembly className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Cadastro de produtos e códigos personalizados.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, código ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {pageError && <p role="alert" className="text-sm text-destructive">{pageError}</p>}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Categoria</th>
                <th className="px-4 py-3 text-left font-medium">Unidade</th>
                <th className="px-4 py-3 text-right font-medium">Preço</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                  <td className="px-4 py-3 font-medium">{p.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.categoria || ""}</td>
                  <td className="px-4 py-3">{p.unidade}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(Number(p.preco || 0))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={p.ativo ? "success" : "secondary"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Editar produto ${p.nome}`}
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label={`Desativar produto ${p.nome}`}
                        onClick={() => {
                          setSelectedId(p.id);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </ScreenAssembly>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setFormOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="produto-dialog-title"
            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 id="produto-dialog-title" className="text-xl font-semibold">
                  {editing ? "Editar produto" : "Novo produto"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Os dados serão salvos no banco de dados.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar formulário"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={saveProduto} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>Código do produto</span>
                  <Input
                    value={form.codigo}
                    onChange={(e) => updateForm("codigo", e.target.value)}
                    placeholder="Automático se ficar vazio"
                    maxLength={60}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span>Nome *</span>
                  <Input
                    value={form.nome}
                    onChange={(e) => updateForm("nome", e.target.value)}
                    placeholder="Nome do produto"
                    required
                    minLength={2}
                    maxLength={150}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span>Categoria</span>
                  <Input
                    value={form.categoria}
                    onChange={(e) => updateForm("categoria", e.target.value)}
                    placeholder="Ex.: Poste, acessório"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span>Unidade</span>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.unidade}
                    onChange={(e) => updateForm("unidade", e.target.value)}
                  >
                    {["KG", "UN", "M", "CM", "TON", "L", "CX", "PÇ"].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span>Peso unitário</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.pesoUnitario}
                    onChange={(e) => updateForm("pesoUnitario", e.target.value)}
                    placeholder="0,000"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span>Preço unitário (R$)</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.preco}
                    onChange={(e) => updateForm("preco", e.target.value)}
                    placeholder="0,00"
                  />
                </label>

                <label className="space-y-1 text-sm sm:col-span-2">
                  <span>Descrição</span>
                  <textarea
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.descricao}
                    onChange={(e) => updateForm("descricao", e.target.value)}
                    placeholder="Descrição opcional do produto"
                    maxLength={2000}
                  />
                </label>

                {editing && (
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => updateForm("ativo", e.target.checked)}
                    />
                    Produto ativo
                  </label>
                )}
              </div>

              {formError && (
                <p role="alert" className="text-sm text-destructive">{formError}</p>
              )}

              <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setFormOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar produto"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminPasswordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        title="Desativar produto"
        description="O produto será desativado para preservar o histórico de carregamentos."
      />
    </div>
  );
}
