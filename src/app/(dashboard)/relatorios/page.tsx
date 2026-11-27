"use client";

import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { Skeleton } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileBarChart,
  FileSpreadsheet,
  Printer,
  FileDown,
  Users,
  Truck,
  CalendarDays,
  ClipboardList,
  AlertCircle,
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
type SecaoId =
  | "funcionario"
  | "diarias"
  | "faltas"
  | "carregamentos"
  | "caminhoes"
  | "rotas"
  | "agendamentos"
  | "manutencoes";

type Secao = {
  id: SecaoId;
  titulo: string;
  colunas: Coluna[];
  linhas: Registro[];
  observacao?: string;
};

const opcoesSecoes: { id: SecaoId; titulo: string; descricao: string }[] = [
  { id: "funcionario", titulo: "Dados do funcionário", descricao: "Cadastro, cargo e situação atual" },
  { id: "diarias", titulo: "Diárias", descricao: "Valores e registros de diárias" },
  { id: "faltas", titulo: "Faltas e ocorrências", descricao: "Faltas, atestados, folgas e licenças" },
  { id: "carregamentos", titulo: "Carregamentos", descricao: "Cargas, motoristas, ajudantes e caminhões" },
  { id: "caminhoes", titulo: "Caminhões", descricao: "Cadastro e situação da frota" },
  { id: "rotas", titulo: "Rotas", descricao: "Rotas cadastradas e programadas" },
  { id: "agendamentos", titulo: "Agendamentos", descricao: "Agendamentos disponíveis para sua conta" },
  { id: "manutencoes", titulo: "Manutenções", descricao: "Manutenções disponíveis para sua conta" },
];

const dinheiro = (valor: unknown) => formatCurrency(Number(valor ?? 0));

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return String(valor);
}

