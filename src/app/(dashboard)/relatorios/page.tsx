"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  FileBarChart,
  FileSpreadsheet,
  Printer,
  CalendarDays,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";

type Registro = Record<string, unknown>;
type Coluna = { key: string; label: string };
type Relatorio = {
  titulo: string;
  colunas: Coluna[];
  linhas: Registro[];
  resumo: { rotulo: string; valor: string }[];
};

const tipos = [
  { id: "diario", label: "Diárias" },
  { id: "detalhe", label: "Detalhamento das Diarias" },
  { id: "funcionario", label: "Por Funcionário" },
  { id: "caminhao", label: "Por Caminhão" },
  { id: "falta", label: "Faltas" },
  { id: "carregamento", label: "Carregamentos" },
  { id: "geral", label: "Geral do Sistema" },
] as const;

type Tipo = (typeof tipos)[number]["id"];

const dinheiro = (valor: unknown) =>
  formatCurrency(Number(valor ?? 0));

function dataISO(valor: unknown): string {
  if (!valor) return "";
  const d = new Date(String(valor));
  if (Number.isNaN(d.getTime())) return "";
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function dataBR(valor: unknown): string {
  const iso = dataISO(valor);
  return iso ? iso.split("-").reverse().join("/") : "";
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return String(valor);
}

function dentroDoPeriodo(
  registro: Registro,
  inicio: string,
  fim: string,
): boolean {
  const dia = dataISO(registro.data);
  if (!dia) return false;
  if (inicio && dia < inicio) return false;
  if (fim && dia > fim) return false;
  return true;
}

async function consultar(endpoint: string): Promise<Registro[]> {
  const resposta = await fetch(endpoint, { cache: "no-store" });
  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    throw new Error(
      typeof corpo?.error === "string"
        ? corpo.error
        : `Falha ao consultar ${endpoint} (${resposta.status}).`,
    );
  }

  if (!Array.isArray(corpo)) {
    throw new Error(`A API ${endpoint} retornou um formato inesperado.`);
  }

  return corpo as Registro[];
}

