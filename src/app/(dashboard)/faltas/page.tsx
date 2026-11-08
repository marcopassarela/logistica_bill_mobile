"use client";

import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { RecordListSkeleton } from "@/components/layout/PageSkeletons";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Paperclip,
  UserX,
  Pencil,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";

type Funcionario = {
  id: string;
  nome: string;
  status?: string;
};

type Falta = {
  id: string;
  funcionarioId: string;
  funcionario: { id: string; nome: string };
  data: string;
  tipo: "FALTA" | "ATESTADO" | "FOLGA" | "LICENCA" | "OUTRO";
  justificativa: string | null;
  atestadoUrl?: string | null;
  createdAt?: string;
};

const tipoVariant: Record<
  string,
  "destructive" | "warning" | "secondary" | "default"
> = {
  FALTA: "destructive",
  ATESTADO: "warning",
  FOLGA: "secondary",
  LICENCA: "default",
  OUTRO: "secondary",
};

const tipoLabel: Record<string, string> = {
  FALTA: "Falta",
  ATESTADO: "Atestado",
  FOLGA: "Folga",
  LICENCA: "Licença",
  OUTRO: "Outro",
};

function dateInputValue(value: string) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function readError(response: Response, fallback: string) {
  const result = await response.json().catch(() => ({}));
  return typeof result.error === "string" ? result.error : fallback;
}

export default function FaltasPage() {
  const [faltas, setFaltas] = useState<Falta[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioId, setFuncionarioId] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState<Falta["tipo"]>("FALTA");
  const [justificativa, setJustificativa] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [faltasResponse, funcionariosResponse] = await Promise.all([
        fetch("/api/faltas", { cache: "no-store" }),
        fetch("/api/funcionarios", { cache: "no-store" }),
      ]);

      if (!faltasResponse.ok) {
        throw new Error(await readError(faltasResponse, "Não foi possível carregar as faltas."));
      }

      if (!funcionariosResponse.ok) {
        throw new Error(await readError(funcionariosResponse, "Não foi possível carregar os funcionários."));
      }

      const [faltasData, funcionariosData] = await Promise.all([
        faltasResponse.json(),
        funcionariosResponse.json(),
      ]);

      setFaltas(Array.isArray(faltasData) ? faltasData : []);
      setFuncionarios(
        Array.isArray(funcionariosData) ? funcionariosData : [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function onDataChanged(event: Event) {
      const modules = (event as CustomEvent<{ modules?: string[] }>).detail?.modules ?? [];
      if (
        modules?.some((module) =>
          ["faltas", "funcionarios"].includes(module)
        )
      ) {
        void loadData();
      }
    }

    window.addEventListener("logistica:data-changed", onDataChanged);
    return () => window.removeEventListener("logistica:data-changed", onDataChanged);
  }, [loadData]);

  function resetForm() {
    setFuncionarioId("");
    setData("");
    setTipo("FALTA");
    setJustificativa("");
    setEditingId(null);
    setError("");
  }

  function startEditing(falta: Falta) {
    setFuncionarioId(falta.funcionarioId);
    setData(dateInputValue(falta.data));
    setTipo(falta.tipo);
    setJustificativa(falta.justificativa || "");
    setEditingId(falta.id);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/faltas", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          funcionarioId,
          data,
          tipo,
          justificativa: justificativa.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            editingId ? "Não foi possível editar a falta." : "Não foi possível registrar a falta.",
          ),
        );
      }

      resetForm();
      setNotice(editingId ? "Falta atualizada com sucesso." : "Falta registrada com sucesso.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a falta.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(adminPassword: string) {
    if (!deletingId) return false;

    const response = await fetch("/api/faltas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deletingId, adminPassword }),
    });

    if (!response.ok) {
      throw new Error(await readError(response, "Não foi possível excluir a falta."));
    }

    setDeletingId(null);
    setNotice("Falta excluída com sucesso.");

    if (editingId === deletingId) resetForm();

    await loadData();
    return true;
  }

  const activeEmployees = funcionarios.filter(
    (item) => item.status !== "INATIVO",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faltas</h1>
        <p className="text-muted-foreground">
          Controle de faltas, atestados, folgas e licenças.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-lg border p-3 text-sm">
          {notice}
        </div>
      )}

      <ScreenAssembly className="grid items-start gap-6 lg:grid-cols-5" itemClassNames={["lg:col-span-2", "lg:col-span-3"]}>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {editingId ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "Editar Falta / Ausência" : "Registrar Falta / Ausência"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="falta-funcionario">Funcionário</Label>
                <select
                  id="falta-funcionario"
                  required
                  value={funcionarioId}
                  onChange={(event) => setFuncionarioId(event.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Selecione um funcionário</option>
                  {activeEmployees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="falta-data">Data</Label>
                <Input
                  id="falta-data"
                  type="date"
                  required
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="falta-tipo">Tipo</Label>
                <select
                  id="falta-tipo"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={tipo}
                  onChange={(event) => setTipo(event.target.value as Falta["tipo"])}
                >
                  <option value="FALTA">Falta</option>
                  <option value="ATESTADO">Atestado</option>
                  <option value="FOLGA">Folga</option>
                  <option value="LICENCA">Licença</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="falta-justificativa">Justificativa</Label>
                <Input
                  id="falta-justificativa"
                  value={justificativa}
                  onChange={(event) => setJustificativa(event.target.value)}
                  placeholder="Opcional"
                  maxLength={2000}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                A edição preserva o anexo existente. O envio de novos arquivos
                não está conectado a um serviço de armazenamento neste módulo.
              </p>

              <div className="flex gap-2">
                <Button className="flex-1" type="submit" disabled={saving || loading || activeEmployees.length === 0}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    <Pencil className="mr-2 h-4 w-4" />
                  ) : (
                    <UserX className="mr-2 h-4 w-4" />
                  )}
                  {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Registrar"}
                </Button>

                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                )}
              </div>

              {activeEmployees.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground">
                  Não há funcionários disponíveis para seleção.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">
              Registros de faltas ({faltas.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {loading ? (
              <RecordListSkeleton rows={3} />
            ) : faltas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma falta registrada.
              </p>
            ) : (
              faltas.map((falta) => (
                <div
                  key={falta.id}
                  className={`flex flex-col gap-3 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
                    editingId === falta.id ? "border-primary" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {falta.funcionario?.nome || "Funcionário não encontrado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(falta.data)}
                      {falta.justificativa ? `  ${falta.justificativa}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {falta.atestadoUrl && (
                      <a
                        href={falta.atestadoUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir anexo existente"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Paperclip className="h-4 w-4" />
                      </a>
                    )}

                    <Badge variant={tipoVariant[falta.tipo] || "secondary"}>
                      {tipoLabel[falta.tipo] || falta.tipo}
                    </Badge>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Editar falta"
                      aria-label="Editar falta"
                      onClick={() => startEditing(falta)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      title="Excluir falta"
                      aria-label="Excluir falta"
                      onClick={() => {
                        setDeletingId(falta.id);
                        setPasswordOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </ScreenAssembly>

      <AdminPasswordModal
        open={passwordOpen}
        onOpenChange={(open) => {
          setPasswordOpen(open);
          if (!open) setDeletingId(null);
        }}
        onConfirm={confirmDelete}
        title="Excluir falta"
        description="Digite a senha do administrador para excluir somente este registro. Esta ação não pode ser desfeita."
      />
    </div>
  );
}