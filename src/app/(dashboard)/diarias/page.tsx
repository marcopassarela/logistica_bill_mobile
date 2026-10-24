"use client";

import { useState } from "react";
import { Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

const mockDiarias = [
  { id: "1", funcionario: "João Silva", caminhao: "ABC-1D23", data: "2026-10-23", valor: 350, obs: "" },
  { id: "2", funcionario: "Maria Oliveira", caminhao: "XYZ-9K87", data: "2026-10-23", valor: 280, obs: "Ajuda extra" },
  { id: "3", funcionario: "João Silva", caminhao: "DEF-4M56", data: "2026-10-22", valor: 350, obs: "" },
  { id: "4", funcionario: "Carlos Souza", caminhao: "—", data: "2026-10-21", valor: 200, obs: "Folga remunerada" },
];

export default function DiariasPage() {
  const [funcionario, setFuncionario] = useState("");
  const [caminhao, setCaminhao] = useState("");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  const total = mockDiarias.reduce((acc, d) => acc + d.valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Diárias</h1>
        <p className="text-muted-foreground">Controle profissional de diárias por funcionário e caminhão</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Formulário esquerda */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Registrar Diária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Input
                value={funcionario}
                onChange={(e) => setFuncionario(e.target.value)}
                placeholder="Selecione ou digite"
              />
            </div>
            <div className="space-y-2">
              <Label>Caminhão (opcional)</Label>
              <Input
                value={caminhao}
                onChange={(e) => setCaminhao(e.target.value)}
                placeholder="Placa"
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <Button className="w-full">
              <CalendarDays className="mr-2 h-4 w-4" />
              Salvar Diária
            </Button>
          </CardContent>
        </Card>

        {/* Pré-visualização direita */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pré-visualização das Diárias</CardTitle>
            <span className="text-sm font-semibold text-primary">
              Total: {formatCurrency(total)}
            </span>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockDiarias.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{d.funcionario}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(d.data)} • {d.caminhao}
                      {d.obs ? ` • ${d.obs}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold">{formatCurrency(d.valor)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