function agrupar(
  registros: Registro[],
  chave: (r: Registro) => string,
) {
  const mapa = new Map<string, { nome: string; quantidade: number; total: number }>();

  for (const r of registros) {
    const nome = chave(r) || "Não informado";
    const atual = mapa.get(nome) || { nome, quantidade: 0, total: 0 };
    atual.quantidade += 1;
    atual.total += Number(r.valor ?? 0);
    mapa.set(nome, atual);
  }

  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState<Tipo>("diario");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [emissao, setEmissao] = useState("");
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gerado, setGerado] = useState(false);
  const [baixarAberto, setBaixarAberto] = useState(false);

  const periodo = useMemo(() => {
    if (dataInicio && dataFim) {
      return `${dataBR(`${dataInicio}T12:00:00`)} a ${dataBR(`${dataFim}T12:00:00`)}`;
    }
    if (dataInicio) return `A partir de ${dataBR(`${dataInicio}T12:00:00`)}`;
    if (dataFim) return `Até ${dataBR(`${dataFim}T12:00:00`)}`;
    return "Todo o período disponível";
  }, [dataInicio, dataFim]);

  async function gerarRelatorio() {
    setLoading(true);
    setError("");
    setGerado(false);
    setRelatorio(null);

    try {
      let diarias: Registro[] = [];
      let faltas: Registro[] = [];
      let carregamentos: Registro[] = [];
      let funcionarios: Registro[] = [];
      let caminhoes: Registro[] = [];

      if (tipo === "diario" || tipo === "detalhe" || tipo === "funcionario" || tipo === "caminhao" || tipo === "geral") {
        diarias = (await consultar("/api/diarias")).filter(
          (r) => dentroDoPeriodo(r, dataInicio, dataFim),
        );
      }

      if (tipo === "falta" || tipo === "geral") {
        faltas = (await consultar("/api/faltas")).filter(
          (r) => dentroDoPeriodo(r, dataInicio, dataFim),
        );
      }

      if (tipo === "carregamento" || tipo === "geral") {
        carregamentos = (await consultar("/api/carregamentos")).filter(
          (r) => dentroDoPeriodo(r, dataInicio, dataFim),
        );
      }

      if (tipo === "geral") {
        [funcionarios, caminhoes] = await Promise.all([
          consultar("/api/funcionarios"),
          consultar("/api/caminhoes"),
        ]);
      }

      let novo: Relatorio;

      if (tipo === "diario") {
        const grupos = agrupar(diarias, (r) =>
          texto((r.funcionario as Registro | null)?.nome),
        );
        const total = diarias.reduce((s, r) => s + Number(r.valor ?? 0), 0);

        novo = {
          titulo: "Resumo de Diarias por Motorista",
          colunas: [
            { key: "nome", label: "Motorista" },
            { key: "quantidade", label: "Quantidade de diarias" },
            { key: "total", label: "Total a receber" },
          ],
          linhas: grupos.map((g) => ({
            nome: g.nome,
            quantidade: g.quantidade,
            total: g.total,
          })),
          resumo: [
            { rotulo: "Motoristas", valor: String(grupos.length) },
            { rotulo: "Diarias registradas", valor: String(diarias.length) },
            { rotulo: "Total geral a pagar", valor: dinheiro(total) },
          ],
        };
      } else if (tipo === "detalhe") {
        const total = diarias.reduce((s, r) => s + Number(r.valor ?? 0), 0);
        novo = {
          titulo: "Detalhamento das Diarias",
          colunas: [
            { key: "data", label: "Data" },
            { key: "funcionario", label: "Funcionário" },
            { key: "caminhao", label: "Caminhão" },
            { key: "valor", label: "Valor" },
            { key: "observacao", label: "Observação" },
          ],
          linhas: diarias.map((r) => ({
            data: dataBR(r.data),
            funcionario: texto((r.funcionario as Registro | null)?.nome),
            caminhao: texto((r.caminhao as Registro | null)?.placa),
            valor: Number(r.valor ?? 0),
            observacao: texto(r.observacao),
          })),
          resumo: [
            { rotulo: "Registros", valor: String(diarias.length) },
            { rotulo: "Valor total", valor: dinheiro(total) },
          ],
        };
      } else if (tipo === "funcionario") {
        const grupos = agrupar(diarias, (r) =>
          texto((r.funcionario as Registro | null)?.nome),
        );
        novo = {
          titulo: "Relatório de Diárias por Funcionário",
          colunas: [
            { key: "nome", label: "Funcionário" },
            { key: "quantidade", label: "Quantidade de diárias" },
            { key: "total", label: "Valor total" },
          ],
          linhas: grupos.map((g) => ({
            nome: g.nome,
            quantidade: g.quantidade,
            total: g.total,
          })),
          resumo: [
            { rotulo: "Funcionários com diárias", valor: String(grupos.length) },
            { rotulo: "Diárias no período", valor: String(diarias.length) },
            {
              rotulo: "Valor total",
              valor: dinheiro(diarias.reduce((s, r) => s + Number(r.valor ?? 0), 0)),
            },
          ],
        };
      } else if (tipo === "caminhao") {
        const grupos = agrupar(diarias, (r) =>
          texto((r.caminhao as Registro | null)?.placa),
        );
        novo = {
          titulo: "Relatório de Diárias por Caminhão",
          colunas: [
            { key: "nome", label: "Caminhão" },
            { key: "quantidade", label: "Quantidade de diárias" },
            { key: "total", label: "Valor total" },
          ],
          linhas: grupos.map((g) => ({
            nome: g.nome,
            quantidade: g.quantidade,
            total: g.total,
          })),
          resumo: [
            { rotulo: "Grupos de caminhão", valor: String(grupos.length) },
            { rotulo: "Diárias no período", valor: String(diarias.length) },
            {
              rotulo: "Valor total",
              valor: dinheiro(diarias.reduce((s, r) => s + Number(r.valor ?? 0), 0)),
            },
          ],
        };
      } else if (tipo === "falta") {
        const tiposFalta: Record<string, string> = {
          FALTA: "Falta",
          ATESTADO: "Atestado",
          FOLGA: "Folga",
          LICENCA: "Licença",
          OUTRO: "Outro",
        };
        novo = {
          titulo: "Relatório de Faltas e Ocorrências",
          colunas: [
            { key: "data", label: "Data" },
            { key: "funcionario", label: "Funcionário" },
            { key: "tipo", label: "Tipo" },
            { key: "justificativa", label: "Justificativa" },
          ],
          linhas: faltas.map((r) => ({
            data: dataBR(r.data),
            funcionario: texto((r.funcionario as Registro | null)?.nome),
            tipo: tiposFalta[String(r.tipo)] || texto(r.tipo),
            justificativa: texto(r.justificativa),
          })),
          resumo: [
            { rotulo: "Ocorrências", valor: String(faltas.length) },
            {
              rotulo: "Faltas registradas",
              valor: String(faltas.filter((r) => r.tipo === "FALTA").length),
            },
            {
              rotulo: "Atestados",
              valor: String(faltas.filter((r) => r.tipo === "ATESTADO").length),
            },
          ],
        };
      } else if (tipo === "carregamento") {
        novo = {
          titulo: "Relatório de Carregamentos",
          colunas: [
            { key: "data", label: "Data" },
            { key: "caminhao", label: "Caminhão" },
            { key: "origem", label: "Origem" },
            { key: "destino", label: "Destino" },
            { key: "peso", label: "Peso total (kg)" },
            { key: "status", label: "Status" },
          ],
          linhas: carregamentos.map((r) => ({
            data: dataBR(r.data),
            caminhao: texto((r.caminhao as Registro | null)?.placa),
            origem: texto(r.origem),
            destino: texto(r.destino),
            peso: Number(r.pesoTotal ?? 0),
            status: texto(r.status),
          })),
          resumo: [
            { rotulo: "Carregamentos", valor: String(carregamentos.length) },
            {
              rotulo: "Peso total (kg)",
              valor: carregamentos.reduce((s, r) => s + Number(r.pesoTotal ?? 0), 0).toLocaleString("pt-BR"),
            },
            {
              rotulo: "Finalizados",
              valor: String(carregamentos.filter((r) => r.status === "FINALIZADO").length),
            },
          ],
        };
      } else {
        novo = {
          titulo: "Relatório Geral do Sistema",
          colunas: [
            { key: "modulo", label: "Módulo" },
            { key: "quantidade", label: "Registros encontrados" },
            { key: "detalhe", label: "Observação" },
          ],
          linhas: [
            { modulo: "Diárias", quantidade: diarias.length, detalhe: "Registros no período selecionado" },
            { modulo: "Faltas", quantidade: faltas.length, detalhe: "Registros no período selecionado" },
            { modulo: "Carregamentos", quantidade: carregamentos.length, detalhe: "Registros no período selecionado" },
            { modulo: "Funcionários", quantidade: funcionarios.length, detalhe: "Cadastro atual; sem filtro por data" },
            { modulo: "Caminhões", quantidade: caminhoes.length, detalhe: "Cadastro atual; sem filtro por data" },
          ],
          resumo: [
            {
              rotulo: "Registros operacionais",
              valor: String(diarias.length + faltas.length + carregamentos.length),
            },
            { rotulo: "Funcionários cadastrados", valor: String(funcionarios.length) },
            { rotulo: "Caminhões cadastrados", valor: String(caminhoes.length) },
          ],
        };
      }

      setRelatorio(novo);
      setEmissao(new Date().toLocaleString("pt-BR"));
      setGerado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void gerarRelatorio();
  }, [tipo, dataInicio, dataFim]);

  function exportarExcel() {
    if (!relatorio) return;

    const dados = relatorio.linhas.map((linha) => {
      const item: Record<string, unknown> = {};
      for (const coluna of relatorio.colunas) {
        item[coluna.label] = linha[coluna.key] ?? "";
      }
      return item;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Logísticas Bill"],
      [relatorio.titulo],
      [`Período do relatório: ${periodo}`],
      [`Gerado em: ${emissao}`],
      [],
      ...relatorio.resumo.map((r) => [r.rotulo, r.valor]),
      [],
      relatorio.colunas.map((c) => c.label),
      ...dados.map((d) => relatorio.colunas.map((c) => d[c.label] ?? "")),
    ]);

    ws["!cols"] = relatorio.colunas.map((c) => ({
      wch: Math.max(c.label.length + 3, 20),
    }));

    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    const nome = relatorio.titulo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    XLSX.writeFile(wb, `${nome || "relatorio"}.xlsx`);
  }

  return (
    <div className="min-w-0 w-full space-y-4 sm:space-y-6 reports-page">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #report-print, #report-print * { visibility: visible !important; }
          #report-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #111 !important;
            background: #fff !important;
          }
          .no-print { display: none !important; }
          #report-print table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          #report-print th, #report-print td {
            border: 1px solid #bbb !important;
            padding: 7px !important;
            color: #111 !important;
          }
          #report-print th { background: #eee !important; }
          #report-print tr { break-inside: avoid; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>

      <div className="no-print">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere, confira e exporte relatórios com dados reais do sistema.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        <Card className="no-print min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileBarChart className="h-5 w-5" />
              Configurar relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de relatório</Label>
              <div className="grid grid-cols-1 gap-2">
                {tipos.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTipo(t.id);
                      setRelatorio(null);
                      setGerado(false);
                      setError("");
                    }}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      tipo === t.id
                        ? "border-primary bg-primary/10 font-semibold"
                        : "hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            <Button
              className="w-full"
              onClick={() => setBaixarAberto(true)}
              disabled={loading || !gerado || !relatorio}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Baixar
            </Button>

            <Dialog open={baixarAberto} onOpenChange={setBaixarAberto}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Baixar relatório</DialogTitle>
                  <DialogDescription>
                    Escolha o formato do relatório.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    onClick={() => {
                      exportarExcel();
                      setBaixarAberto(false);
                    }}
                    disabled={!relatorio}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel (.xlsx)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setBaixarAberto(false);
                      window.print();
                    }}
                    disabled={!relatorio}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Para salvar em PDF, selecione “Salvar como PDF” na janela de impressão.
                </p>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-3">
          <CardHeader className="no-print">
            <CardTitle className="text-base">Pré-visualização {tipos.find((t) => t.id === tipo)?.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
                <strong>Não foi possível gerar o relatório.</strong>
                <p className="mt-1">{error}</p>
                <p className="mt-2 text-muted-foreground">
                  Confira se sua sessão está ativa e tente novamente.
                </p>
              </div>
            ) : loading ? (
              <div className="py-16 text-center text-muted-foreground">
                Consultando os dados do sistema...
              </div>
            ) : !gerado || !relatorio ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <FileDown className="h-10 w-10" />
                <p className="font-medium">Seu relatório será exibido aqui.</p>
                <p className="max-w-sm text-sm">
                  A pré-visualização é atualizada automaticamente ao selecionar o tipo ou alterar o período.
                </p>
              </div>
            ) : (
              <div id="report-print" className="space-y-5">
                <div className="border-b pb-4 text-left">
  <div className="flex items-center gap-4">
    <Logo className="h-12 w-12 shrink-0 sm:h-16 sm:w-16" />
    <div className="min-w-0">
      <h2 className="text-xl font-bold sm:text-2xl">Logísticas Bill</h2>
      <p className="mt-1 text-sm font-medium text-muted-foreground">
        Controle Operacional
      </p>
    </div>
  </div>

  <div className="mt-4 border-t pt-3">
    <p className="text-sm font-semibold">{relatorio.titulo}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-xs text-muted-foreground">Período do relatório</p>
        <p className="mt-1 text-sm">{periodo}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Data de emissão</p>
        <p className="mt-1 text-sm">{emissao}</p>
      </div>
    </div>
  </div>
</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {relatorio.resumo.map((item) => (
                    <div key={item.rotulo} className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">{item.rotulo}</p>
                      <p className="mt-1 text-xl font-bold">{item.valor}</p>
                    </div>
                  ))}
                </div>

                <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border">
                  <table className="min-w-[520px] w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {relatorio.colunas.map((c) => (
                          <th key={c.key} className="whitespace-nowrap p-3 text-left font-semibold">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.linhas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={relatorio.colunas.length}
                            className="p-8 text-center text-muted-foreground"
                          >
                            Nenhum registro encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        relatorio.linhas.map((linha, i) => (
                          <tr key={i} className="border-t">
                            {relatorio.colunas.map((c) => {
                              const valor = linha[c.key];
                              const numerico = typeof valor === "number";
                              const moeda = c.key === "valor" || c.key === "total";
                              return (
                                <td key={c.key} className={`p-3 ${numerico ? "text-right tabular-nums" : ""}`}>
                                  {moeda && numerico ? dinheiro(valor) : texto(valor)}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>Documento emitido pelo sistema Logísticas Bill.</span>
                    <span>Período: {periodo}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
