"use client";

import { useState } from "react";
import { FileBarChart, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const tipos = [
  { id: "diario", label: "Diárias" },
  { id: "funcionario", label: "Por Funcionário" },
  { id: "caminhao", label: "Por Caminhão" },
  { id: "falta", label: "Faltas" },
  { id: "carregamento", label: "Carregamentos" },
  { id: "geral", label: "Geral do Sistema" },
];

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState("diario");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Relatórios profissionais e completos de todo o sistema
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Controles esquerda */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Configurar Relatório</CardTitle>
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
                <Label>Data início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1">
                <FileBarChart className="mr-2 h-4 w-4" />
                Gerar
              </Button>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pré-visualização direita */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">
              Pré-visualização — {tipos.find((t) => t.id === tipo)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tipo === "diario" ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <FileBarChart className="h-8 w-8" />
                <p className="font-medium">Nenhuma diária cadastrada</p>
                <p className="text-sm">O total será exibido quando houver diárias registradas.</p>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
                Selecione o período e clique em Gerar para visualizar o relatório de{" "}
                {tipos.find((t) => t.id === tipo)?.label.toLowerCase()}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
