"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart, Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type Diaria = {
  id: string;
  funcionarioId: string;
  caminhaoId: string | null;
  data: string;
  valor: number | string;
  observacao?: string | null;
  funcionario?: { id: string; nome: string } | null;
  caminhao?: { id: string; placa: string } | null;
};

const tipos = [
  { id: "diario", label: "Diárias" },
  { id: "funcionario", label: "Por Funcionário" },
  { id: "caminhao", label: "Por Caminhão" },
  { id: "falta", label: "Faltas" },
  { id: "carregamento", label: "Carregamentos" },
  { id: "geral", label: "Geral do Sistema" },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState("diario");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [diarias, setDiarias] = useState<Diaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function carregarDiarias() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/diarias", { cache: "no-store" });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Não foi possível carregar as diárias."
        );
      }

      if (!Array.isArray(body)) {
        throw new Error("A API retornou um formato inesperado.");
      }

      setDiarias(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregarDiarias();
  }, []);

  const filtradas = useMemo(() => {
    return diarias.filter((diaria) => {
      const dia = new Date(diaria.data).toISOString().slice(0, 10);
      if (dataInicio && dia < dataInicio) return false;
      if (dataFim && dia > dataFim) return false;
      return true;
    });
  }, [diarias, dataInicio, dataFim]);

  const total = filtradas.reduce((soma, diaria) => soma + Number(diaria.valor), 0);

  const porFuncionario = useMemo(() => {
    const grupos = new Map<string, { nome: string; quantidade: number; total: number }>();

    for (const diaria of filtradas) {
      const id = diaria.funcionarioId;
      const nome = diaria.funcionario?.nome || "Funcionário não identificado";
      const atual = grupos.get(id) || { nome, quantidade: 0, total: 0 };
      atual.quantidade += 1;
      atual.total += Number(diaria.valor);
      grupos.set(id, atual);
    }

    return Array.from(grupos.values()).sort((a, b) => b.total - a.total);
  }, [filtradas]);

  function exportarCSV() {
    const linhas = [
      ["Data", "Funcionário", "Caminhão", "Valor", "Observação"],
      ...filtradas.map((d) => [
        formatDate(d.data),
        d.funcionario?.nome || "Funcionário não identificado",
        d.caminhao?.placa || "",
        Number(d.valor).toFixed(2).replace(".", ","),
        d.observacao || "",
      ]),
      ["", "TOTAL", "", total.toFixed(2).replace(".", ","), ""],
    ];

    const csv = "\uFEFF" + linhas
      .map((linha) => linha.map((campo) =>
        `"${String(campo).replace(/"/g, '""')}"`
      ).join(";"))
      .join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-diarias.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function imprimir() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Consulte e exporte os registros reais do sistema.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Configurar relatório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de relatório</Label>
              <div className="grid grid-cols-1 gap-2">
                {tipos.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipo(t.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      tipo === t.id
                        ? "border-primary bg-primary/10 font-medium"
                        : "hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data inicial</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  max={dataFim || undefined}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data final</Label>
                <Input
                  type="date"
                  value={dataFim}
                  min={dataInicio || undefined}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" onClick={() => void carregarDiarias()} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {loading ? "Carregando..." : "Atualizar"}
              </Button>
              <Button variant="outline" size="icon" onClick={exportarCSV} disabled={tipo !== "diario" || loading}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={imprimir}>
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">
              Pré-visualização  {tipos.find((t) => t.id === tipo)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {error ? (
              <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : tipo !== "diario" ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <FileBarChart className="h-8 w-8" />
                <p className="font-medium">Relatório ainda não implementado</p>
                <p className="text-sm">A consulta funcional disponível nesta tela é a de Diárias.</p>
              </div>
            ) : loading ? (
              <div className="py-12 text-center text-muted-foreground">
                Carregando diárias cadastradas...
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Diárias no período</p>
                    <p className="text-2xl font-bold">{filtradas.length}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Valor total</p>
                    <p className="text-2xl font-bold">{formatCurrency(total)}</p>
                  </div>
                </div>

                {filtradas.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <FileBarChart className="mx-auto mb-2 h-8 w-8" />
                    <p className="font-medium">Nenhuma diária encontrada neste período.</p>
                    <p className="text-sm">Confira as datas ou atualize os registros.</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="mb-3 font-semibold">Resumo por funcionário</h3>
                      <div className="space-y-2">
                        {porFuncionario.map((f) => (
                          <div key={f.nome} className="flex items-center justify-between gap-3 rounded-md border p-3">
                            <div>
                              <p className="font-medium">{f.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {f.quantidade} {f.quantidade === 1 ? "diária" : "diárias"}
                              </p>
                            </div>
                            <p className="font-semibold">{formatCurrency(f.total)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 font-semibold">Detalhamento das diárias</h3>
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="p-3 text-left">Data</th>
                              <th className="p-3 text-left">Funcionário</th>
                              <th className="p-3 text-left">Caminhão</th>
                              <th className="p-3 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtradas.map((d) => (
                              <tr key={d.id} className="border-t">
                                <td className="p-3">{formatDate(d.data)}</td>
                                <td className="p-3">{d.funcionario?.nome || "Não identificado"}</td>
                                <td className="p-3">{d.caminhao?.placa || ""}</td>
                                <td className="p-3 text-right">{formatCurrency(Number(d.valor))}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t bg-muted/50">
                            <tr>
                              <td className="p-3 font-semibold" colSpan={3}>Total</td>
                              <td className="p-3 text-right font-bold">{formatCurrency(total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}