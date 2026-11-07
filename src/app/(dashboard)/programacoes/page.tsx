"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { RecordListSkeleton } from "@/components/layout/PageSkeletons";
import {
  CalendarClock, Plus, RefreshCw, Truck, Pencil, Trash2,
  Wrench, ClipboardList, X, Gauge, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

type Manutencao = {
  id: string;
  descricao: string;
  dataHora: string | null;
  quilometragemAlvo: number | null;
  status: string;
  caminhao: Caminhao;
  caminhaoId?: string;
};

type Lembrete = {
  id: string;
  descricao: string;
  dataHora: string;
  status: "PENDENTE" | "PROCESSANDO" | "ENVIADO" | "CANCELADO";
  enviadoEm: string | null;
};

type Tipo = "AGENDAMENTO" | "MANUTENCAO" | "LEMBRETE";

type Edicao =
  | { tipo: "AGENDAMENTO"; item: Agendamento }
  | { tipo: "MANUTENCAO"; item: Manutencao }
  | { tipo: "LEMBRETE"; item: Lembrete }
  | null;

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
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

export default function ProgramacoesPage() {
  const [tipo, setTipo] = useState<Tipo>("AGENDAMENTO");
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [lembretesDisponiveis, setLembretesDisponiveis] = useState(false);
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [filtro, setFiltro] = useState("TODOS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [agRes, manRes, camRes, lemRes] = await Promise.all([
        fetch("/api/agendamentos", { cache: "no-store" }),
        fetch("/api/manutencoes", { cache: "no-store" }),
        fetch("/api/caminhoes", { cache: "no-store" }),
        fetch("/api/lembretes", { cache: "no-store" }),
      ]);

      const [agData, manData, camData, lemData] = await Promise.all([
        agRes.json(),
        manRes.json(),
        camRes.json(),
        lemRes.json().catch(() => []),
      ]);

      if (!agRes.ok) throw new Error(agData.error || "Erro ao carregar agendamentos.");
      if (!manRes.ok) throw new Error(manData.error || "Erro ao carregar manutenções.");
      if (!camRes.ok) throw new Error(camData.error || "Erro ao carregar caminhões.");

      setAgendamentos(agData);
      setManutencoes(manData);
      setCaminhoes(camData);
      setLembretesDisponiveis(lemRes.ok);
      setLembretes(lemRes.ok && Array.isArray(lemData) ? lemData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar programações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function iniciarEdicao(
    item: Agendamento | Manutencao | Lembrete,
    novoTipo: Tipo
  ) {
    if (novoTipo === "AGENDAMENTO") {
      setEdicao({ tipo: "AGENDAMENTO", item: item as Agendamento });
    } else if (novoTipo === "MANUTENCAO") {
      setEdicao({ tipo: "MANUTENCAO", item: item as Manutencao });
    } else {
      setEdicao({ tipo: "LEMBRETE", item: item as Lembrete });
    }

    setTipo(novoTipo);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelarEdicao() {
    setEdicao(null);
    setError("");
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const dataHora = String(form.get("dataHora") || "");
      let endpoint = "";
      let payload: Record<string, unknown>;

      if (tipo === "AGENDAMENTO") {
        if (!dataHora) throw new Error("Informe a data e o horário do agendamento.");

        payload = {
          caminhaoId: String(form.get("caminhaoId") || ""),
          peso: Number(form.get("peso")),
          dataHora: new Date(dataHora).toISOString(),
          origem: String(form.get("origem") || "").trim(),
          destino: String(form.get("destino") || "").trim(),
        };

        endpoint = edicao?.tipo === "AGENDAMENTO"
          ? `/api/agendamentos/${edicao.item.id}`
          : "/api/agendamentos";
      } else if (tipo === "MANUTENCAO") {
        const km = String(form.get("quilometragemAlvo") || "");

        if (!dataHora && !km) {
          throw new Error("Informe uma data ou uma quilometragem-alvo.");
        }

        payload = {
          caminhaoId: String(form.get("caminhaoId") || ""),
          descricao: String(form.get("descricao") || "").trim(),
          dataHora: dataHora ? new Date(dataHora).toISOString() : null,
          quilometragemAlvo: km ? Number(km) : null,
        };

        endpoint = edicao?.tipo === "MANUTENCAO"
          ? `/api/manutencoes/${edicao.item.id}`
          : "/api/manutencoes";
      } else {
        if (!lembretesDisponiveis) {
          throw new Error("Não foi possível acessar os lembretes. Atualize a página e tente novamente.");
        }

        if (!dataHora) throw new Error("Informe a data e o horário do lembrete.");

        payload = {
          descricao: String(form.get("descricao") || "").trim(),
          dataHora: new Date(dataHora).toISOString(),
        };

        endpoint = edicao?.tipo === "LEMBRETE"
          ? `/api/lembretes/${edicao.item.id}`
          : "/api/lembretes";
      }

      const method = edicao ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");

      const estavaEditando = Boolean(edicao);
      setEdicao(null);
      formElement.reset();

      const categoria = tipo === "AGENDAMENTO"
        ? "Agendamento"
        : tipo === "MANUTENCAO" ? "Manutenção" : "Lembrete";

      setSuccess(
        estavaEditando
          ? `${categoria} atualizado.`
          : `${categoria} cadastrado com sucesso.`
      );

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar programação.");
    } finally {
      setSaving(false);
    }
  }
  async function excluir(
    item: Agendamento | Manutencao | Lembrete,
    novoTipo: Tipo
  ) {
    const descricao = novoTipo === "AGENDAMENTO"
      ? `${(item as Agendamento).origem} para ${(item as Agendamento).destino}`
      : novoTipo === "MANUTENCAO"
        ? (item as Manutencao).descricao
        : (item as Lembrete).descricao;

    if (!window.confirm(`Deseja excluir esta programação?\n\n${descricao}`)) return;

    setError("");
    setSuccess("");

    try {
      const endpoint = novoTipo === "AGENDAMENTO"
        ? `/api/agendamentos/${item.id}`
        : novoTipo === "MANUTENCAO"
          ? `/api/manutencoes/${item.id}`
          : `/api/lembretes/${item.id}`;

      const response = await fetch(endpoint, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(result.error || "Não foi possível excluir.");

      if (edicao && edicao.item.id === item.id && edicao.tipo === novoTipo) {
        setEdicao(null);
      }

      setSuccess("Programação excluída com sucesso.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir programação.");
    }
  }
  const lista = [
    ...agendamentos.map((item) => ({
      tipo: "AGENDAMENTO" as const,
      item,
      data: new Date(item.dataHora).getTime(),
    })),
    ...manutencoes.map((item) => ({
      tipo: "MANUTENCAO" as const,
      item,
      data: item.dataHora ? new Date(item.dataHora).getTime() : Number.MAX_SAFE_INTEGER,
    })),
    ...lembretes.map((item) => ({
      tipo: "LEMBRETE" as const,
      item,
      data: new Date(item.dataHora).getTime(),
    })),
  ]
    .filter((registro) => filtro === "TODOS" || registro.tipo === filtro)
    .sort((a, b) => a.data - b.data);
  const editandoAgendamento = edicao?.tipo === "AGENDAMENTO" ? edicao.item : null;
  const editandoManutencao = edicao?.tipo === "MANUTENCAO" ? edicao.item : null;
  const editandoLembrete = edicao?.tipo === "LEMBRETE" ? edicao.item : null;

  return (
    <ScreenAssembly className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programações</h1>
          <p className="text-sm text-muted-foreground">
            Centralize agendamentos e manutenções da frota em um só lugar.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Agendamentos</p>
              <p className="text-2xl font-bold">{agendamentos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Manutenções</p>
              <p className="text-2xl font-bold">{manutencoes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lembretes</p>
              <p className="text-2xl font-bold">{lembretes.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {edicao ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {edicao ? "Editar programação" : "Nova programação"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={tipo === "AGENDAMENTO" ? "default" : "outline"}
              onClick={() => { setTipo("AGENDAMENTO"); setEdicao(null); setError(""); }}
              disabled={saving}
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Agendamento
            </Button>
            <Button
              type="button"
              variant={tipo === "MANUTENCAO" ? "default" : "outline"}
              onClick={() => { setTipo("MANUTENCAO"); setEdicao(null); setError(""); }}
              disabled={saving}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Manutenção
            </Button>
            <Button
              type="button"
              variant={tipo === "LEMBRETE" ? "default" : "outline"}
              onClick={() => { setTipo("LEMBRETE"); setEdicao(null); setError(""); }}
              disabled={saving}
            >
              <Bell className="mr-2 h-4 w-4" />
              Lembrete
            </Button>
          </div>

          <form
            key={`${tipo}-${edicao ? edicao.item.id : "novo"}`}
            onSubmit={salvar}
            className="grid gap-4 md:grid-cols-2"
          >
            {tipo !== "LEMBRETE" && (
              <div>
                <label className={labelClass}>Caminhão</label>
                <select
                  name="caminhaoId"
                  className={fieldClass}
                  required
                  defaultValue={
                    editandoAgendamento?.caminhaoId ||
                    editandoAgendamento?.caminhao?.id ||
                    editandoManutencao?.caminhaoId ||
                    editandoManutencao?.caminhao?.id ||
                    ""
                  }
                >
                  <option value="" disabled>Selecione um caminhão</option>
                  {caminhoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.placa} {c.marca ? `- ${c.marca}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tipo === "AGENDAMENTO" ? (
              <>
                <div>
                  <label className={labelClass}>Peso previsto (kg)</label>
                  <input
                    name="peso"
                    type="number"
                    min="0.001"
                    step="0.001"
                    className={fieldClass}
                    required
                    placeholder="Ex.: 12000"
                    defaultValue={editandoAgendamento ? String(Number(editandoAgendamento.peso)) : ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>Data e horário</label>
                  <input
                    name="dataHora"
                    type="datetime-local"
                    className={fieldClass}
                    required
                    defaultValue={dataLocalInput(editandoAgendamento?.dataHora || null)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Origem</label>
                  <input
                    name="origem"
                    minLength={2}
                    className={fieldClass}
                    required
                    placeholder="Local de origem"
                    defaultValue={editandoAgendamento?.origem || ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>Destino</label>
                  <input
                    name="destino"
                    minLength={2}
                    className={fieldClass}
                    required
                    placeholder="Local de destino"
                    defaultValue={editandoAgendamento?.destino || ""}
                  />
                </div>
              </>
            ) : tipo === "MANUTENCAO" ? (
              <>
                <div>
                  <label className={labelClass}>Descrição do serviço</label>
                  <input
                    name="descricao"
                    minLength={2}
                    className={fieldClass}
                    required
                    placeholder="Ex.: Troca de óleo"
                    defaultValue={editandoManutencao?.descricao || ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>Data e horário (opcional)</label>
                  <input
                    name="dataHora"
                    type="datetime-local"
                    className={fieldClass}
                    defaultValue={dataLocalInput(editandoManutencao?.dataHora || null)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Quilometragem-alvo (opcional)</label>
                  <input
                    name="quilometragemAlvo"
                    type="number"
                    min="1"
                    step="1"
                    className={fieldClass}
                    placeholder="Ex.: 150000"
                    defaultValue={editandoManutencao?.quilometragemAlvo ?? ""}
                  />
                </div>
                <p className="self-end text-xs text-muted-foreground">
                  Informe pelo menos uma referência: data ou quilometragem.
                </p>
              </>
            ) : (
              <>
                <div className="md:col-span-2">
                  <label className={labelClass}>Descrição do lembrete</label>
                  <textarea
                    name="descricao"
                    minLength={2}
                    maxLength={500}
                    rows={3}
                    className={fieldClass}
                    required
                    placeholder="Ex.: Levar o caminhão ABC-1234 para a oficina."
                    defaultValue={editandoLembrete?.descricao || ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>Data e horário</label>
                  <input
                    name="dataHora"
                    type="datetime-local"
                    className={fieldClass}
                    required
                    defaultValue={dataLocalInput(editandoLembrete?.dataHora || null)}
                  />
                </div>
                <p className="self-end text-xs text-muted-foreground">
                  O lembrete será enviado aos dispositivos cadastrados quando o serviço de notificações estiver ativo.
                </p>
              </>
            )}

            <div className="flex flex-wrap items-end gap-2 md:col-span-2">
              <Button
                type="submit"
                disabled={
                  saving ||
                  (tipo === "LEMBRETE"
                    ? !lembretesDisponiveis
                    : caminhoes.length === 0)
                }
              >
                {saving ? "Salvando..." : edicao ? "Salvar alterações" : "Cadastrar programação"}
              </Button>
              {edicao && (
                <Button type="button" variant="outline" onClick={cancelarEdicao} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar edição
                </Button>
              )}
            </div>
          </form>

          {tipo === "LEMBRETE" && !lembretesDisponiveis && (
            <p className="mt-3 text-sm text-amber-600">
              Não foi possível carregar os lembretes. Verifique sua conexão e tente novamente.
            </p>
          )}
          {tipo !== "LEMBRETE" && caminhoes.length === 0 && !loading && (
            <p className="mt-3 text-sm text-muted-foreground">
              Cadastre um caminhão antes de criar uma programação.
            </p>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {success && <p role="status" className="mt-4 text-sm text-green-600">{success}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Todas as programações
            </CardTitle>
            <select
              className={`${fieldClass} w-full sm:w-48`}
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
              aria-label="Filtrar programações"
            >
              <option value="TODOS">Todas as categorias</option>
              <option value="AGENDAMENTO">Agendamentos</option>
              <option value="MANUTENCAO">Manutenções</option>
              <option value="LEMBRETE">Lembretes</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <RecordListSkeleton rows={4} />
          ) : lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma programação encontrada.
            </p>
          ) : (
            <div className="space-y-3">
              {lista.map((registro) => {
                const agendamento = registro.tipo === "AGENDAMENTO"
                  ? registro.item as Agendamento
                  : null;
                const manutencao = registro.tipo === "MANUTENCAO"
                  ? registro.item as Manutencao
                  : null;
                const lembrete = registro.tipo === "LEMBRETE"
                  ? registro.item as Lembrete
                  : null;

                return (
                  <div
                    key={`${registro.tipo}-${registro.item.id}`}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                        {agendamento
                          ? <><CalendarClock className="h-3 w-3" /> Agendamento</>
                          : manutencao
                            ? <><Wrench className="h-3 w-3" /> Manutenção</>
                            : <><Bell className="h-3 w-3" /> Lembrete</>}
                      </span>

                      <p className="font-semibold">
                        {agendamento
                          ? `${agendamento.origem} → ${agendamento.destino}`
                          : manutencao?.descricao || lembrete?.descricao}
                      </p>

                      {(agendamento || manutencao) && (
                        <p className="text-sm text-muted-foreground">
                          <Truck className="mr-1 inline h-4 w-4" />
                          {agendamento?.caminhao?.placa || manutencao?.caminhao?.placa || "Caminhão não informado"}
                        </p>
                      )}

                      <p className="text-sm text-muted-foreground">
                        <CalendarClock className="mr-1 inline h-4 w-4" />
                        {formatarData(agendamento?.dataHora || manutencao?.dataHora || lembrete?.dataHora || null)}
                      </p>

                      {agendamento && (
                        <p className="text-sm text-muted-foreground">
                          {Number(agendamento.peso).toLocaleString("pt-BR")} kg · {agendamento.status}
                        </p>
                      )}

                      {manutencao?.quilometragemAlvo != null && (
                        <p className="text-sm text-muted-foreground">
                          <Gauge className="mr-1 inline h-4 w-4" />
                          Meta: {Number(manutencao.quilometragemAlvo).toLocaleString("pt-BR")} km
                        </p>
                      )}

                      {manutencao && (
                        <p className="text-sm text-muted-foreground">{manutencao.status}</p>
                      )}

                      {lembrete && (
                        <p className="text-sm text-muted-foreground">
                          Situação: {lembrete.status === "PENDENTE"
                            ? "Pendente"
                            : lembrete.status === "PROCESSANDO"
                              ? "Enviando"
                              : lembrete.status === "ENVIADO" ? "Enviado" : "Cancelado"}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {(!lembrete || lembrete.status === "PENDENTE") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => iniciarEdicao(registro.item, registro.tipo)}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Editar
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => void excluir(registro.item, registro.tipo)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </ScreenAssembly>
  );
}