function dataISO(valor: unknown): string {
  if (!valor) return "";

  const bruto = String(valor).trim();

  const brasileira = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brasileira) {
    return `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(bruto)) {
    return bruto.slice(0, 10);
  }

  const data = new Date(bruto);
  if (Number.isNaN(data.getTime())) return "";

  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function dataBR(valor: unknown): string {
  const iso = dataISO(valor);
  return iso ? iso.split("-").reverse().join("/") : "—";
}

function relacao(registro: Registro, chave: string): Registro {
  const valor = registro[chave];
  return valor && typeof valor === "object" ? valor as Registro : {};
}

function dentroDoPeriodo(valor: unknown, inicio: string, fim: string) {
  const dia = dataISO(valor);
  if (!dia) return !inicio && !fim;
  return (!inicio || dia >= inicio) && (!fim || dia <= fim);
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

function tabela(
  id: SecaoId,
  titulo: string,
  colunas: Coluna[],
  linhas: Registro[],
  observacao?: string,
): Secao {
  return { id, titulo, colunas, linhas, observacao };
}

function formatarCelula(chave: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (chave === "valor" || chave === "total") return dinheiro(valor);

  // As datas das linhas já são convertidas para o formato brasileiro.
  // Não converter novamente, para evitar inverter dia e mês.
  if (chave.toLowerCase().includes("data")) return String(valor);

  if (typeof valor === "number") return valor.toLocaleString("pt-BR");
  return String(valor);
}

function colunaVisivelNaImpressao(
  secaoId: string,
  coluna: Coluna,
  preferencias: Record<string, boolean>,
): boolean {
  const chave = `${secaoId}.${coluna.key}`;

  if (Object.prototype.hasOwnProperty.call(preferencias, chave)) {
    return preferencias[chave];
  }

  // Por padrão, não imprimir observações das diárias.
  return !(secaoId === "diarias" && coluna.key === "observacao");
}

export default function RelatoriosPage() {
  const [secoesSelecionadas, setSecoesSelecionadas] = useState<SecaoId[]>([
    "funcionario", "diarias", "faltas", "carregamentos",
  ]);
  const [funcionarios, setFuncionarios] = useState<Registro[]>([]);
  const [funcionarioId, setFuncionarioId] = useState("");
  const [caminhaoId, setCaminhaoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [colunasImpressao, setColunasImpressao] = useState<Record<string, boolean>>({});
  const [emissao, setEmissao] = useState("");
  const [relatorios, setRelatorios] = useState<Secao[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gerado, setGerado] = useState(false);
  const [baixarAberto, setBaixarAberto] = useState(false);
  const requisicaoAtual = useRef(0);

  const periodo = useMemo(() => {
    if (dataInicio && dataFim) {
      return `${dataBR(dataInicio)} a ${dataBR(dataFim)}`;
    }
    if (dataInicio) return `A partir de ${dataBR(dataInicio)}`;
    if (dataFim) return `Até ${dataBR(dataFim)}`;
    return "Todo o período disponível";
  }, [dataInicio, dataFim]);

  useEffect(() => {
    let ativo = true;
    consultar("/api/funcionarios")
      .then((dados) => {
        if (ativo) setFuncionarios(dados);
      })
      .catch(() => {
        if (ativo) setFuncionarios([]);
      });
    return () => { ativo = false; };
  }, []);

  const alternarSecao = useCallback((id: SecaoId) => {
    setSecoesSelecionadas((atual) =>
      atual.includes(id)
        ? atual.filter((item) => item !== id)
        : [...atual, id],
    );
  }, []);

  const gerarRelatorio = useCallback(async () => {
    const id = ++requisicaoAtual.current;
    setLoading(true);
    setError("");
    setGerado(false);

    try {
      if (secoesSelecionadas.length === 0) {
        throw new Error("Selecione pelo menos uma seção para gerar o relatório.");
      }

      const precisa = (secao: SecaoId) => secoesSelecionadas.includes(secao);
      const endpoints: Partial<Record<SecaoId, string>> = {
        diarias: "/api/diarias",
        faltas: "/api/faltas",
        carregamentos: "/api/carregamentos",
        caminhoes: "/api/caminhoes",
        rotas: "/api/rotas",
        agendamentos: "/api/agendamentos",
        manutencoes: "/api/manutencoes",
      };

      const ids = Object.keys(endpoints) as SecaoId[];
      const resultados = await Promise.all(
        ids.map(async (secao) => {
          if (!precisa(secao)) return [secao, []] as const;
          return [secao, await consultar(endpoints[secao]!)] as const;
        }),
      );

      if (id !== requisicaoAtual.current) return;

      const dados = Object.fromEntries(resultados) as Partial<Record<SecaoId, Registro[]>>;
      const escolhido = funcionarios.find((f) => texto(f.id) === funcionarioId);
      const filtrarFuncionario = Boolean(funcionarioId);

      const pertenceFuncionario = (registro: Registro) => {
        if (!filtrarFuncionario) return true;
        const funcionario = relacao(registro, "funcionario");
        return texto(funcionario.id) === funcionarioId;
      };

      const diarias = (dados.diarias ?? []).filter((r) =>
        dentroDoPeriodo(r.data, dataInicio, dataFim) && pertenceFuncionario(r),
      );

      const faltas = (dados.faltas ?? []).filter((r) =>
        dentroDoPeriodo(r.data, dataInicio, dataFim) && pertenceFuncionario(r),
      );

      const carregamentos = (dados.carregamentos ?? []).filter((r) => {
        if (!dentroDoPeriodo(r.data, dataInicio, dataFim)) return false;
        if (caminhaoId && texto(relacao(r, "caminhao").id) !== caminhaoId) return false;
        if (!filtrarFuncionario) return true;
        return (
          texto(relacao(r, "motorista").id) === funcionarioId ||
          texto(relacao(r, "ajudante").id) === funcionarioId
        );
      });

      const caminhoes = (dados.caminhoes ?? []).filter((r) =>
        !caminhaoId || texto(r.id) === caminhaoId,
      );

      const rotas = (dados.rotas ?? []).filter((r) =>
        dentroDoPeriodo(r.dataProgramada || r.createdAt, dataInicio, dataFim) &&
        (!caminhaoId || texto(relacao(r, "caminhao").id) === caminhaoId),
      );

      const agendamentos = (dados.agendamentos ?? []).filter((r) =>
        dentroDoPeriodo(r.dataHora, dataInicio, dataFim) &&
        (!caminhaoId || texto(r.caminhaoId) === caminhaoId),
      );

      const manutencoes = (dados.manutencoes ?? []).filter((r) =>
        dentroDoPeriodo(r.dataHora || r.createdAt, dataInicio, dataFim) &&
        (!caminhaoId || texto(r.caminhaoId) === caminhaoId),
      );

      const novasSecoes: Secao[] = [];
      const novosAvisos: string[] = [];

      if (precisa("funcionario")) {
        const lista = filtrarFuncionario
          ? (escolhido ? [escolhido] : [])
          : funcionarios;

        novasSecoes.push(tabela(
          "funcionario",
          "Dados dos funcionários",
          [
            { key: "nome", label: "Funcionário" },
            { key: "cargo", label: "Cargo" },
            { key: "status", label: "Situação" },
            { key: "admissao", label: "Data de admissão" },
          ],
          lista.map((f) => ({
            nome: texto(f.nome),
            cargo: texto(relacao(f, "cargo").nome),
            status: texto(f.status),
            admissao: dataBR(f.dataAdmissao),
          })),
        ));
      }

      if (precisa("diarias")) {
        novasSecoes.push(tabela(
          "diarias",
          "Diárias",
          [
            { key: "data", label: "Data" },
            { key: "funcionario", label: "Funcionário" },
            { key: "caminhao", label: "Caminhão" },
            { key: "valor", label: "Valor" },
            { key: "observacao", label: "Observação" },
          ],
          diarias.map((r) => ({
            data: dataBR(r.data),
            funcionario: texto(relacao(r, "funcionario").nome),
            caminhao: texto(relacao(r, "caminhao").placa),
            valor: Number(r.valor ?? 0),
            observacao: texto(r.observacao),
          })),
        ));
      }

      if (precisa("faltas")) {
        const nomes: Record<string, string> = {
          FALTA: "Falta", ATESTADO: "Atestado", FOLGA: "Folga",
          LICENCA: "Licença", OUTRO: "Outro",
        };
        novasSecoes.push(tabela(
          "faltas",
          "Faltas e ocorrências",
          [
            { key: "data", label: "Data" },
            { key: "funcionario", label: "Funcionário" },
            { key: "tipo", label: "Tipo" },
            { key: "justificativa", label: "Justificativa" },
          ],
          faltas.map((r) => ({
            data: dataBR(r.data),
            funcionario: texto(relacao(r, "funcionario").nome),
            tipo: nomes[String(r.tipo)] || texto(r.tipo),
            justificativa: texto(r.justificativa),
          })),
        ));
      }

      if (precisa("carregamentos")) {
        novasSecoes.push(tabela(
          "carregamentos",
          "Carregamentos",
          [
            { key: "data", label: "Data" },
            { key: "caminhao", label: "Caminhão" },
            { key: "motorista", label: "Motorista" },
            { key: "ajudante", label: "Ajudante" },
            { key: "origem", label: "Origem" },
            { key: "destino", label: "Destino" },
            { key: "peso", label: "Peso (kg)" },
            { key: "status", label: "Status" },
          ],
          carregamentos.map((r) => ({
            data: dataBR(r.data),
            caminhao: texto(relacao(r, "caminhao").placa),
            motorista: texto(relacao(r, "motorista").nome),
            ajudante: texto(relacao(r, "ajudante").nome),
            origem: texto(r.origem),
            destino: texto(r.destino),
            peso: Number(r.pesoTotal ?? 0),
            status: texto(r.status),
          })),
          carregamentos.length >= 100
            ? "A API retornou 100 registros. O período pode conter outros carregamentos não incluídos."
            : undefined,
        ));
        if (carregamentos.length >= 100) {
          novosAvisos.push("Carregamentos: a API possui limite de 100 registros por consulta.");
        }
      }

      if (precisa("caminhoes")) {
        novasSecoes.push(tabela(
          "caminhoes",
          "Caminhões",
          [
            { key: "placa", label: "Placa" },
            { key: "marca", label: "Marca" },
            { key: "modelo", label: "Modelo" },
            { key: "ano", label: "Ano" },
            { key: "capacidade", label: "Capacidade (kg)" },
            { key: "status", label: "Situação" },
          ],
          caminhoes.map((r) => ({
            placa: texto(r.placa),
            marca: texto(r.marca),
            modelo: texto(r.modelo),
            ano: texto(r.ano),
            capacidade: Number(r.capacidadeKg ?? 0),
            status: texto(r.status),
          })),
        ));
      }

      if (precisa("rotas")) {
        novasSecoes.push(tabela(
          "rotas",
          "Rotas",
          [
            { key: "nome", label: "Rota" },
            { key: "data", label: "Data programada" },
            { key: "caminhao", label: "Caminhão" },
            { key: "origem", label: "Origem" },
            { key: "destino", label: "Destino" },
            { key: "distancia", label: "Distância (km)" },
            { key: "status", label: "Status" },
          ],
          rotas.map((r) => ({
            nome: texto(r.nome),
            data: dataBR(r.dataProgramada || r.createdAt),
            caminhao: texto(relacao(r, "caminhao").placa),
            origem: texto(r.origem),
            destino: texto(r.destino),
            distancia: Number(r.distanciaKm ?? 0),
            status: texto(r.status),
          })),
          rotas.length >= 100
            ? "A API retornou 100 registros. O período pode conter outras rotas não incluídas."
            : undefined,
        ));
        if (rotas.length >= 100) {
          novosAvisos.push("Rotas: a API possui limite de 100 registros por consulta.");
        }
      }

      if (precisa("agendamentos")) {
        novasSecoes.push(tabela(
          "agendamentos",
          "Agendamentos",
          [
            { key: "data", label: "Data e hora" },
            { key: "caminhao", label: "Caminhão" },
            { key: "origem", label: "Origem" },
            { key: "destino", label: "Destino" },
            { key: "peso", label: "Peso (kg)" },
            { key: "status", label: "Status" },
          ],
          agendamentos.map((r) => ({
            data: r.dataHora ? new Date(String(r.dataHora)).toLocaleString("pt-BR") : "—",
            caminhao: texto(relacao(r, "caminhao").placa),
            origem: texto(r.origem),
            destino: texto(r.destino),
            peso: Number(r.peso ?? 0),
            status: texto(r.status),
          })),
          "Exibe os agendamentos disponíveis para a conta atualmente conectada.",
        ));
      }

      if (precisa("manutencoes")) {
        novasSecoes.push(tabela(
          "manutencoes",
          "Manutenções programadas",
          [
            { key: "descricao", label: "Descrição" },
            { key: "caminhao", label: "Caminhão" },
            { key: "data", label: "Data" },
            { key: "quilometragem", label: "Quilometragem alvo" },
            { key: "status", label: "Status" },
          ],
          manutencoes.map((r) => ({
            descricao: texto(r.descricao),
            caminhao: texto(relacao(r, "caminhao").placa),
            data: dataBR(r.dataHora || r.createdAt),
            quilometragem: r.quilometragemAlvo == null ? "—" : Number(r.quilometragemAlvo),
            status: texto(r.status),
          })),
          "Exibe as manutenções disponíveis para a conta atualmente conectada.",
        ));
      }

      if (id !== requisicaoAtual.current) return;
      setRelatorios(novasSecoes);
      setAvisos(novosAvisos);
      setEmissao(new Date().toLocaleString("pt-BR"));
      setGerado(true);
    } catch (erro) {
      if (id !== requisicaoAtual.current) return;
      setError(erro instanceof Error ? erro.message : "Não foi possível gerar o relatório.");
    } finally {
      if (id === requisicaoAtual.current) setLoading(false);
    }
  }, [
    secoesSelecionadas, funcionarios, funcionarioId, caminhaoId,
    dataInicio, dataFim,
  ]);

  useEffect(() => {
    if (funcionarios.length > 0 || !secoesSelecionadas.includes("funcionario")) {
      void gerarRelatorio();
    }
  }, [gerarRelatorio, funcionarios.length]);

  async function exportarExcel() {
    if (!relatorios.length) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const capa = [
      ["LOGÍSTICAS BILL"],
      ["Relatório personalizado"],
      [`Período: ${periodo}`],
      [`Emitido em: ${emissao}`],
      [`Funcionário: ${texto(texto(funcionarios.find((f) => texto(f.id) === funcionarioId)?.nome ?? "Todos"))}`],
      [`Caminhão: ${caminhaoId ? "Filtrado" : "Todos"}`],
      [],
      ["Seções incluídas"],
      ...relatorios.map((s) => [s.titulo, s.linhas.length]),
      [],
      ...avisos.map((a) => [a]),
    ];
    const wsCapa = XLSX.utils.aoa_to_sheet(capa);
    wsCapa["!cols"] = [{ wch: 38 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsCapa, "Resumo");

    for (const secao of relatorios) {
      const linhas = [
        [secao.titulo],
        [`Período: ${periodo}`],
        [],
        secao.colunas.map((c) => c.label),
        ...secao.linhas.map((linha) =>
          secao.colunas.map((c) => formatarCelula(c.key, linha[c.key])),
        ),
      ];
      if (secao.observacao) linhas.push([], [secao.observacao]);
      const ws = XLSX.utils.aoa_to_sheet(linhas);
      ws["!cols"] = secao.colunas.map((c) => ({
        wch: Math.min(36, Math.max(c.label.length + 3, 16)),
      }));
      const nome = secao.titulo.slice(0, 31).replace(/[\\/?*[\]]/g, "");
      XLSX.utils.book_append_sheet(wb, ws, nome || "Dados");
    }

    XLSX.writeFile(wb, "relatorio-logisticas-bill.xlsx");
  }

  return (
    <div className="reports-page min-w-0 w-full space-y-4 sm:space-y-6">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 4mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          #report-print, #report-print * { visibility: visible !important; }
          #report-print {
            position: static !important;
            width: calc(100% + 48px) !important;
            max-width: none !important;
            margin: 0 -24px !important;
            padding: 0 !important;
            color: #111 !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
          #report-print .report-section { break-inside: auto; margin-bottom: 10px; }
          #report-print table {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 7.5pt !important;
          }
          #report-print .print-hide {
            display: none !important;
          }
          #report-print th, #report-print td {
            border: 0.5pt solid #c8c8c8 !important;
            padding: 1px 2px !important;
            color: #111 !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
          }
          #report-print th { background: #eee !important; }
          #report-print thead { display: table-header-group; }
          #report-print tr { break-inside: avoid; }
          #report-print .report-summary { border: 0 !important; }
          #report-print .report-summary > div {
            border: 1px solid #e5e7eb !important;
          }
          #report-print .report-note { color: #444 !important; }
        }
      `}</style>

      <div className="no-print">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Relatórios</h1>
        <p className="text-muted-foreground">
          Monte relatórios personalizados, confira os dados e exporte somente o que precisa.
        </p>
      </div>

      <ScreenAssembly
        className="grid min-w-0 grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-5"
        itemClassNames={["no-print min-w-0 lg:col-span-2", "min-w-0 lg:col-span-3"]}
      >
        <Card className="no-print min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileBarChart className="h-5 w-5" />
              Configurar relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Informações que deseja incluir</Label>
              <div className="space-y-2">
                {opcoesSecoes.map((opcao) => (
                  <label
                    key={opcao.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      secoesSelecionadas.includes(opcao.id)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-primary"
                      checked={secoesSelecionadas.includes(opcao.id)}
                      onChange={() => alternarSecao(opcao.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{opcao.titulo}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {opcao.descricao}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div>
                <Label>Colunas que aparecem na impressão / PDF</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escolha individualmente o que será impresso. A pré-visualização e o Excel continuam completos.
                </p>
              </div>

              {relatorios.map((secao) => (
                <div key={secao.id} className="space-y-2 border-t pt-3">
                  <p className="text-sm font-semibold">{secao.titulo}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {secao.colunas.map((coluna) => {
                      const chave = `${secao.id}.${coluna.key}`;
                      return (
                        <label
                          key={chave}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={colunaVisivelNaImpressao(
                              secao.id,
                              coluna,
                              colunasImpressao,
                            )}
                            onChange={(e) =>
                              setColunasImpressao((anterior) => ({
                                ...anterior,
                                [chave]: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-input"
                          />
                          {coluna.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {relatorios.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Atualize o relatório para configurar suas colunas.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="relatorio-funcionario">Funcionário específico</Label>
              <select
                id="relatorio-funcionario"
                value={funcionarioId}
                onChange={(e) => setFuncionarioId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos os funcionários</option>
                {funcionarios.map((f) => (
                  <option key={texto(f.id)} value={texto(f.id)}>
                    {texto(f.nome)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Ao escolher alguém, diárias, ocorrências e carregamentos serão filtrados por essa pessoa.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relatorio-caminhao">Caminhão</Label>
              <select
                id="relatorio-caminhao"
                value={caminhaoId}
                onChange={(e) => setCaminhaoId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos os caminhões</option>
                {/* A seleção de caminhão é aplicada aos módulos operacionais. */}
                {relatorios.find((s) => s.id === "caminhoes")?.linhas.map((r, i) => (
                  <option key={`${texto(r.placa)}-${i}`} value={texto(r.id)}>
                    {texto(r.placa)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                O filtro é aplicado aos registros que possuem vínculo com caminhão.
              </p>
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
              onClick={() => void gerarRelatorio()}
              disabled={loading || secoesSelecionadas.length === 0}
            >
              <FileBarChart className="mr-2 h-4 w-4" />
              Atualizar relatório
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setBaixarAberto(true)}
              disabled={loading || !gerado || relatorios.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar relatório
            </Button>

            <Dialog open={baixarAberto} onOpenChange={setBaixarAberto}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Exportar relatório</DialogTitle>
                  <DialogDescription>
                    Os formatos abaixo utilizarão exatamente as seções e os filtros da pré-visualização.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    onClick={async () => {
                      await exportarExcel();
                      setBaixarAberto(false);
                    }}
                    disabled={!relatorios.length}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel (.xlsx)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBaixarAberto(false);
                      window.setTimeout(() => window.print(), 150);
                    }}
                    disabled={!relatorios.length}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    PDF / Imprimir
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Para gerar PDF, escolha “Salvar como PDF” na janela de impressão.
                </p>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-3">
          <CardHeader className="no-print">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              Pré-visualização
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
                <strong>Não foi possível gerar o relatório.</strong>
                <p className="mt-1">{error}</p>
                <p className="mt-2 text-muted-foreground">
                  Confira sua sessão e tente novamente.
                </p>
              </div>
            ) : loading ? (
              <div role="status" aria-busy="true" className="space-y-5 py-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !gerado ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <FileDown className="h-10 w-10" />
                <p className="font-medium">Configure seu relatório.</p>
                <p className="max-w-sm text-sm">
                  Selecione as informações desejadas e atualize a pré-visualização.
                </p>
              </div>
            ) : (
              <div id="report-print" className="min-w-0 space-y-6">
                <div className="border-b pb-4">
                  <div className="flex items-center gap-4">
                    <Logo className="h-12 w-12 shrink-0 sm:h-16 sm:w-16" />
                    <div>
                      <h2 className="text-xl font-bold sm:text-2xl">Logísticas Bill</h2>
                      <p className="text-sm font-medium text-muted-foreground">Controle Operacional</p>
                    </div>
                  </div>
                  <div className="mt-4 border-t pt-3">
                    <h3 className="text-base font-semibold">Relatório personalizado</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Período</p>
                        <p className="text-sm">{periodo}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Emissão</p>
                        <p className="text-sm">{emissao}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Funcionário</p>
                        <p className="text-sm">
                          {texto(texto(funcionarios.find((f) => texto(f.id) === funcionarioId)?.nome ?? "Todos"))}
                        </p>
                      </div>
                      <div className="no-print"><p className="text-xs text-muted-foreground">Seções selecionadas</p>
                        <p className="text-sm">{relatorios.length}</p></div>
                    </div>
                  </div>
                </div>

                <div className="report-summary grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Seções no relatório</p>
                    <p className="mt-1 text-xl font-bold">{relatorios.length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Total de registros</p>
                    <p className="mt-1 text-xl font-bold">
                      {relatorios.reduce((s, r) => s + r.linhas.length, 0).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Filtros de funcionário</p>
                    <p className="mt-1 text-xl font-bold">{funcionarioId ? "Individual" : "Todos"}</p>
                  </div>
                </div>

                {avisos.length > 0 && (
                  <div className="report-note rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="h-4 w-4" />
                      Atenção aos limites dos dados
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
                    </ul>
                  </div>
                )}

                {relatorios.map((secao) => (
                  <section key={secao.id} className="report-section min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                      <h3 className="text-base font-bold">{secao.titulo}</h3>
                      <span className="text-xs text-muted-foreground">
                        {secao.linhas.length.toLocaleString("pt-BR")} registro(s)
                      </span>
                    </div>

                    {secao.observacao && (
                      <p className="report-note text-xs text-amber-700 dark:text-amber-400">
                        {secao.observacao}
                      </p>
                    )}

                    <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-0 text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            {secao.colunas.map((coluna) => (
                              <th
                                key={coluna.key}
                                className={`whitespace-nowrap p-3 text-left font-semibold ${
                                  colunaVisivelNaImpressao(secao.id, coluna, colunasImpressao)
                                    ? ""
                                    : "print-hide"
                                }`}
                              >
                                {coluna.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {secao.linhas.length === 0 ? (
                            <tr>
                              <td
                                colSpan={secao.colunas.length}
                                className="p-6 text-center text-muted-foreground"
                              >
                                Nenhum registro encontrado para os filtros selecionados.
                              </td>
                            </tr>
                          ) : secao.linhas.map((linha, i) => (
                            <tr key={i} className="border-t">
                              {secao.colunas.map((coluna) => (
                                <td
                                  key={coluna.key}
                                  className={`p-3 align-top ${
                                    colunaVisivelNaImpressao(secao.id, coluna, colunasImpressao)
                                      ? ""
                                      : "print-hide"
                                  }`}
                                >
                                  {formatarCelula(coluna.key, linha[coluna.key])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}

                <footer className="border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>Documento emitido pelo sistema Logísticas Bill.</span>
                    <span>Período: {periodo}</span>
                  </div>
                </footer>
              </div>
            )}
          </CardContent>
        </Card>
      </ScreenAssembly>
    </div>
  );
}