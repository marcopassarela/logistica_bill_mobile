"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Entrega = {
  id: string;
  carregamentoId: string;
  entregue: boolean;
  entregaFotoPath: string | null;
  entregaFotoNome: string | null;
  entregaFotoCriadaEm: string | null;
  entregueEm: string | null;
  entregaObservacao: string | null;
  entregaConfirmadaPorNome: string | null;
  descricaoLivre: string | null;
  ordemServico: string | null;
  clienteNome: string | null;
  clienteCidade: string | null;
  clienteBairro: string | null;
  adicionais: {
    id: string;
    descricao: string;
    ordem: number;
  }[];
  carregamento: {
    id: string;
    data: string;
    origem: string | null;
    destino: string | null;
    status: string;
    motorista: { id: string; nome: string } | null;
    ajudante: { id: string; nome: string } | null;
    caminhao: { placa: string } | null;
  };
};

function formatarData(valor: string | null) {
  if (!valor) return "—";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return "—";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EntregasConcluidasPage() {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<Entrega | null>(null);
  const [editando, setEditando] = useState<Entrega | null>(null);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [zoomFoto, setZoomFoto] = useState(1);

  useEffect(() => {
    setZoomFoto(1);
  }, [selecionada?.id]);

  const carregarEntregas = useCallback(async () => {
    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/entregas", {
        cache: "no-store",
      });

      if (!resposta.ok) {
        throw new Error(
          resposta.status === 403
            ? "Você não tem permissão para visualizar as entregas."
            : "Não foi possível carregar o histórico de entregas."
        );
      }

      const dados = await resposta.json();

      if (!Array.isArray(dados)) {
        throw new Error("A resposta do histórico está em formato inesperado.");
      }

      setEntregas(dados);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao carregar entregas."
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarEntregas();
  }, [carregarEntregas]);

  const entregasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    if (!termo) return entregas;

    return entregas.filter((entrega) => {
      const campos = [
        entrega.clienteNome,
        entrega.clienteCidade,
        entrega.clienteBairro,
        entrega.descricaoLivre,
        entrega.ordemServico,
        entrega.carregamento.motorista?.nome,
        entrega.carregamento.caminhao?.placa,
      ];

      return campos.some((campo) =>
        campo?.toLocaleLowerCase("pt-BR").includes(termo)
      );
    });
  }, [entregas, busca]);

  async function salvarObservacao() {
    if (!editando || salvando) return;

    setSalvando(true);

    try {
      const resposta = await fetch(
        `/api/entregas/${encodeURIComponent(editando.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ observacao }),
        }
      );

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(dados.error || "Não foi possível salvar a observação.");
      }

      setEntregas((anteriores) =>
        anteriores.map((item) =>
          item.id === editando.id
            ? { ...item, entregaObservacao: observacao.trim() || null }
            : item
        )
      );

      setSelecionada((atual) =>
        atual?.id === editando.id
          ? { ...atual, entregaObservacao: observacao.trim() || null }
          : atual
      );

      setEditando(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirConfirmacao(entrega: Entrega) {
    const confirmar = window.confirm(
      `Deseja excluir a confirmação de entrega de ${entrega.clienteNome || "este cliente"}?\n\nA fotografia será excluída e o item voltará para Não concluída. O carregamento e os dados comerciais serão preservados.`
    );

    if (!confirmar) return;

    setExcluindo(entrega.id);

    try {
      const resposta = await fetch(
        `/api/entregas/${encodeURIComponent(entrega.id)}`,
        { method: "DELETE" }
      );

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(dados.error || "Não foi possível excluir a confirmação.");
      }

      setEntregas((anteriores) =>
        anteriores.map((item) =>
          item.id === entrega.id
            ? {
                ...item,
                entregue: false,
                entregaFotoPath: null,
                entregaFotoNome: null,
                entregaFotoCriadaEm: null,
                entregueEm: null,
                entregaObservacao: null,
                entregaConfirmadaPorNome: null,
              }
            : item
        )
      );

      setSelecionada((atual) =>
        atual?.id === entrega.id ? null : atual
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir.");
    } finally {
      setExcluindo(null);
    }
  }

  const totalConcluidas = entregas.filter((item) => item.entregue).length;
  const totalPendentes = entregas.length - totalConcluidas;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Entregas concluídas
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de confirmações e comprovantes de entrega.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void carregarEntregas()}
          disabled={carregando}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">Concluídas</p>
              <p className="text-2xl font-bold">{totalConcluidas}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Não concluídas</p>
              <p className="text-2xl font-bold">{totalPendentes}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de entregas</CardTitle>
          <CardDescription>
            Consulte os comprovantes, observações e responsáveis pelas entregas.
          </CardDescription>

          <div className="relative pt-2">
            <Search className="absolute left-3 top-5 h-4 w-4 text-muted-foreground" />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar cliente, motorista, produto ou placa..."
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </CardHeader>

        <CardContent>
          {erro && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erro}
            </div>
          )}

          {carregando ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : entregasFiltradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {busca
                ? "Nenhuma entrega encontrada para essa pesquisa."
                : "Nenhuma entrega encontrada no histórico."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-3 font-medium">Cliente</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Data/Hora</th>
                    <th className="px-3 py-3 font-medium">Motorista</th>
                    <th className="px-3 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {entregasFiltradas.map((entrega) => (
                    <tr key={entrega.id} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-medium">
                          {entrega.clienteNome || "Não informado"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entrega.ordemServico
                            ? `OS: ${entrega.ordemServico}`
                            : entrega.descricaoLivre || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        {entrega.entregue ? (
                          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Concluída
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            Não concluída
                          </Badge>
                        )}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        {formatarData(entrega.entregueEm)}
                      </td>

                      <td className="px-3 py-3">
                        {entrega.carregamento.motorista?.nome || "—"}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          {entrega.entregue && (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                title="Visualizar entrega"
                                onClick={() => setSelecionada(entrega)}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                title="Editar observação"
                                onClick={() => {
                                  setObservacao(entrega.entregaObservacao || "");
                                  setEditando(entrega);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                title="Excluir confirmação"
                                disabled={excluindo === entrega.id}
                                onClick={() => void excluirConfirmacao(entrega)}
                              >
                                {excluindo === entrega.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selecionada && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelecionada(null);
          }}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background p-4">
              <div>
                <h2 className="font-semibold">Comprovante de entrega</h2>
                <p className="text-xs text-muted-foreground">
                  {selecionada.clienteNome || "Cliente não informado"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelecionada(null)}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selecionada.clienteNome || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">{formatarData(selecionada.entregueEm)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Motorista</p>
                  <p className="font-medium">
                    {selecionada.carregamento.motorista?.nome || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Confirmado por</p>
                  <p className="font-medium">
                    {selecionada.entregaConfirmadaPorNome || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Produto / Descrição</p>
                  <p className="font-medium">
                    {selecionada.descricaoLivre || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ordem de serviço</p>
                  <p className="font-medium">{selecionada.ordemServico || "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Endereço</p>
                  <p className="font-medium">
                    {[selecionada.clienteBairro, selecionada.clienteCidade,
                      selecionada.carregamento.destino]
                      .filter(Boolean)
                      .join(" • ") || "—"}
                  </p>
                </div>
              </div>

              {selecionada.adicionais.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Adicionais</p>
                  <ul className="list-inside list-disc text-sm">
                    {selecionada.adicionais.map((adicional) => (
                      <li key={adicional.id}>{adicional.descricao}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs text-muted-foreground">Fotografia do comprovante</p>

                {selecionada.entregaFotoPath ? (
                  <div>
                    <div className="mb-3 flex items-center justify-center gap-2">
                      <Button type="button" size="icon" variant="outline"
                        onClick={() => setZoomFoto((v) => Math.max(1, v - 0.25))}
                        disabled={zoomFoto <= 1} title="Diminuir zoom">
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="min-w-16 text-center text-xs text-muted-foreground">
                        {Math.round(zoomFoto * 100)}%
                      </span>
                      <Button type="button" size="icon" variant="outline"
                        onClick={() => setZoomFoto((v) => Math.min(3, v + 0.25))}
                        disabled={zoomFoto >= 3} title="Aumentar zoom">
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="outline"
                        onClick={() => setZoomFoto(1)}
                        disabled={zoomFoto === 1} title="Restaurar zoom">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="max-h-[65vh] overflow-auto rounded-lg border bg-black/5 p-2">
                      <img
                        src={`/api/entregas/${encodeURIComponent(selecionada.id)}/foto`}
                        alt="Fotografia do comprovante de entrega"
                        className="mx-auto h-auto max-h-[65vh] w-auto max-w-full object-contain"
                        style={{ zoom: zoomFoto }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    A fotografia expirou após sete dias. O histórico da entrega foi preservado.
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Observação</p>
                <p className="whitespace-pre-wrap text-sm">
                  {selecionada.entregaObservacao || "Nenhuma observação registrada."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3">
          <div className="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Editar observação</h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setEditando(null)}
                disabled={salvando}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              {editando.clienteNome || "Cliente não informado"}
            </p>

            <textarea
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Digite uma observação sobre a entrega..."
              className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <p className="mt-1 text-right text-xs text-muted-foreground">
              {observacao.length}/2000
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditando(null)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void salvarObservacao()}
                disabled={salvando || observacao.length > 2000}
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar observação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}